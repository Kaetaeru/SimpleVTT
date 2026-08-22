import type { AppSnapshot } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import {
  CONNECTED_CAPABILITIES,
  broadcastConnectedWire,
  publishConnectedSnapshot,
  sendConnectedWireTo,
} from "./connectedSessionRuntimeAdapter";
import { decodeConnectedWireMessage } from "./connectedSessionWire";
import { connectedStateFor } from "./connectedSessionState";
import { tauriSessionTransport, type SessionTransportMessage } from "./tauriSessionTransport";
import {
  abortConnectedLongRestOwner,
  authorizeConnectedLongRestHostDecision,
  beginConnectedLongRestHostOffer,
  completeConnectedLongRestHostOwnerMaterialization,
  connectedLongRestClientRecoveryMessages,
  connectedLongRestHostRecoveryMessages,
  connectedLongRestOwnerPrompts,
  decideConnectedLongRestOwnerOffer,
  materializeConnectedLongRestOwnerAfterGlobalCommit,
  prepareAuthorizedConnectedLongRestOwner,
  receiveConnectedLongRestOwnerOffer,
  recordConnectedLongRestHostOwnerPrepared,
  resetConnectedLongRestRuntime,
} from "./connectedLongRestRuntimePort";

if(!CONNECTED_CAPABILITIES.includes("connected-long-rest-v1")) CONNECTED_CAPABILITIES.push("connected-long-rest-v1");

declare module "./contracts" {
  interface AppSnapshot {
    connectedLongRest?:{
      ownerPrompts:ReturnType<typeof connectedLongRestOwnerPrompts>;
    };
  }
}

declare module "./mockAdapter" {
  interface MockAdapter {
    startConnectedLongRest(input:{characterId:string;transactionId?:string;advanceMinutes?:number;consumeRations?:boolean}):Promise<AppSnapshot>;
    respondConnectedLongRest(transactionId:string,accepted:boolean):Promise<AppSnapshot>;
  }
}

type SessionVm={
  compatibility:"compatible"|"warning"|"incompatible";
  compatibilityMessage:string;
};

type LongRestAdapterState={session:SessionVm};
const listeners=new WeakSet<MockAdapter>();

function internal(adapter:MockAdapter){return adapter as unknown as LongRestAdapterState;}

async function warn(adapter:MockAdapter,message:string) {
  const app=internal(adapter);
  app.session.compatibility="warning";
  app.session.compatibilityMessage=message;
  await publishConnectedSnapshot(adapter);
}

async function scheduleHostRecovery(adapter:MockAdapter,peer:string) {
  globalThis.setTimeout(()=>{
    void (async()=>{
      const state=connectedStateFor(adapter);
      if(state.mode!=="host"||!state.peerParticipants.has(peer)||!state.peerManifests.has(peer)) return;
      for(const recovery of connectedLongRestHostRecoveryMessages(adapter,peer)){
        await sendConnectedWireTo(peer,recovery).catch(()=>undefined);
      }
    })();
  },50);
}

async function scheduleClientRecovery(adapter:MockAdapter) {
  globalThis.setTimeout(()=>{
    void (async()=>{
      const state=connectedStateFor(adapter);
      if(state.mode!=="client"||!state.sessionId) return;
      for(const recovery of connectedLongRestClientRecoveryMessages(adapter)){
        await broadcastConnectedWire(recovery).catch(()=>undefined);
      }
    })();
  },50);
}

async function handleHostLongRest(adapter:MockAdapter,message:SessionTransportMessage,wire:ReturnType<typeof decodeConnectedWireMessage> extends {status:"ok";message:infer T}?T:never) {
  if(typeof wire!=="object"||wire===null||!("type" in wire)) return;
  if(wire.type==="long-rest-decision"){
    const result=await authorizeConnectedLongRestHostDecision(adapter,message.peer,wire.decision);
    if(result.status==="ready"){
      await sendConnectedWireTo(message.peer,{type:"long-rest-prepare-authorized",preflight:result.preflight});
    }else if(result.status==="rejected"){
      await sendConnectedWireTo(message.peer,{type:"error",code:"connected-long-rest-preflight",message:result.error});
    }
    await publishConnectedSnapshot(adapter);
    return;
  }
  if(wire.type==="long-rest-owner-prepared"){
    const result=await recordConnectedLongRestHostOwnerPrepared(adapter,message.peer,wire.prepared);
    if(result.status==="committed"){
      if(result.projectionWarning) await warn(adapter,result.projectionWarning);
      await sendConnectedWireTo(message.peer,{type:"long-rest-global-commit",commit:result.commit});
    }else{
      await sendConnectedWireTo(message.peer,{type:"long-rest-abort",transactionId:result.transactionId,reason:result.reason});
    }
    await publishConnectedSnapshot(adapter);
    return;
  }
  if(wire.type==="long-rest-owner-materialized"){
    try{
      completeConnectedLongRestHostOwnerMaterialization(adapter,message.peer,wire.materialized,wire.projection);
      await publishConnectedSnapshot(adapter);
    }catch(error){
      await sendConnectedWireTo(message.peer,{
        type:"error",
        code:"connected-long-rest-owner-materialization",
        message:error instanceof Error?error.message:String(error),
      });
      await warn(adapter,`Connected Long Rest Campaign is committed; owner projection recovery required: ${error instanceof Error?error.message:String(error)}`);
    }
  }
}

