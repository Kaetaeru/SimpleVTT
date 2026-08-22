import type { AppSnapshot } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { registerConnectedActionRequestHandler } from "./connectedActionRequestPort";
import { connectedStateFor } from "./connectedSessionState";
import {
  CONNECTED_CAPABILITIES,
  broadcastConnectedWire,
  connectedInternal,
  connectedManifest,
  publishConnectedSnapshot,
  sendConnectedWireTo,
} from "./connectedSessionRuntimeAdapter";
import { clearCommittedResolutionEvents, takeCommittedResolutionEvents } from "./resolutionEventCommitRegistry";
import { tauriSessionTransport } from "./tauriSessionTransport";
import {
  activateProjectedCharacterResolutionContext,
  restoreProjectionResolutionContext,
  type ProjectionResolutionContext,
} from "./characterSessionProjectionMount";
import { projectedCharacterForPeer } from "./characterSessionProjectionRegistry";
import { clearReadyActionConfiguration, readyActionConfigurationFor, setReadyActionConfiguration } from "./standardActionReadyState";

const previousResolveAction=MockAdapter.prototype.resolveAction;
const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;
const previousDismissResolution=MockAdapter.prototype.dismissResolution;
const projectionContexts=new WeakMap<MockAdapter,ProjectionResolutionContext>();

function requestId() {
  return `request.${Date.now().toString(36)}.${Math.floor(Math.random()*1_000_000).toString(36)}`;
}

function restoreProjectedContext(adapter:MockAdapter) {
  const context=projectionContexts.get(adapter);
  if (!context) return false;
  restoreProjectionResolutionContext(adapter,context);
  projectionContexts.delete(adapter);
  return true;
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
  const readyConfig=readyActionConfigurationFor(adapter,resolution.actorId);
  const readyArmed=resolution.actionId==="action.standard.ready"&&readyConfig;
  const readyCleared=readyClearedActorId===resolution.actorId||pending?.request.actionId==="action.standard.ready.trigger";
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
      resolutionEvents:events,
      stateChanges:[...resolution.stateChanges],
      provenance:[...resolution.provenance],
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

  if (request.readyConfiguration) {
    if (request.actionId!=="action.standard.ready"||request.readyConfiguration.actorId!==request.actorId) {
      ledger.cancelReservedActionRequest(request.requestId);
      restoreProjectedContext(adapter);
      await sendConnectedWireTo(transportMessage.peer,{type:"error",code:"ready-config-rejected",message:"Ready configuration must match the requested Ready actor",hostCursor:ledger.cursor});
      return;
    }
    setReadyActionConfiguration(adapter,request.readyConfiguration);
  }

  try {
    const next=await previousResolveAction.call(adapter,request.actionId,request.targetIds);
    const resolution=next.resolution;
    const expectedActionId=request.actionId==="action.standard.ready.trigger"
      ? readyActionConfigurationFor(adapter,request.actorId)?.actionId
      : request.actionId;
    if (!resolution||resolution.actorId!==request.actorId||resolution.actionId!==expectedActionId) {
      ledger.cancelReservedActionRequest(request.requestId);
      if (request.readyConfiguration) clearReadyActionConfiguration(adapter,request.actorId);
      restoreProjectedContext(adapter);
      await sendConnectedWireTo(transportMessage.peer,{type:"error",code:"action-rejected",message:"host production resolution path rejected the requested actor/action/targets",hostCursor:ledger.cursor});
      return;
    }
    state.pendingRemoteAction={peer:transportMessage.peer,request:structuredClone(request),resolutionId:resolution.id};
    await publishConnectedSnapshot(adapter);
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
    const readyConfiguration=actionId==="action.standard.ready"?readyActionConfigurationFor(this,character.characterId):undefined;
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
  const next=await previousResolveAction.call(this,actionId,targetIds);
  return publishCommittedResolution(this,next);
};

MockAdapter.prototype.advanceResolution=async function advanceConnectedResolution() {
  const state=connectedStateFor(this);
  if (state.mode==="client") return connectedInternal(this).getSnapshot();
  const current=connectedInternal(this).resolution;
  const readyBefore=state.mode==="host"&&current?readyActionConfigurationFor(this,current.actorId):undefined;
  const next=await previousAdvanceResolution.call(this);
  const readyClearedActorId=readyBefore&&!readyActionConfigurationFor(this,readyBefore.actorId)?readyBefore.actorId:undefined;
  return publishCommittedResolution(this,next,readyClearedActorId);
};

MockAdapter.prototype.respondToInterrupt=async function respondConnectedInterrupt(accept:boolean) {
  const state=connectedStateFor(this);
  if (state.mode==="client") return connectedInternal(this).getSnapshot();
  const next=await previousRespondToInterrupt.call(this,accept);
  return publishCommittedResolution(this,next);
};

MockAdapter.prototype.dismissResolution=async function dismissConnectedResolution() {
  const state=connectedStateFor(this);
  if (state.mode==="client") return connectedInternal(this).getSnapshot();
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
