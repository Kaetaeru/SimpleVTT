import { legacySpellResolveAction } from "./legacySpellRuntimeHandler";
import "./phase09AuthoritativeSpellcastingAdapter";
import { MockAdapter } from "./mockAdapter";
import { snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import type { AppSnapshot } from "./contracts";

interface RouterState {
  scene:AppSnapshot["scene"];
}

const authoritativeResolveAction=MockAdapter.prototype.resolveAction;

MockAdapter.prototype.resolveAction=async function resolveActionByRuntimePresence(actionId,targetIds) {
  const internal=this as unknown as RouterState;
  const runtime=snapshotAdapterTurnRuntimeState(this,internal.scene);
  if (!runtime) return legacySpellResolveAction.call(this,actionId,targetIds);
  return authoritativeResolveAction.call(this,actionId,targetIds);
};
