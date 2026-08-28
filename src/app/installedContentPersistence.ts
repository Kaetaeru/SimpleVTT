import { parseManualCommonPlayOperationDefinition } from "../domain/commonPlayOperationRuntime";
import {
  INSTALLED_CONTENT_SCHEMA_ID,
  INSTALLED_CONTENT_SCHEMA_VERSION,
  type InstalledCatalogEntryV1,
  type InstalledContentDocumentV1,
  type InstalledContentStore,
} from "./installedContentContracts";
import { catalogQualifiedId } from "./contentCatalogIdentity";
import { parseInstalledCampaignProviderProfile } from "./campaignProviderProfiles";

const cp = <T,>(value:T):T => structuredClone(value);

function canonical(value:unknown):unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string,unknown>)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([key,item]) => [key,canonical(item)]));
  }
  return value;
}

function same(a:unknown,b:unknown) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function isObject(value:unknown):value is Record<string,unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertEntry(value:unknown):asserts value is InstalledCatalogEntryV1 {
  if (!isObject(value)) throw new Error("installed content entry must be an object");
  for (const field of ["contentId","nameKo","nameEn","sourceId","source","version","description"] as const) {
    if (typeof value[field] !== "string") throw new Error(`installed content entry ${field} is invalid`);
  }
  if (!value.contentId || !value.sourceId || !value.version) throw new Error("installed content identity is incomplete");
  const categories=["class","subclass","species","background","feat","spell","item","condition","combatant","option"];
  if (!categories.includes(String(value.category))) throw new Error(`installed content category is invalid: ${String(value.category)}`);
  if (!Array.isArray(value.relationships) || !Array.isArray(value.capabilities)) throw new Error("installed content collections are invalid");
  if(value.mechanics!==undefined) {
    if(!Array.isArray(value.mechanics)) throw new Error("installed content mechanics must be an array");
    value.mechanics.forEach((mechanic,index)=>{
      if(!isObject(mechanic)||mechanic.kind!=="common-play") throw new Error(`installed content mechanic ${index} is unsupported`);
      parseManualCommonPlayOperationDefinition(mechanic.config,`installed content mechanic ${index}.config`);
    });
  }
  if(value.campaignProvider!==undefined) parseInstalledCampaignProviderProfile(value.campaignProvider);
}

function sortedEntries(entries:InstalledCatalogEntryV1[]) {
  return [...entries].map(cp).sort((a,b) =>
    catalogQualifiedId(a.contentId,a.sourceId,a.version).localeCompare(
      catalogQualifiedId(b.contentId,b.sourceId,b.version),"en",
    ),
  );
}

export function decodeInstalledContentV1(payload:string):InstalledContentDocumentV1 {
  const parsed:unknown=JSON.parse(payload);
  if (!isObject(parsed)) throw new Error("installed content document must be an object");
  if (parsed.schemaId!==INSTALLED_CONTENT_SCHEMA_ID) throw new Error(`unsupported installed content schema: ${String(parsed.schemaId)}`);
  if (parsed.schemaVersion!==INSTALLED_CONTENT_SCHEMA_VERSION) throw new Error(`unsupported installed content version: ${String(parsed.schemaVersion)}`);
  if (!Number.isInteger(parsed.storageRevision) || Number(parsed.storageRevision)<0) throw new Error("installed content storageRevision is invalid");
  if (!Array.isArray(parsed.entries)) throw new Error("installed content entries must be an array");
  parsed.entries.forEach(assertEntry);
  const ids=new Set<string>();
  for (const entry of parsed.entries) {
    const id=catalogQualifiedId(entry.contentId,entry.sourceId,entry.version);
    if (ids.has(id)) throw new Error(`duplicate installed content qualified identity: ${id}`);
    ids.add(id);
  }
  return {
    schemaId:INSTALLED_CONTENT_SCHEMA_ID,
    schemaVersion:INSTALLED_CONTENT_SCHEMA_VERSION,
    storageRevision:Number(parsed.storageRevision),
    entries:sortedEntries(parsed.entries),
  };
}

export class InstalledContentSchemaError extends Error {}
export class InstalledContentMigrationRequiredError extends Error {
  constructor(readonly schemaVersion:unknown) {
    super(`Installed content schema version ${String(schemaVersion)} requires an explicit migration`);
  }
}

export function decodeInstalledContent(payload:string):InstalledContentDocumentV1 {
  const parsed:unknown=JSON.parse(payload);
  if (!isObject(parsed)) throw new Error("installed content document must be an object");
  if (parsed.schemaId!==INSTALLED_CONTENT_SCHEMA_ID) throw new InstalledContentSchemaError(`unsupported installed content schema: ${String(parsed.schemaId)}`);
  switch(parsed.schemaVersion) {
    case INSTALLED_CONTENT_SCHEMA_VERSION: return decodeInstalledContentV1(payload);
    default: throw new InstalledContentMigrationRequiredError(parsed.schemaVersion);
  }
}

