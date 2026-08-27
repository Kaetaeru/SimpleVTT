import type { MockAdapter } from "./mockAdapter";
import type { SessionTransportMessage } from "./tauriSessionTransport";
import { connectedStateFor } from "./connectedSessionState";
import type { ConnectedWireMessage } from "./connectedSessionWire";
import {
  answerCommonPlayFactRequest,
  type CommonPlayAuthorityFactRequest,
  type CommonPlayAuthorityFactResponse,
  type CommonPlayFactResolution,
} from "../domain/commonPlaySpatialFactRuntime";

type CommonPlayFactRequestWire=Extract<ConnectedWireMessage,{type:"common-play-fact-request"}>;
type CommonPlayFactResponseWire=Extract<ConnectedWireMessage,{type:"common-play-fact-response"}>;

export interface ConnectedCommonPlayAuthorityFactTransport {
  sendTo(peer:string,message:ConnectedWireMessage):Promise<void>;
  send(message:ConnectedWireMessage):Promise<void>;
}

export interface RequestConnectedCommonPlayAuthorityFactInput {
  request:CommonPlayAuthorityFactRequest;
  responderId:string;
  currentRevision:()=>number;
  onResolution:(resolution:CommonPlayFactResolution)=>void;
}

interface PendingHostFact {
  request:CommonPlayAuthorityFactRequest;
  responderId:string;
  currentRevision:()=>number;
  onResolution:(resolution:CommonPlayFactResolution)=>void;
}

interface CompletedHostFact {
  request:CommonPlayAuthorityFactRequest;
  responderId:string;
  resolution:CommonPlayFactResolution;
}

interface FactRoutingState {
  sessionId:string|null;
  hostPending:Map<string,PendingHostFact>;
  hostCompleted:Map<string,CompletedHostFact>;
  hostClosed:Set<string>;
  clientPending:Map<string,{request:CommonPlayAuthorityFactRequest;responderId:string}>;
  clientAnswered:Map<string,CommonPlayAuthorityFactResponse>;
}

const states=new WeakMap<MockAdapter,FactRoutingState>();
let transport:ConnectedCommonPlayAuthorityFactTransport|null=null;

export function registerConnectedCommonPlayAuthorityFactTransport(next:ConnectedCommonPlayAuthorityFactTransport) {
  transport=next;
}

function routingStateFor(adapter:MockAdapter) {
  const sessionId=connectedStateFor(adapter).sessionId;
  let state=states.get(adapter);
  if(!state||state.sessionId!==sessionId){
    state={
      sessionId,
      hostPending:new Map(),
      hostCompleted:new Map(),
      hostClosed:new Set(),
      clientPending:new Map(),
      clientAnswered:new Map(),
    };
    states.set(adapter,state);
  }
  return state;
}

function currentPeerForResponder(adapter:MockAdapter,responderId:string) {
  for(const [peer,manifest] of connectedStateFor(adapter).peerManifests.entries()){
    if(manifest.character?.characterId===responderId)return peer;
  }
  return undefined;
}

function sameRequest(left:CommonPlayAuthorityFactRequest,right:CommonPlayAuthorityFactRequest) {
  return left.id===right.id
    &&left.idempotencyKey===right.idempotencyKey
    &&left.expectedRevision===right.expectedRevision
    &&left.resolutionId===right.resolutionId
    &&left.queryId===right.queryId
    &&left.fact===right.fact;
}

function promptFor(sessionId:string,responderId:string,request:CommonPlayAuthorityFactRequest):CommonPlayFactRequestWire {
  return {type:"common-play-fact-request",sessionId,responderId,request};
}

export async function requestConnectedCommonPlayAuthorityFact(
  adapter:MockAdapter,
  input:RequestConnectedCommonPlayAuthorityFactInput,
) {
  const connected=connectedStateFor(adapter);
  const sessionId=connected.sessionId;
  if(connected.mode!=="host"||!sessionId)return {status:"rejected" as const,reason:"Common Play authority fact routing requires an active Host session"};
  if(input.request.authority==="host"||input.request.authority==="dm")return {status:"local-authority" as const,request:input.request};
  if(!transport)return {status:"rejected" as const,reason:"Common Play authority fact transport is unavailable"};
  const state=routingStateFor(adapter);
  const completed=state.hostCompleted.get(input.request.id);
  if(completed){
    if(completed.responderId!==input.responderId||!sameRequest(completed.request,input.request))return {status:"rejected" as const,reason:"Common Play authority fact request identity conflicts with completed history"};
    return {status:"duplicate" as const,resolution:completed.resolution};
  }
  if(state.hostClosed.has(input.request.id))return {status:"rejected" as const,reason:"Common Play authority fact request is already closed"};
  const existing=state.hostPending.get(input.request.id);
  if(existing){
    if(existing.responderId!==input.responderId||!sameRequest(existing.request,input.request))return {status:"rejected" as const,reason:"Common Play authority fact request identity conflicts with pending history"};
    return {status:"pending" as const};
  }
  const peer=currentPeerForResponder(adapter,input.responderId);
  if(!peer)return {status:"rejected" as const,reason:`no connected owner peer for ${input.responderId}`};
  state.hostPending.set(input.request.id,{...input});
  await transport.sendTo(peer,promptFor(sessionId,input.responderId,input.request));
  return {status:"queued" as const,peer};
}

