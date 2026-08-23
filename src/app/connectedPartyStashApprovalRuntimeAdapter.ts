import type { AppSnapshot, PartyStashTransferCommand } from "./contracts";
import { connectedStateFor } from "./connectedSessionState";
import { publishConnectedSnapshot } from "./connectedSessionRuntimeAdapter";
import { MockAdapter } from "./mockAdapter";
import { PartyStashApprovalQueue, type PartyStashApprovalRecord, type PartyStashApprovalTerminalState } from "./partyStashApprovalQueue";
import { tauriSessionTransport, type SessionTransportMessage } from "./tauriSessionTransport";

type Raw=Record<string,unknown>;
interface CampaignStashApprovalRequest {type:"campaign-stash-approval-request";sessionId:string;command:PartyStashTransferCommand;}
interface CampaignStashApprovalRequestResult {type:"campaign-stash-approval-request-result";sessionId:string;requestId:string;accepted:boolean;error?:string;}
interface CampaignStashApprovalOutcomeWire {type:"campaign-stash-approval-outcome";sessionId:string;requestId:string;status:PartyStashApprovalTerminalState;message:string;}
export interface PartyStashApprovalOutcomeNotice {requestId:string;status:PartyStashApprovalTerminalState;message:string;}

const queues=new WeakMap<MockAdapter,PartyStashApprovalQueue>();
const pendingClientRequests=new WeakMap<MockAdapter,Map<string,{resolve():void;reject(error:Error):void;timer:ReturnType<typeof setTimeout>}>>();
const clientOutcomeQueues=new WeakMap<MockAdapter,PartyStashApprovalOutcomeNotice[]>();
let activeHostAdapter:MockAdapter|null=null;
let registeringClientAdapter:MockAdapter|null=null;

export function partyStashApprovalQueueFor(adapter:MockAdapter){
  let queue=queues.get(adapter);
  if(!queue){queue=new PartyStashApprovalQueue();queues.set(adapter,queue);}
  return queue;
}