async function handleClientLongRest(adapter:MockAdapter,wire:ReturnType<typeof decodeConnectedWireMessage> extends {status:"ok";message:infer T}?T:never) {
  if(typeof wire!=="object"||wire===null||!("type" in wire)) return;
  if(wire.type==="long-rest-offer"){
    receiveConnectedLongRestOwnerOffer(adapter,wire.offer);
    await publishConnectedSnapshot(adapter);
    return;
  }
  if(wire.type==="long-rest-prepare-authorized"){
    try{
      const prepared=await prepareAuthorizedConnectedLongRestOwner(adapter,wire.preflight);
      await broadcastConnectedWire({type:"long-rest-owner-prepared",prepared});
      await publishConnectedSnapshot(adapter);
    }catch(error){
      await warn(adapter,`Connected Long Rest prepare failed; Host may retry authorization: ${error instanceof Error?error.message:String(error)}`);
    }
    return;
  }
  if(wire.type==="long-rest-global-commit"){
    try{
      const result=await materializeConnectedLongRestOwnerAfterGlobalCommit(adapter,wire.commit);
      await broadcastConnectedWire({type:"long-rest-owner-materialized",materialized:result.materialized,projection:result.projection});
      await publishConnectedSnapshot(adapter);
    }catch(error){
      // Global Campaign commit is irreversible. Keep the prepared marker and
      // wait for retry/reconnect instead of sending a compensating abort.
      await warn(adapter,`Connected Long Rest is committed by Host; Character materialization recovery required: ${error instanceof Error?error.message:String(error)}`);
    }
    return;
  }
  if(wire.type==="long-rest-abort"){
    try{
      await abortConnectedLongRestOwner(adapter,wire.transactionId,wire.reason);
      await publishConnectedSnapshot(adapter);
    }catch(error){
      await warn(adapter,`Connected Long Rest abort could not be applied locally: ${error instanceof Error?error.message:String(error)}`);
    }
  }
}

async function handleLongRestTransportMessage(adapter:MockAdapter,message:SessionTransportMessage) {
  const decoded=decodeConnectedWireMessage(message.message);
  if(decoded.status==="rejected") return;
  const state=connectedStateFor(adapter);

  // The canonical connected-session listener is registered first. Defer replay
  // until it has accepted/rebound the participant and updated session identity.
  if(decoded.message.type==="hello"&&state.mode==="host"){
    await scheduleHostRecovery(adapter,message.peer);
    return;
  }
  if(decoded.message.type==="hello-ack"&&state.mode==="client"){
    await scheduleClientRecovery(adapter);
    return;
  }
  if(decoded.message.type==="session-ended"){
    resetConnectedLongRestRuntime(adapter);
    return;
  }
  if(!decoded.message.type.startsWith("long-rest-")) return;

  try{
    if(state.mode==="host") await handleHostLongRest(adapter,message,decoded.message);
    else if(state.mode==="client") await handleClientLongRest(adapter,decoded.message);
  }catch(error){
    if(state.mode==="host"){
      await sendConnectedWireTo(message.peer,{
        type:"error",code:"connected-long-rest-runtime",message:error instanceof Error?error.message:String(error),
      }).catch(()=>undefined);
    }else{
      await warn(adapter,`Connected Long Rest runtime error: ${error instanceof Error?error.message:String(error)}`);
    }
  }
}

async function ensureLongRestListener(adapter:MockAdapter) {
  if(listeners.has(adapter)||!tauriSessionTransport.available()) return;
  listeners.add(adapter);
  await tauriSessionTransport.onMessage((message)=>{void handleLongRestTransportMessage(adapter,message);});
}

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
MockAdapter.prototype.getSnapshot=async function getSnapshotWithConnectedLongRest(){
  const snapshot=await previousGetSnapshot.call(this);
  snapshot.connectedLongRest={ownerPrompts:connectedLongRestOwnerPrompts(this)};
  return snapshot;
};

const previousHostSession=MockAdapter.prototype.hostSession;
MockAdapter.prototype.hostSession=async function hostSessionWithConnectedLongRest(){
  resetConnectedLongRestRuntime(this);
  const snapshot=await previousHostSession.call(this);
  await ensureLongRestListener(this);
  return snapshot;
};

const previousJoinSession=MockAdapter.prototype.joinSession;
MockAdapter.prototype.joinSession=async function joinSessionWithConnectedLongRest(address:string){
  resetConnectedLongRestRuntime(this);
  const snapshot=await previousJoinSession.call(this,address);
  await ensureLongRestListener(this);
  return snapshot;
};

MockAdapter.prototype.startConnectedLongRest=async function startConnectedLongRestRuntime(input){
  await ensureLongRestListener(this);
  const started=await beginConnectedLongRestHostOffer(this,input);
  await sendConnectedWireTo(started.peer,{type:"long-rest-offer",offer:started.offer});
  return this.getSnapshot();
};

MockAdapter.prototype.respondConnectedLongRest=async function respondConnectedLongRestRuntime(transactionId:string,accepted:boolean){
  await ensureLongRestListener(this);
  const decision=decideConnectedLongRestOwnerOffer(this,transactionId,accepted);
  await broadcastConnectedWire({type:"long-rest-decision",decision});
  return this.getSnapshot();
};
