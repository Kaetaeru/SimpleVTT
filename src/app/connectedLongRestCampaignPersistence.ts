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

function commitId(transactionId:string,campaignRevision:number) {
  return `${transactionId}:campaign-revision:${campaignRevision}`;
}

function memoryStoreFor(document:CampaignDocumentV1) {
  const seeded={...cp(document),storageRevision:1};
  return new MemoryCampaignLibraryStore([{generation:1,payload:encodeCampaignDocumentV1(seeded)}]);
}

/**
 * Host-side global commit point for a connected Long Rest. This runs only after
 * the Character owner has acknowledged a durable invisible prepare. Once this
 * Campaign generation commits, the transaction must finish by owner
 * materialization/recovery rather than by compensating Campaign state.
 */
export async function commitConnectedLongRestCampaignParticipant(
  adapter:MockAdapter,
  preflight:ConnectedLongRestCommitPreflight,
):Promise<ConnectedLongRestCampaignCommitResult> {
  const before=await adapter.getSnapshot();
  const document=campaignDocumentFromSnapshot(before);
  const campaign=document.campaigns.find((item)=>item.campaignId===preflight.campaignId);
  if(!campaign) throw new Error(`Campaign not found: ${preflight.campaignId}`);

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
      campaignCommitId:commitId(preflight.transactionId,campaign.revision),
      preview,
      snapshot:before,
    };
  }
  if(campaign.revision!==preflight.expectedCampaignRevision){
    throw new Error(`connected Long Rest Campaign revision is stale: expected ${preflight.expectedCampaignRevision}, current ${campaign.revision}`);
  }

  const preview=await previewLongRestCampaignParticipant(inputFor(before,preflight),document);
  if(preview.status==="duplicate"){
    const duplicateCampaign=preview.campaignDocument.campaigns.find((item)=>item.campaignId===preflight.campaignId)!;
    return {
      status:"duplicate",
      campaignCommitId:commitId(preflight.transactionId,duplicateCampaign.revision),
      preview,
      snapshot:before,
    };
  }

  let store:CampaignLibraryStore;
  if(isTauriCharacterLibraryRuntime()){
    store=createPlatformCampaignLibraryStore();
  }else{
    store=memoryStoreFor(document);
  }
  const write=await prepareCampaignLibraryGeneration(store,preview.campaignDocument);
  await store.writeGeneration(write.expectedGeneration,write.nextGeneration,write.payload);

  // The global Campaign commit is complete at this point. Rebinding the runtime
  // context only projects the already-committed generation into the current UI.
  setCampaignLibraryStoreForTests(adapter,store);
  const snapshot=await adapter.getSnapshot();
  const committedCampaign=snapshot.campaigns?.find((item)=>item.campaignId===preflight.campaignId);
  if(!committedCampaign||!committedCampaign.recentRequestIds.includes(preflight.transactionId)){
    throw new Error("connected Long Rest Campaign commit did not rehydrate the transaction id");
  }
  return {
    status:"committed",
    campaignCommitId:commitId(preflight.transactionId,committedCampaign.revision),
    preview,
    snapshot,
  };
}
