export const CAMPAIGN_LIBRARY_SCHEMA_ID="simplevtt.campaign-library" as const;
export const CAMPAIGN_LIBRARY_SCHEMA_VERSION=1 as const;

export interface OptionalCampaignCapability {
  enabled:boolean;
  providerId:string;
  providerVersion:string;
  settingsRevision:number;
}

export interface CampaignRosterMember {
  rosterMemberId:string;
  label:string;
  kind:"player-character-ref"|"host-preset"|"companion";
  characterRef?:{ownerHint?:string;characterId:string};
  active:boolean;
  countsForRations:boolean;
  rationUnitsPerDay?:number;
  stashPermission?:"none"|"view"|"request"|"manage";
}

export interface CampaignSessionDefaults {
  revision:number;
  sessionNameTemplate:string;
  startingMode:"freeform"|"initiative";
  calendarEnabled:boolean;
  rationsEnabled:boolean;
  stashPolicy:"shared"|"dm-approval"|"dm-managed";
  dmLibraryEnabled:boolean;
  contentLoadoutId:string;
}

export interface CampaignCalendarState {
  providerId:string;
  revision:number;
  absoluteMinute:number;
  displayAnchor:{era?:string;year?:number;monthId?:string;day?:number};
  timeZoneLabel?:string;
  currentNote?:string;
  history:Array<{transactionId:string;deltaMinutes:number;beforeAbsoluteMinute:number;afterAbsoluteMinute:number;committedAt:string;provenance:string[]}>;
}

export interface CampaignSupplyTransactionSummary {
  transactionId:string;
  kind:"adjust"|"consume"|"undo"|"convert";
  amount:number;
  balanceAfter:number;
  committedAt:string;
  provenance:string[];
}

export interface CampaignSupplyLedger {
  revision:number;
  balances:Record<string,number>;
  lastConsumptionAtAbsoluteMinute?:number;
  consumptionHistory:CampaignSupplyTransactionSummary[];
}

export interface CampaignPartyStashState {
  stashId:string;
  revision:number;
  policy:"shared"|"dm-approval"|"dm-managed";
  wallet:{gp:number;sp:number;cp:number};
  itemReferences:Array<{instanceId:string;definitionId:string;quantity:number}>;
}

export interface CampaignDmLibraryEntry {
  entryId:string;
  kind:"image"|"pc-preset"|"npc-definition"|"custom-item"|"note";
  label:string;
  definitionId?:string;
  favorite?:boolean;
  tags?:string[];
}

export interface CampaignDmLibraryState {
  namespaceId:string;
  revision:number;
  entries:CampaignDmLibraryEntry[];
  recentEntryIds:string[];
}

export interface CampaignSessionSummary {
  sessionId:string;
  name:string;
  startedAt:string;
  endedAt:string;
  participantCount:number;
  summary?:string;
}

export interface CampaignContentLoadout {
  loadoutId:string;
  revision:number;
  entries:Array<{contentId:string;sourceId:string;version:string}>;
  spatialProviderId?:string;
  spatialProviderVersion?:string;
}

export interface CampaignRecordV1 {
  campaignId:string;
  name:string;
  description?:string;
  status:"active"|"archived";
  createdAt:string;
  updatedAt:string;
  lastOpenedAt?:string;
  lastSessionId?:string;
  revision:number;
  roster:CampaignRosterMember[];
  sessionDefaults:CampaignSessionDefaults;
  calendar:{capability:OptionalCampaignCapability;state:CampaignCalendarState};
  rations:{capability:OptionalCampaignCapability;ledger:CampaignSupplyLedger};
  partyStash:CampaignPartyStashState;
  dmLibrary:CampaignDmLibraryState;
  sessionHistory:CampaignSessionSummary[];
  contentLoadout:CampaignContentLoadout;
  recentRequestIds:string[];
}

export interface CampaignDocumentV1 {
  schemaId:typeof CAMPAIGN_LIBRARY_SCHEMA_ID;
  schemaVersion:typeof CAMPAIGN_LIBRARY_SCHEMA_VERSION;
  storageRevision:number;
  activeCampaignId:string|null;
  campaigns:CampaignRecordV1[];
}

export interface CampaignStoredGeneration {
  generation:number;
  payload:string|null;
  readError?:string|null;
}

export interface CampaignLibraryStore {
  readonly durability:"durable"|"memory";
  readGenerations():Promise<CampaignStoredGeneration[]>;
  writeGeneration(expectedGeneration:number,nextGeneration:number,payload:string):Promise<void>;
}

export interface CampaignMutationContext {
  requestId:string;
  campaignId:string;
  sessionId?:string;
  initiatedByParticipantId:string;
  expectedCampaignRevision:number;
  now?:string;
}
