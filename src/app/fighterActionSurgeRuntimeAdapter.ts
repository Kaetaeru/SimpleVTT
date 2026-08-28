import "./progressionContracts";
import type { AppSnapshot, CharacterSheet, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { commitProductionRuntimeResolution } from "./runtimeResolutionCommit";
import {
  FIGHTER_ACTION_SURGE_RESOURCE_ID,
  FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID,
  FIGHTER_ID,
} from "../domain/coreClassResources";
import { resolveFighterActionSurge } from "../domain/fighterActionSurge";

const ACTION_ID="action.fighter.action-surge";
const RESOURCE_IDS=[FIGHTER_ACTION_SURGE_RESOURCE_ID,FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID];

interface AdapterState {
  sessionMode:SessionMode;
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  syncChar():void;
  getSnapshot():Promise<AppSnapshot>;
}

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousResolveAction=MockAdapter.prototype.resolveAction;

function fighterLevel(character:CharacterSheet) {
  return character.classLevels?.find((entry)=>entry.classId===FIGHTER_ID)?.level ?? 0;
}

function syncResourcesFromRuntime(adapter:MockAdapter,internal:AdapterState) {
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  const combatant=state?.combatants[internal.activeCharacter.id];
  if (!combatant) return;
  for (const id of RESOURCE_IDS) {
    const runtime=combatant.resources.find((resource)=>resource.id===id);
    const character=internal.activeCharacter.resources.find((resource)=>resource.id===id);
    if (runtime&&character) character.current=runtime.current;
  }
}

function seedResources(adapter:MockAdapter,internal:AdapterState) {
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  const combatant=state?.combatants[internal.activeCharacter.id];
  if (!state||!combatant) return undefined;
  const missing=RESOURCE_IDS
    .map((id)=>internal.activeCharacter.resources.find((resource)=>resource.id===id))
    .filter((resource)=>resource&&!combatant.resources.some((entry)=>entry.id===resource.id));
  if (!missing.length) return state;
  for (const resource of missing) combatant.resources.push({
    id:resource!.id,
    label:resource!.label,
    current:resource!.current,
    maximum:resource!.max,
    recovery:resource!.recovery ? structuredClone(resource!.recovery) : undefined,
  });
  const expected=state.revision;
  state.revision+=1;
  return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)
    ? snapshotAdapterTurnRuntimeState(adapter,internal.scene)
    : undefined;
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithFighterActionSurge() {
  const internal=this as unknown as AdapterState;
  syncResourcesFromRuntime(this,internal);
  return previousGetSnapshot.call(this);
};

MockAdapter.prototype.resolveAction=async function resolveFighterActionSurgeFromHotbar(actionId:string,targetIds:string[]) {
  if (actionId!==ACTION_ID) return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as AdapterState;
  const actor=internal.activeCharacter;
  const level=fighterLevel(actor);
  const state=internal.sessionMode==="initiative" ? seedResources(this,internal) : undefined;
  if (!state||state.clock.activeActorId!==actor.id||targetIds.some((id)=>id!==actor.id)) return internal.getSnapshot();

  const resolutionId=`fighter.action-surge.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const committed=resolveFighterActionSurge(SIMPLEVTT_APP_RULES_PROFILE,state,{
    id:resolutionId,
    actorId:actor.id,
    expectedRevision:state.revision,
    fighterLevel:level,
  });
  const snapshot=await commitProductionRuntimeResolution(this,state,committed,{
    resolutionId,
    actorId:actor.id,
    targetIds:[actor.id],
    targetNames:[actor.name],
    actionId:ACTION_ID,
    actionName:"액션 서지",
    compact:"비마법 행동 1회 추가",
    detail:["이번 턴에 사용할 추가 행동을 얻었습니다."],
    provenance:["SRD 5.2.1 · Fighter Action Surge"],
    calculatedOutcome:"추가 행동 획득",
    finalOutcome:"추가 행동 획득",
  });
  syncResourcesFromRuntime(this,internal);
  return snapshot;
};
