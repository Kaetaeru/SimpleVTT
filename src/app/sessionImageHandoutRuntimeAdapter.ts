import { MockAdapter } from "./mockAdapter";
import { connectedStateFor } from "./connectedSessionState";
import { HANDOUT_IMAGE_MAX_BYTES, isLocalImageAssetV1, type LocalImageAssetV1 } from "./localImageAsset";
import {
  applyRemoteSessionImageHandout,
  dismissSessionImageHandoutState,
  getSessionImageHandoutState,
  reopenSessionImageHandoutState,
  resetSessionImageHandout,
  setHostSessionImageHandout,
  setSessionImageHandoutError,
  subscribeSessionImageHandout,
} from "./sessionImageHandoutState";
import { tauriSessionTransport, type SessionTransportMessage } from "./tauriSessionTransport";
import {
  applyRemoteSessionLastRollDismissed,
  getSessionLastRollPresentationState,
  resetSessionLastRollPresentationState,
  setHostSessionLastRollDismissed,
  subscribeSessionLastRollPresentation,
} from "./sessionLastRollPresentationState";

type HandoutEnvelope={type:"presentation-handout";sessionId:string;revision:number;asset:LocalImageAssetV1|null};
type LastRollEnvelope={type:"presentation-last-roll-dismiss";sessionId:string;revision:number;resolutionId:string};
type Raw=Record<string,unknown>;

let activeHostAdapter:MockAdapter|null=null;
let registeringClientAdapter:MockAdapter|null=null;
const baseSendTo=tauriSessionTransport.sendTo.bind(tauriSessionTransport);
const baseOnMessage=tauriSessionTransport.onMessage.bind(tauriSessionTransport);

function object(value:unknown):Raw|undefined {
  return value&&typeof value==="object"&&!Array.isArray(value)?value as Raw:undefined;
}

function decodeHandoutEnvelope(raw:string):{status:"other"}|{status:"rejected";error:string}|{status:"ok";message:HandoutEnvelope} {
  let value:unknown;
  try { value=JSON.parse(raw); }
  catch { return {status:"other"}; }
  const record=object(value);
  if (!record||record.type!=="presentation-handout") return {status:"other"};
  if (typeof record.sessionId!=="string"||!record.sessionId||!Number.isInteger(record.revision)||Number(record.revision)<1) {
    return {status:"rejected",error:"이미지 공유 메시지의 세션/리비전이 올바르지 않습니다."};
  }
  if (record.asset!==null&&!isLocalImageAssetV1(record.asset,HANDOUT_IMAGE_MAX_BYTES)) {
    return {status:"rejected",error:"Host 이미지가 PNG/JPEG/WebP 형식 또는 4 MiB 제한을 충족하지 않습니다."};
  }
  return {status:"ok",message:{type:"presentation-handout",sessionId:record.sessionId,revision:Number(record.revision),asset:record.asset?structuredClone(record.asset as LocalImageAssetV1):null}};
}

function decodeLastRollEnvelope(raw:string):{status:"other"}|{status:"rejected";error:string}|{status:"ok";message:LastRollEnvelope} {
  let value:unknown;
  try{value=JSON.parse(raw);}catch{return {status:"other"};}
  const record=object(value);
  if(!record||record.type!=="presentation-last-roll-dismiss")return {status:"other"};
  if(Object.keys(record).some((key)=>!["type","sessionId","revision","resolutionId"].includes(key)))return {status:"rejected",error:"Last Roll 닫기 메시지에 지원하지 않는 필드가 있습니다."};
  if(typeof record.sessionId!=="string"||!record.sessionId||!Number.isInteger(record.revision)||Number(record.revision)<1||typeof record.resolutionId!=="string"||!record.resolutionId||record.resolutionId.length>256)return {status:"rejected",error:"Last Roll 닫기 메시지가 올바르지 않습니다."};
  return {status:"ok",message:{type:"presentation-last-roll-dismiss",sessionId:record.sessionId,revision:Number(record.revision),resolutionId:record.resolutionId}};
}

function compatibleHelloAck(raw:string) {
  try {
    const value=object(JSON.parse(raw));
    const compatibility=object(value?.compatibility);
    return value?.type==="hello-ack"&&typeof value.sessionId==="string"&&compatibility?.status==="compatible"
      ? String(value.sessionId)
      : null;
  } catch { return null; }
}

async function sendToWithHandoutRestore(peer:string,message:string) {
  const result=await baseSendTo(peer,message);
  const host=activeHostAdapter;
  const sessionId=compatibleHelloAck(message);
  if (!host||!sessionId) return result;
  const handout=getSessionImageHandoutState(host);
  if (handout.sessionId===sessionId&&handout.revision>=1) {
    const envelope:HandoutEnvelope={type:"presentation-handout",sessionId,revision:handout.revision,asset:handout.asset};
    await baseSendTo(peer,JSON.stringify(envelope));
  }
  const lastRoll=getSessionLastRollPresentationState(host);
  if(lastRoll.sessionId===sessionId&&lastRoll.revision>=1&&lastRoll.dismissedResolutionId){
    const envelope:LastRollEnvelope={type:"presentation-last-roll-dismiss",sessionId,revision:lastRoll.revision,resolutionId:lastRoll.dismissedResolutionId};
    await baseSendTo(peer,JSON.stringify(envelope));
  }
  return result;
}

