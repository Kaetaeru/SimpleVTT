import type { CatalogEntry } from "./contracts";
import type {
  InstalledCatalogEntryV1,
  InstalledContentRelationshipV1,
  InstalledModuleExtensionPointV1,
  InstalledModuleManifestV1,
  InstalledModuleRefV1,
} from "./installedContentContracts";
import { parseInstalledPortableMechanics } from "./portableCommonPlayMechanics";

const cp = <T,>(value:T):T => structuredClone(value);

function component(value:string) {
  return encodeURIComponent(value.trim());
}

export function catalogQualifiedId(contentId:string,sourceId:string,version:string) {
  return `content:${component(sourceId)}@${component(version)}#${component(contentId)}`;
}

export function builtinCatalogSourceId(entry:CatalogEntry) {
  if (entry.sourceId?.trim()) return entry.sourceId.trim();
  if (entry.source === "SRD 5.2.1") return "dnd.srd-5.2.1";
  throw new Error(`Builtin catalog entry is missing a stable source identity: ${entry.id} / ${entry.source}`);
}

function object(value:unknown):Record<string,unknown>|undefined {
  return value && typeof value==="object" && !Array.isArray(value) ? value as Record<string,unknown> : undefined;
}
function strings(value:unknown) { return Array.isArray(value) ? value.filter((item):item is string=>typeof item==="string") : []; }
function moduleRefs(value:unknown):InstalledModuleRefV1[] {
  return Array.isArray(value) ? value.flatMap((item)=>{
    const ref=object(item);
    return ref && typeof ref.moduleId==="string" && typeof ref.version==="string" ? [{moduleId:ref.moduleId,version:ref.version}] : [];
  }) : [];
}
function extensionPoints(value:unknown):InstalledModuleExtensionPointV1[] {
  return Array.isArray(value) ? value.flatMap((item)=>{
    const point=object(item);
    return point && typeof point.id==="string" ? [{id:point.id,acceptsCategories:strings(point.acceptsCategories)}] : [];
  }) : [];
}
function semanticRelationships(value:unknown):InstalledContentRelationshipV1[] {
  return Array.isArray(value) ? value.flatMap((item)=>{
    const relation=object(item);
    const kind=relation?.kind;
    if (!relation || (kind!=="parent"&&kind!=="extends"&&kind!=="replaces") || typeof relation.target!=="string") return [];
    return [{
      kind,
      target:relation.target,
      targetVersion:typeof relation.targetVersion==="string" ? relation.targetVersion : undefined,
      extensionPoint:typeof relation.extensionPoint==="string" ? relation.extensionPoint : undefined,
    }];
  }) : [];
}
function moduleManifest(value:unknown):InstalledModuleManifestV1|undefined {
  const module=object(value);
  const profile=object(module?.rulesProfile);
  if (!module || typeof module.moduleId!=="string" || typeof module.moduleVersion!=="string" || !profile || typeof profile.id!=="string" || typeof profile.version!=="string") return undefined;
  return {
    moduleId:module.moduleId,
    moduleVersion:module.moduleVersion,
    rulesProfile:{id:profile.id,version:profile.version},
    dependencies:moduleRefs(module.dependencies),
    conflicts:moduleRefs(module.conflicts),
    capabilities:strings(module.capabilities),
    extensionPoints:extensionPoints(module.extensionPoints),
  };
}

export function installedEntryFromPreview(entry:CatalogEntry):InstalledCatalogEntryV1 {
  const sourceId=entry.sourceId?.trim();
  const contentId=(entry.contentId ?? entry.id).trim();
  if (!contentId) throw new Error("Installed content is missing contentId");
  if (!sourceId) throw new Error("Installed content requires sourceId separate from display source");
  if (!entry.version.trim()) throw new Error("Installed content is missing version");
  return cp({
    contentId,
    category:entry.category,
    nameKo:entry.nameKo,
    nameEn:entry.nameEn,
    sourceId,
    source:entry.source,
    version:entry.version,
    description:entry.description,
    relationships:entry.relationships,
    capabilities:entry.capabilities,
    ...(entry.mechanics?{mechanics:entry.mechanics}:{}),
    ...(entry.campaignProvider?{campaignProvider:entry.campaignProvider}:{}),
  });
}

export function installedEntryFromPayload(entry:CatalogEntry,payload:string):InstalledCatalogEntryV1 {
  const installed=installedEntryFromPreview(entry);
  const raw=object(JSON.parse(payload));
  if (!raw) return installed;
  installed.requiresCapabilities=strings(raw.requiresCapabilities);
  if (typeof raw.requiresCapability==="string" && !installed.requiresCapabilities.includes(raw.requiresCapability)) installed.requiresCapabilities.push(raw.requiresCapability);
  installed.semanticRelationships=semanticRelationships(raw.relationships);
  installed.extensionPoints=extensionPoints(raw.extensionPoints);
  installed.module=moduleManifest(raw.module);
  const mechanics=parseInstalledPortableMechanics(raw.mechanics,"mechanics");
  if(mechanics.length) installed.mechanics=mechanics;
  return installed;
}

export function resolvedCatalogEntryFromInstalled(entry:InstalledCatalogEntryV1):CatalogEntry {
  return {
    id:catalogQualifiedId(entry.contentId,entry.sourceId,entry.version),
    contentId:entry.contentId,
    category:entry.category,
    nameKo:entry.nameKo,
    nameEn:entry.nameEn,
    scope:"local",
    sourceId:entry.sourceId,
    source:entry.source,
    version:entry.version,
    description:entry.description,
    relationships:cp(entry.relationships),
    capabilities:cp(entry.capabilities),
    ...(entry.mechanics?{mechanics:cp(entry.mechanics)}:{}),
    ...(entry.campaignProvider?{campaignProvider:cp(entry.campaignProvider)}:{}),
  };
}

export function resolvedBuiltinCatalogEntry(entry:CatalogEntry):CatalogEntry {
  const contentId=entry.contentId ?? entry.id;
  const sourceId=builtinCatalogSourceId(entry);
  return {
    ...cp(entry),
    id:catalogQualifiedId(contentId,sourceId,entry.version),
    contentId,
    sourceId,
    scope:"builtin",
  };
}

export function composeContentCatalog(
  builtin:CatalogEntry[],
  installed:InstalledCatalogEntryV1[],
):CatalogEntry[] {
  const resolved=[
    ...builtin.map(resolvedBuiltinCatalogEntry),
    ...installed.map(resolvedCatalogEntryFromInstalled),
  ];
  const seen=new Set<string>();
  for (const entry of resolved) {
    if (seen.has(entry.id)) throw new Error(`ContentCatalog qualified identity conflict: ${entry.id}`);
    seen.add(entry.id);
  }
  return resolved.sort((a,b) => a.id.localeCompare(b.id,"en"));
}