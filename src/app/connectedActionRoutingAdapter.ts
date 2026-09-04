import type { AppSnapshot } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { registerConnectedActionRequestHandler } from "./connectedActionRequestPort";
import { registerConnectedInterruptResponseHandler } from "./connectedInterruptResponsePort";
import { registerConnectedConcentrationResponseHandler } from "./connectedConcentrationResponsePort";
import { connectedStateFor } from "./connectedSessionState";
import {
  CONNECTED_CAPABILITIES,
  advanceConnectedResolutionPresentation,
  broadcastConnectedWire,
  connectedInternal,
  connectedManifest,
  publishConnectedSnapshot,
  sendConnectedWireTo,
} from "./connectedSessionRuntimeAdapter";
import { clearCommittedResolutionEvents, takeCommittedResolutionEvents } from "./resolutionEventCommitRegistry";
import {
  buildConnectedResolutionPresentation,
  normalizedHiddenFacts,
  redactConnectedResolutionPresentation,
  rollFactsOf,
  type ConnectedResolutionHiddenFact,
  type ConnectedResolutionPresentationV1,
  type ConnectedResolutionRollFactsV1,
  type ConnectedResolutionVisibilityV1,
} from "./connectedResolutionPresentation";
import type { ConnectedEventPayload } from "./connectedSessionProtocol";
import type { ConnectedRuntimeState } from "./connectedSessionState";
import { tauriSessionTransport } from "./tauriSessionTransport";
import {
  activateProjectedCharacterResolutionContext,
  restoreProjectionResolutionContext,
  type ProjectionResolutionContext,
} from "./characterSessionProjectionMount";
import { projectedCharacterById, projectedCharacterForPeer } from "./characterSessionProjectionRegistry";
import { clearReadyActionConfiguration, isReadyPreparationAction, isReadyTriggerAction, readyActionConfigurationFor, setReadyActionConfiguration } from "./standardActionReadyState";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import type { ManualMovementReactionCommand } from "./manualMovementReactionContracts";

const previousResolveAction=MockAdapter.prototype.resolveAction;
const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;
const previousDismissResolution=MockAdapter.prototype.dismissResolution;
const previousUndoLastResolution=MockAdapter.prototype.undoLastResolution;
const previousSubmitConcentrationSaveD20=MockAdapter.prototype.submitConcentrationSaveD20;
const previousDeclareManualMovementReaction=MockAdapter.prototype.declareManualMovementReaction;
const projectionContexts=new WeakMap<MockAdapter,ProjectionResolutionContext>();

function requestId() {
  return `request.${Date.now().toString(36)}.${Math.floor(Math.random()*1_000_000).toString(36)}`;
}

function actionFor(adapter:MockAdapter,actorId:string,actionId:string) {
  return connectedInternal(adapter).scene.actionsByActor[actorId]?.find((action)=>action.id===actionId);
}

function restoreProjectedContext(adapter:MockAdapter) {
  const context=projectionContexts.get(adapter);
  if (!context) return false;
  restoreProjectionResolutionContext(adapter,context);
  projectionContexts.delete(adapter);
  return true;
}

function recordHiddenResolution(state:ConnectedRuntimeState,presentation:ConnectedResolutionPresentationV1,visibility:ConnectedResolutionVisibilityV1) {
  const existing=state.hiddenResolutions.get(presentation.resolutionId);
  state.hiddenResolutions.set(presentation.resolutionId,{
    resolutionId:presentation.resolutionId,
    actorId:presentation.resolution.actorId,
    actionName:presentation.resolution.actionName,
    hidden:normalizedHiddenFacts(visibility.hidden),
    disclosed:existing?.disclosed??[],
    presentation:structuredClone(presentation),
  });
}

/** Builds the peer-facing envelope for one Resolution and keeps the full envelope Host-private when any fact is hidden. */
function outboundPresentation(state:ConnectedRuntimeState,presentation:ConnectedResolutionPresentationV1) {
  const visibility=state.resolutionVisibilityById.get(presentation.resolutionId);
  const hidden=normalizedHiddenFacts(visibility?.hidden);
  if (visibility&&hidden.length) recordHiddenResolution(state,presentation,visibility);
  return {hidden,presentation:redactConnectedResolutionPresentation(presentation,visibility)};
}

function redactOutboundResolutionEvents(events:ResolutionEvent[],hidden:ConnectedResolutionHiddenFact[],targetIds:string[]) {
  const hiddenTargets=new Set(hidden.includes("targets")?targetIds:[]);
  return events.map((event)=>{
    const copy=structuredClone(event);
    if (hidden.includes("roll")) { copy.summary="비공개 판정"; copy.provenance=[]; copy.result={hidden:true}; }
    if (copy.targetId!==undefined&&hiddenTargets.has(copy.targetId)) delete copy.targetId;
    return copy;
  });
}

