import "./productionSessionLifecycleAdapter";
import type { InstalledCatalogEntryV1 } from "./installedContentContracts";
import {
  installSessionInstalledContent,
  requiredSessionInstalledContent,
  snapshotSessionInstalledContent,
  type SessionInstalledContentIdentityV1,
} from "./installedContentRuntimeAdapter";
import { MockAdapter } from "./mockAdapter";
import { connectedInternal, publishConnectedSnapshot } from "./connectedSessionRuntimeAdapter";
import { connectedStateFor } from "./connectedSessionState";
import { decodeConnectedWireMessage, encodeConnectedWireMessage, type ConnectedWireMessage } from "./connectedSessionWire";
import { tauriSessionTransport, type SessionTransportMessage } from "./tauriSessionTransport";

type ParityStatus="unknown"|"checking"|"syncing"|"ready"|"error";
type ParityState={status:ParityStatus;message:string};
type HelloWire=Extract<ConnectedWireMessage,{type:"hello"}>;

type RawRecord=Record<string,unknown>;

const parityStates=new WeakMap<MockAdapter,ParityState>();
const lastClientHello=new WeakMap<MockAdapter,HelloWire>();
let activeAdapter:MockAdapter|null=null;

function parityFor(adapter:MockAdapter):ParityState {
  const existing=parityStates.get(adapter);
  if (existing) return existing;
  const initial={status:"unknown" as const,message:"콘텐츠 확인 대기"};
  parityStates.set(adapter,initial);
  return initial;
}

function setParity(adapter:MockAdapter,status:ParityStatus,message:string) {
  const next={status,message};
  parityStates.set(adapter,next);
  return next;
}

function object(value:unknown):RawRecord|undefined {
  return value && typeof value==="object" && !Array.isArray(value) ? value as RawRecord : undefined;
}

function parseRaw(message:string):RawRecord|undefined {
  try { return object(JSON.parse(message)); }
  catch { return undefined; }
}

function parsePeerInventory(value:unknown):SessionInstalledContentIdentityV1[] {
  if (value===undefined) return [];
  if (!Array.isArray(value)) throw new Error("peer installed-content inventory must be an array");
  return value.map((item,index)=>{
    const entry=object(item);
    if (!entry) throw new Error(`peer installed-content inventory[${index}] must be an object`);
    for (const field of ["contentId","sourceId","version","revision"] as const) {
      if (typeof entry[field]!=="string" || !String(entry[field]).trim()) throw new Error(`peer installed-content inventory[${index}].${field} is invalid`);
    }
    return {
      contentId:String(entry.contentId),
      sourceId:String(entry.sourceId),
      version:String(entry.version),
      revision:String(entry.revision),
    };
  });
}

function parseRequiredContent(value:unknown):InstalledCatalogEntryV1[] {
  if (value===undefined) return [];
  if (!Array.isArray(value)) throw new Error("Host requiredContent must be an array");
  return value.map((item,index)=>{
    const entry=object(item);
    if (!entry) throw new Error(`Host requiredContent[${index}] must be an object`);
    for (const field of ["contentId","sourceId","version","nameKo","nameEn","source","description"] as const) {
      if (typeof entry[field]!=="string" || !String(entry[field]).trim()) throw new Error(`Host requiredContent[${index}].${field} is invalid`);
    }
    if (typeof entry.category!=="string" || !Array.isArray(entry.relationships) || !Array.isArray(entry.capabilities)) {
      throw new Error(`Host requiredContent[${index}] has an invalid declarative shape`);
    }
    return structuredClone(entry) as unknown as InstalledCatalogEntryV1;
  });
}

function compatibilityRecord(value:unknown) {
  const entry=object(value);
  if (!entry || typeof entry.status!=="string" || typeof entry.message!=="string") return undefined;
  if (entry.status!=="compatible"&&entry.status!=="warning"&&entry.status!=="incompatible") return undefined;
  return entry as {status:"compatible"|"warning"|"incompatible";message:string};
}

const previousSend=tauriSessionTransport.send.bind(tauriSessionTransport);
const previousSendTo=tauriSessionTransport.sendTo.bind(tauriSessionTransport);
const previousOnMessage=tauriSessionTransport.onMessage.bind(tauriSessionTransport);

