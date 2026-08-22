import type { CampaignSessionSystemsProjection } from "./campaignPersistenceContracts";
import type { PartyStashTransferCommand } from "./contracts";
import { connectedStateFor } from "./connectedSessionState";
import { publishConnectedSnapshot } from "./connectedSessionRuntimeAdapter";
import { MockAdapter } from "./mockAdapter";
import { tauriSessionTransport, type SessionTransportMessage } from "./tauriSessionTransport";

interface CampaignSystemsEnvelope {type:"campaign-systems-projection";sessionId:string;revision:number;projection:CampaignSessionSystemsProjection;}
interface CampaignLevelUpCompleteRequest {type:"campaign-level-up-complete";sessionId:string;requestId:string;campaignId:string;rosterMemberId:string;characterId:string;level:number;}
type PartyStashDepositCommand=PartyStashTransferCommand;
interface CampaignStashDepositRequest {type:"campaign-stash-deposit";sessionId:string;command:PartyStashDepositCommand;}
interface CampaignStashDepositResult {type:"campaign-stash-deposit-result";sessionId:string;requestId:string;accepted:boolean;error?:string;}
type Raw=Record<string,unknown>;
const remoteProjections=new WeakMap<MockAdapter,{sessionId:string;revision:number;projection:CampaignSessionSystemsProjection}>();
let activeHostAdapter:MockAdapter|null=null;
let registeringClientAdapter:MockAdapter|null=null;
const baseSendTo=tauriSessionTransport.sendTo.bind(tauriSessionTransport);
const baseOnMessage=tauriSessionTransport.onMessage.bind(tauriSessionTransport);
const handledLevelUpRequests=new Set<string>();
const pendingStashDeposits=new WeakMap<MockAdapter,Map<string,{resolve():void;reject(error:Error):void;timer:ReturnType<typeof setTimeout>;rollback:boolean}>>();

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
function decodeStashDepositRequest(raw:string):CampaignStashDepositRequest|null{try{const value=object(JSON.parse(raw));const command=object(value?.command);if(value?.type!=="campaign-stash-deposit"||typeof value.sessionId!=="string"||typeof command?.requestId!=="string"||typeof command.campaignId!=="string"||typeof command.actorId!=="string"||(command.direction!=="character-to-stash"&&command.direction!=="stash-to-character"))return null;if(command.asset==="currency"){if(!Number.isInteger(command.amount)||Number(command.amount)<1)return null;}else if(command.asset==="item"){if(typeof command.definitionId!=="string"||!Number.isInteger(command.quantity)||Number(command.quantity)<1)return null;if(command.direction==="character-to-stash"&&typeof command.itemId!=="string")return null;if(command.direction==="stash-to-character"&&typeof command.catalogEntryId!=="string")return null;}else return null;return value as unknown as CampaignStashDepositRequest;}catch{return null;}}
function decodeStashDepositResult(raw:string):CampaignStashDepositResult|null{try{const value=object(JSON.parse(raw));if(value?.type!=="campaign-stash-deposit-result"||typeof value.sessionId!=="string"||typeof value.requestId!=="string"||typeof value.accepted!=="boolean"||(value.error!==undefined&&typeof value.error!=="string"))return null;return value as unknown as CampaignStashDepositResult;}catch{return null;}}
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
async function onMessageWithCampaignSystems(handler:(message:SessionTransportMessage)=>void){
  const client=registeringClientAdapter;
  return baseOnMessage((message)=>{
    const stashRequest=decodeStashDepositRequest(message.message);
    const host=activeHostAdapter;
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
      if(stashResult.accepted)pending.resolve();else if(pending.rollback)void client.undoLastDmInventoryAdjustment().then(()=>pending.reject(new Error(stashResult.error||"DM이 파티 보관함 이동을 거절했습니다.")));else pending.reject(new Error(stashResult.error||"DM이 파티 보관함 이동을 거절했습니다."));
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
MockAdapter.prototype.stopSession=async function stopSessionWithCampaignSystems(){const result=await previousStopSession.call(this);remoteProjections.delete(this);if(activeHostAdapter===this)activeHostAdapter=null;if(registeringClientAdapter===this)registeringClientAdapter=null;return {...result,campaignSessionSystems:null,campaignSessionSnapshot:null};};

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
const hostTransferPartyStash=broadcastAfter(MockAdapter.prototype.transferPartyStash);
const hostCommitPartyStashDeposit=broadcastAfter(MockAdapter.prototype.commitConnectedPartyStashDeposit);
MockAdapter.prototype.commitConnectedPartyStashDeposit=hostCommitPartyStashDeposit;
MockAdapter.prototype.transferPartyStash=async function transferConnectedPartyStash(command){
  const state=connectedStateFor(this);
  if(state.mode!=="client")return hostTransferPartyStash.call(this,command);
  const snapshot=await this.getSnapshot();
  if(!state.sessionId||command.actorId!==snapshot.activeCharacter.id)throw new Error("자기 캐릭터의 자산만 보관할 수 있습니다.");
  const inventoryCommand=command.asset==="currency"
    ? {requestId:command.requestId,actorId:command.actorId,operation:command.direction==="character-to-stash"?"revoke-currency" as const:"grant-currency" as const,amount:command.amount}
    : command.direction==="character-to-stash"
      ? {requestId:command.requestId,actorId:command.actorId,operation:"revoke-item" as const,itemId:command.itemId,quantity:command.quantity,forceUnequip:command.forceUnequip}
      : {requestId:command.requestId,actorId:command.actorId,operation:"grant-item" as const,catalogEntryId:command.catalogEntryId,quantity:command.quantity};
  const localFirst=command.direction==="character-to-stash";
  if(localFirst)await this.adjustDmInventory(inventoryCommand);
  const waitForHost=new Promise<void>((resolve,reject)=>{
    const map=pendingStashDeposits.get(this)??new Map();
    const timer=setTimeout(()=>{map.delete(command.requestId);if(localFirst)void this.undoLastDmInventoryAdjustment().then(()=>reject(new Error("파티 보관함 이동 응답 시간이 초과되었습니다.")));else reject(new Error("파티 보관함 이동 응답 시간이 초과되었습니다."));},8000);
    map.set(command.requestId,{resolve,reject,timer,rollback:localFirst});pendingStashDeposits.set(this,map);
  });
  let hostAccepted=false;
  try{await tauriSessionTransport.send(JSON.stringify({type:"campaign-stash-deposit",sessionId:state.sessionId,command} satisfies CampaignStashDepositRequest));await waitForHost;hostAccepted=true;if(!localFirst)await this.adjustDmInventory(inventoryCommand);}
  catch(error){
    const pending=pendingStashDeposits.get(this)?.get(command.requestId);if(pending){clearTimeout(pending.timer);pendingStashDeposits.get(this)?.delete(command.requestId);if(localFirst)await this.undoLastDmInventoryAdjustment();}
    if(hostAccepted&&!localFirst){
      const compensation:PartyStashDepositCommand=command.asset==="currency"
        ? {...command,requestId:command.requestId+".compensate",direction:"character-to-stash"}
        : {requestId:command.requestId+".compensate",campaignId:command.campaignId,actorId:command.actorId,direction:"character-to-stash",asset:"item",itemId:"compensate."+command.definitionId,definitionId:command.definitionId,quantity:command.quantity};
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
