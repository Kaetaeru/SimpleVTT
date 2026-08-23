import type { CampaignRecordV1 } from "./campaignPersistenceContracts";
import type { DmInventoryAdjustmentCommand, PartyStashTransferCommand, SessionCharacterInventoryVm } from "./contracts";
import { buildCharacterSessionProjectionV1, type CharacterSessionProjectionV1 } from "./characterSessionProjection";
import { reconstructCharacterSessionProjectionV1 } from "./characterSessionProjectionReconstruction";
import { refreshReconstructedCharacterSessionProjection } from "./characterSessionProjectionMount";
import { projectedCharacterById } from "./characterSessionProjectionRegistry";
import { connectedStateFor } from "./connectedSessionState";
import { publishConnectedSnapshot } from "./connectedSessionRuntimeAdapter";
import {
  TauriConnectedOwnerInventoryJournalStore,
  type ConnectedOwnerInventoryFinalOutcome,
  type ConnectedOwnerInventoryJournalStore,
} from "./connectedOwnerInventoryJournalStore";
import {
  connectedPartyStashHostCoordinatorStoreFor,
  type ConnectedPartyStashHostCoordinatorRecord,
} from "./connectedPartyStashHostCoordinatorStore";
import { refreshSessionCharacterInventoryProjection } from "./sessionInventoryRuntimeAdapter";
import { isTauriCharacterLibraryRuntime } from "./tauriCharacterLibraryStore";
import { MockAdapter } from "./mockAdapter";
import { tauriSessionTransport, type SessionTransportMessage } from "./tauriSessionTransport";

type RecoveryOutcome=ConnectedOwnerInventoryFinalOutcome;
interface PartyStashOwnerRecoveryRequest {type:"campaign-party-stash-owner-recovery";sessionId:string;requestId:string;actorId:string;outcome:RecoveryOutcome;command:DmInventoryAdjustmentCommand;}
interface PartyStashOwnerRecoveryResult {type:"campaign-party-stash-owner-recovery-result";sessionId:string;requestId:string;actorId:string;outcome:RecoveryOutcome;accepted:boolean;error?:string;projection?:CharacterSessionProjectionV1;}
type Raw=Record<string,unknown>;

const cp=<T,>(value:T):T=>structuredClone(value);
const pending=new WeakMap<MockAdapter,Map<string,{peer:string;actorId:string;outcome:RecoveryOutcome;resolve(projection:CharacterSessionProjectionV1):void;reject(error:Error):void;timer:ReturnType<typeof setTimeout>}>>();
const recoveryJournalStores=new WeakMap<MockAdapter,ConnectedOwnerInventoryJournalStore>();
let activeHostAdapter:MockAdapter|null=null;
let registeringClientAdapter:MockAdapter|null=null;
const baseSendTo=tauriSessionTransport.sendTo.bind(tauriSessionTransport);
const baseOnMessage=tauriSessionTransport.onMessage.bind(tauriSessionTransport);
const baseHostSession=MockAdapter.prototype.hostSession;
const baseJoinSession=MockAdapter.prototype.joinSession;
const baseStopSession=MockAdapter.prototype.stopSession;

function object(value:unknown):Raw|undefined{return value&&typeof value==="object"&&!Array.isArray(value)?value as Raw:undefined;}
function compatibleHelloAck(raw:string){try{const value=object(JSON.parse(raw));const compatibility=object(value?.compatibility);return value?.type==="hello-ack"&&typeof value.sessionId==="string"&&compatibility?.status==="compatible"?value.sessionId:null;}catch{return null;}}

export function partyStashOwnerInventoryCommand(command:PartyStashTransferCommand):DmInventoryAdjustmentCommand {
  if(command.asset==="currency")return {requestId:command.requestId,actorId:command.actorId,operation:command.direction==="character-to-stash"?"revoke-currency":"grant-currency",amount:command.amount};
  if(command.direction==="character-to-stash")return {requestId:command.requestId,actorId:command.actorId,operation:"revoke-item",itemId:command.itemId,quantity:command.quantity,forceUnequip:command.forceUnequip};
  if(command.itemTemplate)return {requestId:command.requestId,actorId:command.actorId,operation:"grant-item-template",itemTemplate:cp(command.itemTemplate),quantity:command.quantity};
  if(command.catalogEntryId)return {requestId:command.requestId,actorId:command.actorId,operation:"grant-item",catalogEntryId:command.catalogEntryId,quantity:command.quantity};
  throw new Error("Party Stash recovery is missing a catalog entry or item template");
}

export function connectedPartyStashRecoveryOutcome(record:ConnectedPartyStashHostCoordinatorRecord,campaign:CampaignRecordV1):RecoveryOutcome {
  if(campaign.campaignId!==record.campaignId)throw new Error("Party Stash recovery Campaign identity mismatch");
  const committed=campaign.recentRequestIds.includes(record.requestId);
  const compensated=campaign.recentRequestIds.includes(`${record.requestId}.compensate`);
  return committed&&!compensated?"applied":"undone";
}