function object(value:unknown):Raw|undefined{return value&&typeof value==="object"&&!Array.isArray(value)?value as Raw:undefined;}
function validTransferCommand(command:Raw|undefined):command is Raw {
  if(!command||typeof command.requestId!=="string"||!command.requestId||typeof command.campaignId!=="string"||!command.campaignId||typeof command.actorId!=="string"||!command.actorId||command.direction!=="stash-to-character")return false;
  if(command.asset==="currency")return Number.isInteger(command.amount)&&Number(command.amount)>0;
  if(command.asset!=="item"||typeof command.definitionId!=="string"||!command.definitionId||!Number.isInteger(command.quantity)||Number(command.quantity)<1)return false;
  return typeof command.catalogEntryId==="string"||Boolean(object(command.itemTemplate));
}
function decodeApprovalRequest(raw:string):CampaignStashApprovalRequest|null{
  try{
    const value=object(JSON.parse(raw));
    const command=object(value?.command);
    if(value?.type!=="campaign-stash-approval-request"||typeof value.sessionId!=="string"||!value.sessionId||!validTransferCommand(command))return null;
    return value as unknown as CampaignStashApprovalRequest;
  }catch{return null;}
}
function decodeApprovalResult(raw:string):CampaignStashApprovalRequestResult|null{
  try{
    const value=object(JSON.parse(raw));
    if(value?.type!=="campaign-stash-approval-request-result"||typeof value.sessionId!=="string"||typeof value.requestId!=="string"||typeof value.accepted!=="boolean"||(value.error!==undefined&&typeof value.error!=="string"))return null;
    return value as unknown as CampaignStashApprovalRequestResult;
  }catch{return null;}
}
function decodeApprovalOutcome(raw:string):CampaignStashApprovalOutcomeWire|null{
  try{
    const value=object(JSON.parse(raw));
    const status=value?.status;
    if(value?.type!=="campaign-stash-approval-outcome"||typeof value.sessionId!=="string"||!value.sessionId||typeof value.requestId!=="string"||!value.requestId||(status!=="committed"&&status!=="rejected"&&status!=="cancelled")||typeof value.message!=="string"||!value.message)return null;
    return value as unknown as CampaignStashApprovalOutcomeWire;
  }catch{return null;}
}
function pendingMap(adapter:MockAdapter){let map=pendingClientRequests.get(adapter);if(!map){map=new Map();pendingClientRequests.set(adapter,map);}return map;}
function rejectPendingClientRequests(adapter:MockAdapter,message:string){
  const map=pendingClientRequests.get(adapter);if(!map)return;
  for(const pending of map.values()){clearTimeout(pending.timer);pending.reject(new Error(message));}
  map.clear();pendingClientRequests.delete(adapter);
}
function enqueueClientOutcome(adapter:MockAdapter,outcome:PartyStashApprovalOutcomeNotice){
  const queue=clientOutcomeQueues.get(adapter)??[];
  queue.push(structuredClone(outcome));
  clientOutcomeQueues.set(adapter,queue);
}
function participantPeer(adapter:MockAdapter,participantId:string){return [...connectedStateFor(adapter).peerParticipants.entries()].find(([,mapped])=>mapped===participantId)?.[0];}
function approvalAssetLabel(command:PartyStashTransferCommand){return command.asset==="currency"?`${command.amount} GP`:`${command.itemTemplate?.name??command.definitionId} ×${command.quantity}`;}
function approvalOutcomeMessage(record:PartyStashApprovalRecord,status:PartyStashApprovalTerminalState){
  const asset=approvalAssetLabel(record.command);
  if(status==="committed")return `${asset} Party Stash 출고 요청이 승인되어 내 인벤토리로 이동했습니다.`;
  if(status==="rejected")return `${asset} Party Stash 출고 요청이 DM에게 거절되었습니다.`;
  return `${asset} Party Stash 출고 요청이 취소되었습니다.`;
}
async function notifyApprovalOutcome(host:MockAdapter,record:PartyStashApprovalRecord,status:PartyStashApprovalTerminalState,knownPeer?:string){
  const state=connectedStateFor(host);if(state.mode!=="host"||!state.sessionId)return;
  const peer=knownPeer??participantPeer(host,record.participantId);if(!peer)return;
  await tauriSessionTransport.sendTo(peer,JSON.stringify({type:"campaign-stash-approval-outcome",sessionId:state.sessionId,requestId:record.command.requestId,status,message:approvalOutcomeMessage(record,status)} satisfies CampaignStashApprovalOutcomeWire)).catch(()=>undefined);
}

async function submitHostApprovalRequest(host:MockAdapter,message:SessionTransportMessage,request:CampaignStashApprovalRequest){
  const state=connectedStateFor(host);
  let error:string|undefined;
  try{
    if(state.mode!=="host"||state.sessionId!==request.sessionId)throw new Error("세션이 일치하지 않습니다.");
    const manifest=state.peerManifests.get(message.peer)?.character;
    if(manifest?.characterId!==request.command.actorId)throw new Error("자기 캐릭터의 자산만 요청할 수 있습니다.");
    const snapshot=await host.getSnapshot();
    const campaign=snapshot.campaignSessionSystems;
    if(!campaign||campaign.campaignId!==request.command.campaignId)throw new Error("파티 보관함의 캠페인이 현재 세션과 일치하지 않습니다.");
    if(campaign.partyStash.policy!=="dm-approval")throw new Error("현재 Party Stash 정책은 DM 승인 요청을 사용하지 않습니다.");
    const member=campaign.roster.find((entry)=>entry.characterId===request.command.actorId);
    if(!member||!(member.stashPermission==="request"||member.stashPermission==="manage"))throw new Error("파티 보관함 출고 요청 권한이 없습니다.");
    const participantId=state.peerParticipants.get(message.peer)??message.peer;
    const participantName=snapshot.session.participants.find((participant)=>participant.id===participantId)?.name??participantId;
    const characterName=snapshot.scene.entities.find((entity)=>entity.id===request.command.actorId)?.name??request.command.actorId;
    partyStashApprovalQueueFor(host).submit({command:request.command,participantId,participantName,characterName,requestedAt:new Date().toISOString()});
    await publishConnectedSnapshot(host).catch(()=>undefined);
  }catch(cause){error=cause instanceof Error?cause.message:String(cause);}
  await tauriSessionTransport.sendTo(message.peer,JSON.stringify({type:"campaign-stash-approval-request-result",sessionId:request.sessionId,requestId:request.command.requestId,accepted:!error,...(error?{error}:{})} satisfies CampaignStashApprovalRequestResult));
}