async function publishCommittedResolution(adapter:MockAdapter,snapshot?:AppSnapshot,readyClearedActorId?:string) {
  const state=connectedStateFor(adapter);
  if (state.mode!=="host"||!state.ledger) return snapshot ?? connectedInternal(adapter).getSnapshot();
  const current=snapshot ?? await connectedInternal(adapter).getSnapshot();
  const resolution=current.resolution;
  if (!resolution||resolution.stage!=="complete"||state.publishedResolutionIds.has(resolution.id)) return current;

  const pending=state.pendingRemoteAction;
  const isRemotePending=pending?.resolutionId===resolution.id;
  const events=takeCommittedResolutionEvents(resolution.id);
  const presentation=buildConnectedResolutionPresentation(current,state.nextPresentationSequence,"catchup",state.presentationTimelineByResolution.get(resolution.id));
  if (!presentation) return current;
  state.presentationTimelineByResolution.set(resolution.id,presentation.timeline.map((entry)=>({...entry})));
  const peerFacing=outboundPresentation(state,presentation);
  const rollHidden=peerFacing.hidden.includes("roll");
  const readyConfig=readyActionConfigurationFor(adapter,resolution.actorId);
  const readyArmed=isReadyPreparationAction(actionFor(adapter,resolution.actorId,resolution.actionId))&&readyConfig;
  const readyCleared=readyClearedActorId===resolution.actorId||pending?.readyActionRole==="trigger";
  if (!events?.length&&(readyArmed||readyCleared)) {
    const actorId=resolution.actorId;
    const economy=current.scene.economyByActor[actorId];
    if (!economy) return current;
    const candidate={actorId,payload:{kind:"ready-action" as const,actorId,transition:(readyArmed?"armed":"cleared") as "armed"|"cleared",configuration:readyArmed?readyConfig:undefined,economy:{...economy},stateChanges:[...resolution.stateChanges],provenance:["host-authoritative ready-action lifecycle"]}};
    const committed=isRemotePending&&pending
      ? state.ledger.commitReservedActionRequest(pending.request.requestId,candidate)
      : {status:"committed" as const,event:state.ledger.commitHostEvent(candidate)};
    if (committed.status==="rejected") return current;
    state.publishedResolutionIds.add(resolution.id);
    if (isRemotePending) state.pendingRemoteAction=null;
    await broadcastConnectedWire({type:"event-batch",sessionId:state.ledger.sessionId,afterCursor:committed.event.sequence-1,events:[committed.event]});
    if (isRemotePending&&restoreProjectedContext(adapter)) return connectedInternal(adapter).getSnapshot();
    return current;
  }
  if (!events?.length) {
    if (isRemotePending&&pending) {
      state.ledger.cancelReservedActionRequest(pending.request.requestId);
      await sendConnectedWireTo(pending.peer,{
        type:"error",
        code:"remote-action-not-event-native",
        message:`${resolution.actionId} completed without canonical ResolutionEvent output; it was not broadcast as committed network state`,
        hostCursor:state.ledger.cursor,
      });
      state.pendingRemoteAction=null;
      restoreProjectedContext(adapter);
      return connectedInternal(adapter).getSnapshot();
    }
    return current;
  }

  const candidate={
    actorId:resolution.actorId,
    payload:{
      kind:"resolution" as const,
      resolutionId:resolution.id,
      presentation:peerFacing.presentation,
      resolutionEvents:peerFacing.hidden.length?redactOutboundResolutionEvents(events,peerFacing.hidden,resolution.targetIds):events,
      stateChanges:rollHidden?[]:[...resolution.stateChanges],
      provenance:rollHidden?["host-private resolution"]:[...resolution.provenance],
    },
  };

  const committed=isRemotePending&&pending
    ? state.ledger.commitReservedActionRequest(pending.request.requestId,candidate)
    : { status:"committed" as const,event:state.ledger.commitHostEvent(candidate) };

  if (committed.status==="rejected") {
    if (isRemotePending&&pending) {
      await sendConnectedWireTo(pending.peer,{type:"error",code:"host-commit-rejected",message:committed.error,hostCursor:committed.hostCursor});
      state.pendingRemoteAction=null;
      restoreProjectedContext(adapter);
      return connectedInternal(adapter).getSnapshot();
    }
    return current;
  }

  const event=committed.event;
  const outbound=[event];
  if (readyCleared) {
    const economy=current.scene.economyByActor[resolution.actorId];
    if (economy) outbound.push(state.ledger.commitHostEvent({actorId:resolution.actorId,payload:{kind:"ready-action",actorId:resolution.actorId,transition:"cleared",economy:{...economy},stateChanges:[`${resolution.actorId} 준비 행동 해제`],provenance:["host-authoritative ready-action trigger"]}}));
  }
  state.publishedResolutionIds.add(resolution.id);
  state.publishedResolutionEvents.set(resolution.id,events.map((entry)=>structuredClone(entry)));
  state.nextPresentationSequence=Math.max(state.nextPresentationSequence,presentation.presentationSequence+1);
  if (isRemotePending) state.pendingRemoteAction=null;
  await broadcastConnectedWire({
    type:"event-batch",
    sessionId:state.ledger.sessionId,
    afterCursor:event.sequence-1,
    events:outbound,
  });
  if (isRemotePending&&restoreProjectedContext(adapter)) return connectedInternal(adapter).getSnapshot();
  return current;
}

