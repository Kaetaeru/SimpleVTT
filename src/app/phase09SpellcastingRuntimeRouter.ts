import { legacySpellResolveAction, legacySpellUndoLastResolution } from "./legacySpellRuntimeHandler";
import "./phase09AuthoritativeSpellcastingAdapter";
import { MockAdapter } from "./mockAdapter";
import { snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import type { AppSnapshot } from "./contracts";

interface RouterState {
  scene:AppSnapshot["scene"];
  getSnapshot():Promise<AppSnapshot>;
}

const authoritativeResolveAction=MockAdapter.prototype.resolveAction;
const authoritativeUndoLastResolution=MockAdapter.prototype.undoLastResolution;
const legacySpellUndoPending=new WeakSet<MockAdapter>();

async function isSpellAction(adapter:MockAdapter,actionId:string) {
  const snapshot=await adapter.getSnapshot();
  return Object.values(snapshot.scene.actionsByActor)
    .flat()
    .some((action)=>action.id===actionId && Boolean(action.spellCast));
}

MockAdapter.prototype.resolveAction=async function resolveActionByRuntimePresence(actionId,targetIds) {
  legacySpellUndoPending.delete(this);
  const internal=this as unknown as RouterState;
  const runtime=snapshotAdapterTurnRuntimeState(this,internal.scene);
  if (!runtime && await isSpellAction(this,actionId)) {
    legacySpellUndoPending.add(this);
    return legacySpellResolveAction.call(this,actionId,targetIds);
  }
  return authoritativeResolveAction.call(this,actionId,targetIds);
};

MockAdapter.prototype.undoLastResolution=async function undoLastResolutionByRuntimePresence() {
  if (legacySpellUndoPending.has(this)) {
    legacySpellUndoPending.delete(this);
    return legacySpellUndoLastResolution.call(this);
  }
  return authoritativeUndoLastResolution.call(this);
};
