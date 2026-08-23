import type { CampaignSessionSystemsProjection } from "./campaignPersistenceContracts";
import type { DmInventoryAdjustmentCommand, PartyStashTransferCommand, SessionCharacterInventoryVm } from "./contracts";
import { connectedStateFor } from "./connectedSessionState";
import { publishConnectedSnapshot } from "./connectedSessionRuntimeAdapter";
import { buildCharacterSessionProjectionV1, type CharacterSessionProjectionV1 } from "./characterSessionProjection";
import { reconstructCharacterSessionProjectionV1 } from "./characterSessionProjectionReconstruction";
import { refreshReconstructedCharacterSessionProjection } from "./characterSessionProjectionMount";
import { projectedCharacterById } from "./characterSessionProjectionRegistry";
import { refreshSessionCharacterInventoryProjection } from "./sessionInventoryRuntimeAdapter";
import { MockAdapter } from "./mockAdapter";
import { tauriSessionTransport, type SessionTransportMessage } from "./tauriSessionTransport";

interface CampaignSystemsEnvelope {type:"campaign-systems-projection";sessionId:string;revision:number;projection:CampaignSessionSystemsProjection;}
interface CampaignLevelUpCompleteRequest {type:"campaign-level-up-complete";sessionId:string;requestId:string;campaignId:string;rosterMemberId:string;characterId:string;level:number;}
type PartyStashDepositCommand=PartyStashTransferCommand;
interface CampaignStashDepositRequest {type:"campaign-stash-deposit";sessionId:string;command:PartyStashDepositCommand;}
interface CampaignStashDepositResult {type:"campaign-stash-deposit-result";sessionId:string;requestId:string;accepted:boolean;error?:string;}
type CampaignOwnerInventoryRequest=
  | {type:"campaign-owner-inventory";sessionId:string;correlationId:string;operation:"apply";command:DmInventoryAdjustmentCommand}
  | {type:"campaign-owner-inventory";sessionId:string;correlationId:string;operation:"undo";actorId:string;requestId:string};
interface CampaignOwnerInventoryResult {type:"campaign-owner-inventory-result";sessionId:string;correlationId:string;actorId:string;accepted:boolean;error?:string;projection?:CharacterSessionProjectionV1;}
type Raw=Record<string,unknown>;
const remoteProjections=new WeakMap<MockAdapter,{sessionId:string;revision:number;projection:CampaignSessionSystemsProjection}>();
let activeHostAdapter:MockAdapter|null=null;
let registeringClientAdapter:MockAdapter|null=null;
const baseSendTo=tauriSessionTransport.sendTo.bind(tauriSessionTransport);
const baseOnMessage=tauriSessionTransport.onMessage.bind(tauriSessionTransport);
const handledLevelUpRequests=new Set<string>();
const pendingStashDeposits=new WeakMap<MockAdapter,Map<string,{resolve():void;reject(error:Error):void;timer:ReturnType<typeof setTimeout>;rollback:boolean}>>();
const pendingOwnerInventory=new WeakMap<MockAdapter,Map<string,{peer:string;actorId:string;resolve(projection:CharacterSessionProjectionV1):void;reject(error:Error):void;timer:ReturnType<typeof setTimeout>}>>();
const remoteOwnerMutationRoutes=new WeakMap<MockAdapter,Map<string,{peer:string;actorId:string}>>();
const lastRemoteOwnerMutation=new WeakMap<MockAdapter,string>();

