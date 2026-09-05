import "./phase09RealTurnRuntimeAdapter";
import type { AppSnapshot, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";

/**
 * V1.2 T1-08 — the DM's controlled actor follows the turn. In initiative, when the turn passes to a creature, the
 * DM's action dock switches to it (selectDmActor used to be a separate tap after every 턴 종료).
 */
interface TurnFocusState { scene:SceneVm; sessionMode:string; getSnapshot():Promise<AppSnapshot> }

const previousEndTurn=MockAdapter.prototype.endTurn;
const previousStartInitiative=MockAdapter.prototype.startInitiative;

function followTurn(internal:TurnFocusState) {
  if (internal.sessionMode!=="initiative") return;
  const current=internal.scene.entities.find((entity)=>entity.id===internal.scene.currentActorId);
  if (current) internal.scene.selectedActorId=current.id;
}

MockAdapter.prototype.endTurn=async function endTurnFollowingFocus() {
  const internal=this as unknown as TurnFocusState;
  await previousEndTurn.call(this);
  followTurn(internal);
  return internal.getSnapshot();
};

MockAdapter.prototype.startInitiative=async function startInitiativeFollowingFocus() {
  const internal=this as unknown as TurnFocusState;
  await previousStartInitiative.call(this);
  followTurn(internal);
  return internal.getSnapshot();
};
