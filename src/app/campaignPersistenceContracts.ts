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
  displayAnchor:{era?:string;year?:number;monthId?:string;monthLabel?:string;day?:number;hour?:number;minute?:number};
  timeZoneLabel?:string;
  currentNote?:string;
  history:Array<{
    transactionId:string;
    kind:"advance"|"correction"|"undo";
    deltaMinutes:number;
    beforeAbsoluteMinute:number;
    afterAbsoluteMinute:number;
    committedAt:string;
    note?:string;
    revertsTransactionId?:string;
    provenance:string[];
  }>;
}

export interface CampaignCalendarDateTime {
  era:string;
  year:number;
  monthId:string;
  day:number;
  hour:number;
  minute:number;
}

export interface CampaignSupplyTransactionSummary {
  transactionId:string;
  kind:"adjust"|"consume"|"undo"|"convert";
  amount:number;
  balanceAfter:number;
  requiredAmount?:number;
  shortage?:number;
  note?:string;
  revertsTransactionId?:string;
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
  title:string;
  /** Read compatibility for pre-V1-12 local summaries. */
  name?:string;
  startedAt:string;
  endedAt:string;
  participantLabels:string[];
  /** Read compatibility for pre-V1-12 local summaries. */
  participantCount?:number;
  calendarBefore?:string;
  calendarAfter?:string;
  rationDelta?:number;
  stashTransactionCount:number;
  dmNote?:string;
  /** Read compatibility for pre-V1-12 local summaries. */
  summary?:string;
}

export interface CampaignRationPreview {
  memberCount:number;
  requiredUnits:number;
  availableUnits:number;
  consumedUnits:number;
  shortageUnits:number;
  memberUnits:Array<{rosterMemberId:string;label:string;units:number}>;
}

export interface CampaignContentLoadout {
  loadoutId:string;
  revision:number;
  entries:Array<{contentId:string;sourceId:string;version:string}>;
  spatialProviderId?:string;
  spatialProviderVersion?:string;
}

export interface CampaignSessionSnapshot {
  sessionId:string;
  campaignId:string;
  campaignName:string;
  campaignRevisionAtStart:number;
  settingsRevision:number;
  sessionName:string;
  startingMode:"freeform"|"initiative";
  calendar:OptionalCampaignCapability;
  rations:OptionalCampaignCapability;
  stashPolicy:"shared"|"dm-approval"|"dm-managed";
  contentLoadoutId:string;
  spatialProviderId?:string;
  spatialProviderVersion?:string;
  calendarAbsoluteMinuteAtStart:number;
  calendarEraAtStart?:string;
  rationBalanceAtStart:number;
  stashRevisionAtStart:number;
  startedAt:string;
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