function object(value:unknown):Raw|undefined{return value&&typeof value==="object"&&!Array.isArray(value)?value as Raw:undefined;}
function safeProjection(projection:CampaignSessionSystemsProjection):CampaignSessionSystemsProjection{
  const copy=structuredClone(projection);
  if(!copy.rations.visibleToPlayers){
    copy.rations={enabled:copy.rations.enabled,visibleToPlayers:false};
    copy.roster=copy.roster.map(({countsForRations:_,rationUnitsPerDay:__,...member})=>member);
  }
  return copy;
}
export function decodeCampaignSystemsEnvelope(raw:string):CampaignSystemsEnvelope|null{
  let value:unknown;try{value=JSON.parse(raw);}catch{return null;}
  const record=object(value);const projection=object(record?.projection);const calendar=object(projection?.calendar);const rations=object(projection?.rations);const partyStash=object(projection?.partyStash);const stashWallet=object(partyStash?.wallet);
  if(record?.type!=="campaign-systems-projection"||typeof record.sessionId!=="string"||!record.sessionId||!Number.isInteger(record.revision)||Number(record.revision)<1) return null;
  if(typeof projection?.campaignId!=="string"||typeof projection.campaignName!=="string"||!Number.isInteger(projection.campaignRevision)) return null;
  if(!Array.isArray(projection.roster)||projection.roster.some((value)=>{const member=object(value);return typeof member?.rosterMemberId!=="string"||typeof member.label!=="string"||typeof member.kind!=="string"||typeof member.active!=="boolean";})) return null;
  if(typeof calendar?.enabled!=="boolean"||typeof calendar.providerId!=="string"||!Number.isInteger(calendar.absoluteMinute)||!object(calendar.displayAnchor)) return null;
  if(typeof rations?.enabled!=="boolean"||typeof rations.visibleToPlayers!=="boolean") return null;
  for(const key of ["balance","dailyRequired","shortage"] as const) if(rations[key]!==undefined&&(!Number.isInteger(rations[key])||Number(rations[key])<0)) return null;
  if(!Number.isInteger(partyStash?.revision)||Number(partyStash?.revision)<1||typeof partyStash?.policy!=="string"||!stashWallet||!Array.isArray(partyStash?.itemReferences)) return null;
  for(const key of ["gp","sp","cp"] as const) if(!Number.isInteger(stashWallet?.[key])||Number(stashWallet[key])<0) return null;
  if(partyStash.itemReferences.some((value)=>{const item=object(value);return typeof item?.instanceId!=="string"||typeof item.definitionId!=="string"||!Number.isInteger(item.quantity)||Number(item.quantity)<1;})) return null;
  return {type:"campaign-systems-projection",sessionId:record.sessionId,revision:Number(record.revision),projection:structuredClone(projection) as unknown as CampaignSessionSystemsProjection};
}
function compatibleHelloAck(raw:string){try{const value=object(JSON.parse(raw));const compatibility=object(value?.compatibility);return value?.type==="hello-ack"&&typeof value.sessionId==="string"&&compatibility?.status==="compatible"?value.sessionId:null;}catch{return null;}}
function decodeLevelUpCompleteRequest(raw:string):CampaignLevelUpCompleteRequest|null{try{const value=object(JSON.parse(raw));if(value?.type!=="campaign-level-up-complete"||typeof value.sessionId!=="string"||typeof value.requestId!=="string"||typeof value.campaignId!=="string"||typeof value.rosterMemberId!=="string"||typeof value.characterId!=="string"||!Number.isInteger(value.level)||Number(value.level)<2)return null;return value as unknown as CampaignLevelUpCompleteRequest;}catch{return null;}}
function decodeStashDepositRequest(raw:string):CampaignStashDepositRequest|null{try{const value=object(JSON.parse(raw));const command=object(value?.command);if(value?.type!=="campaign-stash-deposit"||typeof value.sessionId!=="string"||typeof command?.requestId!=="string"||typeof command.campaignId!=="string"||typeof command.actorId!=="string"||(command.direction!=="character-to-stash"&&command.direction!=="stash-to-character"))return null;if(command.asset==="currency"){if(!Number.isInteger(command.amount)||Number(command.amount)<1)return null;}else if(command.asset==="item"){if(typeof command.definitionId!=="string"||!Number.isInteger(command.quantity)||Number(command.quantity)<1)return null;if(command.direction==="character-to-stash"&&typeof command.itemId!=="string")return null;if(command.direction==="stash-to-character"&&typeof command.catalogEntryId!=="string"&&!object(command.itemTemplate))return null;}else return null;return value as unknown as CampaignStashDepositRequest;}catch{return null;}}
function decodeStashDepositResult(raw:string):CampaignStashDepositResult|null{try{const value=object(JSON.parse(raw));if(value?.type!=="campaign-stash-deposit-result"||typeof value.sessionId!=="string"||typeof value.requestId!=="string"||typeof value.accepted!=="boolean"||(value.error!==undefined&&typeof value.error!=="string"))return null;return value as unknown as CampaignStashDepositResult;}catch{return null;}}
function validInventoryCommand(command:Raw|undefined){
  if(!command||typeof command.requestId!=="string"||!command.requestId||typeof command.actorId!=="string"||!command.actorId||typeof command.operation!=="string")return false;
  if(command.operation==="grant-item")return typeof command.catalogEntryId==="string"&&Number.isInteger(command.quantity)&&Number(command.quantity)>0;
  if(command.operation==="grant-item-template")return !!object(command.itemTemplate)&&Number.isInteger(command.quantity)&&Number(command.quantity)>0;
  if(command.operation==="revoke-item")return typeof command.itemId==="string"&&Number.isInteger(command.quantity)&&Number(command.quantity)>0&&(command.forceUnequip===undefined||typeof command.forceUnequip==="boolean");
  if(command.operation==="grant-currency"||command.operation==="revoke-currency")return Number.isInteger(command.amount)&&Number(command.amount)>0;
  return false;
}
export function decodeCampaignOwnerInventoryRequest(raw:string):CampaignOwnerInventoryRequest|null{try{const value=object(JSON.parse(raw));if(value?.type!=="campaign-owner-inventory"||typeof value.sessionId!=="string"||typeof value.correlationId!=="string"||(value.operation!=="apply"&&value.operation!=="undo"))return null;if(value.operation==="apply"){if(!validInventoryCommand(object(value.command)))return null;}else if(typeof value.actorId!=="string"||typeof value.requestId!=="string")return null;return value as unknown as CampaignOwnerInventoryRequest;}catch{return null;}}
export function decodeCampaignOwnerInventoryResult(raw:string):CampaignOwnerInventoryResult|null{try{const value=object(JSON.parse(raw));if(value?.type!=="campaign-owner-inventory-result"||typeof value.sessionId!=="string"||typeof value.correlationId!=="string"||typeof value.actorId!=="string"||typeof value.accepted!=="boolean"||(value.error!==undefined&&typeof value.error!=="string"))return null;const projection=object(value.projection);if(value.accepted&&(typeof projection?.characterId!=="string"||!Number.isInteger(projection.sourceRevision)||!Number.isInteger(projection.runtimeRevision)))return null;return value as unknown as CampaignOwnerInventoryResult;}catch{return null;}}
async function envelopeFor(adapter:MockAdapter):Promise<CampaignSystemsEnvelope|null>{
  const state=connectedStateFor(adapter);if(state.mode!=="host"||!state.sessionId) return null;
  const snapshot=await adapter.getSnapshot();if(!snapshot.campaignSessionSystems) return null;
  return {type:"campaign-systems-projection",sessionId:state.sessionId,revision:snapshot.campaignSessionSystems.campaignRevision,projection:safeProjection(snapshot.campaignSessionSystems)};
}
async function broadcastProjection(adapter:MockAdapter){
  const envelope=await envelopeFor(adapter);if(!envelope)return;
  const message=JSON.stringify(envelope);
  const peers=[...connectedStateFor(adapter).peerParticipants.keys()];
  await Promise.all(peers.map((peer)=>baseSendTo(peer,message)));
}
async function sendToWithCampaignSystems(peer:string,message:string){
  const result=await baseSendTo(peer,message);const sessionId=compatibleHelloAck(message);const host=activeHostAdapter;
  if(!host||!sessionId) return result;const envelope=await envelopeFor(host);if(envelope&&envelope.sessionId===sessionId) await baseSendTo(peer,JSON.stringify(envelope));return result;
}
function ownerActorId(request:CampaignOwnerInventoryRequest){return request.operation==="apply"?request.command.actorId:request.actorId;}
async function sendOwnerInventoryResult(client:MockAdapter,peer:string,request:CampaignOwnerInventoryRequest){
  const state=connectedStateFor(client);let error:string|undefined;let projection:CharacterSessionProjectionV1|undefined;const actorId=ownerActorId(request);
  try{
    if(state.mode!=="client"||state.sessionId!==request.sessionId)throw new Error("세션이 일치하지 않습니다.");
    const snapshot=await client.getSnapshot();
    if(actorId!==snapshot.activeCharacter.id)throw new Error("원격 DM 인벤토리 변경은 소유 중인 활성 Character에만 적용할 수 있습니다.");
    if(request.operation==="apply")await client.adjustDmInventory(request.command);
    else await client.undoDmInventoryAdjustment(request.requestId);
    const after=await client.getSnapshot();
    projection=buildCharacterSessionProjectionV1(after.activeCharacter,after.catalog);
  }catch(cause){error=cause instanceof Error?cause.message:String(cause);}
  await baseSendTo(peer,JSON.stringify({type:"campaign-owner-inventory-result",sessionId:request.sessionId,correlationId:request.correlationId,actorId,accepted:!error,...(error?{error}:{projection})} satisfies CampaignOwnerInventoryResult));
}
async function refreshHostOwnerProjection(host:MockAdapter,peer:string,actorId:string,projection:CharacterSessionProjectionV1){
  const state=connectedStateFor(host);const manifest=state.peerManifests.get(peer);const mounted=projectedCharacterById(host,actorId);
  if(state.mode!=="host"||!state.sessionId||!manifest?.character||!mounted)throw new Error("원격 Character 소유권 projection이 없습니다.");
  if(mounted.peerId!==peer||manifest.character.characterId!==actorId||projection.characterId!==actorId)throw new Error("원격 Character owner identity가 변경되었습니다.");
  if(projection.sourceRevision!==manifest.character.sourceRevision)throw new Error("원격 Character source revision이 세션 중 변경되었습니다.");
  if(projection.runtimeRevision<manifest.character.runtimeRevision)throw new Error("원격 Character runtime revision이 뒤로 이동했습니다.");
  const snapshot=await host.getSnapshot();const reconstructed=reconstructCharacterSessionProjectionV1(projection,snapshot.catalog);if(reconstructed.status==="rejected")throw new Error(reconstructed.error);
  const refreshed=refreshReconstructedCharacterSessionProjection(host,peer,reconstructed);if(refreshed.status==="rejected")throw new Error(refreshed.error);
  refreshSessionCharacterInventoryProjection(host,{characterId:reconstructed.sheet.id,characterName:reconstructed.sheet.name,revision:projection.runtimeRevision,goldGp:reconstructed.sheet.goldGp??0,items:structuredClone(reconstructed.sheet.items)} satisfies SessionCharacterInventoryVm);
  state.peerManifests.set(peer,{...manifest,character:{characterId:projection.characterId,sourceRevision:projection.sourceRevision,runtimeRevision:projection.runtimeRevision}});
  await publishConnectedSnapshot(host);
}
function pendingOwnerMap(adapter:MockAdapter){let map=pendingOwnerInventory.get(adapter);if(!map){map=new Map();pendingOwnerInventory.set(adapter,map);}return map;}
async function requestOwnerInventory(host:MockAdapter,peer:string,request:CampaignOwnerInventoryRequest){
  const map=pendingOwnerMap(host);
  const wait=new Promise<CharacterSessionProjectionV1>((resolve,reject)=>{
    const timer=setTimeout(()=>{map.delete(request.correlationId);reject(new Error("원격 Character 인벤토리 응답 시간이 초과되었습니다."));},8000);
    map.set(request.correlationId,{peer,actorId:ownerActorId(request),resolve,reject,timer});
  });
  try{await baseSendTo(peer,JSON.stringify(request));}catch(error){const pending=map.get(request.correlationId);if(pending){clearTimeout(pending.timer);map.delete(request.correlationId);}throw error;}
  return wait;
}
async function settleOwnerInventoryResult(host:MockAdapter,message:SessionTransportMessage,result:CampaignOwnerInventoryResult){
  const state=connectedStateFor(host);if(state.sessionId!==result.sessionId)return;
  const map=pendingOwnerInventory.get(host);const pending=map?.get(result.correlationId);if(!pending||pending.peer!==message.peer||pending.actorId!==result.actorId)return;
  clearTimeout(pending.timer);map?.delete(result.correlationId);
  if(!result.accepted||!result.projection){pending.reject(new Error(result.error||"원격 Character 인벤토리 변경이 거절되었습니다."));return;}
  try{await refreshHostOwnerProjection(host,message.peer,result.actorId,result.projection);pending.resolve(result.projection);}catch(error){pending.reject(error instanceof Error?error:new Error(String(error)));}
}
async function onMessageWithCampaignSystems(handler:(message:SessionTransportMessage)=>void){
  const client=registeringClientAdapter;
  return baseOnMessage((message)=>{
    const host=activeHostAdapter;
    const ownerRequest=decodeCampaignOwnerInventoryRequest(message.message);
    if(client&&ownerRequest){void sendOwnerInventoryResult(client,message.peer,ownerRequest);return;}
    const ownerResult=decodeCampaignOwnerInventoryResult(message.message);
    if(host&&ownerResult){void settleOwnerInventoryResult(host,message,ownerResult);return;}
    const stashRequest=decodeStashDepositRequest(message.message);
    if(stashRequest){
      if(host)void (async()=>{
        const state=connectedStateFor(host);let error:string|undefined;
        try{
          if(state.sessionId!==stashRequest.sessionId)throw new Error("세션이 일치하지 않습니다.");
          const manifest=state.peerManifests.get(message.peer)?.character;
          if(manifest?.characterId!==stashRequest.command.actorId)throw new Error("자기 캐릭터의 자산만 보관할 수 있습니다.");
          const snapshot=await host.getSnapshot();
          const member=snapshot.campaignSessionSystems?.roster.find((entry)=>entry.characterId===manifest.characterId);
          if(!member||!(member.stashPermission==="request"||member.stashPermission==="manage"))throw new Error("파티 보관함 입고 권한이 없습니다.");
          await hostCommitPartyStashDeposit.call(host,stashRequest.command);
        }catch(cause){error=cause instanceof Error?cause.message:String(cause);}
        await baseSendTo(message.peer,JSON.stringify({type:"campaign-stash-deposit-result",sessionId:stashRequest.sessionId,requestId:stashRequest.command.requestId,accepted:!error,...(error?{error}:{})} satisfies CampaignStashDepositResult));
      })();
      return;
    }
    const stashResult=decodeStashDepositResult(message.message);
    if(client&&stashResult){
      const state=connectedStateFor(client);if(state.sessionId!==stashResult.sessionId)return;
      const pending=pendingStashDeposits.get(client)?.get(stashResult.requestId);if(!pending)return;
      clearTimeout(pending.timer);pendingStashDeposits.get(client)?.delete(stashResult.requestId);
      if(stashResult.accepted)pending.resolve();else if(pending.rollback)void client.undoDmInventoryAdjustment(stashResult.requestId).then(()=>pending.reject(new Error(stashResult.error||"DM이 파티 보관함 이동을 거절했습니다.")));else pending.reject(new Error(stashResult.error||"DM이 파티 보관함 이동을 거절했습니다."));
      return;
    }
    const levelUpRequest=decodeLevelUpCompleteRequest(message.message);
    if(levelUpRequest){
      if(host){
        const state=connectedStateFor(host);
        const manifest=state.peerManifests.get(message.peer)?.character;
        const key=levelUpRequest.sessionId+":"+levelUpRequest.requestId;
        if(state.sessionId===levelUpRequest.sessionId&&manifest?.characterId===levelUpRequest.characterId&&!handledLevelUpRequests.has(key)){
          void (async()=>{
            const snapshot=await host.getSnapshot();
            const member=snapshot.campaignSessionSystems?.roster.find((item)=>item.rosterMemberId===levelUpRequest.rosterMemberId);
            if(!member||member.characterId!==levelUpRequest.characterId||levelUpRequest.level!==(member.level??1)+1)return;
            await hostConsumeCampaignLevelUp.call(host,levelUpRequest.campaignId,levelUpRequest.rosterMemberId,levelUpRequest.level);
            handledLevelUpRequests.add(key);
          })().catch(()=>undefined);
        }
      }
      return;
    }
    if(client){const decoded=decodeCampaignSystemsEnvelope(message.message);if(decoded){
      const state=connectedStateFor(client);if(state.sessionId&&state.sessionId!==decoded.sessionId) return;
      const current=remoteProjections.get(client);if(!current||current.sessionId!==decoded.sessionId||decoded.revision>=current.revision){remoteProjections.set(client,{sessionId:decoded.sessionId,revision:decoded.revision,projection:decoded.projection});void publishConnectedSnapshot(client).catch(()=>undefined);}return;
    }}
    handler(message);
  });
}
tauriSessionTransport.sendTo=sendToWithCampaignSystems;
tauriSessionTransport.onMessage=onMessageWithCampaignSystems;

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
MockAdapter.prototype.getSnapshot=async function getSnapshotWithRemoteCampaignSystems(){
  const snapshot=await previousGetSnapshot.call(this);if(snapshot.session.role!=="client") return snapshot;
  return {...snapshot,campaignSessionSystems:structuredClone(remoteProjections.get(this)?.projection??null),campaignSessionSnapshot:null};
};
const previousHostSession=MockAdapter.prototype.hostSession;
MockAdapter.prototype.hostSession=async function hostSessionWithCampaignSystems(){activeHostAdapter=this;return previousHostSession.call(this);};
const previousJoinSession=MockAdapter.prototype.joinSession;
MockAdapter.prototype.joinSession=async function joinSessionWithCampaignSystems(address:string){registeringClientAdapter=this;remoteProjections.delete(this);try{return await previousJoinSession.call(this,address);}finally{registeringClientAdapter=null;}};
const previousStopSession=MockAdapter.prototype.stopSession;
MockAdapter.prototype.stopSession=async function stopSessionWithCampaignSystems(){const result=await previousStopSession.call(this);remoteProjections.delete(this);pendingOwnerInventory.delete(this);remoteOwnerMutationRoutes.delete(this);lastRemoteOwnerMutation.delete(this);if(activeHostAdapter===this)activeHostAdapter=null;if(registeringClientAdapter===this)registeringClientAdapter=null;return {...result,campaignSessionSystems:null,campaignSessionSnapshot:null};};

