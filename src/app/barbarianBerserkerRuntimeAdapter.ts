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
  BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID,
  barbarianRuntimeResourceDefinitions,
  berserkerIntimidatingPresenceDc,
  resolveBerserkerIntimidatingPresence,
} from "../domain/barbarianBerserker";

export const BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID="action.barbarian.berserker.intimidating-presence";
type DicePrototype={d20(actionId:string,index?:number):number};
interface AdapterState {
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
}

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousResolveAction=MockAdapter.prototype.resolveAction;

function barbarianLevel(character:CharacterSheet) {
  return character.classLevels?.find((entry)=>entry.classId===BARBARIAN_CLASS_ID)?.level??0;
}

function berserkerSubclassId(character:CharacterSheet) {
  return character.subclassIds?.[BARBARIAN_CLASS_ID];
}

function ensurePresenceResource(character:CharacterSheet) {
  const definition=barbarianRuntimeResourceDefinitions(character.classLevels??[],character.subclassIds??{})
    .find((entry)=>entry.resourceId===BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID);
  if(!definition)return undefined;
  let resource=character.resources.find((entry)=>entry.id===definition.resourceId);
  if(!resource) {
    resource={
      id:definition.resourceId,
      label:definition.label,
      current:definition.maximum,
      max:definition.maximum,
      source:definition.source,
      recovery:{...definition.recovery},
    };
    character.resources.push(resource);
  } else {
    resource.label=definition.label;
    resource.max=definition.maximum;
    resource.current=Math.min(resource.current,definition.maximum);
    resource.source=definition.source;
    resource.recovery={...definition.recovery};
  }
  return resource;
}

function relation(actor:SceneEntity,target:SceneEntity) {
  return actor.id===target.id?"self" as const:actor.side===target.side?"ally" as const:"enemy" as const;
}

function eligibleTargets(scene:SceneVm,actorId:string) {
  return scene.entities.filter((entity)=>{
    if(entity.id===actorId)return false;
    try{return resolveRuntimeTargetingFact(scene,actorId,entity.id).distanceFeet<=30;}
    catch{return false;}
  }).map((entity)=>entity.id);
}

function presenceAction(internal:AdapterState,snapshot:AppSnapshot):ActionVm|undefined {
  const character=snapshot.activeCharacter;
  const level=barbarianLevel(character);
  if(level<14||berserkerSubclassId(character)!==BARBARIAN_BERSERKER_SUBCLASS_ID)return undefined;
  const resource=ensurePresenceResource(character);
  if(!resource)return undefined;
  const targetIds=eligibleTargets(snapshot.scene,character.id);
  const bonusAvailable=internal.sessionMode!=="initiative"||(snapshot.scene.economyByActor[character.id]?.bonusAction??false);
  const available=resource.current>0&&bonusAvailable&&targetIds.length>0;
  const disabledReason=resource.current<=0?"위압적인 존재감 사용 횟수가 없습니다."
    :!bonusAvailable?"추가 행동을 이미 사용했습니다."
      :!targetIds.length?"30피트 안에 대상이 없습니다.":undefined;
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
    available,
    disabledReason,
    eligibleTargetIds:targetIds,
    maxTargets:Math.max(1,targetIds.length),
    saveDc:dc,
    saveAbility:"지혜",
    resourceCost:{resourceId:resource.id,amount:1},
    details:[
      {label:"대상",value:"30피트 안의 선택한 크리처"},
      {label:"내성",value:`지혜 DC ${dc}`},
      {label:"효과",value:"실패 시 1분 동안 공포"},
      {label:"비용",value:"추가 행동 1 · 위압적인 존재감 1회"},
      {label:"출처",value:"SRD 5.2.1 · Path of the Berserker · Intimidating Presence"},
    ],
  };
}