function recoveryJournalStore(adapter:MockAdapter){
  const injected=recoveryJournalStores.get(adapter);if(injected)return injected;
  if(!isTauriCharacterLibraryRuntime())return null;
  const store=new TauriConnectedOwnerInventoryJournalStore();recoveryJournalStores.set(adapter,store);return store;
}
export function setConnectedPartyStashRecoveryJournalStoreForTests(adapter:MockAdapter,store:ConnectedOwnerInventoryJournalStore){recoveryJournalStores.set(adapter,store);}

function decodeRequest(raw:string):PartyStashOwnerRecoveryRequest|null{try{
  const value=object(JSON.parse(raw));const command=object(value?.command);
  if(value?.type!=="campaign-party-stash-owner-recovery"||typeof value.sessionId!=="string"||typeof value.requestId!=="string"||typeof value.actorId!=="string"||(value.outcome!=="applied"&&value.outcome!=="undone")||!command)return null;
  if(command.requestId!==value.requestId||command.actorId!==value.actorId||typeof command.operation!=="string")return null;
  return value as unknown as PartyStashOwnerRecoveryRequest;
}catch{return null;}}
function decodeResult(raw:string):PartyStashOwnerRecoveryResult|null{try{
  const value=object(JSON.parse(raw));
  if(value?.type!=="campaign-party-stash-owner-recovery-result"||typeof value.sessionId!=="string"||typeof value.requestId!=="string"||typeof value.actorId!=="string"||(value.outcome!=="applied"&&value.outcome!=="undone")||typeof value.accepted!=="boolean"||(value.error!==undefined&&typeof value.error!=="string"))return null;
  if(value.accepted&&!object(value.projection))return null;
  return value as unknown as PartyStashOwnerRecoveryResult;
}catch{return null;}}

async function finalizeRecoveredOwnerJournal(adapter:MockAdapter,requestId:string,outcome:RecoveryOutcome){
  const store=recoveryJournalStore(adapter);if(!store)return;
  const record=await store.read(requestId);
  if(!record){if(outcome==="applied")throw new Error("recovered owner apply did not create a durable journal");return;}
  await store.finalize(requestId,outcome);
}

async function handleRecoveryClient(adapter:MockAdapter,peer:string,request:PartyStashOwnerRecoveryRequest){
  let error:string|undefined;let projection:CharacterSessionProjectionV1|undefined;
  try{
    const state=connectedStateFor(adapter);const snapshot=await adapter.getSnapshot();
    if(state.mode!=="client"||state.sessionId!==request.sessionId)throw new Error("Party Stash recovery session mismatch");
    if(snapshot.activeCharacter.id!==request.actorId)throw new Error("Party Stash recovery targets another owner Character");
    if(request.outcome==="applied")await adapter.adjustDmInventory(request.command);else await adapter.undoDmInventoryAdjustment(request.requestId);
    await finalizeRecoveredOwnerJournal(adapter,request.requestId,request.outcome);
    const after=await adapter.getSnapshot();projection=buildCharacterSessionProjectionV1(after.activeCharacter,after.catalog);
  }catch(cause){error=cause instanceof Error?cause.message:String(cause);}
  await baseSendTo(peer,JSON.stringify({type:"campaign-party-stash-owner-recovery-result",sessionId:request.sessionId,requestId:request.requestId,actorId:request.actorId,outcome:request.outcome,accepted:!error,...(error?{error}:{projection})} satisfies PartyStashOwnerRecoveryResult));
}

async function refreshRecoveredHostProjection(host:MockAdapter,peer:string,actorId:string,projection:CharacterSessionProjectionV1){
  const state=connectedStateFor(host);const manifest=state.peerManifests.get(peer);const mounted=projectedCharacterById(host,actorId);
  if(state.mode!=="host"||!state.sessionId||!manifest?.character||!mounted)throw new Error("Party Stash recovery owner projection is unavailable");
  if(mounted.peerId!==peer||manifest.character.characterId!==actorId||projection.characterId!==actorId)throw new Error("Party Stash recovery owner identity changed");
  if(projection.sourceRevision!==manifest.character.sourceRevision)throw new Error("Party Stash recovery source revision changed");
  if(projection.runtimeRevision<manifest.character.runtimeRevision)throw new Error("Party Stash recovery runtime revision moved backwards");
  const snapshot=await host.getSnapshot();const reconstructed=reconstructCharacterSessionProjectionV1(projection,snapshot.catalog);if(reconstructed.status==="rejected")throw new Error(reconstructed.error);
  const refreshed=refreshReconstructedCharacterSessionProjection(host,peer,reconstructed);if(refreshed.status==="rejected")throw new Error(refreshed.error);
  refreshSessionCharacterInventoryProjection(host,{characterId:reconstructed.sheet.id,characterName:reconstructed.sheet.name,revision:projection.runtimeRevision,goldGp:reconstructed.sheet.goldGp??0,items:cp(reconstructed.sheet.items)} satisfies SessionCharacterInventoryVm);
  state.peerManifests.set(peer,{...manifest,character:{characterId:projection.characterId,sourceRevision:projection.sourceRevision,runtimeRevision:projection.runtimeRevision}});
  await publishConnectedSnapshot(host);
}

