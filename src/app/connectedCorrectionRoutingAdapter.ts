import type { DmAdjudicationCommand } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { connectedStateFor } from "./connectedSessionState";
import { broadcastConnectedWire, connectedInternal } from "./connectedSessionRuntimeAdapter";
import type { ConnectedCorrectionChange } from "./connectedSessionProtocol";

const previousApplyDmAdjudication=MockAdapter.prototype.applyDmAdjudication;
const IMMEDIATE_STATE_CORRECTIONS=new Set<DmAdjudicationCommand["type"]>([
  "damage-correction",
  "healing-correction",
  "condition-add",
  "condition-remove",
  "resource-correction",
]);

function sameStrings(left:string[],right:string[]) {
  return left.length===right.length&&left.every((value,index)=>value===right[index]);
}

function correctionChanges(before:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,after:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  const changes:ConnectedCorrectionChange[]=[];
  for (const entityAfter of after.scene.entities) {
    const entityBefore=before.scene.entities.find((entry)=>entry.id===entityAfter.id);
    if (!entityBefore) continue;
    if (entityBefore.hp!==entityAfter.hp) {
      changes.push({kind:"hp",targetId:entityAfter.id,before:entityBefore.hp,after:entityAfter.hp});
    }
    if (!sameStrings(entityBefore.status,entityAfter.status)) {
      changes.push({kind:"status",targetId:entityAfter.id,before:[...entityBefore.status],after:[...entityAfter.status]});
    }
  }
  for (const resourceAfter of after.activeCharacter.resources) {
    const resourceBefore=before.activeCharacter.resources.find((entry)=>entry.id===resourceAfter.id);
    if (resourceBefore&&resourceBefore.current!==resourceAfter.current) {
      changes.push({
        kind:"resource",
        targetId:after.activeCharacter.id,
        resourceId:resourceAfter.id,
        before:resourceBefore.current,
        after:resourceAfter.current,
      });
    }
  }
  return changes;
}

MockAdapter.prototype.applyDmAdjudication=async function applyConnectedDmCorrection(command:DmAdjudicationCommand) {
  const state=connectedStateFor(this);
  const app=connectedInternal(this);
  if (state.mode==="client") return app.getSnapshot();
  if (command.type==="ability-check-dc") return previousApplyDmAdjudication.call(this,command);

  if (state.mode==="host"&&state.pendingRemoteAction&&IMMEDIATE_STATE_CORRECTIONS.has(command.type)) {
    app.session.compatibility="warning";
    app.session.compatibilityMessage="State-changing DM correction is blocked while a remote PendingResolution is uncommitted; resolve/dismiss it first.";
    return app.getSnapshot();
  }

  const before=await app.getSnapshot();
  const next=await previousApplyDmAdjudication.call(this,command);
  if (state.mode!=="host"||!state.ledger) return next;

  if (state.pendingRemoteAction) {
    // Preview/adjudication-only changes stay provisional. They influence the eventual
    // host commit but are not synchronized as committed state on their own.
    return next;
  }

  const changes=correctionChanges(before,next);
  const ruling=next.resolution?.finalOutcome
    ?? next.activity.find((entry)=>entry.correction)?.ruling
    ?? `DM correction: ${command.type}`;
  const stateChanges=next.activity.find((entry)=>entry.correction)?.stateChanges ?? [];
  const event=state.ledger.commitHostEvent({
    actorId:"dm",
    payload:{
      kind:"correction",
      resolutionId:next.resolution?.id,
      ruling,
      changes,
      stateChanges:[...stateChanges],
      provenance:[`DM adjudication · ${command.type}`,`scope=${command.scope}`],
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
