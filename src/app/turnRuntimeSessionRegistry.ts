import type { MockAdapter } from "./mockAdapter";
import {
  projectTurnRuntimeToScene,
  synchronizeTurnRuntimeFromScene,
  type TurnRuntimeSession,
} from "./realTurnRuntimeService";
import type { SceneVm } from "./contracts";
import { cloneRuntimeState, type RulesRuntimeState } from "../domain/combatState";

const sessions=new WeakMap<MockAdapter,TurnRuntimeSession>();

export function getTurnRuntimeSession(adapter:MockAdapter) {
  return sessions.get(adapter);
}

export function setTurnRuntimeSession(adapter:MockAdapter,session:TurnRuntimeSession) {
  sessions.set(adapter,session);
}

export function deleteTurnRuntimeSession(adapter:MockAdapter) {
  sessions.delete(adapter);
}

export function snapshotAdapterTurnRuntimeState(adapter:MockAdapter,scene:SceneVm):RulesRuntimeState|undefined {
  const session=sessions.get(adapter);
  if (!session) return undefined;
  synchronizeTurnRuntimeFromScene(session,scene);
  projectTurnRuntimeToScene(session,scene);
  return cloneRuntimeState(session.state);
}

export function commitAdapterTurnRuntimeState(
  adapter:MockAdapter,
  scene:SceneVm,
  expectedRevision:number,
  nextState:RulesRuntimeState,
) {
  const session=sessions.get(adapter);
  if (!session) return false;
  if (session.state.revision!==expectedRevision) return false;
  if (nextState.revision!==expectedRevision+1) return false;
  session.state=cloneRuntimeState(nextState);
  projectTurnRuntimeToScene(session,scene);
  return true;
}