function pendingMap(adapter:MockAdapter){let map=pending.get(adapter);if(!map){map=new Map();pending.set(adapter,map);}return map;}
async function requestOwnerRecovery(host:MockAdapter,peer:string,record:ConnectedPartyStashHostCoordinatorRecord,outcome:RecoveryOutcome){
  const state=connectedStateFor(host);if(state.mode!=="host"||!state.sessionId)throw new Error("Party Stash recovery requires an active Host session");
  const key=`${record.requestId}:${outcome}`;const map=pendingMap(host);if(map.has(key))throw new Error("Party Stash recovery request is already pending");
  const request:PartyStashOwnerRecoveryRequest={type:"campaign-party-stash-owner-recovery",sessionId:state.sessionId,requestId:record.requestId,actorId:record.actorId,outcome,command:partyStashOwnerInventoryCommand(record.command)};
  const wait=new Promise<CharacterSessionProjectionV1>((resolve,reject)=>{const timer=setTimeout(()=>{map.delete(key);reject(new Error("Party Stash owner recovery response timed out"));},8000);map.set(key,{peer,actorId:record.actorId,outcome,resolve,reject,timer});});
  try{await baseSendTo(peer,JSON.stringify(request));}catch(error){const current=map.get(key);if(current){clearTimeout(current.timer);map.delete(key);}throw error;}
  return wait;
}

async function settleRecoveryHost(host:MockAdapter,message:SessionTransportMessage,result:PartyStashOwnerRecoveryResult){
  const state=connectedStateFor(host);if(state.sessionId!==result.sessionId)return;
  const key=`${result.requestId}:${result.outcome}`;const map=pending.get(host);const current=map?.get(key);if(!current||current.peer!==message.peer||current.actorId!==result.actorId)return;
  clearTimeout(current.timer);map?.delete(key);
  if(!result.accepted||!result.projection){current.reject(new Error(result.error||"Party Stash owner recovery was rejected"));return;}
  try{await refreshRecoveredHostProjection(host,message.peer,result.actorId,result.projection);current.resolve(result.projection);}catch(error){current.reject(error instanceof Error?error:new Error(String(error)));}
}

export async function recoverConnectedPartyStashHostForPeer(host:MockAdapter,peer:string){
  const state=connectedStateFor(host);const participantId=state.peerParticipants.get(peer);if(state.mode!=="host"||!state.sessionId||!participantId)return [] as string[];
  const store=connectedPartyStashHostCoordinatorStoreFor(host);const records=(await store.readAll()).filter((record)=>record.ownerParticipantId===participantId);
  const recovered:string[]=[];
  for(const record of records){
    const snapshot=await host.getSnapshot();const campaign=snapshot.campaigns?.find((entry)=>entry.campaignId===record.campaignId);if(!campaign)throw new Error(`Party Stash recovery Campaign is missing: ${record.campaignId}`);
    const outcome=connectedPartyStashRecoveryOutcome(record,campaign);
    await requestOwnerRecovery(host,peer,record,outcome);
    await store.delete(record.requestId);
    recovered.push(record.requestId);
  }
  return recovered;
}

async function sendToWithPartyStashRecovery(peer:string,message:string){
  const result=await baseSendTo(peer,message);const sessionId=compatibleHelloAck(message);const host=activeHostAdapter;
  if(host&&sessionId&&connectedStateFor(host).sessionId===sessionId)await recoverConnectedPartyStashHostForPeer(host,peer).catch(()=>undefined);
  return result;
}
async function onMessageWithPartyStashRecovery(handler:(message:SessionTransportMessage)=>void){
  const client=registeringClientAdapter;
  return baseOnMessage((message)=>{
    const request=decodeRequest(message.message);if(client&&request){void handleRecoveryClient(client,message.peer,request);return;}
    const result=decodeResult(message.message);if(activeHostAdapter&&result){void settleRecoveryHost(activeHostAdapter,message,result);return;}
    handler(message);
  });
}

tauriSessionTransport.sendTo=sendToWithPartyStashRecovery;
tauriSessionTransport.onMessage=onMessageWithPartyStashRecovery;
MockAdapter.prototype.hostSession=async function hostSessionWithPartyStashRecovery(){activeHostAdapter=this;return baseHostSession.call(this);};
MockAdapter.prototype.joinSession=async function joinSessionWithPartyStashRecovery(address:string){registeringClientAdapter=this;try{return await baseJoinSession.call(this,address);}finally{registeringClientAdapter=null;}};
MockAdapter.prototype.stopSession=async function stopSessionWithPartyStashRecovery(){const result=await baseStopSession.call(this);pending.delete(this);recoveryJournalStores.delete(this);if(activeHostAdapter===this)activeHostAdapter=null;if(registeringClientAdapter===this)registeringClientAdapter=null;return result;};

export {};
