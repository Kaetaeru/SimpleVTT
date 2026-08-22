import type { AppSnapshot } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import type { ConnectedLongRestCommitPreflight } from "./connectedLongRestPreflight";
import {
  previewLongRestCampaignParticipant,
  type LongRestCampaignParticipantPreview,
  type LongRestCompoundInput,
} from "./longRestCompoundCoordinator";
import { prepareCampaignLibraryGeneration } from "./characterCampaignCompoundPersistence";
import {
  CAMPAIGN_LIBRARY_SCHEMA_ID,
  CAMPAIGN_LIBRARY_SCHEMA_VERSION,
  type CampaignDocumentV1,
  type CampaignLibraryStore,
} from "./campaignPersistenceContracts";
import { encodeCampaignDocumentV1 } from "./campaignPersistence";
import { MemoryCampaignLibraryStore } from "./memoryCampaignLibraryStore";
import { createPlatformCampaignLibraryStore } from "./tauriCampaignLibraryStore";
import { isTauriCharacterLibraryRuntime } from "./tauriCharacterLibraryStore";
import { setCampaignLibraryStoreForTests } from "./campaignRuntimeAdapter";
import { pinnedCampaignProviderDescriptorFromCatalog } from "./campaignProviderProfiles";

const cp=<T,>(value:T):T=>structuredClone(value);

export interface ConnectedLongRestCampaignCommitResult {
  status:"committed"|"duplicate";
  campaignCommitId:string;
  preview:LongRestCampaignParticipantPreview;
  snapshot:AppSnapshot;
  projectionWarning?:string;
}

function campaignDocumentFromSnapshot(snapshot:AppSnapshot):CampaignDocumentV1 {
  const campaigns=cp(snapshot.campaigns??[]);
  const activeCampaignId=snapshot.activeCampaignId??snapshot.campaignSessionSystems?.campaignId??null;
  if(!activeCampaignId||!campaigns.some((campaign)=>campaign.campaignId===activeCampaignId)){
    throw new Error("connected Long Rest requires an active Campaign");
  }
  return {
    schemaId:CAMPAIGN_LIBRARY_SCHEMA_ID,
    schemaVersion:CAMPAIGN_LIBRARY_SCHEMA_VERSION,
    storageRevision:0,
    activeCampaignId,
    campaigns,
  };
}

function inputFor(snapshot:AppSnapshot,preflight:ConnectedLongRestCommitPreflight):LongRestCompoundInput {
  const campaign=snapshot.campaigns?.find((item)=>item.campaignId===preflight.campaignId);
  if(!campaign) throw new Error(`Campaign not found: ${preflight.campaignId}`);
  const session=snapshot.campaignSessionSystems?.campaignId===preflight.campaignId
    ?snapshot.campaignSessionSystems
    :null;
  const calendar=pinnedCampaignProviderDescriptorFromCatalog(
    snapshot.catalog,
    "calendar",
    campaign.calendar.capability.providerId,
    campaign.calendar.capability.providerVersion,
  );
  const ration=pinnedCampaignProviderDescriptorFromCatalog(
    snapshot.catalog,
    "ration",
    campaign.rations.capability.providerId,
    campaign.rations.capability.providerVersion,
  );
  return {
    transactionId:preflight.transactionId,
    campaignId:preflight.campaignId,
    activeCharacterId:preflight.character.characterId,
    initiatedByParticipantId:"host",
    now:new Date().toISOString(),
    advanceMinutes:preflight.options.advanceMinutes,
    consumeRations:preflight.options.consumeRations,
    calendarEnabled:session?.calendar.enabled??campaign.calendar.capability.enabled,
    rationsEnabled:session?.rations.enabled??campaign.rations.capability.enabled,
    calendarProfile:calendar?.profile.kind==="calendar"?calendar.profile:undefined,
    rationProfile:ration?.profile.kind==="ration"?ration.profile:undefined,
  };
}