export function encodeInstalledContentV1(document:InstalledContentDocumentV1) {
  return JSON.stringify(canonical({ ...document,entries:sortedEntries(document.entries) }),null,2);
}

function initialDocument():InstalledContentDocumentV1 {
  return {
    schemaId:INSTALLED_CONTENT_SCHEMA_ID,
    schemaVersion:INSTALLED_CONTENT_SCHEMA_VERSION,
    storageRevision:0,
    entries:[],
  };
}

export interface InstalledContentHydration {
  document:InstalledContentDocumentV1;
  physicalGeneration:number;
  loadedGeneration:number|null;
  recoveredFromOlderGeneration:boolean;
  changed:boolean;
}

export type InstalledContentInstallResult=
  | {status:"committed";hydration:InstalledContentHydration}
  | {status:"conflict";error:string;qualifiedId:string};

export class InstalledContentCorruptError extends Error {}

export class InstalledContentRepository {
  private document:InstalledContentDocumentV1|null=null;
  private physicalGeneration=0;
  private loadedGeneration:number|null=null;

  constructor(private readonly store:InstalledContentStore) {}
  get durability() { return this.store.durability; }

  private result(recovered=false,changed=false):InstalledContentHydration {
    if (!this.document) throw new Error("installed content repository is not hydrated");
    return {
      document:cp(this.document),
      physicalGeneration:this.physicalGeneration,
      loadedGeneration:this.loadedGeneration,
      recoveredFromOlderGeneration:recovered,
      changed,
    };
  }

  async hydrate():Promise<InstalledContentHydration> {
    const generations=(await this.store.readGenerations()).sort((a,b)=>b.generation-a.generation);
    this.physicalGeneration=generations[0]?.generation ?? 0;
    for (const generation of generations) {
      if (generation.payload===null) continue;
      try {
        const document=decodeInstalledContent(generation.payload);
        if (document.storageRevision!==generation.generation) continue;
        this.document=document;
        this.loadedGeneration=generation.generation;
        return this.result(generation.generation<this.physicalGeneration,false);
      } catch(error) {
        if (error instanceof InstalledContentMigrationRequiredError || error instanceof InstalledContentSchemaError) throw error;
      }
    }
    if (generations.length) throw new InstalledContentCorruptError("no valid committed installed-content generation remains");
    this.document=initialDocument();
    this.loadedGeneration=null;
    return this.result(false,false);
  }

  async install(entry:InstalledCatalogEntryV1):Promise<InstalledContentInstallResult> {
    return this.installMany([entry]);
  }

  async installMany(entries:InstalledCatalogEntryV1[]):Promise<InstalledContentInstallResult> {
    if (!this.document) throw new Error("installed content repository must hydrate before install");
    if (!entries.length) return {status:"committed",hydration:this.result(false,false)};

    const incoming=new Map<string,InstalledCatalogEntryV1>();
    for (const entry of entries) {
      assertEntry(entry);
      const qualifiedId=catalogQualifiedId(entry.contentId,entry.sourceId,entry.version);
      if (incoming.has(qualifiedId)) {
        return {status:"conflict",qualifiedId,error:`Installed content package contains duplicate qualified identity: ${qualifiedId}`};
      }
      incoming.set(qualifiedId,entry);
    }

    const existingById=new Map(this.document.entries.map((entry)=>[
      catalogQualifiedId(entry.contentId,entry.sourceId,entry.version),entry,
    ]));
    const additions:InstalledCatalogEntryV1[]=[];
    for (const [qualifiedId,entry] of incoming) {
      const existing=existingById.get(qualifiedId);
      if (!existing) { additions.push(entry); continue; }
      if (!same(existing,entry)) {
        return {status:"conflict",qualifiedId,error:`Installed content conflict for ${qualifiedId}: same qualified identity has a different payload`};
      }
    }
    if (!additions.length) return {status:"committed",hydration:this.result(false,false)};

    const nextGeneration=this.physicalGeneration+1;
    const next:InstalledContentDocumentV1={
      schemaId:INSTALLED_CONTENT_SCHEMA_ID,
      schemaVersion:INSTALLED_CONTENT_SCHEMA_VERSION,
      storageRevision:nextGeneration,
      entries:sortedEntries([...this.document.entries,...additions]),
    };
    await this.store.writeGeneration(this.physicalGeneration,nextGeneration,encodeInstalledContentV1(next));
    this.document=next;
    this.physicalGeneration=nextGeneration;
    this.loadedGeneration=nextGeneration;
    return {status:"committed",hydration:this.result(false,true)};
  }

  snapshot() { return this.document ? cp(this.document) : null; }
}
