import type { CatalogEntry } from "./contracts";

export const INSTALLED_CONTENT_SCHEMA_ID = "simplevtt.installed-content" as const;
export const INSTALLED_CONTENT_SCHEMA_VERSION = 1 as const;

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
