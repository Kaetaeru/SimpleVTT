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

function startBlockedReason(adapter:MockAdapter) {
  const app=connectedInternal(adapter);
  const state=connectedStateFor(adapter);
  const ledger=state.ledger;
  if (state.mode!=="host"||!ledger||app.session.role!=="host") return "Only an active Host can start prepared play.";
  if (state.sessionStarted) return "The connected session is already live.";
  const players=app.session.participants.filter((participant)=>participant.id!=="host");
  if (players.length===0) return "At least one compatible player must join before play can start.";
  for (const participant of players) {
    if (participant.state!=="connected") return `${participant.name} is not connected.`;
    if (!participant.ready) return `${participant.name} is not Ready.`;
    const peer=[...state.peerParticipants.entries()].find(([,participantId])=>participantId===participant.id)?.[0];
    const manifest=peer ? state.peerManifests.get(peer) : undefined;
    if (!peer||!manifest||ledger.handshake(manifest).status==="incompatible") {
      return `${participant.name} does not have a compatible accepted handshake.`;
    }
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
      stateChanges:[`${participant.name} disconnected · Ready reset`],
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
    app.session.compatibilityMessage="Ready can only change from a compatible player lobby.";
    return app.getSnapshot();
  }
  if (app.connectionState!=="connected"||app.session.compatibility==="incompatible") {
    app.session.compatibility="warning";
    app.session.compatibilityMessage="Ready requires an active compatible Host connection.";
    return app.getSnapshot();
  }
  await broadcastConnectedWire({type:"ready-intent",sessionId:state.sessionId,ready});
  app.session.compatibilityMessage=ready ? "Ready sent to Host · waiting for authoritative confirmation." : "Ready cancellation sent to Host.";
  return app.getSnapshot();
};

MockAdapter.prototype.setPreparedSessionName=async function setProductionPreparedSessionName(name:string) {
  const app=connectedInternal(this);
  if (app.session.role!=="host"||lifecycleFor(this)!=="preparing") return app.getSnapshot();
  const normalized=name.trim();
  if (!normalized||normalized.length>80) return app.getSnapshot();
  app.session.name=normalized;
  return app.getSnapshot();
};

MockAdapter.prototype.startPreparedSession=async function startProductionPreparedSession(mode:SessionMode) {
  const app=connectedInternal(this);
  const state=connectedStateFor(this);
  const blocked=startBlockedReason(this);
  if (blocked) {
    app.session.compatibility="warning";
    app.session.compatibilityMessage=blocked;
    return app.getSnapshot();
  }
  state.sessionStarted=true;
  setLifecycle(this,"live");
  app.session.compatibility="compatible";
  app.session.compatibilityMessage=`Host starting ${mode} play.`;
  if (mode==="initiative") {
    return this.startInitiative();
  }
  await this.setSessionMode("freeform");
  return publishConnectedTurnProjection(this,"session-start-freeform");
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
  const endReason=state.sessionStarted ? "Host ended live play." : "Host closed the preparation lobby.";
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
      ? "Session ended. Start Host to open a fresh preparation lobby."
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
    setLifecycle(this,"preparing");
    if (!app.session.name.trim()||app.session.name===REFERENCE_SESSION_NAME) {
      app.session.name=DEFAULT_PRODUCTION_SESSION_NAME;
    }
    refreshHostSessionMetadata(this);
    app.session.compatibility="compatible";
    app.session.compatibilityMessage=`Host listening at ${started.session.address} · preparation lobby open.`;
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