function inverseResolutionEvents(events:ResolutionEvent[],undoId:string):ResolutionEvent[] {
  return [...events].reverse().map((event,eventIndex)=>({
    ...structuredClone(event),id:`${undoId}:event:${eventIndex+1}`,resolutionId:undoId,operationId:`undo:${event.operationId}`,summary:`Undo · ${event.summary}`,
    provenance:[...event.provenance,{source:`undo:${event.resolutionId}`,status:"applied",reason:"Host-authoritative compensating event"}],
    stateChanges:[...event.stateChanges].reverse().map((change)=>{
      if(change.kind==="inventory-item")return {...structuredClone(change),operation:change.operation==="added"?"removed":change.operation==="removed"?"added":"updated",before:structuredClone(change.after),after:structuredClone(change.before)};
      if(change.kind==="effect")return {...structuredClone(change),operation:change.operation==="added"?"removed":change.operation==="removed"?"added":"updated",before:structuredClone(change.after),after:structuredClone(change.before)};
      if(change.kind==="artifact")return {...structuredClone(change),operation:change.operation==="added"?"removed":change.operation==="removed"?"added":"updated",before:structuredClone(change.after),after:structuredClone(change.before)};
      if(change.kind==="combatant")return {...structuredClone(change),operation:change.operation==="added"?"removed":change.operation==="removed"?"added":"updated",before:structuredClone(change.after),after:structuredClone(change.before)};
      if(change.kind==="zone-membership")return {...structuredClone(change),operation:change.operation==="added"?"removed":change.operation==="removed"?"added":"updated",before:structuredClone(change.after),after:structuredClone(change.before)};
      if(change.kind==="concentration")return {...structuredClone(change),before:structuredClone(change.after),after:structuredClone(change.before)};
      if(change.kind==="spellcasting-turn")return {...structuredClone(change),before:structuredClone(change.after),after:structuredClone(change.before)};
      if(change.kind==="hp")return {...structuredClone(change),before:change.after,after:change.before};
      if(change.kind==="economy"&&change.field==="extraActions")return {...structuredClone(change),before:structuredClone(change.after),after:structuredClone(change.before)};
      if(change.kind==="economy"&&change.field==="extraAttacks")return {...structuredClone(change),before:structuredClone(change.after),after:structuredClone(change.before)};
      if(change.kind==="economy")return {...structuredClone(change),before:change.after,after:change.before};
      if(change.kind==="resource")return {...structuredClone(change),before:change.after,after:change.before,recoveryLockouts:change.recoveryLockouts?{before:structuredClone(change.recoveryLockouts.after),after:structuredClone(change.recoveryLockouts.before)}:undefined};
      if(change.kind==="death-save")return {...structuredClone(change),before:change.after,after:change.before};
      if(change.kind==="turn-clock")return {...structuredClone(change),before:structuredClone(change.after),after:structuredClone(change.before)};
      if(change.kind==="life")return {...structuredClone(change),before:change.after,after:change.before};
      return change;
    }),result:{undoOf:event.id},
  }));
}

