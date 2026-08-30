import "./persistenceContracts";
import type { CatalogEntry, CharacterSheet } from "./contracts";
import {
  projectCharacterRuntimeDurableV1,
  projectCharacterSourceV1,
} from "./characterLibraryPersistence";
import { catalogQualifiedId, builtinCatalogSourceId } from "./contentCatalogIdentity";
import { sanitizeCharacterPortrait, type CharacterPortraitV1 } from "./characterPortraitContracts";
import type {
  CharacterRuntimeDurableSnapshotV1,
  CharacterSourceSnapshotV1,
  RulesProfileRefV1,
} from "./persistenceContracts";

export const CHARACTER_SESSION_PROJECTION_SCHEMA_ID = "simplevtt.character-session-projection" as const;
export const CHARACTER_SESSION_PROJECTION_SCHEMA_VERSION = 1 as const;

export interface CharacterProjectionContentIdentityV1 {
  qualifiedId:string;
  contentId:string;
  sourceId:string;
  version:string;
  category:CatalogEntry["category"];
}

export interface CharacterProjectionSourceAuthorityV1 {
  maxHp:number;
}

export interface CharacterSessionProjectionV1 {
  schemaId:typeof CHARACTER_SESSION_PROJECTION_SCHEMA_ID;
  schemaVersion:typeof CHARACTER_SESSION_PROJECTION_SCHEMA_VERSION;
  characterId:string;
  sourceRevision:number;
  runtimeRevision:number;
  rulesProfile:RulesProfileRefV1;
  source:CharacterSourceSnapshotV1;
  sourceAuthority:CharacterProjectionSourceAuthorityV1;
  runtime:CharacterRuntimeDurableSnapshotV1;
  contentIdentities:CharacterProjectionContentIdentityV1[];
  portrait?:CharacterPortraitV1;
}

export type CharacterSessionProjectionValidation =
  | { status:"accepted"; projection:CharacterSessionProjectionV1 }
  | { status:"rejected"; error:string };

type ResolvedCatalogEntry = CatalogEntry & {
  contentId?:string;
  sourceId?:string;
  progressionContributions?:Array<{track:string;threshold:number;grants:string[]}>;
};
type RequiredContentRef = { label:string; token:string; categories:CatalogEntry["category"][] };

const PROJECTION_KEYS = new Set([
  "schemaId","schemaVersion","characterId","sourceRevision","runtimeRevision",
  "rulesProfile","source","sourceAuthority","runtime","contentIdentities",
  "portrait",
]);
const IDENTITY_KEYS = new Set(["qualifiedId","contentId","sourceId","version","category"]);
const RULES_PROFILE_KEYS = new Set(["id","version"]);
const SOURCE_AUTHORITY_KEYS = new Set(["maxHp"]);

function object(value:unknown):Record<string,unknown>|undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string,unknown>
    : undefined;
}

function exactKeys(value:Record<string,unknown>,allowed:Set<string>,label:string) {
  const unexpected=Object.keys(value).filter((key)=>!allowed.has(key));
  return unexpected.length ? `${label} contains unsupported fields: ${unexpected.join(", ")}` : undefined;
}

function nonNegativeInteger(value:unknown):value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function nonEmptyString(value:unknown):value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizedToken(value:string) {
  const trimmed=value.trim();
  return trimmed.startsWith("always:") ? trimmed.slice("always:".length) : trimmed;
}

function entryIdentity(entry:ResolvedCatalogEntry):CharacterProjectionContentIdentityV1 {
  const contentId=(entry.contentId ?? "").trim();
  const sourceId=(entry.sourceId ?? (entry.scope === "builtin" ? builtinCatalogSourceId(entry) : "")).trim();
  const version=entry.version.trim();
  if (!contentId || !sourceId || !version) {
    throw new Error(`resolved catalog entry is missing qualified identity fields: ${entry.id}`);
  }
  const qualifiedId=catalogQualifiedId(contentId,sourceId,version);
  if (entry.id !== qualifiedId) {
    throw new Error(`catalog entry is not resolved to its qualified identity: ${entry.id} != ${qualifiedId}`);
  }
  return { qualifiedId,contentId,sourceId,version,category:entry.category };
}