async function onMessageWithHandout(handler:(message:SessionTransportMessage)=>void) {
  const client=registeringClientAdapter;
  return baseOnMessage((message)=>{
    if (client) {
      const lastRoll=decodeLastRollEnvelope(message.message);
      if(lastRoll.status==="ok"){
        applyRemoteSessionLastRollDismissed(client,lastRoll.message.sessionId,lastRoll.message.revision,lastRoll.message.resolutionId);
        return;
      }
      if(lastRoll.status==="rejected")return;
      const decoded=decodeHandoutEnvelope(message.message);
      if (decoded.status==="ok") {
        applyRemoteSessionImageHandout(client,decoded.message.sessionId,decoded.message.revision,decoded.message.asset);
        return;
      }
      if (decoded.status==="rejected") {
        setSessionImageHandoutError(client,decoded.error);
        return;
      }
    }
    handler(message);
  });
}

tauriSessionTransport.sendTo=sendToWithHandoutRestore;
tauriSessionTransport.onMessage=onMessageWithHandout;

const previousHostSession=MockAdapter.prototype.hostSession;
const previousJoinSession=MockAdapter.prototype.joinSession;
const previousStopSession=MockAdapter.prototype.stopSession;

MockAdapter.prototype.hostSession=async function hostSessionWithImageHandout() {
  activeHostAdapter=this;
  resetSessionImageHandout(this);
  resetSessionLastRollPresentationState(this);
  return previousHostSession.call(this);
};

MockAdapter.prototype.joinSession=async function joinSessionWithImageHandout(address:string) {
  registeringClientAdapter=this;
  resetSessionImageHandout(this);
  resetSessionLastRollPresentationState(this);
  try { return await previousJoinSession.call(this,address); }
  finally { registeringClientAdapter=null; }
};

MockAdapter.prototype.stopSession=async function stopSessionWithImageHandout() {
  const result=await previousStopSession.call(this);
  resetSessionImageHandout(this);
  resetSessionLastRollPresentationState(this);
  if (activeHostAdapter===this) activeHostAdapter=null;
  if (registeringClientAdapter===this) registeringClientAdapter=null;
  return result;
};

export async function revealSessionImageHandout(adapter:MockAdapter,asset:LocalImageAssetV1) {
  if (!isLocalImageAssetV1(asset,HANDOUT_IMAGE_MAX_BYTES)) throw new Error("공유 이미지는 PNG/JPEG/WebP, 최대 4 MiB여야 합니다.");
  const connected=connectedStateFor(adapter);
  if (connected.mode!=="host"||!connected.sessionId) throw new Error("이미지 공유는 연결된 Host 세션에서만 사용할 수 있습니다.");
  const state=setHostSessionImageHandout(adapter,connected.sessionId,asset);
  const envelope:HandoutEnvelope={type:"presentation-handout",sessionId:connected.sessionId,revision:state.revision,asset:state.asset};
  await tauriSessionTransport.send(JSON.stringify(envelope));
  return state;
}

export async function withdrawSessionImageHandout(adapter:MockAdapter) {
  const connected=connectedStateFor(adapter);
  if (connected.mode!=="host"||!connected.sessionId) throw new Error("이미지 공유는 연결된 Host 세션에서만 사용할 수 있습니다.");
  const state=setHostSessionImageHandout(adapter,connected.sessionId,null);
  const envelope:HandoutEnvelope={type:"presentation-handout",sessionId:connected.sessionId,revision:state.revision,asset:null};
  await tauriSessionTransport.send(JSON.stringify(envelope));
  return state;
}

export function dismissSessionImageHandout(adapter:MockAdapter) { return dismissSessionImageHandoutState(adapter); }
export function reopenSessionImageHandout(adapter:MockAdapter) { return reopenSessionImageHandoutState(adapter); }
export async function dismissSessionLastRoll(adapter:MockAdapter,resolutionId:string) {
  if(!resolutionId||resolutionId.length>256)throw new Error("닫을 Last Roll 식별자가 올바르지 않습니다.");
  const snapshot=await adapter.getSnapshot();
  if(snapshot.session.role!=="host")throw new Error("Last Roll은 DM만 모든 화면에서 닫을 수 있습니다.");
  const connected=connectedStateFor(adapter);
  const sessionId=connected.mode==="host"&&connected.sessionId?connected.sessionId:"local:preview";
  const state=setHostSessionLastRollDismissed(adapter,sessionId,resolutionId);
  if(connected.mode==="host"&&connected.sessionId){const envelope:LastRollEnvelope={type:"presentation-last-roll-dismiss",sessionId,revision:state.revision,resolutionId};await tauriSessionTransport.send(JSON.stringify(envelope));}
  return state;
}
export { getSessionImageHandoutState,subscribeSessionImageHandout,getSessionLastRollPresentationState,subscribeSessionLastRollPresentation };