async function publishConnectedResolutionPresentation(adapter:MockAdapter,snapshot:AppSnapshot) {
  const state=connectedStateFor(adapter);
  const resolution=snapshot.resolution;
  if (state.mode!=="host"||!state.ledger||!resolution) return snapshot;
  if (resolution.stage==="complete"&&state.presentationTimelineByResolution.has(resolution.id)) return snapshot;
  const key=`${resolution.id}:${resolution.stage}:${resolution.authoritativeDice.join(",")}:${resolution.finalOutcome}`;
  if (state.lastPublishedPresentationKey===key) return snapshot;
  const presentation=buildConnectedResolutionPresentation(snapshot,state.nextPresentationSequence,"live",state.presentationTimelineByResolution.get(resolution.id));
  if (!presentation) return snapshot;
  state.presentationTimelineByResolution.set(resolution.id,presentation.timeline.map((entry)=>({...entry})));
  state.lastPublishedPresentationKey=key;
  state.nextPresentationSequence+=1;
  await broadcastConnectedWire({type:"resolution-presentation",sessionId:state.ledger.sessionId,presentation:outboundPresentation(state,presentation).presentation});
  const interrupt=snapshot.resolution?.interrupt;
  if(snapshot.resolution?.stage!=="interrupt"&&state.interruptTimeout){clearTimeout(state.interruptTimeout);state.interruptTimeout=null;state.interruptTimeoutResolutionId=null;}
  if(snapshot.resolution?.stage==="interrupt"&&interrupt){
    const ownerPeer=[...state.peerManifests.entries()].find(([,manifest])=>manifest.character?.characterId===interrupt.responderId)?.[0];
    if(ownerPeer) await sendConnectedWireTo(ownerPeer,{
      type:"resolution-interrupt-prompt",
      sessionId:state.ledger.sessionId,
      resolutionId:resolution.id,
      presentationSequence:presentation.presentationSequence,
      interrupt:structuredClone(interrupt),
    });
    if(ownerPeer&&state.interruptTimeoutResolutionId!==resolution.id){
      if(state.interruptTimeout)clearTimeout(state.interruptTimeout);
      state.interruptTimeoutResolutionId=resolution.id;
      state.interruptTimeout=setTimeout(()=>{state.interruptTimeout=null;state.interruptTimeoutResolutionId=null;void expireConnectedInterrupt(adapter,resolution.id);},30_000);
    }
  }
  const concentration=snapshot.resolution?.concentrationSave;
  if(snapshot.resolution?.stage==="save-animation"&&concentration&&concentration.natural===undefined){
    const ownerPeer=[...state.peerManifests.entries()].find(([,manifest])=>manifest.character?.characterId===concentration.targetId)?.[0];
    if(ownerPeer)await sendConnectedWireTo(ownerPeer,{type:"resolution-concentration-prompt",sessionId:state.ledger.sessionId,resolutionId:resolution.id,presentationSequence:presentation.presentationSequence,save:structuredClone(concentration)});
  }
  return snapshot;
}

export async function expireConnectedInterrupt(adapter:MockAdapter,resolutionId:string){
  const state=connectedStateFor(adapter);const app=connectedInternal(adapter);
  if(state.mode!=="host"||app.resolution?.id!==resolutionId||app.resolution.stage!=="interrupt"||!app.resolution.interrupt)return {status:"ignored" as const};
  await adapter.respondToInterrupt(false);
  return {status:"declined" as const};
}

registerConnectedInterruptResponseHandler(async(adapter,transportMessage,response)=>{
  const state=connectedStateFor(adapter);
  const app=connectedInternal(adapter);
  const ledger=state.ledger;
  if(state.mode!=="host"||!ledger)return;
  const reject=async(code:string,message:string)=>sendConnectedWireTo(transportMessage.peer,{type:"error",code,message,hostCursor:ledger.cursor});
  if(response.sessionId!==ledger.sessionId){await reject("session-mismatch",`expected ${ledger.sessionId}, received ${response.sessionId}`);return;}
  const characterId=state.peerManifests.get(transportMessage.peer)?.character?.characterId;
  const interrupt=app.resolution?.interrupt;
  if(!characterId||!interrupt||app.resolution?.id!==response.resolutionId){await reject("interrupt-not-pending","no matching authoritative interrupt is pending");return;}
  if(interrupt.responderId!==characterId||interrupt.id!==response.promptId){await reject("interrupt-not-authorized","interrupt response does not belong to this peer Character");return;}
  if(state.interruptTimeout)clearTimeout(state.interruptTimeout);state.interruptTimeout=null;state.interruptTimeoutResolutionId=null;
  await adapter.respondToInterrupt(response.accept,response.selectedIds);
});

registerConnectedConcentrationResponseHandler(async(adapter,transportMessage,response)=>{
  const state=connectedStateFor(adapter);const app=connectedInternal(adapter);const ledger=state.ledger;
  if(state.mode!=="host"||!ledger)return;
  const characterId=state.peerManifests.get(transportMessage.peer)?.character?.characterId;
  const save=app.resolution?.concentrationSave;
  if(response.sessionId!==ledger.sessionId||app.resolution?.id!==response.resolutionId||!save||save.natural!==undefined||save.targetId!==characterId){
    await sendConnectedWireTo(transportMessage.peer,{type:"error",code:"concentration-not-authorized",message:"no matching owner concentration save is pending",hostCursor:ledger.cursor});return;
  }
  await adapter.submitConcentrationSaveD20(response.face);
});