function seedPresenceResource(adapter:MockAdapter,internal:AdapterState) {
  let state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  if(!state){ensureAdapterTurnRuntimeState(adapter,internal.scene);state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);}
  const combatant=state?.combatants[internal.activeCharacter.id];
  const resource=ensurePresenceResource(internal.activeCharacter);
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
    ?snapshotAdapterTurnRuntimeState(adapter,internal.scene)
    :undefined;
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithBerserkerIntimidatingPresence(){
  const internal=this as unknown as AdapterState;
  ensurePresenceResource(internal.activeCharacter);
  const snapshot=await previousGetSnapshot.call(this);
  ensurePresenceResource(snapshot.activeCharacter);
  const actions=snapshot.scene.actionsByActor[snapshot.activeCharacter.id];
  if(!actions)return snapshot;
  const index=actions.findIndex((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID);
  const action=presenceAction(internal,snapshot);
  if(!action){if(index>=0)actions.splice(index,1);return snapshot;}
  if(index>=0)actions[index]=action;else actions.push(action);
  return snapshot;
};

MockAdapter.prototype.resolveAction=async function resolveBerserkerIntimidatingPresenceAction(actionId:string,targetIds:string[]){
  if(actionId!==BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID)return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as AdapterState;
  const snapshot=await internal.getSnapshot();
  const actor=internal.activeCharacter;
  const source=snapshot.scene.actionsByActor[actor.id]?.find((entry)=>entry.id===actionId);
  const actorEntity=internal.scene.entities.find((entry)=>entry.id===actor.id);
  if(!source?.available||!actorEntity||!targetIds.length||targetIds.length>(source.maxTargets??1)||targetIds.some((id)=>!source.eligibleTargetIds.includes(id)))return snapshot;
  if(internal.sessionMode==="initiative"&&internal.role==="player"&&actor.id!==internal.scene.currentActorId)return snapshot;
  const level=barbarianLevel(actor);
  const subclassId=berserkerSubclassId(actor);
  const state=seedPresenceResource(this,internal);
  if(!state||level<14||subclassId!==BARBARIAN_BERSERKER_SUBCLASS_ID||!state.combatants[actor.id])return snapshot;
  const strengthModifier=Math.floor((actor.abilities.str-10)/2);
  const dc=berserkerIntimidatingPresenceDc(strengthModifier,actor.proficiencyBonus);
  const resolutionId=`barbarian.berserker.intimidating-presence.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  try {
    const targets=targetIds.map((targetId,index)=>{
      const entity=internal.scene.entities.find((entry)=>entry.id===targetId);
      if(!entity)throw new Error("target missing");
      const sheet=entity.id===actor.id?actor:projectedCharacterById(this,entity.id)?.sheet;
      const save=resolveRuntimeSaveModifier(entity,sheet??actor,"wis",internal.combatantDefinitions);
      const spatial=resolveRuntimeTargetingFact(internal.scene,actor.id,targetId);
      const face=(MockAdapter.prototype as unknown as DicePrototype).d20.call(this,BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID,index);
      return {
        id:targetId,
        kind:"creature" as const,
        relation:relation(actorEntity,entity),
        distanceFeet:spatial.distanceFeet,
        visible:spatial.visible,
        cover:spatial.cover,
        wisdomSaveModifier:save.modifier,
        saveDice:{id:`${resolutionId}:save:${targetId}`,purpose:"Intimidating Presence Wisdom save",sides:20 as const,faces:[face]},
      };
    });
    const committed=resolveBerserkerIntimidatingPresence(SIMPLEVTT_APP_RULES_PROFILE,state,{
      id:resolutionId,
      actorId:actor.id,
      expectedRevision:state.revision,
      barbarianLevel:level,
      subclassId,
      strengthModifier,
      proficiencyBonus:actor.proficiencyBonus,
      targets,
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
    const saveResults=targets.map((target)=>{
      const d20=target.saveDice.faces[0]??1;
      const total=d20+target.wisdomSaveModifier;
      return {targetId:target.id,targetName:internal.scene.entities.find((entry)=>entry.id===target.id)?.name??target.id,d20,total,dc,outcome:(total>=dc?"성공":"실패") as "성공"|"실패"};
    });
    const failures=saveResults.filter((entry)=>entry.outcome==="실패").length;
    const names=targetIds.map((id)=>internal.scene.entities.find((entry)=>entry.id===id)?.name??id);
    const outcome=`${targetIds.length}명 내성 · ${failures}명 공포`;
    const resolution:ResolutionView={
      id:resolutionId,
      actorId:actor.id,
      targetIds,
      actionId:BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID,
      actionName:"위압적인 존재감",
      rollKind:"save",
      stage:"complete",
      authoritativeDice:targets.flatMap((target)=>target.saveDice.faces),
      saveResults,
      damageComponents:[],
      compact:outcome,
      detail:["실패한 대상은 1분 동안 공포 상태가 됩니다."],
      provenance:["SRD 5.2.1 · Path of the Berserker · Intimidating Presence"],
      calculatedOutcome:outcome,
      finalOutcome:outcome,
      stateChanges:projected.stateChanges,
      adjudicated:false,
      canAdvance:false,
    };
    internal.resolution=resolution;
    internal.activity.unshift(projectResolutionEventsToActivity({resolution,events:committed.events,actorName:actor.name,targetNames:names}));
    internal.lastResolutionId=resolutionId;
    internal.lastBefore=null;
    recordRuntimeResolutionEvents(this,resolutionId,committed.events);
    internal.syncChar();
    return internal.getSnapshot();
  } catch {
    return snapshot;
  }
};