async function sendHelloWithInventory(adapter:MockAdapter,hello:HelloWire) {
  const app=connectedInternal(adapter);
  try {
    const installedContent=await snapshotSessionInstalledContent(adapter);
    lastClientHello.set(adapter,structuredClone(hello));
    setParity(adapter,"checking","콘텐츠 확인 중 · Host 설치 콘텐츠와 비교합니다.");
    app.session.compatibility="warning";
    app.session.compatibilityMessage="콘텐츠 확인 중 · Host 설치 콘텐츠와 비교합니다.";
    return previousSend(JSON.stringify({...hello,installedContent}));
  } catch(error) {
    const message=`콘텐츠 확인 실패 · Ready 불가: ${error instanceof Error?error.message:String(error)}`;
    setParity(adapter,"error",message);
    app.session.compatibility="warning";
    app.session.compatibilityMessage=message;
    await publishConnectedSnapshot(adapter).catch(()=>undefined);
    return 0;
  }
}

tauriSessionTransport.send=async function sendWithInstalledContentParity(message:string) {
  const adapter=activeAdapter;
  if (!adapter) return previousSend(message);
  const decoded=decodeConnectedWireMessage(message);
  if (decoded.status==="ok"&&decoded.message.type==="hello") {
    return sendHelloWithInventory(adapter,decoded.message);
  }
  return previousSend(message);
};

async function hostParityPreflight(adapter:MockAdapter,message:SessionTransportMessage,raw:RawRecord) {
  const state=connectedStateFor(adapter);
  const app=connectedInternal(adapter);
  const decoded=decodeConnectedWireMessage(message.message);
  if (decoded.status!=="ok"||decoded.message.type!=="hello"||!state.ledger) return message;
  const compatibility=state.ledger.handshake(decoded.message.manifest);
  if (compatibility.status==="incompatible") return message;
  try {
    const inventory=parsePeerInventory(raw.installedContent);
    const requiredContent=await requiredSessionInstalledContent(adapter,inventory);
    if (!requiredContent.length) return message;
    await previousSendTo(message.peer,JSON.stringify({
      type:"hello-ack",
      sessionId:state.ledger.sessionId,
      sessionName:app.session.name,
      compatibility:{status:"warning",message:`콘텐츠 확인 → 필요한 콘텐츠 받기 (${requiredContent.length}) → 검증 대기`},
      hostCursor:state.ledger.cursor,
      events:[],
      requiredContent,
    }));
    return null;
  } catch(error) {
    await previousSendTo(message.peer,encodeConnectedWireMessage({
      type:"hello-ack",
      sessionId:state.ledger.sessionId,
      sessionName:app.session.name,
      compatibility:{status:"incompatible",message:`Host 콘텐츠 확인 실패: ${error instanceof Error?error.message:String(error)}`},
      hostCursor:state.ledger.cursor,
      events:[],
    }));
    return null;
  }
}

async function clientParityPreflight(adapter:MockAdapter,message:SessionTransportMessage,raw:RawRecord) {
  const decoded=decodeConnectedWireMessage(message.message);
  if (decoded.status!=="ok"||decoded.message.type!=="hello-ack") return message;
  const app=connectedInternal(adapter);
  const compatibility=compatibilityRecord(raw.compatibility);
  if (!compatibility) return message;
  if (compatibility.status==="incompatible") {
    setParity(adapter,"error",compatibility.message);
    return message;
  }

  let requiredContent:InstalledCatalogEntryV1[];
  try {
    requiredContent=parseRequiredContent(raw.requiredContent);
  } catch(error) {
    const detail=error instanceof Error?error.message:String(error);
    const parityMessage=`콘텐츠 검증 실패 · Ready 불가: ${detail}`;
    setParity(adapter,"error",parityMessage);
    app.session.compatibility="warning";
    app.session.compatibilityMessage=parityMessage;
    await publishConnectedSnapshot(adapter).catch(()=>undefined);
    return null;
  }

  if (requiredContent.length) {
    const receiving=`필요한 콘텐츠 받기 (${requiredContent.length}) → 검증 중 · Ready 대기`;
    setParity(adapter,"syncing",receiving);
    app.session.compatibility="warning";
    app.session.compatibilityMessage=receiving;
    await publishConnectedSnapshot(adapter).catch(()=>undefined);
    try {
      await installSessionInstalledContent(adapter,requiredContent);
      const hello=lastClientHello.get(adapter);
      if (!hello) throw new Error("재검증에 사용할 Client hello가 없습니다.");
      const checking="콘텐츠 검증 완료 → Host 준비 상태 재확인 중";
      setParity(adapter,"checking",checking);
      app.session.compatibility="warning";
      app.session.compatibilityMessage=checking;
      await publishConnectedSnapshot(adapter).catch(()=>undefined);
      await tauriSessionTransport.send(encodeConnectedWireMessage(hello));
    } catch(error) {
      const detail=error instanceof Error?error.message:String(error);
      const parityMessage=`콘텐츠 동기화 실패 · Ready 불가: ${detail}`;
      setParity(adapter,"error",parityMessage);
      app.session.compatibility="warning";
      app.session.compatibilityMessage=parityMessage;
      await publishConnectedSnapshot(adapter).catch(()=>undefined);
    }
    return null;
  }

  const complete=`콘텐츠 확인 → 필요한 콘텐츠 받기 → 검증 → 준비 완료 · ${compatibility.message}`;
  setParity(adapter,"ready",complete);
  return {
    ...message,
    message:JSON.stringify({...raw,compatibility:{...compatibility,message:complete}}),
  };
}

