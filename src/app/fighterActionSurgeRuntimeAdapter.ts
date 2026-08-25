import "./progressionContracts";
import type { ActivityEntry, AppSnapshot, CharacterSheet, ResolutionView, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
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
  resolution:ResolutionView|null;
  activity:ActivityEntry[];
  lastResolutionId:string|null;
  lastBefore:unknown;
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
  if (committed.status==="rejected") return internal.getSnapshot();

  const projected=applyResolutionEvents(internal.scene,committed.events,actor.resources);
  if (projected.status==="rejected") return internal.getSnapshot();
  const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");
  if (writeBack.status==="rejected") return internal.getSnapshot();
  if (!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state)) {
    if (writeBack.changed) await persistCharacterResolutionEvents(this,committed.events,"inverse");
    return internal.getSnapshot();
  }

  internal.scene=projected.scene;
  internal.activeCharacter.resources=projected.resources;
  const resolution:ResolutionView={
    id:resolutionId,actorId:actor.id,targetIds:[actor.id],actionId:ACTION_ID,actionName:"액션 서지",
    rollKind:"effect",stage:"complete",authoritativeDice:[],saveResults:[],damageComponents:[],
    compact:"비마법 행동 1회 추가",detail:["이번 턴에 사용할 추가 행동을 얻었습니다."],
    provenance:["SRD 5.2.1 · Fighter Action Surge"],calculatedOutcome:"추가 행동 획득",finalOutcome:"추가 행동 획득",
    stateChanges:projected.stateChanges,adjudicated:false,canAdvance:false,
  };
  internal.resolution=resolution;
  internal.activity.unshift(projectResolutionEventsToActivity({resolution,events:committed.events,actorName:actor.name,targetNames:[actor.name]}));
  internal.lastResolutionId=resolutionId;
  internal.lastBefore=null;
  recordRuntimeResolutionEvents(this,resolutionId,committed.events);
  syncResourcesFromRuntime(this,internal);
  internal.syncChar();
  return internal.getSnapshot();
};
