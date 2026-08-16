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

const previousResolveAction=MockAdapter.prototype.resolveAction;
const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;
const previousDismissResolution=MockAdapter.prototype.dismissResolution;

function requestId() {
  return `request.${Date.now().toString(36)}.${Math.floor(Math.random()*1_000_000).toString(36)}`;
}

async function publishCommittedResolution(adapter:MockAdapter,snapshot?:AppSnapshot) {
  const state=connectedStateFor(adapter);
  if (state.mode!=="host"||!state.ledger) return snapshot ?? connectedInternal(adapter).getSnapshot();
  const current=snapshot ?? await connectedInternal(adapter).getSnapshot();
  const resolution=current.resolution;
  if (!resolution||resolution.stage!=="complete"||state.publishedResolutionIds.has(resolution.id)) return current;

  const pending=state.pendingRemoteAction;
  const events=takeCommittedResolutionEvents(resolution.id);
  if (!events?.length) {
    if (pending?.resolutionId===resolution.id) {
      state.ledger.cancelReservedActionRequest(pending.request.requestId);
      await sendConnectedWireTo(pending.peer,{
        type:"error",
        code:"remote-action-not-event-native",
        message:`${resolution.actionId} completed without canonical ResolutionEvent output; it was not broadcast as committed network state`,
        hostCursor:state.ledger.cursor,
      });
      state.pendingRemoteAction=null;
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

  const committed=pending?.resolutionId===resolution.id
    ? state.ledger.commitReservedActionRequest(pending.request.requestId,candidate)
    : { status:"committed" as const,event:state.ledger.commitHostEvent(candidate) };

  if (committed.status==="rejected") {
    if (pending?.resolutionId===resolution.id) {
      await sendConnectedWireTo(pending.peer,{type:"error",code:"host-commit-rejected",message:committed.error,hostCursor:committed.hostCursor});
      state.pendingRemoteAction=null;
    }
    return current;
  }

  const event=committed.event;
  state.publishedResolutionIds.add(resolution.id);
  if (pending?.resolutionId===resolution.id) state.pendingRemoteAction=null;
  await broadcastConnectedWire({
    type:"event-batch",
    sessionId:state.ledger.sessionId,
    afterCursor:event.sequence-1,
    events:[event],
  });
  return current;
}

registerConnectedActionRequestHandler(async (adapter,transportMessage,request) => {
  const state=connectedStateFor(adapter);
  const app=connectedInternal(adapter);
  const ledger=state.ledger;
  if (state.mode!=="host"||!ledger) return;

  if (state.pendingRemoteAction) {
    await sendConnectedWireTo(transportMessage.peer,{type:"error",code:"host-busy",message:"host already has an uncommitted remote PendingResolution",hostCursor:ledger.cursor});
    return;
  }
  if (!request.character||request.character.characterId!==request.actorId) {
    await sendConnectedWireTo(transportMessage.peer,{type:"error",code:"actor-projection-mismatch",message:"ActionRequest actor must match the submitted Character projection",hostCursor:ledger.cursor});
    return;
  }
  if (CONNECTED_CAPABILITIES.some((capability)=>!request.capabilities.includes(capability))) {
    await sendConnectedWireTo(transportMessage.peer,{type:"error",code:"capability-mismatch",message:"ActionRequest is missing a required connected-session capability",hostCursor:ledger.cursor});
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

  try {
    const next=await previousResolveAction.call(adapter,request.actionId,request.targetIds);
    const resolution=next.resolution;
    if (!resolution||resolution.actorId!==request.actorId||resolution.actionId!==request.actionId) {
      ledger.cancelReservedActionRequest(request.requestId);
      await sendConnectedWireTo(transportMessage.peer,{type:"error",code:"action-rejected",message:"host production resolution path rejected the requested actor/action/targets",hostCursor:ledger.cursor});
      return;
    }
    state.pendingRemoteAction={peer:transportMessage.peer,request:structuredClone(request),resolutionId:resolution.id};
    await publishConnectedSnapshot(adapter);
    await publishCommittedResolution(adapter,next);
  } catch(error) {
    ledger.cancelReservedActionRequest(request.requestId);
    state.pendingRemoteAction=null;
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
  const next=await previousAdvanceResolution.call(this);
  return publishCommittedResolution(this,next);
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
    await sendConnectedWireTo(pending.peer,{type:"error",code:"host-dismissed",message:"host dismissed the pending remote resolution",hostCursor:state.ledger.cursor});
  }
  return previousDismissResolution.call(this);
};
