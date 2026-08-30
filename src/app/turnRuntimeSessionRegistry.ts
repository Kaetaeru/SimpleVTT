import type { MockAdapter } from "./mockAdapter";
import {
  createTurnRuntimeSession,
  projectTurnRuntimeToScene,
  synchronizeTurnRuntimeFromScene,
  type TurnRuntimeSession,
} from "./realTurnRuntimeService";
import { resolveRuntimeProfileProperty } from "./realResolutionService";
import { connectedStateFor } from "./connectedSessionState";
import type { CharacterSheet, SceneVm } from "./contracts";
import { cloneRuntimeState, type RulesRuntimeState } from "../domain/combatState";

const sessions=new WeakMap<MockAdapter,TurnRuntimeSession>();

export interface TurnRuntimeStateStore {
  read(sceneId:string):RulesRuntimeState|undefined;
  write(sceneId:string,state:RulesRuntimeState):void;
  delete(sceneId:string):void;
}

export class MemoryTurnRuntimeStateStore implements TurnRuntimeStateStore {
  private readonly states=new Map<string,RulesRuntimeState>();
  read(sceneId:string) { const state=this.states.get(sceneId); return state?cloneRuntimeState(state):undefined; }
  write(sceneId:string,state:RulesRuntimeState) { this.states.set(sceneId,cloneRuntimeState(state)); }
  delete(sceneId:string) { this.states.delete(sceneId); }
}

const injectedStores=new WeakMap<MockAdapter,TurnRuntimeStateStore>();
const STORAGE_PREFIX="simplevtt.turn-runtime.v1:";

function runtimeStorage() {
  try {
    return typeof window==="undefined"?undefined:window.localStorage;
  } catch {
    return undefined;
  }
}

function runtimeState(value:unknown):RulesRuntimeState|undefined {
  if(!value||typeof value!=="object") return undefined;
  const state=value as Partial<RulesRuntimeState>;
  if(!Number.isInteger(state.revision)||!state.clock||!state.combatants||typeof state.combatants!=="object"||!Array.isArray(state.effects)||!Array.isArray(state.history)) return undefined;
  try { return cloneRuntimeState(state as RulesRuntimeState); } catch { return undefined; }
}

const platformStore:TurnRuntimeStateStore={
  read(sceneId) {
    const storage=runtimeStorage();
    if(!storage) return undefined;
    try {
      const text=storage.getItem(`${STORAGE_PREFIX}${sceneId}`);
      if(!text) return undefined;
      const payload=JSON.parse(text) as {version?:unknown;state?:unknown};
      return payload.version===1?runtimeState(payload.state):undefined;
    } catch { return undefined; }
  },
  write(sceneId,state) {
    const storage=runtimeStorage();
    if(!storage) return;
    try { storage.setItem(`${STORAGE_PREFIX}${sceneId}`,JSON.stringify({version:1,state})); } catch { /* persistence failure must not corrupt live authority */ }
  },
  delete(sceneId) {
    const storage=runtimeStorage();
    if(!storage) return;
    try { storage.removeItem(`${STORAGE_PREFIX}${sceneId}`); } catch { /* best-effort cleanup */ }
  },
};

const PROFILE_SCENE_FIELDS=[
  ["defense.ac","ac"],
  ["initiative","initiative"],
] as const;

function activeCharacterFor(adapter:MockAdapter) {
  return (adapter as unknown as {activeCharacter?:CharacterSheet}).activeCharacter;
}

