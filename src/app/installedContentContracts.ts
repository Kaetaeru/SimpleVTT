import type { CommonPlayOperationDefinition } from "../domain/commonPlayOperationRuntime";
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
  /** Optional data-owned action alias. It identifies authored content; it never selects an execution algorithm. */
  id?:string;
  kind:"common-play";
  config:CommonPlayOperationDefinition;
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
  mechanics?:InstalledCommonPlayMechanicV1[];
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
    /** Validated, data-only Common Play executable definitions. */
    mechanics?:InstalledCommonPlayMechanicV1[];
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
