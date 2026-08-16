import { MockAdapter } from "./mockAdapter";
import { connectedStateFor } from "./connectedSessionState";
import { broadcastConnectedWire, connectedInternal } from "./connectedSessionRuntimeAdapter";

const previousStartInitiative=MockAdapter.prototype.startInitiative;
const previousEndInitiative=MockAdapter.prototype.endInitiative;
const previousEndTurn=MockAdapter.prototype.endTurn;
const previousSetCurrentActor=MockAdapter.prototype.setCurrentActor;

export async function publishConnectedTurnProjection(adapter:MockAdapter,label:string) {
  const state=connectedStateFor(adapter);
  const app=connectedInternal(adapter);
  if (state.mode!=="host"||!state.ledger) return app.getSnapshot();
  const snapshot=await app.getSnapshot();
  const event=state.ledger.commitHostEvent({
    payload:{
      kind:"mode-transition",
      sessionMode:snapshot.sessionMode,
      round:snapshot.scene.round,
      currentActorId:snapshot.scene.currentActorId,
      economyByActor:structuredClone(snapshot.scene.economyByActor),
      stateChanges:[label,`round=${snapshot.scene.round}`,`currentActor=${snapshot.scene.currentActorId}`],
      provenance:["Phase 09 authoritative turn runtime projection"],
    },
  });
  await broadcastConnectedWire({type:"event-batch",sessionId:state.ledger.sessionId,afterCursor:event.sequence-1,events:[event]});
  return snapshot;
}

function blockedByRemotePending(adapter:MockAdapter) {
  const state=connectedStateFor(adapter);
  if (state.mode!=="host"||!state.pendingRemoteAction) return false;
  const app=connectedInternal(adapter);
  app.session.compatibility="warning";
  app.session.compatibilityMessage="Resolve or dismiss the pending remote action before changing authoritative turn state.";
  return true;
}

MockAdapter.prototype.startInitiative=async function startConnectedInitiative() {
  const state=connectedStateFor(this);
  if (state.mode==="client") return connectedInternal(this).getSnapshot();
  if (blockedByRemotePending(this)) return connectedInternal(this).getSnapshot();
  const next=await previousStartInitiative.call(this);
  if (state.mode!=="host") return next;
  return publishConnectedTurnProjection(this,"initiative-start");
};

MockAdapter.prototype.endInitiative=async function endConnectedInitiative() {
  const state=connectedStateFor(this);
  if (state.mode==="client") return connectedInternal(this).getSnapshot();
  if (blockedByRemotePending(this)) return connectedInternal(this).getSnapshot();
  const next=await previousEndInitiative.call(this);
  if (state.mode!=="host") return next;
  return publishConnectedTurnProjection(this,"initiative-end");
};

MockAdapter.prototype.endTurn=async function endConnectedTurn() {
  const state=connectedStateFor(this);
  if (state.mode==="client") return connectedInternal(this).getSnapshot();
  if (blockedByRemotePending(this)) return connectedInternal(this).getSnapshot();
  const next=await previousEndTurn.call(this);
  if (state.mode!=="host") return next;
  return publishConnectedTurnProjection(this,"turn-end");
};

MockAdapter.prototype.setCurrentActor=async function setConnectedCurrentActor(actorId:string) {
  const state=connectedStateFor(this);
  if (state.mode==="client") return connectedInternal(this).getSnapshot();
  if (blockedByRemotePending(this)) return connectedInternal(this).getSnapshot();
  const next=await previousSetCurrentActor.call(this,actorId);
  if (state.mode!=="host") return next;
  return publishConnectedTurnProjection(this,"current-actor-set");
};
