import type { AppSnapshot } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import {
  getCharacterLibraryPersistenceStateForTests,
  setCharacterLibraryStoreForTests,
} from "./characterLibraryRuntimeAdapter";
import { setCampaignLibraryStoreForTests } from "./campaignRuntimeAdapter";
import { createPlatformCharacterLibraryStore, isTauriCharacterLibraryRuntime } from "./tauriCharacterLibraryStore";
import { createPlatformCampaignLibraryStore } from "./tauriCampaignLibraryStore";
import { TauriCharacterCampaignCompoundWriter } from "./tauriCharacterCampaignCompoundWriter";
import { MemoryCharacterLibraryStore } from "./memoryCharacterLibraryStore";
import { MemoryCampaignLibraryStore } from "./memoryCampaignLibraryStore";
import {
  MemoryCharacterCampaignCompoundWriter,
  type CharacterCampaignCompoundWriter,
} from "./characterCampaignCompoundPersistence";
import { encodeCharacterLibraryV1 } from "./characterLibraryPersistence";
import type { CharacterLibraryStore } from "./persistenceContracts";
import { encodeCampaignDocumentV1 } from "./campaignPersistence";
import {
  CAMPAIGN_LIBRARY_SCHEMA_ID,
  CAMPAIGN_LIBRARY_SCHEMA_VERSION,
  type CampaignDocumentV1,
  type CampaignLibraryStore,
} from "./campaignPersistenceContracts";
import { pinnedCampaignProviderDescriptorFromCatalog } from "./campaignProviderProfiles";
import {
  executeLongRestCompound,
  previewLongRestCompound,
  type LongRestCompoundInput,
  type LongRestCompoundPreview,
  type LongRestCompoundResult,
} from "./longRestCompoundCoordinator";
import { publishExternalAdapterSnapshot } from "./adapterSnapshotEvents";

const cp=<T,>(value:T):T=>structuredClone(value);

export interface ProductionLongRestOptions {
  transactionId?:string;
  advanceMinutes?:number;
  consumeRations?:boolean;
  note?:string;
}

export interface ProductionLongRestPreview extends LongRestCompoundPreview {
  snapshot:AppSnapshot;
}

export interface ProductionLongRestResult extends LongRestCompoundResult {
  snapshot:AppSnapshot;
}

function transactionId(prefix="long-rest"){
  const id=globalThis.crypto?.randomUUID?.()??`${Date.now()}.${Math.floor(Math.random()*1_000_000)}`;
  return `${prefix}.${id}`;
}

function campaignDocumentFromSnapshot(snapshot:AppSnapshot):CampaignDocumentV1 {
  const campaigns=cp(snapshot.campaigns??[]);
  const activeCampaignId=snapshot.activeCampaignId??snapshot.campaignSessionSystems?.campaignId??null;
  if(!activeCampaignId||!campaigns.some((campaign)=>campaign.campaignId===activeCampaignId)){
    throw new Error("Long Rest requires an active Campaign");
  }
  return {
    schemaId:CAMPAIGN_LIBRARY_SCHEMA_ID,
    schemaVersion:CAMPAIGN_LIBRARY_SCHEMA_VERSION,
    storageRevision:0,
    activeCampaignId,
    campaigns,
  };
}

function exactProviderProfiles(snapshot:AppSnapshot,campaignId:string){
  const campaign=snapshot.campaigns?.find((item)=>item.campaignId===campaignId);
  if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
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
    calendarProfile:calendar?.profile.kind==="calendar"?calendar.profile:undefined,
    rationProfile:ration?.profile.kind==="ration"?ration.profile:undefined,
  };
}

function effectiveCapabilities(snapshot:AppSnapshot,campaignId:string){
  const campaign=snapshot.campaigns?.find((item)=>item.campaignId===campaignId);
  if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  const session=snapshot.campaignSessionSystems?.campaignId===campaignId?snapshot.campaignSessionSystems:null;
  return {
    calendarEnabled:session?.calendar.enabled??campaign.calendar.capability.enabled,
    rationsEnabled:session?.rations.enabled??campaign.rations.capability.enabled,
  };
}