function matchesToken(entry:ResolvedCatalogEntry,token:string) {
  const normalized=normalizedToken(token);
  return entry.id===normalized
    || entry.contentId===normalized
    || entry.nameKo===normalized
    || entry.nameEn===normalized;
}

/** Content that can change executable Character mechanics must always resolve on Host and Client. */
function requiredContentRefs(source:CharacterSourceSnapshotV1):RequiredContentRef[] {
  const refs:RequiredContentRef[]=[
    { label:"primary class",token:source.build.classLevels?.[0]?.classId ?? source.build.className,categories:["class"] },
    { label:"species",token:source.build.species,categories:["species"] },
    { label:"background",token:source.build.background,categories:["background"] },
  ];
  for (const track of source.build.classLevels ?? []) {
    refs.push({ label:`class track level ${track.level}`,token:track.classId,categories:["class"] });
  }
  for (const subclassId of Object.values(source.progression.subclassIds ?? {})) {
    if (subclassId.trim()) refs.push({ label:"subclass",token:subclassId,categories:["subclass"] });
  }
  for (const spellId of source.spellAndFeatureSelections.cantrips ?? []) refs.push({ label:"cantrip",token:spellId,categories:["spell"] });
  for (const spellId of source.spellAndFeatureSelections.preparedSpells ?? []) refs.push({ label:"prepared spell",token:spellId,categories:["spell"] });
  for (const spellId of source.spellAndFeatureSelections.spellbookSpells ?? []) refs.push({ label:"spellbook spell",token:spellId,categories:["spell"] });
  for (const weapon of source.spellAndFeatureSelections.masteryWeapons ?? []) refs.push({ label:"mastery weapon",token:weapon,categories:["item"] });
  return refs.filter((ref)=>ref.token.trim().length>0);
}

function resolveRequiredIdentities(source:CharacterSourceSnapshotV1,catalog:CatalogEntry[]) {
  const resolvedCatalog=catalog as ResolvedCatalogEntry[];
  const identities=new Map<string,CharacterProjectionContentIdentityV1>();
  for (const ref of requiredContentRefs(source)) {
    const matches=resolvedCatalog.filter((entry)=>ref.categories.includes(entry.category) && matchesToken(entry,ref.token));
    if (matches.length===0) throw new Error(`missing canonical host/client content for ${ref.label}: ${ref.token}`);
    if (matches.length>1) throw new Error(`ambiguous canonical content for ${ref.label}: ${ref.token}`);
    const identity=entryIdentity(matches[0]);
    identities.set(identity.qualifiedId,identity);
  }
  return [...identities.values()].sort((left,right)=>left.qualifiedId.localeCompare(right.qualifiedId,"en"));
}

/**
 * Inventory entries are different from class/spell mechanics. If the definition is
 * installed in the catalog we pin its qualified identity. If no definition exists,
 * the Character source snapshot itself may carry an inert item description; Host
 * reconstruction must not turn that embedded metadata into executable mechanics.
 */
function resolveKnownItemIdentities(source:CharacterSourceSnapshotV1,catalog:CatalogEntry[]) {
  const resolvedCatalog=catalog as ResolvedCatalogEntry[];
  const identities=new Map<string,CharacterProjectionContentIdentityV1>();
  for (const item of source.itemReferences) {
    if (!item.definitionId.trim()) throw new Error(`projection item ${item.id} is missing definitionId`);
    const matches=resolvedCatalog.filter((entry)=>entry.category==="item" && matchesToken(entry,item.definitionId));
    if (matches.length>1) throw new Error(`ambiguous canonical content for item ${item.id}: ${item.definitionId}`);
    if (matches.length===0) continue;
    const identity=entryIdentity(matches[0]);
    identities.set(identity.qualifiedId,identity);
  }
  return [...identities.values()].sort((left,right)=>left.qualifiedId.localeCompare(right.qualifiedId,"en"));
}