const baseOnMessage=tauriSessionTransport.onMessage.bind(tauriSessionTransport);
async function onMessageWithPartyStashApprovals(handler:(message:SessionTransportMessage)=>void){
  const client=registeringClientAdapter;
  return baseOnMessage((message)=>{
    const host=activeHostAdapter;
    const request=decodeApprovalRequest(message.message);
    if(host&&request){void submitHostApprovalRequest(host,message,request);return;}
    const result=decodeApprovalResult(message.message);
    if(client&&result){
      const state=connectedStateFor(client);if(state.sessionId!==result.sessionId)return;
      const map=pendingClientRequests.get(client);const pending=map?.get(result.requestId);if(!pending)return;
      clearTimeout(pending.timer);map?.delete(result.requestId);
      if(result.accepted)pending.resolve();else pending.reject(new Error(result.error||"Party Stash 승인 요청이 거절되었습니다."));
      return;
    }
    const outcome=decodeApprovalOutcome(message.message);
    if(client&&outcome){
      const state=connectedStateFor(client);if(state.sessionId!==outcome.sessionId)return;
      enqueueClientOutcome(client,{requestId:outcome.requestId,status:outcome.status,message:outcome.message});
      void publishConnectedSnapshot(client).catch(()=>undefined);
      return;
    }
    handler(message);
  });
}
tauriSessionTransport.onMessage=onMessageWithPartyStashApprovals;

const baseHostSession=MockAdapter.prototype.hostSession;
MockAdapter.prototype.hostSession=async function hostSessionWithPartyStashApprovals(){activeHostAdapter=this;partyStashApprovalQueueFor(this).clear();return baseHostSession.call(this);};
const baseJoinSession=MockAdapter.prototype.joinSession;
MockAdapter.prototype.joinSession=async function joinSessionWithPartyStashApprovals(address:string){registeringClientAdapter=this;rejectPendingClientRequests(this,"세션 연결이 다시 시작되었습니다.");clientOutcomeQueues.delete(this);try{return await baseJoinSession.call(this,address);}finally{registeringClientAdapter=null;}};
const baseStopSession=MockAdapter.prototype.stopSession;
MockAdapter.prototype.stopSession=async function stopSessionWithPartyStashApprovals(){
  partyStashApprovalQueueFor(this).clear();rejectPendingClientRequests(this,"세션이 종료되어 Party Stash 승인 요청이 취소되었습니다.");clientOutcomeQueues.delete(this);
  const result=await baseStopSession.call(this);
  if(activeHostAdapter===this)activeHostAdapter=null;if(registeringClientAdapter===this)registeringClientAdapter=null;
  return result;
};

const baseTransfer=MockAdapter.prototype.transferPartyStash;
MockAdapter.prototype.transferPartyStash=async function transferPartyStashWithApprovalRequest(command:PartyStashTransferCommand){
  const state=connectedStateFor(this);
  if(state.mode!=="client"||command.direction!=="stash-to-character")return baseTransfer.call(this,command);
  const snapshot=await this.getSnapshot();const campaign=snapshot.campaignSessionSystems;
  if(!campaign||campaign.campaignId!==command.campaignId||campaign.partyStash.policy!=="dm-approval")return baseTransfer.call(this,command);
  const member=campaign.roster.find((entry)=>entry.characterId===command.actorId);
  if(command.actorId!==snapshot.activeCharacter.id)throw new Error("자기 캐릭터의 자산만 요청할 수 있습니다.");
  if(!member||!(member.stashPermission==="request"||member.stashPermission==="manage"))throw new Error("파티 보관함 출고 요청 권한이 없습니다.");
  if(!state.sessionId)throw new Error("연결된 세션이 없습니다.");
  const map=pendingMap(this);
  if(map.has(command.requestId))throw new Error("같은 Party Stash 승인 요청이 이미 전송 중입니다.");
  const wait=new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>{map.delete(command.requestId);reject(new Error("Party Stash 승인 요청 응답 시간이 초과되었습니다."));},8000);
    map.set(command.requestId,{resolve,reject,timer});
  });
  try{
    await tauriSessionTransport.send(JSON.stringify({type:"campaign-stash-approval-request",sessionId:state.sessionId,command} satisfies CampaignStashApprovalRequest));
    await wait;
  }catch(error){const pending=map.get(command.requestId);if(pending){clearTimeout(pending.timer);map.delete(command.requestId);}throw error;}
  return this.getSnapshot();
};

