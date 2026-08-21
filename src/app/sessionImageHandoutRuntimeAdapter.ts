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

type HandoutEnvelope={type:"presentation-handout";sessionId:string;revision:number;asset:LocalImageAssetV1|null};
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
  if (handout.sessionId!==sessionId||handout.revision<1) return result;
  const envelope:HandoutEnvelope={type:"presentation-handout",sessionId,revision:handout.revision,asset:handout.asset};
  await baseSendTo(peer,JSON.stringify(envelope));
  return result;
}

async function onMessageWithHandout(handler:(message:SessionTransportMessage)=>void) {
  const client=registeringClientAdapter;
  return baseOnMessage((message)=>{
    if (client) {
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
  return previousHostSession.call(this);
};

MockAdapter.prototype.joinSession=async function joinSessionWithImageHandout(address:string) {
  registeringClientAdapter=this;
  resetSessionImageHandout(this);
  try { return await previousJoinSession.call(this,address); }
  finally { registeringClientAdapter=null; }
};

MockAdapter.prototype.stopSession=async function stopSessionWithImageHandout() {
  const result=await previousStopSession.call(this);
  resetSessionImageHandout(this);
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
export { getSessionImageHandoutState,subscribeSessionImageHandout };