registerConnectedActionRequestHandler(async (adapter,transportMessage,request) => {
  const state=connectedStateFor(adapter);
  const ledger=state.ledger;
  if (state.mode!=="host"||!ledger) return;

  if (state.pendingRemoteAction) {
    await sendConnectedWireTo(transportMessage.peer,{type:"error",code:"host-busy",message:"host already has an uncommitted remote PendingResolution",hostCursor:ledger.cursor});
    return;
  }
  const peerManifest=state.peerManifests.get(transportMessage.peer);
  if (!peerManifest?.character) {
    await sendConnectedWireTo(transportMessage.peer,{type:"error",code:"handshake-required",message:"ActionRequest requires a compatible Character hello handshake",hostCursor:ledger.cursor});
    return;
  }
  if (!request.character||request.character.characterId!==request.actorId||peerManifest.character.characterId!==request.actorId) {
    await sendConnectedWireTo(transportMessage.peer,{type:"error",code:"actor-projection-mismatch",message:"ActionRequest actor must match the peer Character projection from hello",hostCursor:ledger.cursor});
    return;
  }
  if (request.character.sourceRevision!==peerManifest.character.sourceRevision) {
    await sendConnectedWireTo(transportMessage.peer,{type:"error",code:"source-revision-changed",message:"Character source revision changed after handshake; reconnect/revalidate before acting",hostCursor:ledger.cursor});
    return;
  }
  if (CONNECTED_CAPABILITIES.some((capability)=>!request.capabilities.includes(capability))) {
    await sendConnectedWireTo(transportMessage.peer,{type:"error",code:"capability-mismatch",message:"ActionRequest is missing a required connected-session capability",hostCursor:ledger.cursor});
    return;
  }

  const mounted=projectedCharacterForPeer(adapter,transportMessage.peer);
  if (mounted&&mounted.characterId!==request.actorId) {
    await sendConnectedWireTo(transportMessage.peer,{type:"error",code:"actor-projection-mismatch",message:"ActionRequest actor does not match the mounted host SessionProjection",hostCursor:ledger.cursor});
    return;
  }

  const reserved=ledger.reserveActionRequest(request);
  if (reserved.status==="duplicate") {
    await sendConnectedWireTo(transportMessage.peer,{type:"event-batch",sessionId:ledger.sessionId,afterCursor:reserved.event.sequence-1,events:[reserved.event]});
    return;
  }
  if (reserved.status==="rejected") {
    await sendConnectedWireTo(transportMessage.peer,{type:"error",code:"request-rejected",message:reserved.error,hostCursor:reserved.hostCursor});
    return;
  }

  if (mounted) {
    const activated=activateProjectedCharacterResolutionContext(adapter,transportMessage.peer);
    if (activated.status==="rejected") {
      ledger.cancelReservedActionRequest(request.requestId);
      await sendConnectedWireTo(transportMessage.peer,{type:"error",code:"projection-activation-failed",message:activated.error,hostCursor:ledger.cursor});
      return;
    }
    projectionContexts.set(adapter,activated.context);
  }

  if (!request.manualMovementReaction) {
    const snapshot=await connectedInternal(adapter).getSnapshot();
    const requestedAction=snapshot.scene.actionsByActor[request.actorId]?.find((action)=>action.id===request.actionId);
    if (!requestedAction) {
      ledger.cancelReservedActionRequest(request.requestId);
      restoreProjectedContext(adapter);
      await sendConnectedWireTo(transportMessage.peer,{type:"error",code:"action-unsupported",message:`Action ${request.actionId} is not available for ${request.actorId}`,hostCursor:ledger.cursor});
      return;
    }
    if (!requestedAction.available) {
      ledger.cancelReservedActionRequest(request.requestId);
      restoreProjectedContext(adapter);
      await sendConnectedWireTo(transportMessage.peer,{type:"error",code:"action-disabled",message:requestedAction.disabledReason??"Action is currently disabled",hostCursor:ledger.cursor});
      return;
    }
  }

  if (request.readyConfiguration) {
    if (!isReadyPreparationAction(actionFor(adapter,request.actorId,request.actionId))||request.readyConfiguration.actorId!==request.actorId) {
      ledger.cancelReservedActionRequest(request.requestId);
      restoreProjectedContext(adapter);
      await sendConnectedWireTo(transportMessage.peer,{type:"error",code:"ready-config-rejected",message:"Ready configuration must match the requested Ready actor",hostCursor:ledger.cursor});
      return;
    }
    setReadyActionConfiguration(adapter,request.readyConfiguration);
  }

  if (request.manualMovementReaction&&(request.manualMovementReaction.provokerId!==request.actorId||request.manualMovementReaction.attackActionId!==request.actionId)) {
    ledger.cancelReservedActionRequest(request.requestId);
    restoreProjectedContext(adapter);
    await sendConnectedWireTo(transportMessage.peer,{type:"error",code:"manual-reaction-not-authorized",message:"manual movement reaction must be declared by the current peer Character",hostCursor:ledger.cursor});
    return;
  }

  try {
    const next=request.manualMovementReaction
      ?await previousDeclareManualMovementReaction.call(adapter,request.manualMovementReaction)
      :await previousResolveAction.call(adapter,request.actionId,request.targetIds);
    const resolution=next.resolution;
    const expectedActorId=request.manualMovementReaction?.reactorId??request.actorId;
    const expectedActionId=request.manualMovementReaction?.attackActionId??(isReadyTriggerAction(actionFor(adapter,request.actorId,request.actionId))
      ? readyActionConfigurationFor(adapter,request.actorId)?.actionId
      : request.actionId);
    if (!resolution||resolution.actorId!==expectedActorId||resolution.actionId!==expectedActionId) {
      ledger.cancelReservedActionRequest(request.requestId);
      if (request.readyConfiguration) clearReadyActionConfiguration(adapter,request.actorId);
      restoreProjectedContext(adapter);
      await sendConnectedWireTo(transportMessage.peer,{type:"error",code:"action-rejected",message:"host production resolution path rejected the requested actor/action/targets",hostCursor:ledger.cursor});
      return;
    }
    state.pendingRemoteAction={peer:transportMessage.peer,request:structuredClone(request),resolutionId:resolution.id,readyActionRole:actionFor(adapter,request.actorId,request.actionId)?.readyActionRole};
    await publishConnectedSnapshot(adapter);
    await publishConnectedResolutionPresentation(adapter,next);
    await publishCommittedResolution(adapter,next);
  } catch(error) {
    ledger.cancelReservedActionRequest(request.requestId);
    state.pendingRemoteAction=null;
    restoreProjectedContext(adapter);
    if (request.readyConfiguration) clearReadyActionConfiguration(adapter,request.actorId);
    await sendConnectedWireTo(transportMessage.peer,{type:"error",code:"action-resolution-error",message:error instanceof Error?error.message:String(error),hostCursor:ledger.cursor});
  }
});

