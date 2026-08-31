import type { AppSnapshot } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { HostSessionLedger } from "./connectedSessionProtocol";
import { connectedStateFor } from "./connectedSessionState";
import { broadcastConnectedWire, connectedInternal, publishConnectedTurnSimultaneousOrderingPrompt, sendConnectedWireTo } from "./connectedSessionRuntimeAdapter";
import { consumeAdapterTurnLifecycleEvents, peekAdapterTurnLifecycleUndo, peekAdapterTurnSimultaneousOrdering, respondToAdapterTurnSimultaneousOrdering } from "./phase09EffectAwareTurnAdapter";
import { registerConnectedTurnSimultaneousOrderingResponseHandler } from "./connectedTurnSimultaneousOrderingResponsePort";
import { inverseResolutionEvents } from "./resolutionEventUndo";
import { readyActionConfigurationsFor, type ReadyActionConfiguration } from "./standardActionReadyState";
import type { ResolutionEvent } from "../domain/resolutionTypes";

const previousStartInitiative=MockAdapter.prototype.startInitiative;
const previousEndInitiative=MockAdapter.prototype.endInitiative;
const previousEndTurn=MockAdapter.prototype.endTurn;
const previousUndoLastResolution=MockAdapter.prototype.undoLastResolution;
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
  readyClears:ConnectedReadyLifecycleClear[] = [],
  resolutionEvents:ResolutionEvent[] = [],
) {
  const orderedReadyClears=[...readyClears].sort((left,right)=>left.actorId.localeCompare(right.actorId));
  for (const readyClear of orderedReadyClears) {
    if (!snapshot.scene.economyByActor[readyClear.actorId]) {
      throw new Error(`Ready lifecycle clear requires projected economy for ${readyClear.actorId}`);
    }
  }

  const events=[ledger.commitHostEvent({
    payload:{
      kind:"mode-transition",
      sessionMode:snapshot.sessionMode,
      round:snapshot.scene.round,
      currentActorId:snapshot.scene.currentActorId,
      economyByActor:structuredClone(snapshot.scene.economyByActor),
      resolutionEvents:resolutionEvents.map((event)=>structuredClone(event)),
      stateChanges:[label,`round=${snapshot.scene.round}`,`currentActor=${snapshot.scene.currentActorId}`],
      provenance:["Phase 09 authoritative turn runtime projection"],
    },
  })];

  for (const readyClear of orderedReadyClears) {
    const readyEconomy=snapshot.scene.economyByActor[readyClear.actorId]!;
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
  readyClears:ConnectedReadyLifecycleClear[] = [],
  resolutionEvents:ResolutionEvent[] = [],
) {
  const state=connectedStateFor(adapter);
  const app=connectedInternal(adapter);
  if (state.mode!=="host"||!state.ledger) return app.getSnapshot();
  const snapshot=await app.getSnapshot();
  const events=commitConnectedTurnProjectionEvents(state.ledger,snapshot,label,readyClears,resolutionEvents);
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

function readyLifecycleClears(
  before:ReadyActionConfiguration[],
  after:ReadyActionConfiguration[],
  reason:ConnectedReadyLifecycleReason,
):ConnectedReadyLifecycleClear[] {
  const remainingActors=new Set(after.map((configuration)=>configuration.actorId));
  return before
    .filter((configuration)=>!remainingActors.has(configuration.actorId))
    .map((configuration)=>({actorId:configuration.actorId,reason}));
}

export async function sendConnectedTurnSimultaneousOrderingResponse(adapter:MockAdapter,orderedCandidateIds:string[]) {
  const state=connectedStateFor(adapter);
  const app=connectedInternal(adapter);
  const ordering=peekAdapterTurnSimultaneousOrdering(adapter);
  if(state.mode!=="client"||!state.sessionId) return {status:"rejected" as const,error:"only a connected Client can send simultaneous ordering"};
  if(!ordering||ordering.status!=="pending") return {status:"rejected" as const,error:"no simultaneous ordering decision is pending"};
  if(ordering.request.authority.kind!=="actor-controller"||ordering.request.authority.responderId!==app.activeCharacter.id) return {status:"rejected" as const,error:"simultaneous ordering decision does not belong to this Client Character"};
  const response={decisionId:ordering.request.id,revision:ordering.request.revision,responderId:app.activeCharacter.id,orderedCandidateIds:[...orderedCandidateIds]};
  await broadcastConnectedWire({type:"turn-simultaneous-ordering-response",sessionId:state.sessionId,response});
  const local=respondToAdapterTurnSimultaneousOrdering(adapter,response);
  if(!local||local.status==="rejected") return {status:"rejected" as const,error:local?.status==="rejected"?local.reason:"simultaneous ordering state disappeared"};
  return {status:"sent" as const,decisionId:response.decisionId};
}

registerConnectedTurnSimultaneousOrderingResponseHandler(async(adapter,transportMessage,envelope)=>{
  const state=connectedStateFor(adapter);
  const ledger=state.ledger;
  if(state.mode!=="host"||!ledger)return;
  const reject=async(code:string,message:string)=>sendConnectedWireTo(transportMessage.peer,{type:"error",code,message,hostCursor:ledger.cursor});
  if(envelope.sessionId!==ledger.sessionId){await reject("session-mismatch",`expected ${ledger.sessionId}, received ${envelope.sessionId}`);return;}
  const ordering=peekAdapterTurnSimultaneousOrdering(adapter);
  if(!ordering||ordering.status!=="pending"||ordering.request.id!==envelope.response.decisionId){await reject("simultaneous-ordering-not-pending","no matching authoritative simultaneous-ordering decision is pending");return;}
  const characterId=state.peerManifests.get(transportMessage.peer)?.character?.characterId;
  if(ordering.request.authority.kind!=="actor-controller"||!characterId||characterId!==ordering.request.authority.responderId||envelope.response.responderId!==characterId){
    await reject("simultaneous-ordering-not-authorized","simultaneous-ordering response does not belong to this peer Character");
    return;
  }
  const resolved=respondToAdapterTurnSimultaneousOrdering(adapter,envelope.response);
  if(!resolved||resolved.status==="rejected"){
    await reject("simultaneous-ordering-response-rejected",resolved?.status==="rejected"?resolved.reason:"simultaneous ordering state disappeared");
    await publishConnectedTurnSimultaneousOrderingPrompt(adapter);
    return;
  }
  await adapter.endTurn();
});

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
  const readyBefore=state.mode==="host"?readyActionConfigurationsFor(this):[];
  const next=await previousEndInitiative.call(this);
  if (state.mode!=="host") return next;
  const readyClears=readyLifecycleClears(readyBefore,readyActionConfigurationsFor(this),"initiative-ended");
  return publishConnectedTurnProjection(this,"initiative-end",readyClears);
};

MockAdapter.prototype.endTurn=async function endConnectedTurn() {
  const state=connectedStateFor(this);
  if (state.mode==="client") return connectedInternal(this).getSnapshot();
  if (blockedByRemotePending(this)) return connectedInternal(this).getSnapshot();
  const readyBefore=state.mode==="host"?readyActionConfigurationsFor(this):[];
  const next=await previousEndTurn.call(this);
  const resolutionEvents=consumeAdapterTurnLifecycleEvents(this);
  if (state.mode!=="host") return next;
  const ordering=peekAdapterTurnSimultaneousOrdering(this);
  if(ordering?.status==="pending") {
    await publishConnectedTurnSimultaneousOrderingPrompt(this);
    return next;
  }
  const readyClears=readyLifecycleClears(readyBefore,readyActionConfigurationsFor(this),"next-turn-start");
  return publishConnectedTurnProjection(this,"turn-end",readyClears,resolutionEvents);
};

MockAdapter.prototype.undoLastResolution=async function undoConnectedTurnLifecycle() {
  const state=connectedStateFor(this);
  if (state.mode==="client") return connectedInternal(this).getSnapshot();
  const lifecycleUndo=peekAdapterTurnLifecycleUndo(this);
  const next=await previousUndoLastResolution.call(this);
  if (!lifecycleUndo||state.mode!=="host"||!state.ledger) return next;
  const committedUndo=next.activity.find((entry)=>entry.undoOf===lifecycleUndo.resolutionId);
  if (!committedUndo) return next;

  const undoId=`undo.${lifecycleUndo.resolutionId}.${state.ledger.cursor+1}`;
  const inverse=inverseResolutionEvents(lifecycleUndo.events,undoId);
  const event=state.ledger.commitHostEvent({
    actorId:"dm",
    payload:{
      kind:"resolution-undo",
      undoId,
      undoOf:lifecycleUndo.resolutionId,
      inverseResolutionEvents:inverse,
      stateChanges:[...committedUndo.stateChanges],
      provenance:["Host-authoritative turn lifecycle Undo","original turn event history retained"],
    },
  });
  await broadcastConnectedWire({
    type:"event-batch",
    sessionId:state.ledger.sessionId,
    afterCursor:event.sequence-1,
    events:[event],
  });
  return next;
};

MockAdapter.prototype.setCurrentActor=async function setConnectedCurrentActor(actorId:string) {
  const state=connectedStateFor(this);
  if (state.mode==="client") return connectedInternal(this).getSnapshot();
  if (blockedByRemotePending(this)) return connectedInternal(this).getSnapshot();
  const next=await previousSetCurrentActor.call(this,actorId);
  if (state.mode!=="host") return next;
  return publishConnectedTurnProjection(this,"current-actor-set");
};