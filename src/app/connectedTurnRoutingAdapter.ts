import type { AppSnapshot } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { HostSessionLedger } from "./connectedSessionProtocol";
import { connectedStateFor } from "./connectedSessionState";
import { broadcastConnectedWire, connectedInternal } from "./connectedSessionRuntimeAdapter";
import { readyActionConfigurationFor, type ReadyActionConfiguration } from "./standardActionReadyState";

const previousStartInitiative=MockAdapter.prototype.startInitiative;
const previousEndInitiative=MockAdapter.prototype.endInitiative;
const previousEndTurn=MockAdapter.prototype.endTurn;
const previousSetCurrentActor=MockAdapter.prototype.setCurrentActor;

export type ConnectedReadyLifecycleReason="next-turn-start"|"initiative-ended";

export interface ConnectedReadyLifecycleClear {
  actorId:string;
  reason:ConnectedReadyLifecycleReason;
}

export function commitConnectedTurnProjectionEvents(
  ledger:HostSessionLedger,
  snapshot:AppSnapshot,
  label:string,
  readyClear?:ConnectedReadyLifecycleClear,
) {
  const readyEconomy=readyClear?snapshot.scene.economyByActor[readyClear.actorId]:undefined;
  if (readyClear&&!readyEconomy) {
    throw new Error(`Ready lifecycle clear requires projected economy for ${readyClear.actorId}`);
  }

  const events=[ledger.commitHostEvent({
    payload:{
      kind:"mode-transition",
      sessionMode:snapshot.sessionMode,
      round:snapshot.scene.round,
      currentActorId:snapshot.scene.currentActorId,
      economyByActor:structuredClone(snapshot.scene.economyByActor),
      stateChanges:[label,`round=${snapshot.scene.round}`,`currentActor=${snapshot.scene.currentActorId}`],
      provenance:["Phase 09 authoritative turn runtime projection"],
    },
  })];

  if (readyClear&&readyEconomy) {
    events.push(ledger.commitHostEvent({
      actorId:readyClear.actorId,
      payload:{
        kind:"ready-action",
        actorId:readyClear.actorId,
        transition:"cleared",
        economy:structuredClone(readyEconomy),
        stateChanges:["준비 행동 해제",`ready-lifecycle=${readyClear.reason}`],
        provenance:["Phase 09 authoritative Ready lifecycle expiration"],
      },
    }));
  }

  return events;
}

export async function publishConnectedTurnProjection(
  adapter:MockAdapter,
  label:string,
  readyClear?:ConnectedReadyLifecycleClear,
) {
  const state=connectedStateFor(adapter);
  const app=connectedInternal(adapter);
  if (state.mode!=="host"||!state.ledger) return app.getSnapshot();
  const snapshot=await app.getSnapshot();
  const events=commitConnectedTurnProjectionEvents(state.ledger,snapshot,label,readyClear);
  await broadcastConnectedWire({
    type:"event-batch",
    sessionId:state.ledger.sessionId,
    afterCursor:events[0].sequence-1,
    events,
  });
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

function readyLifecycleClear(
  before:ReadyActionConfiguration|undefined,
  after:ReadyActionConfiguration|undefined,
  reason:ConnectedReadyLifecycleReason,
):ConnectedReadyLifecycleClear|undefined {
  if (!before||after) return undefined;
  return {actorId:before.actorId,reason};
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
  const readyBefore=state.mode==="host"?readyActionConfigurationFor(this):undefined;
  const next=await previousEndInitiative.call(this);
  if (state.mode!=="host") return next;
  const readyClear=readyLifecycleClear(readyBefore,readyActionConfigurationFor(this),"initiative-ended");
  return publishConnectedTurnProjection(this,"initiative-end",readyClear);
};

MockAdapter.prototype.endTurn=async function endConnectedTurn() {
  const state=connectedStateFor(this);
  if (state.mode==="client") return connectedInternal(this).getSnapshot();
  if (blockedByRemotePending(this)) return connectedInternal(this).getSnapshot();
  const readyBefore=state.mode==="host"?readyActionConfigurationFor(this):undefined;
  const next=await previousEndTurn.call(this);
  if (state.mode!=="host") return next;
  const readyClear=readyLifecycleClear(readyBefore,readyActionConfigurationFor(this),"next-turn-start");
  return publishConnectedTurnProjection(this,"turn-end",readyClear);
};

MockAdapter.prototype.setCurrentActor=async function setConnectedCurrentActor(actorId:string) {
  const state=connectedStateFor(this);
  if (state.mode==="client") return connectedInternal(this).getSnapshot();
  if (blockedByRemotePending(this)) return connectedInternal(this).getSnapshot();
  const next=await previousSetCurrentActor.call(this,actorId);
  if (state.mode!=="host") return next;
  return publishConnectedTurnProjection(this,"current-actor-set");
};