function resolveKnownClassFeatureIdentities(source:CharacterSourceSnapshotV1,catalog:CatalogEntry[]) {
  const resolvedCatalog=catalog as ResolvedCatalogEntry[];
  const identities=new Map<string,CharacterProjectionContentIdentityV1>();
  const tracks=source.build.classLevels?.length
    ? source.build.classLevels
    : [{classId:source.build.className,level:source.build.level}];
  for (const track of tracks) {
    const classMatches=resolvedCatalog.filter((entry)=>entry.category==="class"&&matchesToken(entry,track.classId));
    if (classMatches.length===0) throw new Error("missing canonical class progression source: "+track.classId);
    if (classMatches.length>1) throw new Error("ambiguous canonical class progression source: "+track.classId);
    const grants=(classMatches[0].progressionContributions ?? [])
      .filter((contribution)=>Number.isInteger(contribution.threshold)&&contribution.threshold>0&&contribution.threshold<=track.level)
      .flatMap((contribution)=>contribution.grants);
    for (const featureId of grants) {
      const matches=resolvedCatalog.filter((entry)=>(entry.category==="option"||entry.category==="feat")&&matchesToken(entry,featureId));
      if (matches.length>1) throw new Error("ambiguous canonical content for class feature: "+featureId);
      if (matches.length===0) continue;
      const identity=entryIdentity(matches[0]);
      identities.set(identity.qualifiedId,identity);
    }
  }
  return [...identities.values()].sort((left,right)=>left.qualifiedId.localeCompare(right.qualifiedId,"en"));
}

function resolveKnownFeatureIdentities(source:CharacterSourceSnapshotV1,catalog:CatalogEntry[]) {
  const resolvedCatalog=catalog as ResolvedCatalogEntry[];
  const identities=new Map<string,CharacterProjectionContentIdentityV1>();
  for (const featureId of source.progression.subclassFeatureIds ?? []) {
    if (!featureId.trim()) continue;
    const matches=resolvedCatalog.filter((entry)=>(entry.category==="option"||entry.category==="feat")&&matchesToken(entry,featureId));
    if (matches.length>1) throw new Error(`ambiguous canonical content for subclass feature: ${featureId}`);
    if (matches.length===0) continue;
    const identity=entryIdentity(matches[0]);
    identities.set(identity.qualifiedId,identity);
  }
  return [...identities.values()].sort((left,right)=>left.qualifiedId.localeCompare(right.qualifiedId,"en"));
}

function resolveProjectionIdentities(source:CharacterSourceSnapshotV1,catalog:CatalogEntry[]) {
  const identities=new Map<string,CharacterProjectionContentIdentityV1>();
  for(const identity of [
    ...resolveRequiredIdentities(source,catalog),
    ...resolveKnownItemIdentities(source,catalog),
    ...resolveKnownClassFeatureIdentities(source,catalog),
    ...resolveKnownFeatureIdentities(source,catalog),
  ]) identities.set(identity.qualifiedId,identity);
  return [...identities.values()].sort((left,right)=>left.qualifiedId.localeCompare(right.qualifiedId,"en"));
}

function clone<T>(value:T):T {
  return structuredClone(value);
}

export function buildCharacterSessionProjectionV1(
  sheet:CharacterSheet,
  catalog:CatalogEntry[],
):CharacterSessionProjectionV1 {
  const sourceRevision=sheet.sourceRevision ?? 0;
  const runtimeRevision=sheet.runtimeRevision ?? 0;
  if (!nonNegativeInteger(sourceRevision) || !nonNegativeInteger(runtimeRevision)) {
    throw new Error(`Character revisions must be non-negative integers: ${sheet.id}`);
  }
  if (!nonNegativeInteger(sheet.maxHp)) {
    throw new Error(`Character max HP must be a non-negative integer: ${sheet.id}`);
  }
  const source=projectCharacterSourceV1(sheet);
  const runtime=projectCharacterRuntimeDurableV1(sheet);
  const portrait=sanitizeCharacterPortrait(sheet.portrait);
  return {
    schemaId:CHARACTER_SESSION_PROJECTION_SCHEMA_ID,
    schemaVersion:CHARACTER_SESSION_PROJECTION_SCHEMA_VERSION,
    characterId:sheet.id,
    sourceRevision,
    runtimeRevision,
    rulesProfile:clone(source.rulesProfile),
    source,
    sourceAuthority:{ maxHp:sheet.maxHp },
    runtime,
    contentIdentities:resolveProjectionIdentities(source,catalog),
    ...(portrait?{portrait}:{}),
  };
}