declare module "./mockAdapter" {
  interface MockAdapter {
    listPartyStashApprovalRequests():PartyStashApprovalRecord[];
    approvePartyStashApproval(requestId:string):Promise<AppSnapshot>;
    rejectPartyStashApproval(requestId:string):Promise<AppSnapshot>;
    cancelPartyStashApproval(requestId:string):Promise<AppSnapshot>;
    takeNextPartyStashApprovalOutcome():PartyStashApprovalOutcomeNotice|null;
  }
}

MockAdapter.prototype.listPartyStashApprovalRequests=function(){return partyStashApprovalQueueFor(this).active();};
MockAdapter.prototype.takeNextPartyStashApprovalOutcome=function(){const queue=clientOutcomeQueues.get(this);const outcome=queue?.shift();if(!outcome)return null;if(!queue?.length)clientOutcomeQueues.delete(this);return structuredClone(outcome);};
MockAdapter.prototype.approvePartyStashApproval=async function approvePartyStashApproval(requestId:string){
  const queue=partyStashApprovalQueueFor(this);const current=queue.lookup(requestId);
  if(!current)throw new Error("Party Stash approval request not found");
  let approved=current.state==="approved";
  try{
    const state=connectedStateFor(this);const snapshot=await this.getSnapshot();const campaign=snapshot.campaignSessionSystems;
    if(state.mode!=="host"||!state.sessionId)throw new Error("Host Session에서만 Party Stash 요청을 승인할 수 있습니다.");
    if(!campaign||campaign.campaignId!==current.command.campaignId)throw new Error("승인 요청의 캠페인이 현재 세션과 일치하지 않습니다.");
    if(campaign.partyStash.policy!=="dm-approval")throw new Error("Party Stash 정책이 변경되어 요청을 다시 검토해야 합니다.");
    const member=campaign.roster.find((entry)=>entry.characterId===current.command.actorId);
    if(!member||!(member.stashPermission==="request"||member.stashPermission==="manage"))throw new Error("요청자의 Party Stash 권한이 변경되었습니다.");
    const ownerPeer=[...state.peerParticipants.entries()].find(([,participantId])=>participantId===current.participantId)?.[0];
    if(!ownerPeer||state.peerManifests.get(ownerPeer)?.character?.characterId!==current.command.actorId)throw new Error("요청 Character의 연결된 소유자를 다시 확인할 수 없습니다.");
    const record=queue.approve(requestId);approved=true;
    await this.transferPartyStash(record.command);
    const committed=queue.settle(requestId,"committed");
    await publishConnectedSnapshot(this).catch(()=>undefined);
    await notifyApprovalOutcome(this,committed,"committed",ownerPeer);
    return this.getSnapshot();
  }catch(cause){
    const error=cause instanceof Error?cause:new Error(String(cause));
    if(approved)queue.recordApprovedFailure(requestId,error.message);
    await publishConnectedSnapshot(this).catch(()=>undefined);
    throw error;
  }
};
MockAdapter.prototype.rejectPartyStashApproval=async function rejectPartyStashApproval(requestId:string){const record=partyStashApprovalQueueFor(this).settle(requestId,"rejected");await publishConnectedSnapshot(this).catch(()=>undefined);await notifyApprovalOutcome(this,record,"rejected");return this.getSnapshot();};
MockAdapter.prototype.cancelPartyStashApproval=async function cancelPartyStashApproval(requestId:string){const record=partyStashApprovalQueueFor(this).settle(requestId,"cancelled");await publishConnectedSnapshot(this).catch(()=>undefined);await notifyApprovalOutcome(this,record,"cancelled");return this.getSnapshot();};

export {};
