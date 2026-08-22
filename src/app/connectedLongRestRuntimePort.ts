import type { AppSnapshot, CharacterSheet } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import {
  beginConnectedLongRestTransaction,
  abortConnectedLongRestTransaction,
  commitConnectedLongRestTransaction,
  recordConnectedLongRestOwnerMaterialized,
  recordConnectedLongRestOwnerPrepared,
  type ConnectedLongRestGlobalCommit,
  type ConnectedLongRestOwnerMaterialized,
  type ConnectedLongRestOwnerPrepared,
  type ConnectedLongRestTransactionState,
} from "./connectedLongRestTransactionState";
import {
  preflightConnectedLongRest,
  type ConnectedLongRestCommitPreflight,
  type ConnectedLongRestOffer,
  type ConnectedLongRestOwnerDecision,
} from "./connectedLongRestPreflight";
import { connectedStateFor } from "./connectedSessionState";
import { projectedCharacterById } from "./characterSessionProjectionRegistry";
import { projectCharacterLongRest, type CharacterLongRestProjection } from "./characterLongRestProjection";
import {
  abortConnectedLongRestOwnerCandidate,
  materializeConnectedLongRestOwnerCandidate,
  prepareConnectedLongRestOwnerCandidate,
} from "./connectedLongRestOwnerPersistence";
import {
  MemoryConnectedLongRestOwnerPreparationStore,
  TauriConnectedLongRestOwnerPreparationStore,
  type ConnectedLongRestOwnerPreparationStore,
} from "./connectedLongRestOwnerPreparationStore";
import { MemoryCharacterLibraryStore } from "./memoryCharacterLibraryStore";
import { createPlatformCharacterLibraryStore, isTauriCharacterLibraryRuntime } from "./tauriCharacterLibraryStore";
import { encodeCharacterLibraryV1 } from "./characterLibraryPersistence";
import type { CharacterLibraryDocumentV1, CharacterLibraryStore } from "./persistenceContracts";
import {
  getCharacterLibraryPersistenceStateForTests,
  setCharacterLibraryStoreForTests,
} from "./characterLibraryRuntimeAdapter";
import {
  commitConnectedLongRestCampaignParticipant,
  connectedLongRestCampaignCommitId,
} from "./connectedLongRestCampaignPersistence";
import {
  createConnectedLongRestHostCoordinatorStore,
  type ConnectedLongRestHostCoordinatorStore,
  type ConnectedLongRestHostDurableRecord,
} from "./connectedLongRestHostCoordinatorStore";
import { buildCharacterSessionProjectionV1, type CharacterSessionProjectionV1 } from "./characterSessionProjection";
import { reconstructCharacterSessionProjectionV1 } from "./characterSessionProjectionReconstruction";
import { refreshReconstructedCharacterSessionProjection } from "./characterSessionProjectionMount";
import type { ConnectedLongRestWireMessage } from "./connectedLongRestWire";

const cp=<T,>(value:T):T=>structuredClone(value);

type HostRecord={
  peer:string|null;
  offer:ConnectedLongRestOffer;
  transaction?:ConnectedLongRestTransactionState;
  outcome?:"declined";
};

type ClientRecord={
  offer:ConnectedLongRestOffer;
  preview:CharacterLongRestProjection;
  beforeHp:number;
  beforeTempHp:number;
  decision?:ConnectedLongRestOwnerDecision;
  preflight?:ConnectedLongRestCommitPreflight;
  prepared?:ConnectedLongRestOwnerPrepared;
  characterStore?:CharacterLibraryStore;
  preparationStore?:ConnectedLongRestOwnerPreparationStore;
  globalCommit?:ConnectedLongRestGlobalCommit;
  materialized?:ConnectedLongRestOwnerMaterialized;
  projection?:CharacterSessionProjectionV1;
  abortedReason?:string;
};

const hostRecords=new WeakMap<MockAdapter,Map<string,HostRecord>>();
const clientRecords=new WeakMap<MockAdapter,Map<string,ClientRecord>>();
const hostCoordinatorStores=new WeakMap<MockAdapter,ConnectedLongRestHostCoordinatorStore>();