function parseIdentity(value:unknown):CharacterProjectionContentIdentityV1 {
  const raw=object(value);
  if (!raw) throw new Error("projection content identity must be an object");
  const keyError=exactKeys(raw,IDENTITY_KEYS,"projection content identity");
  if (keyError) throw new Error(keyError);
  if (!nonEmptyString(raw.qualifiedId) || !nonEmptyString(raw.contentId) || !nonEmptyString(raw.sourceId) || !nonEmptyString(raw.version) || !nonEmptyString(raw.category)) {
    throw new Error("projection content identity is missing required string fields");
  }
  const categories:CatalogEntry["category"][]=["class","subclass","species","background","feat","spell","item","condition","combatant","option"];
  if (!categories.includes(raw.category as CatalogEntry["category"])) throw new Error(`unsupported projection content category: ${raw.category}`);
  const expected=catalogQualifiedId(raw.contentId,raw.sourceId,raw.version);
  if (raw.qualifiedId!==expected) throw new Error(`projection qualified content identity mismatch: ${raw.qualifiedId} != ${expected}`);
  return {
    qualifiedId:raw.qualifiedId,
    contentId:raw.contentId,
    sourceId:raw.sourceId,
    version:raw.version,
    category:raw.category as CatalogEntry["category"],
  };
}

function parseRulesProfile(value:unknown):RulesProfileRefV1 {
  const raw=object(value);
  if (!raw) throw new Error("projection rulesProfile must be an object");
  const keyError=exactKeys(raw,RULES_PROFILE_KEYS,"projection rulesProfile");
  if (keyError) throw new Error(keyError);
  if (!nonEmptyString(raw.id) || !nonEmptyString(raw.version)) throw new Error("projection rulesProfile requires id/version");
  return { id:raw.id,version:raw.version };
}

function parseSourceAuthority(value:unknown):CharacterProjectionSourceAuthorityV1 {
  const raw=object(value);
  if (!raw) throw new Error("projection sourceAuthority must be an object");
  const keyError=exactKeys(raw,SOURCE_AUTHORITY_KEYS,"projection sourceAuthority");
  if (keyError) throw new Error(keyError);
  if (!nonNegativeInteger(raw.maxHp)) throw new Error("projection sourceAuthority.maxHp must be a non-negative integer");
  return { maxHp:raw.maxHp };
}

function parseSource(value:unknown):CharacterSourceSnapshotV1 {
  const source=object(value);
  const build=object(source?.build);
  const rulesProfile=object(source?.rulesProfile);
  const selections=object(source?.spellAndFeatureSelections);
  const progression=object(source?.progression);
  if (!source || !build || !rulesProfile || !selections || !progression || !Array.isArray(source.itemReferences)) {
    throw new Error("projection source is not a CharacterSourceSnapshotV1 envelope");
  }
  if (!nonEmptyString(source.characterId) || !nonEmptyString(source.name) || !nonEmptyString(rulesProfile.id) || !nonEmptyString(rulesProfile.version)) {
    throw new Error("projection source is missing Character/rules identity");
  }
  if (!nonEmptyString(build.className) || !nonEmptyString(build.species) || !nonEmptyString(build.background) || !nonNegativeInteger(build.level)) {
    throw new Error("projection source build identity is invalid");
  }
  if (Array.isArray(build.classLevels)) {
    const tracks=build.classLevels as Array<{classId?:unknown;level?:unknown}>;
    if (tracks.some((track)=>!nonEmptyString(track.classId) || !Number.isInteger(track.level) || Number(track.level)<=0)) {
      throw new Error("projection classLevels contains an invalid class track");
    }
    const total=tracks.reduce((sum,track)=>sum+Number(track.level),0);
    if (tracks.length>0 && total!==Number(build.level)) {
      throw new Error(`projection classLevels total does not match Character level: ${total} != ${String(build.level)}`);
    }
  }
  return clone(value as CharacterSourceSnapshotV1);
}

function parseRuntime(value:unknown):CharacterRuntimeDurableSnapshotV1 {
  const runtime=object(value);
  if (!runtime || typeof runtime.hp!=="number" || !Number.isFinite(runtime.hp) || typeof runtime.tempHp!=="number" || !Number.isFinite(runtime.tempHp) || !Array.isArray(runtime.resources) || !Array.isArray(runtime.items)) {
    throw new Error("projection runtime is not a CharacterRuntimeDurableSnapshotV1 envelope");
  }
  return clone(value as CharacterRuntimeDurableSnapshotV1);
}