MockAdapter.prototype.resolveAction=async function resolveConnectedAction(actionId:string,targetIds:string[]) {
  const state=connectedStateFor(this);
  const app=connectedInternal(this);
  if (state.mode==="client") {
    if (!state.sessionId||!state.replica||app.connectionState!=="connected") {
      app.session.compatibility="warning";
      app.session.compatibilityMessage="ActionRequest cannot be sent until the host handshake is complete.";
      return app.getSnapshot();
    }
    const character=connectedManifest(this).character;
    if (!character) return app.getSnapshot();
    const readyConfiguration=isReadyPreparationAction(actionFor(this,character.characterId,actionId))?readyActionConfigurationFor(this,character.characterId):undefined;
    await tauriSessionTransport.send(JSON.stringify({
      type:"action-request",
      request:{
        sessionId:state.sessionId,
        requestId:requestId(),
        actorId:character.characterId,
        actionId,
        targetIds:[...targetIds],
        knownEventCursor:state.replica.cursor,
        character,
        capabilities:[...CONNECTED_CAPABILITIES],
        readyConfiguration,
      },
    }));
    app.session.compatibility="compatible";
    app.session.compatibilityMessage=`ActionRequest sent at host event cursor ${state.replica.cursor}; waiting for host commit.`;
    return app.getSnapshot();
  }
  if (state.mode==="host"&&state.pendingRemoteAction) {
    app.session.compatibility="warning";
    app.session.compatibilityMessage="Resolve or dismiss the pending remote action before starting another shared action.";
    return app.getSnapshot();
  }
  const armedVisibility=state.mode==="host"?state.nextResolutionVisibility:null;
  const previousResolutionId=app.resolution?.id;
  const next=await previousResolveAction.call(this,actionId,targetIds);
  if (armedVisibility&&next.resolution&&next.resolution.id!==previousResolutionId) {
    state.resolutionVisibilityById.set(next.resolution.id,{hidden:normalizedHiddenFacts(armedVisibility.hidden)});
    state.nextResolutionVisibility=null;
  }
  await publishConnectedResolutionPresentation(this,next);
  return publishCommittedResolution(this,next);
};

const HIDDEN_TARGET_LABEL="비공개 대상";

/** Roll facts disclosed while the targets stay hidden must not name them: per-target structures are withheld and target ids/labels are scrubbed from text. */
function scrubHiddenTargets(facts:ConnectedResolutionRollFactsV1,targets:Array<{id:string;label:string}>):ConnectedResolutionRollFactsV1 {
  const scrub=(text:string)=>targets.reduce((value,target)=>value.split(target.id).join(HIDDEN_TARGET_LABEL).split(target.label).join(HIDDEN_TARGET_LABEL),text);
  return {
    ...facts,
    saveResults:[],
    damageComponents:[],
    compact:scrub(facts.compact),
    detail:facts.detail.map(scrub),
    provenance:facts.provenance.map(scrub),
    calculatedOutcome:scrub(facts.calculatedOutcome),
    finalOutcome:scrub(facts.finalOutcome),
    stateChanges:facts.stateChanges.map(scrub),
  };
}

