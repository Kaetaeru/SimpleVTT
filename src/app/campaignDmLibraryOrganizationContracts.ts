export interface CampaignDmLibraryFolder {
  folderId:string;
  label:string;
}

export interface CampaignPcActorPreset {
  definitionId:string;
  name:string;
  nameEn?:string;
  level:number;
  ac:number;
  maxHp:number;
  actions:string[];
  statusImmunities:string[];
  source:string;
  version:string;
}

declare module "./campaignPersistenceContracts" {
  interface CampaignDmLibraryEntry {
    folderId?:string;
    pcPreset?:CampaignPcActorPreset;
    noteText?:string;
  }

  interface CampaignDmLibraryState {
    folders?:CampaignDmLibraryFolder[];
  }
}

export {};