export function parseCharacterSessionProjectionV1(
  value:unknown,
  hostCatalog:CatalogEntry[],
):CharacterSessionProjectionValidation {
  try {
    const raw=object(value);
    if (!raw) throw new Error("Character SessionProjection must be an object");
    const keyError=exactKeys(raw,PROJECTION_KEYS,"Character SessionProjection");
    if (keyError) throw new Error(keyError);
    if (raw.schemaId!==CHARACTER_SESSION_PROJECTION_SCHEMA_ID || raw.schemaVersion!==CHARACTER_SESSION_PROJECTION_SCHEMA_VERSION) {
      throw new Error(`unsupported Character SessionProjection schema: ${String(raw.schemaId)}@${String(raw.schemaVersion)}`);
    }
    if (!nonEmptyString(raw.characterId) || !nonNegativeInteger(raw.sourceRevision) || !nonNegativeInteger(raw.runtimeRevision)) {
      throw new Error("Character SessionProjection identity/revisions are invalid");
    }
    const rulesProfile=parseRulesProfile(raw.rulesProfile);
    const source=parseSource(raw.source);
    const sourceAuthority=parseSourceAuthority(raw.sourceAuthority);
    const runtime=parseRuntime(raw.runtime);
    const portrait=sanitizeCharacterPortrait(raw.portrait);
    if (raw.portrait!==undefined&&!portrait) throw new Error("projection portrait is invalid");
    if (source.characterId!==raw.characterId) throw new Error(`projection Character ID drift: ${source.characterId} != ${raw.characterId}`);
    if (source.rulesProfile.id!==rulesProfile.id || source.rulesProfile.version!==rulesProfile.version) {
      throw new Error("projection rules profile does not match Character source");
    }
    if (runtime.hp < 0 || runtime.hp > sourceAuthority.maxHp) {
      throw new Error(`projection runtime HP is outside source-owned max HP: ${runtime.hp}/${sourceAuthority.maxHp}`);
    }
    if (!Array.isArray(raw.contentIdentities)) throw new Error("projection contentIdentities must be an array");
    if (raw.contentIdentities.length>2048) throw new Error("projection content identity list exceeds limit");
    const identities=raw.contentIdentities.map(parseIdentity);
    const ids=new Set<string>();
    const hostById=new Map((hostCatalog as ResolvedCatalogEntry[]).map((entry)=>[entry.id,entry]));
    for (const identity of identities) {
      if (ids.has(identity.qualifiedId)) throw new Error(`duplicate projection content identity: ${identity.qualifiedId}`);
      ids.add(identity.qualifiedId);
      const host=hostById.get(identity.qualifiedId);
      if (!host) throw new Error(`host is missing projected content: ${identity.qualifiedId}`);
      const hostIdentity=entryIdentity(host);
      if (hostIdentity.contentId!==identity.contentId || hostIdentity.sourceId!==identity.sourceId || hostIdentity.version!==identity.version || hostIdentity.category!==identity.category) {
        throw new Error(`host content identity mismatch: ${identity.qualifiedId}`);
      }
    }
    const required=[...resolveRequiredIdentities(source,hostCatalog),...resolveKnownItemIdentities(source,hostCatalog)];
    for (const identity of required) {
      if (!ids.has(identity.qualifiedId)) throw new Error(`projection omitted required content identity: ${identity.qualifiedId}`);
    }
    return {
      status:"accepted",
      projection:{
        schemaId:CHARACTER_SESSION_PROJECTION_SCHEMA_ID,
        schemaVersion:CHARACTER_SESSION_PROJECTION_SCHEMA_VERSION,
        characterId:raw.characterId,
        sourceRevision:raw.sourceRevision,
        runtimeRevision:raw.runtimeRevision,
        rulesProfile,
        source,
        sourceAuthority,
        runtime,
        contentIdentities:identities.sort((left,right)=>left.qualifiedId.localeCompare(right.qualifiedId,"en")),
        ...(portrait?{portrait}:{}),
      },
    };
  } catch (error) {
    return { status:"rejected",error:error instanceof Error ? error.message : String(error) };
  }
}
