import type { CatalogEntry, ContentImportPreview, ValidationMessage } from "./contracts";
import { parseInstalledCampaignProviderProfile } from "./campaignProviderProfiles";
import { parseInstalledContentMechanics } from "./installedCommonPlayMechanics";
import type {
  InstalledCatalogEntryV1,
  InstalledContentRelationshipV1,
  InstalledModuleExtensionPointV1,
  InstalledModuleManifestV1,
  InstalledModuleRefV1,
} from "./installedContentContracts";

const CATEGORIES=new Set<InstalledCatalogEntryV1["category"]>(["class","subclass","species","background","feat","spell","item","condition","combatant","option"]);
const cp=<T,>(value:T):T=>structuredClone(value);

type Obj=Record<string,unknown>;
function object(value:unknown,label:string):Obj {
  if (!value || typeof value!=="object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Obj;
}
function string(value:unknown,label:string) {
  if (typeof value!=="string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}
function strings(value:unknown,label:string) {
  if (value===undefined) return [];
  if (!Array.isArray(value) || value.some((item)=>typeof item!=="string" || !item.trim())) throw new Error(`${label} must be an array of non-empty strings`);
  return value.map((item)=>String(item));
}
function moduleRefs(value:unknown,label:string):InstalledModuleRefV1[] {
  if (value===undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((item,index)=>{
    const ref=object(item,`${label}[${index}]`);
    return {moduleId:string(ref.moduleId,`${label}[${index}].moduleId`),version:string(ref.version,`${label}[${index}].version`)};
  });
}
function extensionPoints(value:unknown,label:string):InstalledModuleExtensionPointV1[] {
  if (value===undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((item,index)=>{
    const point=object(item,`${label}[${index}]`);
    return {id:string(point.id,`${label}[${index}].id`),acceptsCategories:strings(point.acceptsCategories,`${label}[${index}].acceptsCategories`)};
  });
}
function semanticRelationships(value:unknown,label:string):InstalledContentRelationshipV1[] {
  if (value===undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((item,index)=>{
    const relation=object(item,`${label}[${index}]`);
    const kind=relation.kind;
    if (kind!=="parent"&&kind!=="extends"&&kind!=="replaces") throw new Error(`${label}[${index}].kind is unsupported`);
    return {
      kind,
      target:string(relation.target,`${label}[${index}].target`),
      targetVersion:typeof relation.targetVersion==="string" ? relation.targetVersion : undefined,
      extensionPoint:typeof relation.extensionPoint==="string" ? relation.extensionPoint : undefined,
    };
  });
}

function presentation(raw:unknown,moduleDefaultLocale:string,label:string) {
  const value=object(raw,`${label}.presentation`);
  const defaultLocale=typeof value.defaultLocale==="string" ? value.defaultLocale : moduleDefaultLocale;
  const locales=object(value.locales,`${label}.presentation.locales`);
  const defaultEntry=object(locales[defaultLocale],`${label}.presentation.locales.${defaultLocale}`);
  const ko=locales.ko && typeof locales.ko==="object" && !Array.isArray(locales.ko) ? locales.ko as Obj : undefined;
  const en=locales.en && typeof locales.en==="object" && !Array.isArray(locales.en) ? locales.en as Obj : undefined;
  const nameKo=typeof ko?.name==="string" ? ko.name : string(defaultEntry.name,`${label}.presentation.locales.${defaultLocale}.name`);
  const nameEn=typeof value.originalName==="string" ? value.originalName : typeof en?.name==="string" ? en.name : nameKo;
  const description=[defaultEntry.description,defaultEntry.summary].find((item)=>typeof item==="string") as string|undefined;
  return {nameKo,nameEn,description:description ?? ""};
}

function relationshipViews(relationships:InstalledContentRelationshipV1[]) {
  const labels={parent:"상위",extends:"확장",replaces:"대체"} as const;
  return relationships.map((relationship)=>({label:labels[relationship.kind],targetId:relationship.target,targetName:relationship.target}));
}

export interface RuleModulePackagePreviewEntry {
  contentId:string;
  category:InstalledCatalogEntryV1["category"];
  nameKo:string;
  nameEn:string;
  validation:ValidationMessage[];
}
export interface RuleModulePackagePreviewVm {
  moduleId:string;
  moduleVersion:string;
  rulesProfile:{id:string;version:string};
  source:string;
  dependencies:InstalledModuleRefV1[];
  conflicts:InstalledModuleRefV1[];
  capabilities:string[];
  entries:RuleModulePackagePreviewEntry[];
}
export interface ParsedRuleModulePackage {
  module:InstalledModuleManifestV1;
  source:string;
  entries:InstalledCatalogEntryV1[];
  preview:RuleModulePackagePreviewVm;
}

export function looksLikeRuleModulePackage(payload:string) {
  try {
    const raw=JSON.parse(payload) as unknown;
    return Boolean(raw && typeof raw==="object" && !Array.isArray(raw) && Array.isArray((raw as Obj).content) && typeof (raw as Obj).moduleId==="string");
  } catch { return false; }
}

export function parseRuleModulePackage(payload:string):ParsedRuleModulePackage {
  const raw=object(JSON.parse(payload),"RuleModule package");
  if (raw.schemaVersion!=="0.1-draft") throw new Error(`RuleModule schemaVersion must be 0.1-draft`);
  const moduleId=string(raw.moduleId,"moduleId");
  const moduleVersion=string(raw.moduleVersion,"moduleVersion");
  const profile=object(raw.rulesProfile,"rulesProfile");
  const rulesProfile={id:string(profile.id,"rulesProfile.id"),version:string(profile.version,"rulesProfile.version")};
  const defaultLocale=string(raw.defaultLocale,"defaultLocale");
  const source=object(raw.source,"source");
  const sourceDocument=string(source.document,"source.document");
  string(source.version,"source.version");
  string(source.license,"source.license");
  if (typeof source.srdDerived!=="boolean") throw new Error("source.srdDerived must be boolean");
  const module:InstalledModuleManifestV1={
    moduleId,moduleVersion,rulesProfile,
    dependencies:moduleRefs(raw.dependencies,"dependencies"),
    conflicts:moduleRefs(raw.conflicts,"conflicts"),
    capabilities:strings(raw.capabilities,"capabilities"),
    extensionPoints:extensionPoints(raw.extensionPoints,"extensionPoints"),
  };
  if (!Array.isArray(raw.content) || !raw.content.length) throw new Error("RuleModule content must contain at least one entry");
  const entries=raw.content.map((item,index)=>{
    const value=object(item,`content[${index}]`);
    const contentId=string(value.id,`content[${index}].id`);
    const categoryRaw=string(value.category,`content[${index}].category`);
    if (!CATEGORIES.has(categoryRaw as InstalledCatalogEntryV1["category"])) throw new Error(`content[${index}].category is unsupported by the generic Catalog: ${categoryRaw}`);
    const category=categoryRaw as InstalledCatalogEntryV1["category"];
    const present=presentation(value.presentation,defaultLocale,`content[${index}]`);
    const relations=semanticRelationships(value.relationships,`content[${index}].relationships`);
    const mechanics=parseInstalledContentMechanics(value.mechanics,`content[${index}].mechanics`);
    if (Array.isArray(value.progressionContributions) && value.progressionContributions.length) throw new Error(`content[${index}].progressionContributions cannot be activated by the generic Catalog yet`);
    const campaignProvider=value.campaignProvider===undefined?undefined:parseInstalledCampaignProviderProfile(value.campaignProvider);
    return {
      contentId,category,nameKo:present.nameKo,nameEn:present.nameEn,
      sourceId:moduleId,source:sourceDocument,version:moduleVersion,description:present.description,
      relationships:relationshipViews(relations),capabilities:[],
      requiresCapabilities:strings(value.requiresCapabilities,`content[${index}].requiresCapabilities`),
      semanticRelationships:relations,
      extensionPoints:extensionPoints(value.extensionPoints,`content[${index}].extensionPoints`),
      module:cp(module),
      ...(mechanics.length?{mechanics}:{}),
      ...(campaignProvider?{campaignProvider}:{}),
    } satisfies InstalledCatalogEntryV1;
  });
  const duplicateIds=new Set<string>();
  for (const entry of entries) {
    if (duplicateIds.has(entry.contentId)) throw new Error(`RuleModule package contains duplicate content id: ${entry.contentId}`);
    duplicateIds.add(entry.contentId);
  }
  return {
    module,source:sourceDocument,entries,
    preview:{moduleId,moduleVersion,rulesProfile,source:sourceDocument,dependencies:cp(module.dependencies),conflicts:cp(module.conflicts),capabilities:cp(module.capabilities),entries:entries.map((entry)=>({contentId:entry.contentId,category:entry.category,nameKo:entry.nameKo,nameEn:entry.nameEn,validation:[]}))},
  };
}

export function catalogEntryForPackagePreview(entry:InstalledCatalogEntryV1):CatalogEntry {
  return {
    id:entry.contentId,category:entry.category,nameKo:entry.nameKo,nameEn:entry.nameEn,scope:"local",source:entry.source,version:entry.version,
    description:entry.description,relationships:cp(entry.relationships),capabilities:cp(entry.capabilities),contentId:entry.contentId,sourceId:entry.sourceId,
  };
}

declare module "./contracts" {
  interface ContentImportPreview {
    package?:RuleModulePackagePreviewVm;
  }
}

export {};