function broadcastAfter<T extends unknown[], R>(previous:(...args:T)=>Promise<R>){return async function(this:MockAdapter,...args:T):Promise<R>{const result=await previous.apply(this,args);await broadcastProjection(this).catch(()=>undefined);return result;};}
MockAdapter.prototype.advanceCampaignCalendar=broadcastAfter(MockAdapter.prototype.advanceCampaignCalendar);
MockAdapter.prototype.correctCampaignCalendar=broadcastAfter(MockAdapter.prototype.correctCampaignCalendar);
MockAdapter.prototype.correctCampaignCalendarDateTime=broadcastAfter(MockAdapter.prototype.correctCampaignCalendarDateTime);
MockAdapter.prototype.setCampaignCalendarNote=broadcastAfter(MockAdapter.prototype.setCampaignCalendarNote);
MockAdapter.prototype.undoCampaignCalendar=broadcastAfter(MockAdapter.prototype.undoCampaignCalendar);
MockAdapter.prototype.adjustCampaignRations=broadcastAfter(MockAdapter.prototype.adjustCampaignRations);
MockAdapter.prototype.consumeCampaignDailyRations=broadcastAfter(MockAdapter.prototype.consumeCampaignDailyRations);
MockAdapter.prototype.undoCampaignRationConsumption=broadcastAfter(MockAdapter.prototype.undoCampaignRationConsumption);
MockAdapter.prototype.advanceCampaignDay=broadcastAfter(MockAdapter.prototype.advanceCampaignDay);
MockAdapter.prototype.upsertCampaignRosterMember=broadcastAfter(MockAdapter.prototype.upsertCampaignRosterMember);
MockAdapter.prototype.removeCampaignRosterMember=broadcastAfter(MockAdapter.prototype.removeCampaignRosterMember);
MockAdapter.prototype.grantCampaignAdvancement=broadcastAfter(MockAdapter.prototype.grantCampaignAdvancement);
MockAdapter.prototype.grantCampaignDmLibraryItem=broadcastAfter(MockAdapter.prototype.grantCampaignDmLibraryItem);
const hostTransferPartyStash=broadcastAfter(MockAdapter.prototype.transferPartyStash);
const hostCommitPartyStashDeposit=broadcastAfter(MockAdapter.prototype.commitConnectedPartyStashDeposit);
const localAdjustDmInventory=MockAdapter.prototype.adjustDmInventory;
const localUndoDmInventoryAdjustment=MockAdapter.prototype.undoDmInventoryAdjustment;
const localUndoLastDmInventoryAdjustment=MockAdapter.prototype.undoLastDmInventoryAdjustment;
function ownerRoute(adapter:MockAdapter,actorId:string){
  const state=connectedStateFor(adapter);if(state.mode!=="host"||!state.sessionId)return null;
  const mounted=projectedCharacterById(adapter,actorId);if(!mounted)return null;
  const manifest=state.peerManifests.get(mounted.peerId)?.character;if(manifest?.characterId!==actorId)return null;
  return {peer:mounted.peerId,actorId};
}
function mutationRoutes(adapter:MockAdapter){let routes=remoteOwnerMutationRoutes.get(adapter);if(!routes){routes=new Map();remoteOwnerMutationRoutes.set(adapter,routes);}return routes;}
MockAdapter.prototype.adjustDmInventory=async function adjustConnectedOwnerInventory(command){
  const route=ownerRoute(this,command.actorId);
  if(!route){const result=await localAdjustDmInventory.call(this,command);if(connectedStateFor(this).mode==="host")lastRemoteOwnerMutation.delete(this);return result;}
  const state=connectedStateFor(this);const correlationId=command.requestId+":apply";mutationRoutes(this).set(command.requestId,route);
  try{
    await requestOwnerInventory(this,route.peer,{type:"campaign-owner-inventory",sessionId:state.sessionId!,correlationId,operation:"apply",command});
    lastRemoteOwnerMutation.set(this,command.requestId);
  }catch(error){
    await requestOwnerInventory(this,route.peer,{type:"campaign-owner-inventory",sessionId:state.sessionId!,correlationId:command.requestId+":undo-after-failure",operation:"undo",actorId:command.actorId,requestId:command.requestId}).catch(()=>undefined);
    mutationRoutes(this).delete(command.requestId);lastRemoteOwnerMutation.delete(this);throw error;
  }
  return this.getSnapshot();
};
MockAdapter.prototype.undoDmInventoryAdjustment=async function undoConnectedOwnerInventory(requestId){
  const route=remoteOwnerMutationRoutes.get(this)?.get(requestId);
  if(!route)return localUndoDmInventoryAdjustment.call(this,requestId);
  const state=connectedStateFor(this);if(state.mode!=="host"||!state.sessionId)return localUndoDmInventoryAdjustment.call(this,requestId);
  await requestOwnerInventory(this,route.peer,{type:"campaign-owner-inventory",sessionId:state.sessionId,correlationId:requestId+":undo",operation:"undo",actorId:route.actorId,requestId});
  remoteOwnerMutationRoutes.get(this)?.delete(requestId);if(lastRemoteOwnerMutation.get(this)===requestId)lastRemoteOwnerMutation.delete(this);
  return this.getSnapshot();
};
MockAdapter.prototype.undoLastDmInventoryAdjustment=async function undoLastConnectedOwnerInventory(){
  const requestId=lastRemoteOwnerMutation.get(this);if(requestId)return this.undoDmInventoryAdjustment(requestId);
  return localUndoLastDmInventoryAdjustment.call(this);
};
MockAdapter.prototype.commitConnectedPartyStashDeposit=hostCommitPartyStashDeposit;
MockAdapter.prototype.transferPartyStash=async function transferConnectedPartyStash(command){
  const state=connectedStateFor(this);
  if(state.mode!=="client"){
    try{return await hostTransferPartyStash.call(this,command);}
    finally{if(lastRemoteOwnerMutation.get(this)===command.requestId)lastRemoteOwnerMutation.delete(this);}
  }
  const snapshot=await this.getSnapshot();
  if(!state.sessionId||command.actorId!==snapshot.activeCharacter.id)throw new Error("자기 캐릭터의 자산만 보관할 수 있습니다.");
  const inventoryCommand=command.asset==="currency"
    ? {requestId:command.requestId,actorId:command.actorId,operation:command.direction==="character-to-stash"?"revoke-currency" as const:"grant-currency" as const,amount:command.amount}
    : command.direction==="character-to-stash"
      ? {requestId:command.requestId,actorId:command.actorId,operation:"revoke-item" as const,itemId:command.itemId,quantity:command.quantity,forceUnequip:command.forceUnequip}
      : command.itemTemplate
        ? {requestId:command.requestId,actorId:command.actorId,operation:"grant-item-template" as const,itemTemplate:command.itemTemplate,quantity:command.quantity}
        : {requestId:command.requestId,actorId:command.actorId,operation:"grant-item" as const,catalogEntryId:command.catalogEntryId!,quantity:command.quantity};
  const localFirst=command.direction==="character-to-stash";
  if(localFirst)await this.adjustDmInventory(inventoryCommand);
  const waitForHost=new Promise<void>((resolve,reject)=>{
    const map=pendingStashDeposits.get(this)??new Map();
    const timer=setTimeout(()=>{map.delete(command.requestId);if(localFirst)void this.undoDmInventoryAdjustment(command.requestId).then(()=>reject(new Error("파티 보관함 이동 응답 시간이 초과되었습니다.")));else reject(new Error("파티 보관함 이동 응답 시간이 초과되었습니다."));},8000);
    map.set(command.requestId,{resolve,reject,timer,rollback:localFirst});pendingStashDeposits.set(this,map);
  });
  let hostAccepted=false;
  try{await tauriSessionTransport.send(JSON.stringify({type:"campaign-stash-deposit",sessionId:state.sessionId,command} satisfies CampaignStashDepositRequest));await waitForHost;hostAccepted=true;if(!localFirst)await this.adjustDmInventory(inventoryCommand);}
  catch(error){
    const pending=pendingStashDeposits.get(this)?.get(command.requestId);if(pending){clearTimeout(pending.timer);pendingStashDeposits.get(this)?.delete(command.requestId);if(localFirst)await this.undoDmInventoryAdjustment(command.requestId);}
    if(hostAccepted&&!localFirst){
      const compensation:PartyStashDepositCommand=command.asset==="currency"
        ? {...command,requestId:command.requestId+".compensate",direction:"character-to-stash"}
        : {requestId:command.requestId+".compensate",campaignId:command.campaignId,actorId:command.actorId,direction:"character-to-stash",asset:"item",itemId:"compensate."+command.definitionId,definitionId:command.definitionId,quantity:command.quantity,itemTemplate:command.itemTemplate};
      await tauriSessionTransport.send(JSON.stringify({type:"campaign-stash-deposit",sessionId:state.sessionId,command:compensation} satisfies CampaignStashDepositRequest)).catch(()=>undefined);
    }
    throw error;
  }
  return this.getSnapshot();
};
const hostConsumeCampaignLevelUp=broadcastAfter(MockAdapter.prototype.consumeCampaignLevelUpCredit);
MockAdapter.prototype.consumeCampaignLevelUpCredit=async function consumeConnectedCampaignLevelUpCredit(campaignId,rosterMemberId,level){
  const state=connectedStateFor(this);
  if(state.mode!=="client") return hostConsumeCampaignLevelUp.call(this,campaignId,rosterMemberId,level);
  if(!state.sessionId||level===undefined) return this.getSnapshot();
  const snapshot=await this.getSnapshot();
  const member=snapshot.campaignSessionSystems?.roster.find((item)=>item.rosterMemberId===rosterMemberId);
  if(!member?.characterId||member.characterId!==snapshot.activeCharacter.id) return snapshot;
  const requestId=globalThis.crypto?.randomUUID?.()??String(Date.now());
  await tauriSessionTransport.send(JSON.stringify({type:"campaign-level-up-complete",sessionId:state.sessionId,requestId,campaignId,rosterMemberId,characterId:member.characterId,level} satisfies CampaignLevelUpCompleteRequest));
  return this.getSnapshot();
};