function hostMap(adapter:MockAdapter) {
  let records=hostRecords.get(adapter);
  if(!records){records=new Map();hostRecords.set(adapter,records);}
  return records;
}

function clientMap(adapter:MockAdapter) {
  let records=clientRecords.get(adapter);
  if(!records){records=new Map();clientRecords.set(adapter,records);}
  return records;
}

function hostCoordinatorStore(adapter:MockAdapter) {
  let store=hostCoordinatorStores.get(adapter);
  if(!store){store=createConnectedLongRestHostCoordinatorStore();hostCoordinatorStores.set(adapter,store);}
  return store;
}

export function setConnectedLongRestHostCoordinatorStoreForTests(adapter:MockAdapter,store:ConnectedLongRestHostCoordinatorStore) {
  hostCoordinatorStores.set(adapter,store);
}

function required(value:string,label:string) {
  const normalized=value.trim();
  if(!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function sameCharacter(left:ConnectedLongRestOffer["character"],right:ConnectedLongRestOffer["character"]) {
  return left.characterId===right.characterId
    &&left.sourceRevision===right.sourceRevision
    &&left.runtimeRevision===right.runtimeRevision;
}

function sameOptions(left:ConnectedLongRestOffer["options"],right:ConnectedLongRestOffer["options"]) {
  return left.advanceMinutes===right.advanceMinutes&&left.consumeRations===right.consumeRations;
}

function sameOffer(left:ConnectedLongRestOffer,right:ConnectedLongRestOffer) {
  return left.transactionId===right.transactionId
    &&left.sessionId===right.sessionId
    &&left.campaignId===right.campaignId
    &&left.campaignRevision===right.campaignRevision
    &&left.ownerParticipantId===right.ownerParticipantId
    &&sameCharacter(left.character,right.character)
    &&sameOptions(left.options,right.options);
}

function preflightMatchesOffer(preflight:ConnectedLongRestCommitPreflight,offer:ConnectedLongRestOffer) {
  return preflight.transactionId===offer.transactionId
    &&preflight.sessionId===offer.sessionId
    &&preflight.campaignId===offer.campaignId
    &&preflight.expectedCampaignRevision===offer.campaignRevision
    &&preflight.ownerParticipantId===offer.ownerParticipantId
    &&sameCharacter(preflight.character,offer.character)
    &&sameOptions(preflight.options,offer.options);
}

function offerFromPreflight(preflight:ConnectedLongRestCommitPreflight):ConnectedLongRestOffer {
  return {
    transactionId:preflight.transactionId,
    sessionId:preflight.sessionId,
    campaignId:preflight.campaignId,
    campaignRevision:preflight.expectedCampaignRevision,
    ownerParticipantId:preflight.ownerParticipantId,
    character:cp(preflight.character),
    options:cp(preflight.options),
  };
}

function transactionId() {
  const id=globalThis.crypto?.randomUUID?.()??`${Date.now()}.${Math.floor(Math.random()*1_000_000)}`;
  return `connected-long-rest.${id}`;
}

function ownerParticipantId(character:CharacterSheet) {
  return `client:${character.id}`;
}

function currentCampaign(snapshot:AppSnapshot,campaignId:string) {
  const campaign=snapshot.campaigns?.find((item)=>item.campaignId===campaignId);
  if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  return campaign;
}

function durableRecord(state:ConnectedLongRestTransactionState):ConnectedLongRestHostDurableRecord {
  if(state.phase==="owner-prepared") return {version:1,phase:"owner-prepared",preflight:cp(state.preflight),preparationId:state.preparationId};
  if(state.phase==="committed") return {version:1,phase:"committed",preflight:cp(state.preflight),preparationId:state.preparationId,campaignCommitId:state.campaignCommitId};
  if(state.phase==="aborted") return {version:1,phase:"aborted",preflight:cp(state.preflight),preparationId:"aborted-before-or-after-prepare",reason:state.reason};
  throw new Error(`connected Long Rest Host phase is not durable: ${state.phase}`);
}

function stateFromDurable(record:ConnectedLongRestHostDurableRecord):ConnectedLongRestTransactionState {
  let state=beginConnectedLongRestTransaction(record.preflight);
  state=recordConnectedLongRestOwnerPrepared(state,{
    transactionId:record.preflight.transactionId,
    ownerParticipantId:record.preflight.ownerParticipantId,
    character:record.preflight.character,
    preparationId:record.preparationId,
  });
  if(record.phase==="owner-prepared") return state;
  if(record.phase==="committed") return commitConnectedLongRestTransaction(state,{
    transactionId:record.preflight.transactionId,
    campaignCommitId:record.campaignCommitId!,
  });
  return abortConnectedLongRestTransaction(state,record.reason!);
}

function peerOwnsRecoveredRecord(adapter:MockAdapter,peer:string,record:HostRecord) {
  if(record.peer===peer) return true;
  if(record.peer) return false;
  const participantId=connectedStateFor(adapter).peerParticipants.get(peer);
  if(participantId!==record.offer.ownerParticipantId) return false;
  record.peer=peer;
  return true;
}

export function resetConnectedLongRestRuntime(adapter:MockAdapter) {
  hostRecords.delete(adapter);
  clientRecords.delete(adapter);
}

export async function recoverConnectedLongRestHostTransactions(adapter:MockAdapter) {
  const store=hostCoordinatorStore(adapter);
  const records=await store.readAll();
  const snapshot=await adapter.getSnapshot();
  const recovered:string[]=[];
  for(const durable of records){
    let current=durable;
    if(durable.phase==="owner-prepared"){
      const campaign=snapshot.campaigns?.find((item)=>item.campaignId===durable.preflight.campaignId);
      if(campaign?.recentRequestIds.includes(durable.preflight.transactionId)){
        current={
          ...durable,
          phase:"committed",
          campaignCommitId:connectedLongRestCampaignCommitId(durable.preflight.transactionId),
        };
      }else{
        current={
          ...durable,
          phase:"aborted",
          reason:"Host restarted before the connected Long Rest Campaign global commit",
        };
      }
      await store.write(current);
    }
    const transaction=stateFromDurable(current);
    hostMap(adapter).set(current.preflight.transactionId,{
      peer:null,
      offer:offerFromPreflight(current.preflight),
      transaction,
    });
    recovered.push(current.preflight.transactionId);
  }
  return recovered;
}

export interface ConnectedLongRestOwnerPrompt {
  offer:ConnectedLongRestOffer;
  hp:{before:number;after:number};
  tempHp:{before:number;after:number};
  accepted?:boolean;
  phase:"offered"|"declined"|"accepted"|"prepared"|"committed"|"complete"|"aborted";
  error?:string;
}

export function connectedLongRestOwnerPrompts(adapter:MockAdapter):ConnectedLongRestOwnerPrompt[] {
  return [...clientMap(adapter).values()].map((record)=>({
    offer:cp(record.offer),
    hp:{before:record.beforeHp,after:record.preview.sheet.hp},
    tempHp:{before:record.beforeTempHp,after:record.preview.sheet.tempHp},
    accepted:record.decision?.accepted,
    phase:record.abortedReason?"aborted"
      :record.materialized?"complete"
      :record.globalCommit?"committed"
      :record.prepared?"prepared"
      :record.decision?.accepted===false?"declined"
      :record.decision?.accepted?"accepted"
      :"offered",
    error:record.abortedReason,
  }));
}

export async function beginConnectedLongRestHostOffer(adapter:MockAdapter,input:{
  characterId:string;
  transactionId?:string;
  advanceMinutes?:number;
  consumeRations?:boolean;
}) {
  const state=connectedStateFor(adapter);
  if(state.mode!=="host"||!state.sessionId||!state.ledger) throw new Error("connected Long Rest offer requires an active Host session");
  const characterId=required(input.characterId,"connected Long Rest Character id");
  const mounted=projectedCharacterById(adapter,characterId);
  if(!mounted) throw new Error(`connected Long Rest requires a mounted remote Character: ${characterId}`);
  const participantId=state.peerParticipants.get(mounted.peerId);
  if(!participantId) throw new Error(`connected Long Rest Character owner is not an accepted participant: ${characterId}`);
  const manifest=state.peerManifests.get(mounted.peerId);
  if(!manifest?.capabilities.includes("connected-long-rest-v1")) throw new Error("connected Long Rest owner does not advertise connected-long-rest-v1");
  const snapshot=await adapter.getSnapshot();
  const systems=snapshot.campaignSessionSystems;
  if(!systems) throw new Error("connected Long Rest requires an active Campaign session");
  const advanceMinutes=input.advanceMinutes??0;
  if(!Number.isInteger(advanceMinutes)||advanceMinutes<0) throw new Error("connected Long Rest advanceMinutes must be a non-negative integer");
  const offer:ConnectedLongRestOffer={
    transactionId:required(input.transactionId??transactionId(),"connected Long Rest transaction id"),
    sessionId:state.sessionId,
    campaignId:systems.campaignId,
    campaignRevision:systems.campaignRevision,
    ownerParticipantId:participantId,
    character:{
      characterId:mounted.characterId,
      sourceRevision:mounted.sourceRevision,
      runtimeRevision:mounted.runtimeRevision,
    },
    options:{advanceMinutes,consumeRations:input.consumeRations??false},
  };
  const existing=hostMap(adapter).get(offer.transactionId);
  if(existing){
    if(existing.peer!==mounted.peerId||!sameOffer(existing.offer,offer)) throw new Error("connected Long Rest transaction id is already used by a different offer");
    return {peer:existing.peer,offer:cp(existing.offer)};
  }
  hostMap(adapter).set(offer.transactionId,{peer:mounted.peerId,offer:cp(offer)});
  return {peer:mounted.peerId,offer};
}

export function receiveConnectedLongRestOwnerOffer(adapter:MockAdapter,offer:ConnectedLongRestOffer) {
  const state=connectedStateFor(adapter);
  const app=adapter as unknown as {activeCharacter:CharacterSheet};
  if(state.mode!=="client"||!state.sessionId) throw new Error("connected Long Rest offer requires an active Client session");
  if(offer.sessionId!==state.sessionId) throw new Error("connected Long Rest offer session is stale");
  if(offer.ownerParticipantId!==ownerParticipantId(app.activeCharacter)) throw new Error("connected Long Rest offer is addressed to another owner");
  if(offer.character.characterId!==app.activeCharacter.id) throw new Error("connected Long Rest offer Character does not match the active owner Character");
  if(offer.character.sourceRevision!==(app.activeCharacter.sourceRevision??0)||offer.character.runtimeRevision!==(app.activeCharacter.runtimeRevision??0)){
    throw new Error("connected Long Rest offer Character revision is stale");
  }
  const existing=clientMap(adapter).get(offer.transactionId);
  if(existing){
    if(!sameOffer(existing.offer,offer)) throw new Error("connected Long Rest transaction changed during retry");
    return cp(existing.preview);
  }
  const preview=projectCharacterLongRest(app.activeCharacter);
  clientMap(adapter).set(offer.transactionId,{
    offer:cp(offer),
    preview:cp(preview),
    beforeHp:app.activeCharacter.hp,
    beforeTempHp:app.activeCharacter.tempHp,
  });
  return preview;
}

export function decideConnectedLongRestOwnerOffer(adapter:MockAdapter,transaction:string,accepted:boolean):ConnectedLongRestOwnerDecision {
  const id=required(transaction,"connected Long Rest transaction id");
  const record=clientMap(adapter).get(id);
  if(!record) throw new Error(`connected Long Rest offer is missing: ${id}`);
  const app=adapter as unknown as {activeCharacter:CharacterSheet};
  if(record.offer.character.characterId!==app.activeCharacter.id
    ||record.offer.character.sourceRevision!==(app.activeCharacter.sourceRevision??0)
    ||record.offer.character.runtimeRevision!==(app.activeCharacter.runtimeRevision??0)){
    throw new Error("connected Long Rest Character changed before owner decision");
  }
  if(record.decision&&record.decision.accepted!==accepted) throw new Error("connected Long Rest owner decision cannot change after submission");
  const decision:ConnectedLongRestOwnerDecision={
    transactionId:id,
    sessionId:record.offer.sessionId,
    ownerParticipantId:record.offer.ownerParticipantId,
    character:cp(record.offer.character),
    accepted,
  };
  record.decision=decision;
  return cp(decision);
}

export async function authorizeConnectedLongRestHostDecision(adapter:MockAdapter,peer:string,decision:ConnectedLongRestOwnerDecision) {
  const record=hostMap(adapter).get(decision.transactionId);
  if(!record) return {status:"rejected" as const,error:"connected Long Rest Host offer is missing"};
  if(record.peer!==peer) return {status:"rejected" as const,error:"connected Long Rest decision came from the wrong peer"};
  const state=connectedStateFor(adapter);
  const mounted=projectedCharacterById(adapter,record.offer.character.characterId);
  const snapshot=await adapter.getSnapshot();
  if(!state.sessionId||!mounted) return {status:"rejected" as const,error:"connected Long Rest current Character authority is unavailable"};
  const participantId=state.peerParticipants.get(peer);
  const campaign=currentCampaign(snapshot,record.offer.campaignId);
  const result=preflightConnectedLongRest(record.offer,decision,{
    sessionId:state.sessionId,
    campaignId:campaign.campaignId,
    campaignRevision:campaign.revision,
    registeredOwnerParticipantId:participantId??"",
    projection:mounted.projection,
  });
  if(result.status==="declined"){
    record.outcome="declined";
    return result;
  }
  if(result.status==="rejected") return result;
  if(record.transaction){
    if(record.transaction.preflight.transactionId!==result.preflight.transactionId) return {status:"rejected" as const,error:"connected Long Rest Host transaction identity changed"};
    return result;
  }
  record.transaction=beginConnectedLongRestTransaction(result.preflight);
  return result;
}

function memoryCharacterStore(document:CharacterLibraryDocumentV1) {
  const store=new MemoryCharacterLibraryStore();
  store.seed(document.storageRevision,encodeCharacterLibraryV1(document));
  return store;
}

export async function prepareAuthorizedConnectedLongRestOwner(adapter:MockAdapter,preflight:ConnectedLongRestCommitPreflight) {
  const record=clientMap(adapter).get(preflight.transactionId);
  if(!record) throw new Error("connected Long Rest owner offer is missing");
  if(!record.decision?.accepted) throw new Error("connected Long Rest owner did not accept this transaction");
  if(!preflightMatchesOffer(preflight,record.offer)) throw new Error("connected Long Rest prepare authorization does not match the accepted offer");
  if(record.prepared) return cp(record.prepared);

  const snapshot=await adapter.getSnapshot();
  const persistence=getCharacterLibraryPersistenceStateForTests(adapter);
  const document=persistence?.document;
  if(!document) throw new Error("connected Long Rest owner requires a hydrated Character library");
  let characterStore:CharacterLibraryStore;
  let preparationStore:ConnectedLongRestOwnerPreparationStore;
  if(isTauriCharacterLibraryRuntime()){
    characterStore=createPlatformCharacterLibraryStore();
    preparationStore=new TauriConnectedLongRestOwnerPreparationStore();
  }else{
    const memory=memoryCharacterStore(document);
    characterStore=memory;
    preparationStore=new MemoryConnectedLongRestOwnerPreparationStore(memory);
  }
  const prepared=await prepareConnectedLongRestOwnerCandidate({
    preflight,
    currentDocument:document,
    currentCharacter:snapshot.activeCharacter,
    characterStore,
    preparationStore,
  });
  record.preflight=cp(preflight);
  record.prepared=cp(prepared.prepared);
  record.characterStore=characterStore;
  record.preparationStore=preparationStore;
  return cp(prepared.prepared);
}

export async function recordConnectedLongRestHostOwnerPrepared(adapter:MockAdapter,peer:string,prepared:ConnectedLongRestOwnerPrepared) {
  const record=hostMap(adapter).get(prepared.transactionId);
  if(!record||record.peer!==peer||!record.transaction) throw new Error("connected Long Rest owner prepare is not authorized by this Host transaction");
  if(record.transaction.phase==="committed"||record.transaction.phase==="complete"){
    return {
      status:"committed" as const,
      peer,
      commit:{transactionId:record.transaction.preflight.transactionId,campaignCommitId:record.transaction.campaignCommitId},
      snapshot:await adapter.getSnapshot(),
    };
  }
  if(record.transaction.phase==="aborted"){
    return {status:"aborted" as const,peer,transactionId:prepared.transactionId,reason:record.transaction.reason};
  }
  const ownerPrepared=record.transaction.phase==="owner-prepared"
    ?record.transaction
    :recordConnectedLongRestOwnerPrepared(record.transaction,prepared);
  record.transaction=ownerPrepared;
  const store=hostCoordinatorStore(adapter);
  try{
    await store.write(durableRecord(ownerPrepared));
  }catch(error){
    const reason=`connected Long Rest Host durable prepare failed: ${error instanceof Error?error.message:String(error)}`;
    record.transaction=abortConnectedLongRestTransaction(ownerPrepared,reason);
    await store.write(durableRecord(record.transaction)).catch(()=>undefined);
    return {status:"aborted" as const,peer,transactionId:prepared.transactionId,reason};
  }

  try{
    const campaign=await commitConnectedLongRestCampaignParticipant(adapter,ownerPrepared.preflight);
    const commit:ConnectedLongRestGlobalCommit={transactionId:prepared.transactionId,campaignCommitId:campaign.campaignCommitId};
    record.transaction=commitConnectedLongRestTransaction(record.transaction,commit);
    let persistenceWarning:string|undefined;
    try{await store.write(durableRecord(record.transaction));}
    catch(error){persistenceWarning=`Host coordinator commit phase persistence needs recovery: ${error instanceof Error?error.message:String(error)}`;}
    return {
      status:"committed" as const,
      peer,
      commit,
      snapshot:campaign.snapshot,
      projectionWarning:[campaign.projectionWarning,persistenceWarning].filter(Boolean).join(" · ")||undefined,
    };
  }catch(error){
    const reason=error instanceof Error?error.message:String(error);
    record.transaction=abortConnectedLongRestTransaction(record.transaction,reason);
    await store.write(durableRecord(record.transaction)).catch(()=>undefined);
    return {status:"aborted" as const,peer,transactionId:prepared.transactionId,reason};
  }
}

export async function materializeConnectedLongRestOwnerAfterGlobalCommit(adapter:MockAdapter,commit:ConnectedLongRestGlobalCommit) {
  const record=clientMap(adapter).get(commit.transactionId);
  if(!record?.prepared||!record.preflight||!record.characterStore||!record.preparationStore){
    throw new Error("connected Long Rest owner preparation is missing for global commit");
  }
  if(record.globalCommit&&record.globalCommit.campaignCommitId!==commit.campaignCommitId){
    throw new Error("connected Long Rest global commit identity changed during retry");
  }
  record.globalCommit=cp(commit);
  if(record.materialized&&record.projection){
    return {materialized:cp(record.materialized),projection:cp(record.projection),snapshot:await adapter.getSnapshot()};
  }
  await materializeConnectedLongRestOwnerCandidate(record.preparationStore,record.prepared);
  setCharacterLibraryStoreForTests(adapter,record.characterStore);
  const snapshot=await adapter.getSnapshot();
  const projection=buildCharacterSessionProjectionV1(snapshot.activeCharacter,snapshot.catalog);
  const materialized:ConnectedLongRestOwnerMaterialized={
    transactionId:record.prepared.transactionId,
    ownerParticipantId:record.prepared.ownerParticipantId,
    character:cp(record.prepared.character),
    preparationId:record.prepared.preparationId,
  };
  record.materialized=cp(materialized);
  record.projection=cp(projection);
  return {materialized,projection,snapshot};
}

export async function abortConnectedLongRestOwner(adapter:MockAdapter,transaction:string,reason:string) {
  const id=required(transaction,"connected Long Rest transaction id");
  const record=clientMap(adapter).get(id);
  if(!record) return;
  if(record.globalCommit||record.materialized) throw new Error("committed connected Long Rest owner transaction cannot be aborted");
  record.abortedReason=required(reason,"connected Long Rest abort reason");
  if(record.prepared&&record.preparationStore){
    await abortConnectedLongRestOwnerCandidate(record.preparationStore,record.prepared);
  }
}

export async function completeConnectedLongRestHostOwnerMaterialization(
  adapter:MockAdapter,
  peer:string,
  materialized:ConnectedLongRestOwnerMaterialized,
  projection:CharacterSessionProjectionV1,
) {
  const record=hostMap(adapter).get(materialized.transactionId);
  if(!record||!record.transaction||!peerOwnsRecoveredRecord(adapter,peer,record)) throw new Error("connected Long Rest Host transaction is missing for owner materialization");
  if(record.transaction.phase!=="committed"){
    if(record.transaction.phase==="complete") return cp(record.transaction);
    throw new Error(`connected Long Rest owner materialization is invalid during ${record.transaction.phase}`);
  }
  const state=connectedStateFor(adapter);
  const manifest=state.peerManifests.get(peer);
  if(!manifest?.character) throw new Error("connected Long Rest owner materialization requires the accepted Character manifest");
  if(projection.characterId!==materialized.character.characterId) throw new Error("connected Long Rest materialized projection Character mismatch");
  if(projection.sourceRevision!==materialized.character.sourceRevision) throw new Error("connected Long Rest materialized projection source revision changed");
  if(projection.runtimeRevision<=materialized.character.runtimeRevision) throw new Error("connected Long Rest materialized projection did not advance runtime revision");
  const app=adapter as unknown as {catalog:AppSnapshot["catalog"]};
  const reconstructed=reconstructCharacterSessionProjectionV1(projection,app.catalog);
  if(reconstructed.status==="rejected") throw new Error(reconstructed.error);
  const refreshed=refreshReconstructedCharacterSessionProjection(adapter,peer,reconstructed);
  if(refreshed.status==="rejected") throw new Error(refreshed.error);
  record.transaction=recordConnectedLongRestOwnerMaterialized(record.transaction,materialized);
  state.peerManifests.set(peer,{
    ...manifest,
    character:{
      characterId:projection.characterId,
      sourceRevision:projection.sourceRevision,
      runtimeRevision:projection.runtimeRevision,
    },
  });
  await hostCoordinatorStore(adapter).delete(materialized.transactionId).catch(()=>undefined);
  return cp(record.transaction);
}

export function connectedLongRestHostRecoveryMessages(adapter:MockAdapter,peer:string):ConnectedLongRestWireMessage[] {
  const messages:ConnectedLongRestWireMessage[]=[];
  for(const record of hostMap(adapter).values()){
    if(record.outcome==="declined"||!peerOwnsRecoveredRecord(adapter,peer,record)) continue;
    if(!record.transaction){messages.push({type:"long-rest-offer",offer:cp(record.offer)});continue;}
    if(record.transaction.phase==="approved"){
      messages.push({type:"long-rest-prepare-authorized",preflight:cp(record.transaction.preflight)});
    }else if(record.transaction.phase==="committed"){
      messages.push({type:"long-rest-global-commit",commit:{transactionId:record.transaction.preflight.transactionId,campaignCommitId:record.transaction.campaignCommitId}});
    }else if(record.transaction.phase==="aborted"){
      messages.push({type:"long-rest-abort",transactionId:record.transaction.preflight.transactionId,reason:record.transaction.reason});
    }
  }
  return messages;
}

export function connectedLongRestClientRecoveryMessages(adapter:MockAdapter):ConnectedLongRestWireMessage[] {
  const messages:ConnectedLongRestWireMessage[]=[];
  for(const record of clientMap(adapter).values()){
    if(record.abortedReason||record.decision?.accepted===false) continue;
    if(record.materialized&&record.projection){
      messages.push({type:"long-rest-owner-materialized",materialized:cp(record.materialized),projection:cp(record.projection)});
    }else if(record.prepared){
      messages.push({type:"long-rest-owner-prepared",prepared:cp(record.prepared)});
    }else if(record.decision){
      messages.push({type:"long-rest-decision",decision:cp(record.decision)});
    }
  }
  return messages;
}
