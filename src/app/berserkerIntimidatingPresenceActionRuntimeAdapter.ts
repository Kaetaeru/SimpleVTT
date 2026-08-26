import "./progressionContracts";
import type { ActionVm, ActivityEntry, AppRole, AppSnapshot, CharacterSheet, CombatantDefinitionVm, ResolutionView, SceneEntity, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { resolveRuntimeSaveModifier } from "./realRuntimeStatProvider";
import { resolveRuntimeTargetingFact } from "./realRuntimeAttackFactProvider";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { projectTurnRuntimeToScene } from "./realTurnRuntimeService";
import { commitAdapterTurnRuntimeState, ensureAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState, turnRuntimeSessions } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { projectedCharacterById } from "./characterSessionProjectionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import {
  BARBARIAN_BERSERKER_SUBCLASS_ID,
  BARBARIAN_CLASS_ID,
  BERSERKER_INTIMIDATING_PRESENCE_FEATURE_ID,
  BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID,
  barbarianRuntimeResourceDefinitions,
  berserkerIntimidatingPresenceDc,
  resolveBerserkerIntimidatingPresence,
} from "../domain/barbarianBerserker";

export const BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID="action.barbarian.berserker.intimidating-presence";
type DicePrototype={d20(actionId:string,index?:number):number};
type AdapterState={
  role:AppRole;
  sessionMode:SessionMode;
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  combatantDefinitions:CombatantDefinitionVm[];
  resolution:ResolutionView|null;
  activity:ActivityEntry[];
  lastResolutionId:string|null;
  lastBefore:unknown;
  syncChar():void;
  getSnapshot():Promise<AppSnapshot>;
};

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousResolveAction=MockAdapter.prototype.resolveAction;

function barbarianLevel(character:CharacterSheet) {
  return character.classLevels?.find((entry)=>entry.classId===BARBARIAN_CLASS_ID)?.level??0;
}

function projectedAction(character:CharacterSheet,scene:SceneVm):ActionVm|undefined {
  const definitions=barbarianRuntimeResourceDefinitions(character.classLevels??[],character.subclassIds??{});
  if(!definitions.some((entry)=>entry.resourceId===BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID))return undefined;
  const resource=character.resources.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID);
  if(!resource)return undefined;
  const strengthModifier=Math.floor((character.abilities.str-10)/2);
  const dc=berserkerIntimidatingPresenceDc(strengthModifier,character.proficiencyBonus);
  return {
    id:BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID,
    actorId:character.id,
    name:"위압적인 존재감",
    category:"basic",
    target:"any",
    economy:"추가 행동",
    resolutionKind:"saving-throw",
    summary:`30피트 · 지혜 내성 DC ${dc} · 실패 시 공포`,
    available:resource.current>0,
    disabledReason:resource.current>0?undefined:"위압적인 존재감 사용 횟수가 없습니다.",
    eligibleTargetIds:scene.entities.filter((entry)=>entry.id!==character.id).map((entry)=>entry.id),
    maxTargets:64,
    saveDc:dc,
    saveAbility:"지혜",
    resourceCost:{resourceId:resource.id,amount:1},
    details:[
      {label:"대상",value:"자신을 제외한 선택한 크리처"},
      {label:"사거리",value:"30피트"},
      {label:"내성",value:`지혜 DC ${dc}`},
      {label:"실패",value:"1분간 공포"},
      {label:"비용",value:"추가 행동 1 · 사용 횟수 1"},
      {label:"출처",value:"SRD 5.2.1 · Path of the Berserker · Intimidating Presence"},
    ],
  };
}

function project(scene:SceneVm,actorId:string,action:ActionVm|undefined) {
  const current=(scene.actionsByActor[actorId]??[]).filter((entry)=>entry.id!==BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID);
  scene.actionsByActor[actorId]=action?[...current,structuredClone(action)]:current;
}

function actorAction(scene:SceneVm) {
  for(const actorId of [scene.selectedActorId,scene.currentActorId,...Object.keys(scene.actionsByActor)]){
    const found=scene.actionsByActor[actorId]?.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID);
    if(found)return found;
  }
}

function relation(actor:SceneEntity,target:SceneEntity) {
  return actor.id===target.id?"self" as const:actor.side===target.side?"ally" as const:"enemy" as const;
}

function seedResource(adapter:MockAdapter,internal:AdapterState) {
  let state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  if(!state){ensureAdapterTurnRuntimeState(adapter,internal.scene);state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);}
  const combatant=state?.combatants[internal.activeCharacter.id];
  const definition=barbarianRuntimeResourceDefinitions(internal.activeCharacter.classLevels??[],internal.activeCharacter.subclassIds??{})
    .find((entry)=>entry.resourceId===BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID);
  const resource=internal.activeCharacter.resources.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID);
  if(!state||!combatant||!definition||!resource||combatant.resources.some((entry)=>entry.id===resource.id))return state;
  combatant.resources.push({
    id:resource.id,
    label:resource.label,
    current:resource.current,
    maximum:resource.max,
    recovery:resource.recovery?structuredClone(resource.recovery):structuredClone(definition.recovery),
  });
  const expected=state.revision;
  state.revision+=1;
  return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)?snapshotAdapterTurnRuntimeState(adapter,internal.scene):undefined;
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithBerserkerIntimidatingPresence(){
  const snapshot=await previousGetSnapshot.call(this);
  const internal=this as unknown as AdapterState;
  const action=projectedAction(snapshot.activeCharacter,snapshot.scene);
  project(internal.scene,snapshot.activeCharacter.id,action);
  project(snapshot.scene,snapshot.activeCharacter.id,action);
  return snapshot;
};

