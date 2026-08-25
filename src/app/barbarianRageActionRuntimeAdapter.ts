import "./progressionContracts";
import type { ActionVm, ActivityEntry, AppSnapshot, CharacterSheet, ResolutionView, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { itemEntryById, itemMechanic } from "./characterCreationV10Data";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { projectTurnRuntimeToScene } from "./realTurnRuntimeService";
import { commitAdapterTurnRuntimeState, ensureAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState, turnRuntimeSessions } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import {
  BARBARIAN_CLASS_ID,
  BARBARIAN_RAGE_RESOURCE_ID,
  BARBARIAN_RAGE_TAG,
  barbarianRageDamageBonus,
  resolveBarbarianRageStart,
} from "../domain/barbarianBerserker";

const ACTION_ID="action.barbarian.rage";
type ArmorDefinition={training?:string};

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

function barbarianLevel(character:CharacterSheet) {
  return character.classLevels?.find((entry)=>entry.classId===BARBARIAN_CLASS_ID)?.level ?? 0;
}

function wearingHeavyArmor(character:CharacterSheet) {
  return character.items.some((item)=>{
    if(!item.equipped)return false;
    const entry=itemEntryById(item.definitionId);
    const armor=entry ? itemMechanic(entry,"armor-definition") as ArmorDefinition|undefined : undefined;
    return armor?.training==="heavy";
  });
}

function rageActive(adapter:MockAdapter,scene:SceneVm,actorId:string) {
  const state=snapshotAdapterTurnRuntimeState(adapter,scene);
  return state?.effects.some((effect)=>effect.targetId===actorId&&effect.tags.includes(BARBARIAN_RAGE_TAG)) ?? false;
}

function syncResourceFromRuntime(adapter:MockAdapter,internal:AdapterState) {
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  const runtime=state?.combatants[internal.activeCharacter.id]?.resources.find((entry)=>entry.id===BARBARIAN_RAGE_RESOURCE_ID);
  const character=internal.activeCharacter.resources.find((entry)=>entry.id===BARBARIAN_RAGE_RESOURCE_ID);
  if(runtime&&character)character.current=runtime.current;
}

function seedResource(adapter:MockAdapter,internal:AdapterState) {
  let state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  if(!state){ensureAdapterTurnRuntimeState(adapter,internal.scene);state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);}
  const combatant=state?.combatants[internal.activeCharacter.id];
  const resource=internal.activeCharacter.resources.find((entry)=>entry.id===BARBARIAN_RAGE_RESOURCE_ID);
  if(!state||!combatant||!resource||combatant.resources.some((entry)=>entry.id===resource.id))return state;
  combatant.resources.push({
    id:resource.id,
    label:resource.label,
    current:resource.current,
    maximum:resource.max,
    recovery:resource.recovery?structuredClone(resource.recovery):undefined,
  });
  const expected=state.revision;
  state.revision+=1;
  return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)
    ? snapshotAdapterTurnRuntimeState(adapter,internal.scene)
    : undefined;
}