export async function applyConnectedCommonPlayAuthorityFactRequest(
  adapter:MockAdapter,
  wire:CommonPlayFactRequestWire,
  localResponderId:string,
) {
  const connected=connectedStateFor(adapter);
  if(connected.mode!=="client"||!connected.sessionId||wire.sessionId!==connected.sessionId)return {status:"rejected" as const,reason:"Common Play authority fact request session does not match this Client"};
  if(wire.responderId!==localResponderId)return {status:"rejected" as const,reason:"Common Play authority fact request does not belong to this Client Character"};
  const state=routingStateFor(adapter);
  const answered=state.clientAnswered.get(wire.request.id);
  if(answered){
    if(answered.idempotencyKey!==wire.request.idempotencyKey||answered.expectedRevision!==wire.request.expectedRevision)return {status:"rejected" as const,reason:"Common Play authority fact replay identity mismatch"};
    if(!transport)return {status:"rejected" as const,reason:"Common Play authority fact transport is unavailable"};
    await transport.send({type:"common-play-fact-response",sessionId:wire.sessionId,response:answered});
    return {status:"replayed-response" as const};
  }
  const existing=state.clientPending.get(wire.request.id);
  if(existing){
    if(existing.responderId!==wire.responderId||!sameRequest(existing.request,wire.request))return {status:"rejected" as const,reason:"Common Play authority fact replay conflicts with pending request"};
    return {status:"duplicate" as const};
  }
  state.clientPending.set(wire.request.id,{request:wire.request,responderId:wire.responderId});
  return {status:"applied" as const};
}

export async function submitConnectedCommonPlayAuthorityFactResponse(
  adapter:MockAdapter,
  requestId:string,
  value:unknown,
) {
  const connected=connectedStateFor(adapter);
  const sessionId=connected.sessionId;
  if(connected.mode!=="client"||!sessionId)return {status:"rejected" as const,reason:"Common Play authority fact response requires an active Client session"};
  if(!transport)return {status:"rejected" as const,reason:"Common Play authority fact transport is unavailable"};
  const state=routingStateFor(adapter);
  const pending=state.clientPending.get(requestId);
  if(!pending){
    const answered=state.clientAnswered.get(requestId);
    return answered?{status:"duplicate" as const,response:answered}:{status:"rejected" as const,reason:"Common Play authority fact request is not pending"};
  }
  const response:CommonPlayAuthorityFactResponse={
    requestId:pending.request.id,
    idempotencyKey:pending.request.idempotencyKey,
    expectedRevision:pending.request.expectedRevision,
    responderId:pending.responderId,
    value,
  };
  await transport.send({type:"common-play-fact-response",sessionId,response});
  state.clientPending.delete(requestId);
  state.clientAnswered.set(requestId,response);
  return {status:"sent" as const,response};
}

export async function routeConnectedCommonPlayAuthorityFactResponse(
  adapter:MockAdapter,
  transportMessage:SessionTransportMessage,
  wire:CommonPlayFactResponseWire,
) {
  const connected=connectedStateFor(adapter);
  const sessionId=connected.sessionId;
  if(connected.mode!=="host"||!sessionId||wire.sessionId!==sessionId)return {status:"rejected" as const,reason:"Common Play authority fact response session does not match this Host"};
  const state=routingStateFor(adapter);
  const completed=state.hostCompleted.get(wire.response.requestId);
  const pending=state.hostPending.get(wire.response.requestId);
  const expected=completed??pending;
  if(!expected)return {status:"rejected" as const,reason:"Common Play authority fact response has no active or completed request"};
  const peer=currentPeerForResponder(adapter,expected.responderId);
  if(!peer||peer!==transportMessage.peer)return {status:"rejected" as const,reason:"Common Play authority fact response came from a non-owner peer"};
  if(wire.response.responderId!==expected.responderId)return {status:"rejected" as const,reason:"Common Play authority fact responder identity mismatch"};
  if(completed){
    if(!sameRequest(completed.request,{...completed.request,idempotencyKey:wire.response.idempotencyKey,expectedRevision:wire.response.expectedRevision}))return {status:"rejected" as const,reason:"Common Play authority fact duplicate identity mismatch"};
    return {status:"duplicate" as const,resolution:completed.resolution};
  }
  const resolution=answerCommonPlayFactRequest(pending!.request,wire.response,pending!.currentRevision());
  if(resolution.status==="resolved"){
    state.hostPending.delete(wire.response.requestId);
    state.hostCompleted.set(wire.response.requestId,{request:pending!.request,responderId:pending!.responderId,resolution});
    pending!.onResolution(resolution);
    return resolution;
  }
  if(resolution.status==="stale"){
    state.hostPending.delete(wire.response.requestId);
    state.hostClosed.add(wire.response.requestId);
    pending!.onResolution(resolution);
  }
  return resolution;
}

export async function resumeConnectedCommonPlayAuthorityFactRequestsForCharacter(adapter:MockAdapter,responderId:string) {
  const connected=connectedStateFor(adapter);
  const sessionId=connected.sessionId;
  if(connected.mode!=="host"||!sessionId||!transport)return {status:"ignored" as const};
  const peer=currentPeerForResponder(adapter,responderId);
  if(!peer)return {status:"ignored" as const};
  const state=routingStateFor(adapter);
  let resent=0;
  for(const pending of state.hostPending.values()){
    if(pending.responderId!==responderId)continue;
    await transport.sendTo(peer,promptFor(sessionId,responderId,pending.request));
    resent+=1;
  }
  return {status:"resent" as const,count:resent,peer};
}