MockAdapter.prototype.resolveAction=async function resolveBerserkerIntimidatingPresence(actionId:string,targetIds:string[]){
  if(actionId!==BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID)return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as AdapterState;
  const snapshot=await internal.getSnapshot();
  const action=actorAction(snapshot.scene);
  const actor=action&&internal.scene.entities.find((entry)=>entry.id===action.actorId);
  if(!action?.available||!actor||!targetIds.length||targetIds.length>(action.maxTargets??64)||targetIds.some((id)=>!action.eligibleTargetIds.includes(id)))return snapshot;
  if(internal.sessionMode==="initiative"&&internal.role==="player"&&action.actorId!==internal.scene.currentActorId)return snapshot;
  const level=barbarianLevel(internal.activeCharacter);
  const subclassId=internal.activeCharacter.subclassIds?.[BARBARIAN_CLASS_ID];
  const state=seedResource(this,internal);
  if(!state||level<14||subclassId!==BARBARIAN_BERSERKER_SUBCLASS_ID||!state.combatants[action.actorId])return snapshot;
  const strengthModifier=Math.floor((internal.activeCharacter.abilities.str-10)/2);
  const resolutionId=`barbarian.berserker.intimidating-presence.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  try{
    const targets=targetIds.map((targetId,index)=>{
      const entity=internal.scene.entities.find((entry)=>entry.id===targetId);
      if(!entity||entity.id===action.actorId||!state.combatants[targetId])throw new Error("target missing");
      const sheet=projectedCharacterById(this,entity.id)?.sheet;
      const save=resolveRuntimeSaveModifier(entity,sheet??internal.activeCharacter,"wis",internal.combatantDefinitions);
      const spatial=resolveRuntimeTargetingFact(internal.scene,action.actorId,targetId);
      return {
        id:targetId,
        kind:"creature" as const,
        relation:relation(actor,entity),
        distanceFeet:spatial.distanceFeet,
        visible:spatial.visible,
        cover:spatial.cover,
        wisdomSaveModifier:save.modifier,
        saveDice:{
          id:`${resolutionId}:save:${targetId}`,
          purpose:"Intimidating Presence Wisdom save",
          sides:20 as const,
          faces:[(MockAdapter.prototype as unknown as DicePrototype).d20.call(this,actionId,index)],
        },
      };
    });
    const committed=resolveBerserkerIntimidatingPresence(SIMPLEVTT_APP_RULES_PROFILE,state,{
      id:resolutionId,
      actorId:action.actorId,
      expectedRevision:state.revision,
      barbarianLevel:level,
      subclassId,
      strengthModifier,
      proficiencyBonus:internal.activeCharacter.proficiencyBonus,
      targets,
    });
    if(committed.status==="rejected")return snapshot;
    const projected=applyResolutionEvents(internal.scene,committed.events,internal.activeCharacter.resources,internal.activeCharacter.items,state);
    if(projected.status==="rejected")return snapshot;
    const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");
    if(writeBack.status==="rejected")return snapshot;
    if(!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state)){
      if(writeBack.changed)await persistCharacterResolutionEvents(this,committed.events,"inverse");
      return snapshot;
    }
    internal.scene=projected.scene;
    internal.activeCharacter.resources=projected.resources;
    const session=turnRuntimeSessions.get(this);
    if(session)projectTurnRuntimeToScene(session,internal.scene);
    const targetNames=targetIds.map((id)=>internal.scene.entities.find((entry)=>entry.id===id)?.name??id);
    const affected=targetIds.filter((id)=>committed.state.effects.some((effect)=>effect.targetId===id&&effect.sourceId===BERSERKER_INTIMIDATING_PRESENCE_FEATURE_ID)).length;
    const outcome=`${targetIds.length}명 판정 · ${affected}명 공포`;
    const resolution:ResolutionView={
      id:resolutionId,
      actorId:action.actorId,
      targetIds,
      actionId:BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID,
      actionName:"위압적인 존재감",
      rollKind:"save",
      stage:"complete",
      authoritativeDice:targets.flatMap((target)=>target.saveDice.faces),
      saveResults:[],
      damageComponents:[],
      compact:outcome,
      detail:["실패한 대상은 1분간 공포 상태가 됩니다."],
      provenance:["SRD 5.2.1 · Path of the Berserker · Intimidating Presence"],
      calculatedOutcome:outcome,
      finalOutcome:outcome,
      stateChanges:projected.stateChanges,
      adjudicated:false,
      canAdvance:false,
    };
    internal.resolution=resolution;
    internal.activity.unshift(projectResolutionEventsToActivity({resolution,events:committed.events,actorName:actor.name,targetNames}));
    internal.lastResolutionId=resolutionId;
    internal.lastBefore=null;
    recordRuntimeResolutionEvents(this,resolutionId,committed.events);
    internal.syncChar();
    return internal.getSnapshot();
  }catch{
    return snapshot;
  }
};