function projectRageAction(adapter:MockAdapter,snapshot:AppSnapshot) {
  const character=snapshot.activeCharacter;
  const level=barbarianLevel(character);
  const resource=character.resources.find((entry)=>entry.id===BARBARIAN_RAGE_RESOURCE_ID);
  const actions=snapshot.scene.actionsByActor[character.id] ?? [];
  snapshot.scene.actionsByActor[character.id]=actions.filter((entry)=>entry.id!==ACTION_ID);
  if(level<1||!resource)return;

  const active=rageActive(adapter,snapshot.scene,character.id);
  const heavy=wearingHeavyArmor(character);
  const bonusReady=snapshot.sessionMode!=="initiative"||snapshot.scene.economyByActor[character.id]?.bonusAction!==false;
  const available=resource.current>0&&!active&&!heavy&&bonusReady;
  const disabledReason=active
    ? "이미 격노 중입니다."
    : heavy
      ? "중갑을 착용한 동안에는 격노를 시작할 수 없습니다."
      : resource.current<=0
        ? "격노 사용 횟수가 없습니다."
        : !bonusReady
          ? "이번 턴의 추가 행동을 이미 사용했습니다."
          : undefined;
  const action:ActionVm={
    id:ACTION_ID,
    actorId:character.id,
    name:"격노",
    category:"basic",
    target:"self",
    economy:"추가 행동",
    resolutionKind:"no-roll",
    summary:`물리 피해 저항 · Rage Damage +${barbarianRageDamageBonus(level)} · ${resource.current}/${resource.max}`,
    available,
    disabledReason,
    eligibleTargetIds:[character.id],
    resourceCost:{resourceId:resource.id,amount:1},
    details:[
      {label:"대상",value:"자신"},
      {label:"효과",value:"타격·관통·참격 피해 저항"},
      {label:"피해",value:`근력 기반 공격 피해 +${barbarianRageDamageBonus(level)}`},
      {label:"비용",value:"추가 행동 1 · 격노 1회"},
      {label:"종료",value:level>=15?"10분 · 무의식/사망 시 조기 종료":"다음 턴 종료 · 행동불능/사망 시 조기 종료"},
      {label:"출처",value:"SRD 5.2.1 · Barbarian Rage"},
    ],
  };
  snapshot.scene.actionsByActor[character.id].push(action);
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithBarbarianRage() {
  const internal=this as unknown as AdapterState;
  syncResourceFromRuntime(this,internal);
  const snapshot=await previousGetSnapshot.call(this);
  projectRageAction(this,snapshot);
  return snapshot;
};

MockAdapter.prototype.resolveAction=async function resolveBarbarianRageFromHotbar(actionId:string,targetIds:string[]) {
  if(actionId!==ACTION_ID)return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as AdapterState;
  const snapshot=await internal.getSnapshot();
  const actor=snapshot.activeCharacter;
  const action=snapshot.scene.actionsByActor[actor.id]?.find((entry)=>entry.id===ACTION_ID);
  if(!action?.available||targetIds.length!==1||targetIds[0]!==actor.id)return snapshot;
  if(internal.sessionMode==="initiative"&&internal.scene.currentActorId!==actor.id)return snapshot;

  const level=barbarianLevel(actor);
  const state=seedResource(this,internal);
  if(!state||level<1||!state.combatants[actor.id])return snapshot;
  const resolutionId=`barbarian.rage.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const committed=resolveBarbarianRageStart(SIMPLEVTT_APP_RULES_PROFILE,state,{
    id:resolutionId,
    actorId:actor.id,
    expectedRevision:state.revision,
    barbarianLevel:level,
    wearingHeavyArmor:wearingHeavyArmor(actor),
  });
  if(committed.status==="rejected")return snapshot;

  const projected=applyResolutionEvents(internal.scene,committed.events,actor.resources,actor.items,state);
  if(projected.status==="rejected")return snapshot;
  const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");
  if(writeBack.status==="rejected")return snapshot;
  if(!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state)){
    if(writeBack.changed)await persistCharacterResolutionEvents(this,committed.events,"inverse");
    return internal.getSnapshot();
  }

  internal.scene=projected.scene;
  internal.activeCharacter.resources=projected.resources;
  const session=turnRuntimeSessions.get(this);
  if(session)projectTurnRuntimeToScene(session,internal.scene);
  const resolution:ResolutionView={
    id:resolutionId,
    actorId:actor.id,
    targetIds:[actor.id],
    actionId:ACTION_ID,
    actionName:"격노",
    rollKind:"effect",
    stage:"complete",
    authoritativeDice:[],
    saveResults:[],
    damageComponents:[],
    compact:"격노 시작",
    detail:["타격·관통·참격 피해에 저항을 얻습니다.",`근력 기반 공격 피해에 +${barbarianRageDamageBonus(level)}를 얻습니다.`],
    provenance:["SRD 5.2.1 · Barbarian Rage"],
    calculatedOutcome:"격노 시작",
    finalOutcome:"격노 시작",
    stateChanges:projected.stateChanges,
    adjudicated:false,
    canAdvance:false,
  };
  internal.resolution=resolution;
  internal.activity.unshift(projectResolutionEventsToActivity({resolution,events:committed.events,actorName:actor.name,targetNames:[actor.name]}));
  internal.lastResolutionId=resolutionId;
  internal.lastBefore=null;
  recordRuntimeResolutionEvents(this,resolutionId,committed.events);
  syncResourceFromRuntime(this,internal);
  internal.syncChar();
  return internal.getSnapshot();
};
