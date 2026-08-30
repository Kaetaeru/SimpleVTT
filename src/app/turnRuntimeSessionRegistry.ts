import type { MockAdapter } from "./mockAdapter";
import {
  createTurnRuntimeSession,
  projectTurnRuntimeToScene,
  synchronizeTurnRuntimeFromScene,
  type TurnRuntimeSession,
} from "./realTurnRuntimeService";
import { resolveRuntimeProfileProperty } from "./realResolutionService";
import type { SceneVm } from "./contracts";
import { cloneRuntimeState, type RulesRuntimeState } from "../domain/combatState";

const sessions=new WeakMap<MockAdapter,TurnRuntimeSession>();

const PROFILE_SCENE_FIELDS=[
  ["defense.ac","ac"],
  ["initiative","initiative"],
] as const;

function ensureProfilePropertyBases(session:TurnRuntimeSession,scene:SceneVm) {
  for(const entity of scene.entities) {
    const runtime=session.state.combatants[entity.id];
    if(!runtime||runtime.baseProperties) continue;
    runtime.baseProperties={
      "movement.walk":runtime.baseSpeed,
      "defense.ac":entity.ac,
      "initiative":entity.initiative,
    };
  }
}

function projectRuntimeProfileProperties(session:TurnRuntimeSession,scene:SceneVm) {
  ensureProfilePropertyBases(session,scene);
  for(const entity of scene.entities) {
    const runtime=session.state.combatants[entity.id];
    if(!runtime?.baseProperties) continue;
    for(const [property,field] of PROFILE_SCENE_FIELDS) {
      if(runtime.baseProperties[property]===undefined) continue;
      entity[field]=resolveRuntimeProfileProperty(
        session.state.effects,entity.id,property,runtime.baseProperties,
      ).value;
    }
  }
}

export const turnRuntimeSessions={
  get:(adapter:MockAdapter)=>sessions.get(adapter),
  set:(adapter:MockAdapter,session:TurnRuntimeSession)=>sessions.set(adapter,session),
  delete:(adapter:MockAdapter)=>sessions.delete(adapter),
};

export function ensureAdapterTurnRuntimeState(adapter:MockAdapter,scene:SceneVm) {
  if (!sessions.has(adapter)) sessions.set(adapter,createTurnRuntimeSession(scene));
  return snapshotAdapterTurnRuntimeState(adapter,scene)!;
}

export function snapshotAdapterTurnRuntimeState(adapter:MockAdapter,scene:SceneVm):RulesRuntimeState|undefined {
  const session=sessions.get(adapter);
  if (!session) return undefined;
  ensureProfilePropertyBases(session,scene);
  synchronizeTurnRuntimeFromScene(session,scene);
  projectTurnRuntimeToScene(session,scene);
  projectRuntimeProfileProperties(session,scene);
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
  projectRuntimeProfileProperties(session,scene);
  return true;
}
