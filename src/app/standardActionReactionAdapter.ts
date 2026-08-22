import type { AppRole, AppSnapshot, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";

type ReadyReactionState={
  role:AppRole;
  sessionMode:SessionMode;
  scene:SceneVm;
  getSnapshot():Promise<AppSnapshot>;
};

const READY_TRIGGER_ID="action.standard.ready.trigger";
const previousResolveAction=MockAdapter.prototype.resolveAction;
const previousGetSnapshot=MockAdapter.prototype.getSnapshot;

function readyReactionAvailable(internal:ReadyReactionState,actorId:string) {
  const actor=internal.scene.entities.find((entity)=>entity.id===actorId&&entity.status.includes("준비 행동"));
  return Boolean(actor&&internal.scene.economyByActor[actor.id]?.reaction);
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithReadyReactionAvailability() {
  const snapshot=await previousGetSnapshot.call(this);
  const internal=this as unknown as ReadyReactionState;
  for (const actions of Object.values(snapshot.scene.actionsByActor)) {
    const trigger=actions.find((action)=>action.id===READY_TRIGGER_ID);
    if (trigger&&readyReactionAvailable(internal,trigger.actorId)) {
      trigger.available=true;
      trigger.disabledReason=undefined;
    }
  }
  return snapshot;
};

MockAdapter.prototype.resolveAction=async function resolveReadyActionAsReaction(actionId:string,targetIds:string[]) {
  if (actionId!==READY_TRIGGER_ID) return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as ReadyReactionState;
  const trigger=Object.values(internal.scene.actionsByActor).flat().find((action)=>action.id===READY_TRIGGER_ID);
  if (!trigger||!readyReactionAvailable(internal,trigger.actorId)) return internal.getSnapshot();

  // The core player-turn gate normally rejects every off-turn action. A prepared
  // action is the explicit exception: it is manually triggered and spends Reaction.
  const previousRole=internal.role;
  if (internal.sessionMode==="initiative"&&previousRole==="player") internal.role="dm";
  try {
    await previousResolveAction.call(this,actionId,targetIds);
  } finally {
    internal.role=previousRole;
  }
  return internal.getSnapshot();
};
