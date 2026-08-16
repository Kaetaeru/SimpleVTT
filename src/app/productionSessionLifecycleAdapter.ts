import type { AppSnapshot, CharacterSummary, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { broadcastConnectedWire, connectedInternal, publishConnectedSnapshot } from "./connectedSessionRuntimeAdapter";
import { connectedStateFor, resetConnectedState } from "./connectedSessionState";
import { publishConnectedTurnProjection } from "./connectedTurnRoutingAdapter";
import { projectedCharacterIds } from "./characterSessionProjectionRegistry";
import { unmountAllReconstructedCharacterSessionProjections } from "./characterSessionProjectionMount";
import { tauriSessionTransport, type SessionTransportStatus } from "./tauriSessionTransport";

export type ProductionSessionLifecycle = "offline" | "preparing" | "connecting" | "lobby" | "live";

declare module "./contracts" {
  interface SessionVm {
    lifecycle?: ProductionSessionLifecycle;
  }
}

declare module "./mockAdapter" {
  interface MockAdapter {
    stopSession():Promise<AppSnapshot>;
    setSessionReady(ready:boolean):Promise<AppSnapshot>;
    startPreparedSession(mode:SessionMode):Promise<AppSnapshot>;
  }
}

const REFERENCE_CHARACTER_IDS=new Set(["char.aelar","char.mira"]);
const lifecycleByAdapter=new WeakMap<MockAdapter,ProductionSessionLifecycle>();
const hostPeerCountByAdapter=new WeakMap<MockAdapter,number>();
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

async function resetReadyAfterHostPeerDrop(adapter:MockAdapter,status:SessionTransportStatus) {
  const state=connectedStateFor(adapter);
  if (state.mode!=="host") return;
  const previousPeerCount=hostPeerCountByAdapter.get(adapter) ?? 0;
  hostPeerCountByAdapter.set(adapter,status.peerCount);
  if (state.sessionStarted||!state.ledger||status.peerCount>=previousPeerCount) return;

  const app=connectedInternal(adapter);
  const readyPlayers=app.session.participants.filter((participant)=>participant.id!=="host"&&participant.ready);
  if (readyPlayers.length===0) return;

  const readyIds=new Set(readyPlayers.map((participant)=>participant.id));
  const events=readyPlayers.map((participant)=>state.ledger!.commitHostEvent({
    actorId:participant.id,
    payload:{
      kind:"participant" as const,
      participantId:participant.id,
      participantName:participant.name,
      characterName:participant.characterName,
      state:participant.state,
      ready:false,
      stateChanges:[`${participant.name} Ready reset after Host peer count dropped from ${previousPeerCount} to ${status.peerCount}`],
      provenance:["host-authoritative transport peer-count drop"],
    },
  }));
  app.session.participants=app.session.participants.map((participant)=>readyIds.has(participant.id)?{...participant,ready:false}:participant);
  app.session.compatibility="warning";
  app.session.compatibilityMessage=`Player connection count dropped from ${previousPeerCount} to ${status.peerCount}; Ready was reset and disconnected players must re-handshake before Host start.`;
  await broadcastConnectedWire({
    type:"event-batch",
    sessionId:state.ledger.sessionId,
    afterCursor:events[0].sequence-1,
    events,
  });
  await publishConnectedSnapshot(adapter);
}

function ensureHostPeerObserver(adapter:MockAdapter) {
  if (hostPeerObserverInstalled.has(adapter)||!tauriSessionTransport.available()) return;
  hostPeerObserverInstalled.add(adapter);
  void tauriSessionTransport.onState((status)=>{
    void resetReadyAfterHostPeerDrop(adapter,status).catch(()=>undefined);
  });
}

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
MockAdapter.prototype.getSnapshot=async function getSnapshotWithProductionSessionLifecycle() {
  const snapshot=await previousGetSnapshot.call(this);
  const lifecycle=lifecycleFor(this);
  snapshot.session.lifecycle=lifecycle;
  connectedInternal(this).session.lifecycle=lifecycle;
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
  const blocked=stopBlockedReason(this);
  if (blocked) {
    app.session.compatibility="warning";
    app.session.compatibilityMessage=blocked;
    return app.getSnapshot();
  }

  hostPeerCountByAdapter.set(this,0);
  try {
    await tauriSessionTransport.stop();
  } catch(error) {
    app.session.compatibility="warning";
    app.session.compatibilityMessage=`Session stop failed: ${error instanceof Error?error.message:String(error)}`;
    return app.getSnapshot();
  }

  unmountAllReconstructedCharacterSessionProjections(this);
  resetConnectedState(this,null);
  setLifecycle(this,"offline");
  app.connectionState="disconnected";
  app.session.role="offline";
  app.session.address="";
  app.session.participants=[];
  app.session.compatibility="warning";
  app.session.compatibilityMessage="Session stopped. Start Host to open a fresh preparation lobby.";
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
    hostPeerCountByAdapter.set(this,0);
    ensureHostPeerObserver(this);
    setLifecycle(this,"preparing");
    app.session.compatibility="compatible";
    app.session.compatibilityMessage=`Host listening at ${started.session.address} · preparation lobby open.`;
    return app.getSnapshot();
  } catch(error) {
    hostPeerCountByAdapter.set(this,0);
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