function inputFor(
  snapshot:AppSnapshot,
  campaignId:string,
  options:ProductionLongRestOptions,
  prefix="long-rest",
):LongRestCompoundInput {
  const profiles=exactProviderProfiles(snapshot,campaignId);
  const capabilities=effectiveCapabilities(snapshot,campaignId);
  return {
    transactionId:options.transactionId?.trim()||transactionId(prefix),
    campaignId,
    activeCharacterId:snapshot.activeCharacter.id,
    initiatedByParticipantId:"dm.local",
    now:new Date().toISOString(),
    advanceMinutes:options.advanceMinutes,
    consumeRations:options.consumeRations,
    note:options.note,
    calendarEnabled:capabilities.calendarEnabled,
    rationsEnabled:capabilities.rationsEnabled,
    calendarProfile:profiles.calendarProfile,
    rationProfile:profiles.rationProfile,
  };
}

export async function previewProductionLongRest(
  adapter:MockAdapter,
  options:ProductionLongRestOptions={},
):Promise<ProductionLongRestPreview> {
  const snapshot=await adapter.getSnapshot();
  const campaignDocument=campaignDocumentFromSnapshot(snapshot);
  const campaignId=campaignDocument.activeCampaignId!;
  const preview=await previewLongRestCompound(inputFor(snapshot,campaignId,options,"long-rest-preview"),{
    characterSheets:[snapshot.activeCharacter],
    campaignDocument,
  });
  return {...preview,snapshot};
}

/**
 * Production bridge for one authoritative Long Rest transaction.
 * It deliberately prepares both stores outside the existing single-store mutation
 * methods, publishes one compound write, then resets both runtime persistence
 * contexts to the already-committed stores before projecting a new snapshot.
 */
export async function performProductionLongRest(
  adapter:MockAdapter,
  options:ProductionLongRestOptions={},
):Promise<ProductionLongRestResult> {
  const before=await adapter.getSnapshot();
  const campaignDocument=campaignDocumentFromSnapshot(before);
  const campaignId=campaignDocument.activeCampaignId!;
  const characterState=getCharacterLibraryPersistenceStateForTests(adapter);
  const characterDocument=characterState?.document;
  if(!characterDocument) throw new Error("Long Rest requires a hydrated Character library");

  let characterStore:CharacterLibraryStore;
  let campaignStore:CampaignLibraryStore;
  let writer:CharacterCampaignCompoundWriter;

  if(isTauriCharacterLibraryRuntime()){
    characterStore=createPlatformCharacterLibraryStore();
    campaignStore=createPlatformCampaignLibraryStore();
    writer=new TauriCharacterCampaignCompoundWriter();
  }else{
    const volatileCharacterStore=new MemoryCharacterLibraryStore();
    volatileCharacterStore.seed(
      characterDocument.storageRevision,
      encodeCharacterLibraryV1(characterDocument),
    );
    const volatileCampaignStore=new MemoryCampaignLibraryStore([{
      generation:1,
      payload:encodeCampaignDocumentV1({...campaignDocument,storageRevision:1}),
    }]);
    characterStore=volatileCharacterStore;
    campaignStore=volatileCampaignStore;
    writer=new MemoryCharacterCampaignCompoundWriter(volatileCharacterStore,volatileCampaignStore);
  }

  const result=await executeLongRestCompound(inputFor(before,campaignId,options),{
    characterDocument,
    characterSheets:[before.activeCharacter],
    characterStore,
    campaignDocument,
    campaignStore,
    writer,
  });

  if(result.status==="duplicate"){
    return {...result,snapshot:before};
  }

  // The compound writer has already committed both generations. Swapping the
  // runtime persistence contexts only after that point makes the next hydrate
  // observe the committed pair and also refreshes the Scene projection from the
  // durable Character state. No UI/Scene projection is mutated before success.
  setCharacterLibraryStoreForTests(adapter,characterStore);
  setCampaignLibraryStoreForTests(adapter,campaignStore);
  const snapshot=await adapter.getSnapshot();
  publishExternalAdapterSnapshot(snapshot);
  return {...result,snapshot};
}