/** Stable across later Campaign revisions so a Host restart can recover a commit from the durable transaction id. */
export function connectedLongRestCampaignCommitId(transactionId:string) {
  const normalized=transactionId.trim();
  if(!normalized) throw new Error("connected Long Rest transaction id is required");
  return `${normalized}:campaign-commit-v1`;
}

function memoryStoreFor(document:CampaignDocumentV1) {
  const seeded={...cp(document),storageRevision:1};
  return new MemoryCampaignLibraryStore([{generation:1,payload:encodeCampaignDocumentV1(seeded)}]);
}

/**
 * Host-side global commit point for a connected Long Rest. This runs only after
 * the Character owner has acknowledged a durable invisible prepare. Once this
 * Campaign generation commits, later projection failures are recovery work and
 * MUST NOT be reported as an abortable pre-commit failure.
 */
export async function commitConnectedLongRestCampaignParticipant(
  adapter:MockAdapter,
  preflight:ConnectedLongRestCommitPreflight,
):Promise<ConnectedLongRestCampaignCommitResult> {
  const before=await adapter.getSnapshot();
  const document=campaignDocumentFromSnapshot(before);
  const campaign=document.campaigns.find((item)=>item.campaignId===preflight.campaignId);
  if(!campaign) throw new Error(`Campaign not found: ${preflight.campaignId}`);
  const campaignCommitId=connectedLongRestCampaignCommitId(preflight.transactionId);

  if(campaign.recentRequestIds.includes(preflight.transactionId)){
    const preview:LongRestCampaignParticipantPreview={
      status:"duplicate",
      transactionId:preflight.transactionId,
      campaignDocument:document,
      applied:{calendar:false,rations:false},
      warnings:[],
    };
    return {
      status:"duplicate",
      campaignCommitId,
      preview,
      snapshot:before,
    };
  }
  if(campaign.revision!==preflight.expectedCampaignRevision){
    throw new Error(`connected Long Rest Campaign revision is stale: expected ${preflight.expectedCampaignRevision}, current ${campaign.revision}`);
  }

  const preview=await previewLongRestCampaignParticipant(inputFor(before,preflight),document);
  if(preview.status==="duplicate"){
    return {
      status:"duplicate",
      campaignCommitId,
      preview,
      snapshot:before,
    };
  }

  const candidateCampaign=preview.campaignDocument.campaigns.find((item)=>item.campaignId===preflight.campaignId);
  if(!candidateCampaign||!candidateCampaign.recentRequestIds.includes(preflight.transactionId)){
    throw new Error("connected Long Rest Campaign candidate is missing the transaction id");
  }

  let store:CampaignLibraryStore;
  if(isTauriCharacterLibraryRuntime()){
    store=createPlatformCampaignLibraryStore();
  }else{
    store=memoryStoreFor(document);
  }
  const write=await prepareCampaignLibraryGeneration(store,preview.campaignDocument);
  await store.writeGeneration(write.expectedGeneration,write.nextGeneration,write.payload);

  // Global commit point has passed. Runtime rebind/rehydrate below is projection
  // only; failures cannot undo or reclassify the durable Campaign commit.
  try{
    setCampaignLibraryStoreForTests(adapter,store);
    const snapshot=await adapter.getSnapshot();
    const projected=snapshot.campaigns?.find((item)=>item.campaignId===preflight.campaignId);
    const projectionWarning=!projected?.recentRequestIds.includes(preflight.transactionId)
      ?"connected Long Rest Campaign committed, but runtime projection has not observed the transaction yet"
      :undefined;
    return {
      status:"committed",
      campaignCommitId,
      preview,
      snapshot,
      projectionWarning,
    };
  }catch(error){
    return {
      status:"committed",
      campaignCommitId,
      preview,
      snapshot:before,
      projectionWarning:`connected Long Rest Campaign committed; runtime projection recovery required: ${error instanceof Error?error.message:String(error)}`,
    };
  }
}
