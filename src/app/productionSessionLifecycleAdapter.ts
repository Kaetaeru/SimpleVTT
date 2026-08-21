import type { AppSnapshot, CharacterSummary, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import {
  broadcastConnectedWire,
  connectedInternal,
  connectedManifest,
  publishConnectedSnapshot,
  resetConnectedSessionTransientState,
} from "./connectedSessionRuntimeAdapter";
import { connectedStateFor, resetConnectedState } from "./connectedSessionState";
import { publishConnectedTurnProjection } from "./connectedTurnRoutingAdapter";
import { projectedCharacterIds } from "./characterSessionProjectionRegistry";
import { unmountAllReconstructedCharacterSessionProjections } from "./characterSessionProjectionMount";
import { tauriSessionTransport, type SessionTransportPeerLifecycle } from "./tauriSessionTransport";

export type ProductionSessionLifecycle = "offline" | "preparing" | "connecting" | "lobby" | "live";

declare module "./contracts" {
  interface SessionVm {
    lifecycle?: ProductionSessionLifecycle;
    rulesProfileId?: string;
  }
}

declare module "./mockAdapter" {
  interface MockAdapter {
    stopSession():Promise<AppSnapshot>;
    setSessionReady(ready:boolean):Promise<AppSnapshot>;
    setPreparedSessionName(name:string):Promise<AppSnapshot>;
    startPreparedSession(mode:SessionMode):Promise<AppSnapshot>;
  }
}

const REFERENCE_CHARACTER_IDS=new Set(["char.aelar","char.mira"]);
const REFERENCE_SESSION_NAME="금요일 세션";
const DEFAULT_PRODUCTION_SESSION_NAME="새 플레이 세션";
const REFERENCE_LOCAL_CONTENT_IDS=new Set(["combatant.goblin","subclass.iron-warden"]);
const lifecycleByAdapter=new WeakMap<MockAdapter,ProductionSessionLifecycle>();
const hostPeerObserverInstalled=new WeakSet<MockAdapter>();

function isSavedProductionCharacter(character:CharacterSummary) {
  return !REFERENCE_CHARACTER_IDS.has(character.id) && character.saveState==="saved";
}

export function productionJoinCharacters(adapter:MockAdapter) {
  return connectedInternal(adapter).characters.filter(isSavedProductionCharacter).map((character)=>structuredClone(character));
}

export function activeCharacterCanJoinProductionSession(adapter:MockAdapter) {
  const app=connectedInternal(adapter);
  return productionJoinCharacters(adapter).some((character)=>character.id===app.activeCharacter.id);
}

function productionSessionContent(adapter:MockAdapter) {
  const entries=connectedInternal(adapter).catalog
    .filter((entry)=>entry.scope!=="builtin"&&!REFERENCE_LOCAL_CONTENT_IDS.has(entry.id))
    .map((entry)=>`${entry.nameKo} · ${entry.source} ${entry.version}`.trim());
  return [...new Set(entries)];
}

function refreshHostSessionMetadata(adapter:MockAdapter) {
  const app=connectedInternal(adapter);
  const manifest=connectedManifest(adapter);
  app.session.rulesProfileId=manifest.rulesProfileId;
  app.session.sessionContent=productionSessionContent(adapter);
}

function lifecycleFor(adapter:MockAdapter):ProductionSessionLifecycle {
  const app=connectedInternal(adapter);
  const state=connectedStateFor(adapter);
  if (state.sessionStarted && (state.mode==="host"||state.mode==="client")) return "live";
  if (app.session.role==="client") {
    if (state.mode!=="client") return "offline";
    return state.sessionId ? "lobby" : "connecting";
  }
  if (app.session.role==="offline") return "offline";
  const stored=lifecycleByAdapter.get(adapter);
  if (stored) return stored;
  return "lobby";
}

function setLifecycle(adapter:MockAdapter,lifecycle:ProductionSessionLifecycle) {
  lifecycleByAdapter.set(adapter,lifecycle);
  connectedInternal(adapter).session.lifecycle=lifecycle;
}

function stopBlockedReason(adapter:MockAdapter) {
  const state=connectedStateFor(adapter);
  if (state.pendingRemoteAction) return "Host stop blocked while a remote action is pending resolution.";
  const projected=new Set(projectedCharacterIds(adapter));
  if (projected.has(connectedInternal(adapter).activeCharacter.id)) {
    return "Host stop blocked while a projected Character resolution context is active.";
  }
  return undefined;
}

async function markHostPeerDisconnected(adapter:MockAdapter,event:SessionTransportPeerLifecycle) {
  const state=connectedStateFor(adapter);
  const ledger=state.ledger;
  if (state.mode!=="host"||!ledger||event.state!=="disconnected") return;
  const participantId=state.peerParticipants.get(event.peer);
  if (!participantId) return;
  const app=connectedInternal(adapter);
  const participant=app.session.participants.find((entry)=>entry.id===participantId);
  if (!participant||(participant.state==="disconnected"&&!participant.ready)) return;

  const committed=ledger.commitHostEvent({
    actorId:participantId,
    payload:{
      kind:"participant" as const,
      participantId,
      participantName:participant.name,
      characterName:participant.characterName,
      state:"disconnected",
      ready:false,
      stateChanges:[`${participant.name} disconnected`],
      provenance:[`host-authoritative exact transport disconnect: ${event.peer}`],
    },
  });
  app.session.participants=app.session.participants.map((entry)=>entry.id===participantId?{...entry,state:"disconnected" as const,ready:false}:entry);
  app.session.compatibility="warning";
  app.session.compatibilityMessage=`${participant.name} disconnected. Host runtime is preserved for reconnect.`;
  await broadcastConnectedWire({
    type:"event-batch",
    sessionId:ledger.sessionId,
    afterCursor:committed.sequence-1,
    events:[committed],
  });
  await publishConnectedSnapshot(adapter);
}

function ensureHostPeerObserver(adapter:MockAdapter) {
  if (hostPeerObserverInstalled.has(adapter)||!tauriSessionTransport.available()) return;
  hostPeerObserverInstalled.add(adapter);
  void tauriSessionTransport.onPeerLifecycle((event)=>{
    void markHostPeerDisconnected(adapter,event).catch(()=>undefined);
  });
}

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
MockAdapter.prototype.getSnapshot=async function getSnapshotWithProductionSessionLifecycle() {
  const lifecycle=lifecycleFor(this);
  const app=connectedInternal(this);
  if (app.session.role==="host"&&(lifecycle==="preparing"||lifecycle==="live")) {
    refreshHostSessionMetadata(this);
  }
  const snapshot=await previousGetSnapshot.call(this);
  snapshot.session.lifecycle=lifecycle;
  app.session.lifecycle=lifecycle;
  return snapshot;
};

MockAdapter.prototype.setSessionReady=async function setProductionSessionReady(ready:boolean) {
  const app=connectedInternal(this);
  const state=connectedStateFor(this);
  if (state.mode!=="client"||!state.sessionId||app.session.role!=="client"||lifecycleFor(this)!=="lobby") {
    app.session.compatibility="warning";
    app.session.compatibilityMessage="Ready is only supported by legacy pre-live lobbies; current Host sessions open directly into play.";
    return app.getSnapshot();
  }
  if (app.connectionState!=="connected"||app.session.compatibility==="incompatible") {
    app.session.compatibility="warning";
    app.session.compatibilityMessage="Ready requires an active compatible Host connection.";
    return app.getSnapshot();
  }
  await broadcastConnectedWire({type:"ready-intent",sessionId:state.sessionId,ready});
  app.session.compatibilityMessage=ready ? "Ready sent to legacy Host lobby." : "Ready cancellation sent to legacy Host lobby.";
  return app.getSnapshot();
};

MockAdapter.prototype.setPreparedSessionName=async function setProductionPreparedSessionName(name:string) {
  const app=connectedInternal(this);
  const lifecycle=lifecycleFor(this);
  if (app.session.role!=="host"||(lifecycle!=="preparing"&&lifecycle!=="live")) return app.getSnapshot();
  const normalized=name.trim();
  if (!normalized||normalized.length>80) return app.getSnapshot();
  app.session.name=normalized;
  return app.getSnapshot();
};

MockAdapter.prototype.startPreparedSession=async function startProductionPreparedSession(mode:SessionMode) {
  const app=connectedInternal(this);
  const state=connectedStateFor(this);
  if (state.mode!=="host"||!state.ledger||app.session.role!=="host") {
    app.session.compatibility="warning";
    app.session.compatibilityMessage="Only an active Host can change connected play mode.";
    return app.getSnapshot();
  }
  if (state.sessionStarted) {
    if (mode==="initiative"&&app.sessionMode!=="initiative") return this.startInitiative();
    if (mode==="freeform"&&app.sessionMode==="initiative") return this.endInitiative();
    return app.getSnapshot();
  }
  state.sessionStarted=true;
  setLifecycle(this,"live");
  app.session.compatibility="compatible";
  if (mode==="initiative") return this.startInitiative();
  if (app.sessionMode==="initiative") await this.endInitiative();
  else await publishConnectedTurnProjection(this,"legacy-session-start-freeform");
  app.session.compatibilityMessage="Host live Freeform play is active.";
  return app.getSnapshot();
};

MockAdapter.prototype.stopSession=async function stopProductionSession() {
  const app=connectedInternal(this);
  const state=connectedStateFor(this);
  const blocked=stopBlockedReason(this);
  if (blocked) {
    app.session.compatibility="warning";
    app.session.compatibilityMessage=blocked;
    return app.getSnapshot();
  }

  const wasHost=state.mode==="host";
  const endedSessionId=wasHost ? state.sessionId : null;
  const endReason=state.sessionStarted ? "Host ended live play." : "Host ended the connected session.";
  if (endedSessionId) {
    await broadcastConnectedWire({type:"session-ended",sessionId:endedSessionId,reason:endReason}).catch(()=>undefined);
  }

  try {
    await tauriSessionTransport.stop();
  } catch(error) {
    app.session.compatibility="warning";
    app.session.compatibilityMessage=`Session stop failed: ${error instanceof Error?error.message:String(error)}`;
    return app.getSnapshot();
  }

  unmountAllReconstructedCharacterSessionProjections(this);
  resetConnectedSessionTransientState(
    this,
    wasHost
      ? "Session ended. Start Host to open a fresh live session."
      : "Session left. Join or start Host to begin a new connected session.",
  );
  setLifecycle(this,"offline");
  return app.getSnapshot();
};

const previousHostSession=MockAdapter.prototype.hostSession;
MockAdapter.prototype.hostSession=async function hostProductionSessionWithLifecycle() {
  const app=connectedInternal(this);
  const state=connectedStateFor(this);
  if (state.mode!==null || app.session.role!=="offline") {
    const stopped=await this.stopSession();
    if (stopped.session.role!=="offline") return stopped;
  }

  try {
    const started=await previousHostSession.call(this);
    if (started.session.role!=="host" || started.connectionState!=="connected") {
      setLifecycle(this,"offline");
      return app.getSnapshot();
    }
    ensureHostPeerObserver(this);
    if (!app.session.name.trim()||app.session.name===REFERENCE_SESSION_NAME) {
      app.session.name=DEFAULT_PRODUCTION_SESSION_NAME;
    }
    refreshHostSessionMetadata(this);
    const liveState=connectedStateFor(this);
    liveState.sessionStarted=true;
    setLifecycle(this,"live");
    if (app.sessionMode==="initiative") await this.endInitiative();
    else await publishConnectedTurnProjection(this,"session-open-freeform");
    app.session.compatibility="compatible";
    app.session.compatibilityMessage=`Host live Freeform play opened at ${started.session.address}. Players may join now or later.`;
    return app.getSnapshot();
  } catch(error) {
    await tauriSessionTransport.stop().catch(()=>undefined);
    resetConnectedState(this,null);
    setLifecycle(this,"offline");
    app.connectionState="disconnected";
    app.session.role="offline";
    app.session.address="";
    app.session.participants=[];
    app.session.compatibility="incompatible";
    app.session.compatibilityMessage=`Host start failed: ${error instanceof Error?error.message:String(error)}`;
    return app.getSnapshot();
  }
};

const previousJoinSession=MockAdapter.prototype.joinSession;
MockAdapter.prototype.joinSession=async function joinProductionSessionWithLifecycle(address:string) {
  const app=connectedInternal(this);
  const state=connectedStateFor(this);
  if (!activeCharacterCanJoinProductionSession(this)) {
    setLifecycle(this,"offline");
    app.connectionState="disconnected";
    app.session.role="offline";
    app.session.compatibility="incompatible";
    app.session.compatibilityMessage="Select a saved production Character before joining. Reference Characters cannot enter production sessions.";
    return app.getSnapshot();
  }
  if (state.mode!==null || app.session.role!=="offline") {
    const stopped=await this.stopSession();
    if (stopped.session.role!=="offline") return stopped;
  }

  setLifecycle(this,"connecting");
  try {
    const joined=await previousJoinSession.call(this,address);
    if (joined.session.role!=="client") {
      setLifecycle(this,"offline");
      return app.getSnapshot();
    }
    return app.getSnapshot();
  } catch(error) {
    await tauriSessionTransport.stop().catch(()=>undefined);
    resetConnectedState(this,null);
    setLifecycle(this,"offline");
    app.connectionState="disconnected";
    app.session.role="offline";
    app.session.participants=[];
    app.session.compatibility="incompatible";
    app.session.compatibilityMessage=`Join failed: ${error instanceof Error?error.message:String(error)}`;
    return app.getSnapshot();
  }
};