function ensureProfilePropertyBases(adapter:MockAdapter,session:TurnRuntimeSession,scene:SceneVm) {
  const activeCharacter=activeCharacterFor(adapter);
  for(const entity of scene.entities) {
    const runtime=session.state.combatants[entity.id];
    if(!runtime) continue;
    runtime.baseProperties??={
      "movement.walk":runtime.baseSpeed,
      "defense.ac":entity.ac,
      "initiative":entity.initiative,
    };
    runtime.baseProperties["movement.walk"]=runtime.baseSpeed;
    runtime.baseProperties["hp.current"]=runtime.life.hp.current;
    runtime.baseProperties["hp.maximum"]=runtime.life.hp.maximum;
    runtime.baseProperties["hp.temporary"]=runtime.life.hp.temporary;
    if(activeCharacter?.id!==entity.id) continue;
    Object.assign(runtime.baseProperties,{
      "ability.str.score":activeCharacter.abilities.str,
      "ability.dex.score":activeCharacter.abilities.dex,
      "ability.con.score":activeCharacter.abilities.con,
      "ability.int.score":activeCharacter.abilities.int,
      "ability.wis.score":activeCharacter.abilities.wis,
      "ability.cha.score":activeCharacter.abilities.cha,
      "progression.character.level":activeCharacter.level,
      "proficiency.bonus":activeCharacter.proficiencyBonus,
    });
  }
}

function projectRuntimeProfileProperties(adapter:MockAdapter,session:TurnRuntimeSession,scene:SceneVm) {
  ensureProfilePropertyBases(adapter,session,scene);
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

function sceneFor(adapter:MockAdapter) {
  return (adapter as unknown as {scene?:SceneVm}).scene;
}

function storeFor(adapter:MockAdapter) {
  return injectedStores.get(adapter)??platformStore;
}

function localAuthority(adapter:MockAdapter) {
  return connectedStateFor(adapter).mode===null;
}

function persist(adapter:MockAdapter,session:TurnRuntimeSession,scene=sceneFor(adapter)) {
  if(!scene||!localAuthority(adapter)) return;
  storeFor(adapter).write(scene.id,session.state);
}

function restore(adapter:MockAdapter,session:TurnRuntimeSession) {
  const scene=sceneFor(adapter);
  if(!scene||!localAuthority(adapter)||session.state.revision!==0) return session;
  const restored=storeFor(adapter).read(scene.id);
  if(!restored) return session;
  session.state=restored;
  const activeActorId=restored.clock.activeActorId;
  if(activeActorId&&session.initiativeOrder.includes(activeActorId)) session.activeIndex=session.initiativeOrder.indexOf(activeActorId);
  else {
    session.state.clock.activeActorId=session.initiativeOrder[0];
    session.activeIndex=0;
  }
  return session;
}

export function setTurnRuntimeStateStoreForTests(adapter:MockAdapter,store:TurnRuntimeStateStore) {
  injectedStores.set(adapter,store);
}

export const turnRuntimeSessions={
  get:(adapter:MockAdapter)=>sessions.get(adapter),
  set:(adapter:MockAdapter,session:TurnRuntimeSession)=>{
    const next=restore(adapter,session);
    sessions.set(adapter,next);
    persist(adapter,next);
    return sessions;
  },
  delete:(adapter:MockAdapter)=>{
    const scene=sceneFor(adapter);
    if(scene&&localAuthority(adapter)) storeFor(adapter).delete(scene.id);
    return sessions.delete(adapter);
  },
};

export function ensureAdapterTurnRuntimeState(adapter:MockAdapter,scene:SceneVm) {
  if (!sessions.has(adapter)) turnRuntimeSessions.set(adapter,createTurnRuntimeSession(scene));
  return snapshotAdapterTurnRuntimeState(adapter,scene)!;
}

export function snapshotAdapterTurnRuntimeState(adapter:MockAdapter,scene:SceneVm):RulesRuntimeState|undefined {
  const session=sessions.get(adapter);
  if (!session) return undefined;
  ensureProfilePropertyBases(adapter,session,scene);
  synchronizeTurnRuntimeFromScene(session,scene);
  ensureProfilePropertyBases(adapter,session,scene);
  projectTurnRuntimeToScene(session,scene);
  projectRuntimeProfileProperties(adapter,session,scene);
  persist(adapter,session,scene);
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
  projectRuntimeProfileProperties(adapter,session,scene);
  persist(adapter,session,scene);
  return true;
}
