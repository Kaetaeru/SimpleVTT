import type { InstalledBackgroundDefinitionV1 } from "./installedBackgroundDefinition";
import type { InstalledSpellDefinitionV1 } from "./installedSpellDefinition";
import type { InstalledSpeciesDefinitionV1 } from "./installedSpeciesDefinition";
import type { InstalledFeatDefinitionV1 } from "./installedFeatDefinition";
import type { SpellMechanicDefinition } from "../domain/spellcasting";
import type { CommonPlayDefinitionIR } from "../domain/commonPlayDefinitionRuntime";
import type { CatalogEntry } from "./contracts";

export const INSTALLED_CONTENT_SCHEMA_ID = "simplevtt.installed-content" as const;
export const INSTALLED_CONTENT_SCHEMA_VERSION = 1 as const;

export interface InstalledModuleRefV1 {
  moduleId:string;
  version:string;
}

export interface InstalledModuleExtensionPointV1 {
  id:string;
  acceptsCategories:string[];
}

export interface InstalledModuleManifestV1 {
  moduleId:string;
  moduleVersion:string;
  rulesProfile:{ id:string; version:string };
  dependencies:InstalledModuleRefV1[];
  conflicts:InstalledModuleRefV1[];
  capabilities:string[];
  extensionPoints:InstalledModuleExtensionPointV1[];
}

export interface InstalledContentRelationshipV1 {
  kind:"parent"|"extends"|"replaces";
  target:string;
  targetVersion?:string;
  extensionPoint?:string;
}

export interface InstalledCommonPlayMechanicV1 {
  kind:"common-play";
  config:CommonPlayDefinitionIR;
}

export interface InstalledBackgroundDefinitionMechanicV1 {
  kind:"background-definition";
  config:InstalledBackgroundDefinitionV1;
}

/** Presentation-level spell facts (level, school, casting time, range, components, duration, class lists). */
export interface InstalledSpellDefinitionMechanicV1 {
  kind:"spell-definition";
  config:InstalledSpellDefinitionV1;
}

/** Executable spell definition in the reviewed `SpellMechanicDefinition` shape; keyed by the entry's content id. */
export interface InstalledSpellMechanicMechanicV1 {
  kind:"spell-mechanic";
  config:SpellMechanicDefinition;
}

/** Declarative species semantics (size, speed, darkvision, traits, creation choices) for an installed species. */
export interface InstalledSpeciesDefinitionMechanicV1 {
  kind:"species-definition";
  config:InstalledSpeciesDefinitionV1;
}

/** Declarative feat semantics (tier, prerequisites, ability increase, execution record) for an installed feat. */
export interface InstalledFeatDefinitionMechanicV1 {
  kind:"feat-definition";
  config:InstalledFeatDefinitionV1;
}

export type InstalledMechanicV1 = InstalledCommonPlayMechanicV1 | InstalledBackgroundDefinitionMechanicV1 | InstalledSpellDefinitionMechanicV1 | InstalledSpellMechanicMechanicV1 | InstalledSpeciesDefinitionMechanicV1 | InstalledFeatDefinitionMechanicV1;

/** Narrows an entry's mechanics to the executable Common Play definitions; declarative kinds such as background-definition are skipped. */
export function commonPlayMechanicsOf(mechanics:InstalledMechanicV1[]|undefined):InstalledCommonPlayMechanicV1[] {
  return (mechanics??[]).filter((mechanic):mechanic is InstalledCommonPlayMechanicV1=>mechanic.kind==="common-play");
}

export interface InstalledProgressionContributionV1 {
  track:string;
  threshold:number;
  grants:string[];
  choices?:InstalledProgressionChoiceV1[];
}

export interface InstalledProgressionChoiceV1 {
  id:string;
  label:string;
  description?:string;
  count:number;
  required:boolean;
  options:Array<{
    id:string;
    label:string;
    description?:string;
    grants:string[];
    replaces?:string[];
  }>;
}

export interface InstalledCampaignCalendarProfileV1 {
  kind:"calendar";
  defaultEra:string;
  weekdays:string[];
  months:Array<{id:string;label:string;days:number}>;
  leapYear?:{
    cycle:number;
    remainders:number[];
    monthId:string;
    extraDays:number;
  };
}

export interface InstalledCampaignRationItemConversionV1 {
  requiredCapability:string;
  rationUnitsPerItem:number;
}

export interface InstalledCampaignRationProfileV1 {
  kind:"ration";
  defaultUnitsPerDay:number;
  unitsByRosterKind?:Partial<Record<"player-character-ref"|"host-preset"|"companion",number>>;
  shortageConsequences?:string[];
  itemConversions?:InstalledCampaignRationItemConversionV1[];
}

export type InstalledCampaignProviderProfileV1 = InstalledCampaignCalendarProfileV1 | InstalledCampaignRationProfileV1;

export interface InstalledCatalogEntryV1 {
  contentId:string;
  category:CatalogEntry["category"];
  nameKo:string;
  nameEn:string;
  sourceId:string;
  source:string;
  version:string;
  description:string;
  relationships:CatalogEntry["relationships"];
  capabilities:string[];
  requiresCapabilities?:string[];
  semanticRelationships?:InstalledContentRelationshipV1[];
  extensionPoints?:InstalledModuleExtensionPointV1[];
  module?:InstalledModuleManifestV1;
  /** Validated, data-only Common Play executable definitions. */
  mechanics?:InstalledMechanicV1[];
  /** Generic grants activated when the named progression track reaches its threshold. */
  progressionContributions?:InstalledProgressionContributionV1[];
  /** Data-only optional Campaign capability profile. Never executable code. */
  campaignProvider?:InstalledCampaignProviderProfileV1;
}

export interface InstalledContentDocumentV1 {
  schemaId:typeof INSTALLED_CONTENT_SCHEMA_ID;
  schemaVersion:typeof INSTALLED_CONTENT_SCHEMA_VERSION;
  storageRevision:number;
  entries:InstalledCatalogEntryV1[];
}

export interface InstalledContentStoredGeneration {
  generation:number;
  payload:string|null;
  readError?:string;
}

export interface InstalledContentStore {
  readonly durability:"durable"|"volatile";
  readGenerations():Promise<InstalledContentStoredGeneration[]>;
  writeGeneration(expectedGeneration:number,nextGeneration:number,payload:string):Promise<void>;
}

declare module "./contracts" {
  interface CatalogEntry {
    /** Resolved catalog identity. Portable source content identity is contentId. */
    contentId?:string;
    /** Stable module/source identity; distinct from display source. */
    sourceId?:string;
    /** Validated, data-only Common Play executable definitions carried by built-in or installed content. */
    mechanics?:InstalledMechanicV1[];
    /** Validated, data-only progression grants projected by the production level-up runtime. */
    progressionContributions?:InstalledProgressionContributionV1[];
    /** Read-only data-only Campaign provider projection from installed content. */
    campaignProvider?:InstalledCampaignProviderProfileV1;
  }

  interface AppSnapshot {
    contentCatalogPersistence?: {
      durability:"durable"|"volatile";
      status:"ready"|"recovered"|"error";
      storageRevision:number;
      message?:string;
    };
  }
}

export {};