export async function discloseConnectedResolution(adapter:MockAdapter,resolutionId:string,facts:ConnectedResolutionHiddenFact[]) {
  const state=connectedStateFor(adapter);
  const app=connectedInternal(adapter);
  if (state.mode!=="host"||!state.ledger) return {status:"rejected" as const,error:"only the Host can disclose a hidden Resolution"};
  const record=state.hiddenResolutions.get(resolutionId);
  if (!record) return {status:"rejected" as const,error:`no hidden Resolution ${resolutionId}`};
  const selected=normalizedHiddenFacts(facts).filter((fact)=>record.hidden.includes(fact)&&!record.disclosed.includes(fact));
  if (!selected.length) return {status:"rejected" as const,error:"no selected fact is still hidden"};
  const disclosureId=`disclosure.${resolutionId}.${state.ledger.cursor+1}`;
  const targetsStillHidden=record.hidden.includes("targets")&&!record.disclosed.includes("targets")&&!selected.includes("targets");
  const rollFacts=rollFactsOf(record.presentation.resolution);
  const payload:Extract<ConnectedEventPayload,{kind:"resolution-disclosure"}>={
    kind:"resolution-disclosure",
    resolutionId,
    disclosureId,
    disclosed:selected,
    ...(selected.includes("roll")?{roll:{facts:targetsStillHidden?scrubHiddenTargets(rollFacts,record.presentation.targets):rollFacts,dice:structuredClone(record.presentation.dice)}}:{}),
    ...(selected.includes("targets")?{targets:structuredClone(record.presentation.targets)}:{}),
    stateChanges:[],
    provenance:["Host-authoritative DM disclosure","hidden Resolution history retained"],
  };
  const event=state.ledger.commitHostEvent({actorId:"dm",payload});
  record.disclosed=[...record.disclosed,...selected];
  app.activity.unshift({id:disclosureId,time:"지금",actor:"DM",title:`DM 공개 · ${record.actionName}`,summary:selected.map((fact)=>fact==="roll"?"판정 결과":"대상").join(", "),detail:[`eventId=${event.eventId}`,...payload.provenance],stateChanges:[]});
  await broadcastConnectedWire({type:"event-batch",sessionId:state.ledger.sessionId,afterCursor:event.sequence-1,events:[event]});
  return {status:"disclosed" as const,event};
}

MockAdapter.prototype.setNextResolutionVisibility=async function setConnectedResolutionVisibility(visibility:ConnectedResolutionVisibilityV1|null) {
  const state=connectedStateFor(this);
  const hidden=normalizedHiddenFacts(visibility?.hidden);
  state.nextResolutionVisibility=state.mode==="host"&&hidden.length?{hidden}:null;
  return connectedInternal(this).getSnapshot();
};

MockAdapter.prototype.discloseResolution=async function discloseHiddenResolution(resolutionId:string,facts:ConnectedResolutionHiddenFact[]) {
  await discloseConnectedResolution(this,resolutionId,facts);
  return connectedInternal(this).getSnapshot();
};

MockAdapter.prototype.advanceResolution=async function advanceConnectedResolution() {
  const state=connectedStateFor(this);
  if (state.mode==="client") {
    advanceConnectedResolutionPresentation(this);
    return connectedInternal(this).getSnapshot();
  }
  const current=connectedInternal(this).resolution;
  const readyBefore=state.mode==="host"&&current?readyActionConfigurationFor(this,current.actorId):undefined;
  const next=await previousAdvanceResolution.call(this);
  await publishConnectedResolutionPresentation(this,next);
  const readyClearedActorId=readyBefore&&!readyActionConfigurationFor(this,readyBefore.actorId)?readyBefore.actorId:undefined;
  return publishCommittedResolution(this,next,readyClearedActorId);
};

MockAdapter.prototype.respondToInterrupt=async function respondConnectedInterrupt(accept:boolean,selectedIds?:string[]) {
  const state=connectedStateFor(this);
  if (state.mode==="client") {
    const app=connectedInternal(this);
    const interrupt=app.resolution?.interrupt;
    if(!state.sessionId||!interrupt||!app.resolution)return app.getSnapshot();
    await tauriSessionTransport.send(JSON.stringify({
      type:"resolution-interrupt-response",
      response:{sessionId:state.sessionId,resolutionId:app.resolution.id,promptId:interrupt.id,accept,...(selectedIds?{selectedIds:[...selectedIds]}:{})},
    }));
    state.privateInterruptsByResolution.delete(app.resolution.id);
    app.resolution.interrupt=undefined;
    app.resolution.compact="Host 반응 판정 대기";
    return app.getSnapshot();
  }
  const next=await previousRespondToInterrupt.call(this,accept,selectedIds);
  await publishConnectedResolutionPresentation(this,next);
  return publishCommittedResolution(this,next);
};

