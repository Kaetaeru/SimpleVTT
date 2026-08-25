import "./progressionContracts";
import type { ActionVm, ActivityEntry, AppSnapshot, CharacterSheet, ResolutionView, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { itemEntryById, itemMechanic } from "./characterCreationV10Data";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { projectTurnRuntimeToScene } from "./realTurnRuntimeService";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { commitAdapterTurnRuntimeState, ensureAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState, turnRuntimeSessions } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { BARBARIAN_CLASS_ID, BARBARIAN_RAGE_RESOURCE_ID } from "../domain/barbarianBerserker";
import { BARBARIAN_RAGE_TAG, resolveBarbarianRageStart } from "../domain/barbarianRage";

const ACTION_ID="action.barbarian.rage";
type ArmorDef={training?:"light"|"medium"|"heavy"};
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
  return character.classLevels?.find((entry)=>entry.classId===BARBARIAN_CLASS_ID)?.level??0;
}

function wearingHeavyArmor(character:CharacterSheet) {
  return character.items.some((item)=>{
    if(!item.equipped)return false;
    const entry=itemEntryById(item.definitionId);
    if(!entry||entry.category!=="armor")return false;
    return (itemMechanic(entry,"armor-definition") as ArmorDef|undefined)?.training==="heavy";
  });
}

function seedRageResource(adapter:MockAdapter,internal:AdapterState) {
  let state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  if(!state){ensureAdapterTurnRuntimeState(adapter,internal.scene);state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);}
  const combatant=state?.combatants[internal.activeCharacter.id];
  const resource=internal.activeCharacter.resources.find((entry)=>entry.id===BARBARIAN_RAGE_RESOURCE_ID);
  if(!state||!combatant||!resource)return state;
  if(combatant.resources.some((entry)=>entry.id===resource.id))return state;
  combatant.resources.push({id:resource.id,label:resource.label,current:resource.current,maximum:resource.max,recovery:resource.recovery?structuredClone(resource.recovery):undefined});
  const expected=state.revision;state.revision+=1;
  return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)?snapshotAdapterTurnRuntimeState(adapter,internal.scene):undefined;
}

function activeRage(adapter:MockAdapter,internal:AdapterState) {
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  return state?.effects.some((effect)=>effect.targetId===internal.activeCharacter.id&&effect.tags.includes(BARBARIAN_RAGE_TAG))??false;
}

function rageAction(adapter:MockAdapter,internal:AdapterState,snapshot:AppSnapshot):ActionVm|undefined {
  const character=snapshot.activeCharacter;
  if(!barbarianLevel(character))return undefined;
  const resource=character.resources.find((entry)=>entry.id===BARBARIAN_RAGE_RESOURCE_ID);
  if(!resource)return undefined;
  const heavy=wearingHeavyArmor(character);
  const active=activeRage(adapter,internal);
  const bonusAvailable=internal.sessionMode!=="initiative"||(snapshot.scene.economyByActor[character.id]?.bonusAction??false);
  const available=resource.current>0&&!heavy&&!active&&bonusAvailable;
  const disabledReason=resource.current<=0?"격노 사용 횟수가 없습니다."
    :heavy?"중갑을 착용 중에는 격노를 시작할 수 없습니다."
      :active?"이미 격노 중입니다."
        :!bonusAvailable?"추가 행동을 이미 사용했습니다.":undefined;
  return {
    id:ACTION_ID,actorId:character.id,name:"격노",category:"basic",target:"self",economy:"추가 행동",resolutionKind:"no-roll",
    summary:`격노 시작 · ${resource.current}/${resource.max}`,available,disabledReason,eligibleTargetIds:[character.id],
    resourceCost:{resourceId:resource.id,amount:1},
    details:[
      {label:"효과",value:"근력 판정/내성 이점 · 타격/관통/참격 저항 · 근력 공격 피해 보너스"},
      {label:"비용",value:"추가 행동 1 · 격노 1회"},
      {label:"제한",value:"중갑 착용 중 시작 불가"},
      {label:"출처",value:"SRD 5.2.1 · Barbarian Rage"},
    ],
  };
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithBarbarianRageAction(){
  const internal=this as unknown as AdapterState;
  const snapshot=await previousGetSnapshot.call(this);
  const action=rageAction(this,internal,snapshot);
  const actions=snapshot.scene.actionsByActor[snapshot.activeCharacter.id];
  if(!actions)return snapshot;
  const index=actions.findIndex((entry)=>entry.id===ACTION_ID);
  if(!action){if(index>=0)actions.splice(index,1);return snapshot;}
  if(index>=0)actions[index]=action;else actions.push(action);
  return snapshot;
};

MockAdapter.prototype.resolveAction=async function resolveBarbarianRageFromHotbar(actionId:string,targetIds:string[]){
  if(actionId!==ACTION_ID)return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as AdapterState;
  const snapshot=await internal.getSnapshot();
  const action=snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id===ACTION_ID);
  const actor=internal.activeCharacter;
  const level=barbarianLevel(actor);
  if(!action?.available||targetIds.length!==1||targetIds[0]!==actor.id||!level)return snapshot;
  const state=seedRageResource(this,internal);
  if(!state||!state.combatants[actor.id])return snapshot;
  const resolutionId=`barbarian.rage.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const committed=resolveBarbarianRageStart(SIMPLEVTT_APP_RULES_PROFILE,state,{
    id:resolutionId,actorId:actor.id,expectedRevision:state.revision,barbarianLevel:level,
    wearingHeavyArmor:wearingHeavyArmor(actor),useBonusActionEconomy:internal.sessionMode==="initiative",
  });
  if(committed.status==="rejected")return snapshot;
  const projected=applyResolutionEvents(internal.scene,committed.events,actor.resources,actor.items,state);
  if(projected.status==="rejected")return snapshot;
  const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");
  if(writeBack.status==="rejected")return snapshot;
  if(!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state)){
    if(writeBack.changed)await persistCharacterResolutionEvents(this,committed.events,"inverse");
    return snapshot;
  }
  internal.scene=projected.scene;
  internal.activeCharacter.resources=projected.resources;
  const session=turnRuntimeSessions.get(this);if(session)projectTurnRuntimeToScene(session,internal.scene);
  const resolution:ResolutionView={
    id:resolutionId,actorId:actor.id,targetIds:[actor.id],actionId:ACTION_ID,actionName:"격노",rollKind:"effect",stage:"complete",
    authoritativeDice:[],saveResults:[],damageComponents:[],compact:"격노 시작",detail:["근력 판정/내성 이점 · 물리 피해 저항 · 근력 공격 Rage Damage"],
    provenance:["SRD 5.2.1 · Barbarian Rage"],calculatedOutcome:"격노 시작",finalOutcome:"격노 시작",stateChanges:projected.stateChanges,adjudicated:false,canAdvance:false,
  };
  internal.resolution=resolution;
  internal.activity.unshift(projectResolutionEventsToActivity({resolution,events:committed.events,actorName:actor.name,targetNames:[actor.name]}));
  internal.lastResolutionId=resolutionId;internal.lastBefore=null;recordRuntimeResolutionEvents(this,resolutionId,committed.events);internal.syncChar();
  return internal.getSnapshot();
};