async function parityPreflight(adapter:MockAdapter,message:SessionTransportMessage):Promise<SessionTransportMessage|null> {
  const raw=parseRaw(message.message);
  if (!raw) return message;
  const state=connectedStateFor(adapter);
  if (state.mode==="host"&&raw.type==="hello") return hostParityPreflight(adapter,message,raw);
  if (state.mode==="client"&&raw.type==="hello-ack") return clientParityPreflight(adapter,message,raw);
  return message;
}

tauriSessionTransport.onMessage=async function onMessageWithInstalledContentParity(handler:(message:SessionTransportMessage)=>void) {
  const adapter=activeAdapter;
  return previousOnMessage((message)=>{
    if (!adapter) { handler(message); return; }
    void parityPreflight(adapter,message)
      .then((next)=>{ if (next) handler(next); })
      .catch(async(error)=>{
        const app=connectedInternal(adapter);
        const detail=error instanceof Error?error.message:String(error);
        const parityMessage=`콘텐츠 동기화 실패 · Ready 불가: ${detail}`;
        setParity(adapter,"error",parityMessage);
        app.session.compatibility="warning";
        app.session.compatibilityMessage=parityMessage;
        await publishConnectedSnapshot(adapter).catch(()=>undefined);
      });
  });
};

const previousHostSession=MockAdapter.prototype.hostSession;
const previousJoinSession=MockAdapter.prototype.joinSession;
const previousStopSession=MockAdapter.prototype.stopSession;
const previousSetSessionReady=MockAdapter.prototype.setSessionReady;

MockAdapter.prototype.hostSession=async function hostSessionWithContentParity() {
  activeAdapter=this;
  setParity(this,"unknown","Host 콘텐츠 parity 대기");
  return previousHostSession.call(this);
};

MockAdapter.prototype.joinSession=async function joinSessionWithContentParity(address:string) {
  activeAdapter=this;
  lastClientHello.delete(this);
  setParity(this,"unknown","콘텐츠 확인 대기");
  return previousJoinSession.call(this,address);
};

MockAdapter.prototype.stopSession=async function stopSessionWithContentParity() {
  const result=await previousStopSession.call(this);
  lastClientHello.delete(this);
  setParity(this,"unknown","콘텐츠 확인 대기");
  return result;
};

MockAdapter.prototype.setSessionReady=async function setSessionReadyAfterContentParity(ready:boolean) {
  if (ready) {
    const parity=parityFor(this);
    if (parity.status!=="ready") {
      const app=connectedInternal(this);
      app.session.compatibility="warning";
      app.session.compatibilityMessage=parity.status==="error" ? parity.message : `콘텐츠 확인이 끝날 때까지 Ready할 수 없습니다. ${parity.message}`;
      return app.getSnapshot();
    }
  }
  return previousSetSessionReady.call(this,ready);
};

export function getSessionContentParityStateForTests(adapter:MockAdapter) {
  return structuredClone(parityFor(adapter));
}