MockAdapter.prototype.dismissResolution=async function dismissConnectedResolution() {
  const state=connectedStateFor(this);
  const app=connectedInternal(this);
  if (state.mode==="client") {
    const advanced=advanceConnectedResolutionPresentation(this);
    if(advanced.status==="empty"){
      app.resolution=null;
      app.resolutionPresentation=null;
    }
    return app.getSnapshot();
  }
  const pending=state.pendingRemoteAction;
  if (pending&&state.ledger) {
    state.ledger.cancelReservedActionRequest(pending.request.requestId);
    clearCommittedResolutionEvents(pending.resolutionId);
    state.pendingRemoteAction=null;
    restoreProjectedContext(this);
    await sendConnectedWireTo(pending.peer,{type:"error",code:"host-dismissed",message:"host dismissed the pending remote resolution",hostCursor:state.ledger.cursor});
  }
  return previousDismissResolution.call(this);
};

MockAdapter.prototype.declareManualMovementReaction=async function declareConnectedManualMovementReaction(command:ManualMovementReactionCommand) {
  const state=connectedStateFor(this);
  const app=connectedInternal(this);
  if (state.mode==="client") {
    const character=connectedManifest(this).character;
    if (!state.sessionId||!state.replica||app.connectionState!=="connected"||!character||character.characterId!==command.provokerId) return app.getSnapshot();
    await tauriSessionTransport.send(JSON.stringify({
      type:"action-request",
      request:{
        sessionId:state.sessionId,requestId:requestId(),actorId:command.provokerId,actionId:command.attackActionId,
        targetIds:[command.reactorId],knownEventCursor:state.replica.cursor,character,capabilities:[...CONNECTED_CAPABILITIES],manualMovementReaction:structuredClone(command),
      },
    }));
    app.session.compatibility="compatible";
    app.session.compatibilityMessage=`기회공격 유발 선언 전송 · Host event cursor ${state.replica.cursor}`;
    return app.getSnapshot();
  }
  if (state.mode==="host"&&state.pendingRemoteAction) return app.getSnapshot();
  const next=await previousDeclareManualMovementReaction.call(this,command);
  await publishConnectedResolutionPresentation(this,next);
  return publishCommittedResolution(this,next);
};

MockAdapter.prototype.submitConcentrationSaveD20=async function submitConnectedConcentrationSave(face:number){
  const state=connectedStateFor(this);const app=connectedInternal(this);
  if(state.mode==="client"){
    if(!state.sessionId||!app.resolution?.concentrationSave)return app.getSnapshot();
    await tauriSessionTransport.send(JSON.stringify({type:"resolution-concentration-response",response:{sessionId:state.sessionId,resolutionId:app.resolution.id,face}}));
    state.privateConcentrationByResolution.delete(app.resolution.id);app.resolution.concentrationSave=undefined;app.resolution.compact="Host 집중 내성 판정 대기";return app.getSnapshot();
  }
  const next=await previousSubmitConcentrationSaveD20.call(this,face);
  await publishConnectedResolutionPresentation(this,next);
  return publishCommittedResolution(this,next);
};

MockAdapter.prototype.undoLastResolution=async function undoConnectedResolution() {
  const state=connectedStateFor(this);
  const app=connectedInternal(this);
  if(state.mode==="client")return app.getSnapshot();
  const completed=app.resolution?.stage==="complete"?app.resolution:undefined;
  const resolutionId=completed?.id;
  const originalEvents=resolutionId?state.publishedResolutionEvents.get(resolutionId):undefined;
  const mounted=completed?projectedCharacterById(this,completed.actorId):undefined;
  const activated=mounted?activateProjectedCharacterResolutionContext(this,mounted.peerId):undefined;
  const undoContext=activated?.status==="accepted"?activated.context:undefined;
  let next:AppSnapshot;
  try {
    next=await previousUndoLastResolution.call(this);
  } finally {
    if(undoContext)restoreProjectionResolutionContext(this,undoContext);
  }
  if(undoContext)next=await app.getSnapshot();
  if(state.mode!=="host"||!state.ledger||!resolutionId||!originalEvents?.length)return next;
  const committedUndo=next.activity.find((entry)=>entry.undoOf===resolutionId);
  if(!committedUndo)return next;
  const undoId=`undo.${resolutionId}.${state.ledger.cursor+1}`;
  const inverse=inverseResolutionEvents(originalEvents,undoId);
  const event=state.ledger.commitHostEvent({actorId:"dm",payload:{kind:"resolution-undo",undoId,undoOf:resolutionId,inverseResolutionEvents:inverse,stateChanges:[...committedUndo.stateChanges],provenance:["Host-authoritative compensating Undo","original event history retained"]}});
  state.publishedResolutionEvents.delete(resolutionId);
  await broadcastConnectedWire({type:"event-batch",sessionId:state.ledger.sessionId,afterCursor:event.sequence-1,events:[event]});
  return next;
};
