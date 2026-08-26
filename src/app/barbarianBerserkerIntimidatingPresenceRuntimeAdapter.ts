import "./progressionContracts";
import type { ActionVm, ActivityEntry, AppRole, AppSnapshot, CharacterSheet, CombatantDefinitionVm, ResolutionView, SceneEntity, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { resolveRuntimeTargetingFact } from "./realRuntimeAttackFactProvider";
import { resolveRuntimeSaveModifier } from "./realRuntimeStatProvider";
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
  compileBerserkerIntimidatingPresence,
  resolveBerserkerIntimidatingPresence,
  type BerserkerIntimidatingPresenceRequest,
} from "../domain/barbarianBerserker";
import { resolvePendingResolution } from "../domain/resolution";
import type { ResolutionCommit } from "../domain/resolutionTypes";

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

function eligibleTargets(scene:SceneVm,actorId:string) {
  return scene.entities.filter((entity)=>{
    if(entity.id===actorId)return false;
    try{return resolveRuntimeTargetingFact(scene,actorId,entity.id).distanceFeet<=30;}catch{return true;}
  }).map((entity)=>entity.id);
}

function intimidatingPresenceAction(internal:AdapterState,snapshot:AppSnapshot):ActionVm|undefined {
  const character=snapshot.activeCharacter;
  const subclassId=character.subclassIds?.[BARBARIAN_CLASS_ID];
  const definition=barbarianRuntimeResourceDefinitions(character.classLevels??[],character.subclassIds??{})
    .find((entry)=>entry.resourceId===BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID);
  const resource=character.resources.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID);
  if(!definition||subclassId!==BARBARIAN_BERSERKER_SUBCLASS_ID||!resource)return undefined;
  const bonusAvailable=internal.sessionMode!=="initiative"||(snapshot.scene.economyByActor[character.id]?.bonusAction??false);
  const available=resource.current>0&&bonusAvailable;
  const targetIds=eligibleTargets(snapshot.scene,character.id);
  const strengthModifier=Math.floor((character.abilities.str-10)/2);
  const saveDc=berserkerIntimidatingPresenceDc(strengthModifier,character.proficiencyBonus);
  return {
    id:BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID,
    actorId:character.id,
    name:"위압적인 존재감",
    category:"basic",
    target:"any",
    economy:"추가 행동",
    resolutionKind:"saving-throw",
    summary:`지혜 내성 DC ${saveDc} · 실패 시 공포`,
    available,
    disabledReason:resource.current<=0?"위압적인 존재감 사용 횟수가 없습니다.":!bonusAvailable?"추가 행동을 이미 사용했습니다.":undefined,
    eligibleTargetIds:targetIds,
    eligibleTargetReasons:{[character.id]:"자신은 대상이 아닙니다."},
    maxTargets:targetIds.length,
    saveDc,
    saveAbility:"지혜",
    resourceCost:{resourceId:resource.id,amount:1},
    details:[
      {label:"대상",value:"30피트 내 생물"},
      {label:"내성",value:`지혜 DC ${saveDc}`},
      {label:"효과",value:"실패 시 1분간 공포"},
      {label:"비용",value:"추가 행동 1 · 위압적인 존재감 1회"},
      {label:"출처",value:definition.source},
    ],
  };
}

function seedResource(adapter:MockAdapter,internal:AdapterState) {
  let state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  if(!state){ensureAdapterTurnRuntimeState(adapter,internal.scene);state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);}
  const combatant=state?.combatants[internal.activeCharacter.id];
  const resource=internal.activeCharacter.resources.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID);
  if(!state||!combatant||!resource||combatant.resources.some((entry)=>entry.id===resource.id))return state;
  combatant.resources.push({id:resource.id,label:resource.label,current:resource.current,maximum:resource.max,recovery:resource.recovery?structuredClone(resource.recovery):undefined});
  const expected=state.revision;state.revision+=1;
  return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)?snapshotAdapterTurnRuntimeState(adapter,internal.scene):undefined;
}

function relation(actor:SceneEntity,target:SceneEntity) {
  return actor.side===target.side?"ally" as const:"enemy" as const;
}

function resolvePresence(state:NonNullable<ReturnType<typeof snapshotAdapterTurnRuntimeState>>,request:BerserkerIntimidatingPresenceRequest,useBonusActionEconomy:boolean):ResolutionCommit {
  if(useBonusActionEconomy)return resolveBerserkerIntimidatingPresence(SIMPLEVTT_APP_RULES_PROFILE,state,request);
  try{
    const pending=compileBerserkerIntimidatingPresence(request);
    return resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state,{
      ...pending,
      operations:pending.operations.filter((operation)=>!(operation.kind==="use-economy"&&operation.actorId===request.actorId&&operation.slot==="bonus-action")),
    });
  }catch(error){
    return {status:"rejected",state,events:[],results:{},error:error instanceof Error?error.message:String(error)};
  }
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithBerserkerIntimidatingPresence(){
  const internal=this as unknown as AdapterState;
  const snapshot=await previousGetSnapshot.call(this);
  const actions=snapshot.scene.actionsByActor[snapshot.activeCharacter.id];
  if(!actions)return snapshot;
  const projected=intimidatingPresenceAction(internal,snapshot);
  const index=actions.findIndex((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID);
  if(!projected){if(index>=0)actions.splice(index,1);return snapshot;}
  if(index>=0)actions[index]=projected;else actions.push(projected);
  return snapshot;
};

MockAdapter.prototype.resolveAction=async function resolveBerserkerIntimidatingPresence(actionId:string,targetIds:string[]){
  if(actionId!==BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID)return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as AdapterState;
  const snapshot=await internal.getSnapshot();
  const source=snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id===actionId);
  const actor=source&&internal.scene.entities.find((entry)=>entry.id===source.actorId);
  if(!source?.available||!actor||!targetIds.length||targetIds.length>(source.maxTargets??64)||targetIds.some((id)=>!source.eligibleTargetIds.includes(id)))return snapshot;
  if(internal.sessionMode==="initiative"&&internal.role==="player"&&source.actorId!==internal.scene.currentActorId)return snapshot;
  const level=barbarianLevel(internal.activeCharacter);
  const subclassId=internal.activeCharacter.subclassIds?.[BARBARIAN_CLASS_ID];
  const state=seedResource(this,internal);
  if(!state||level<14||subclassId!==BARBARIAN_BERSERKER_SUBCLASS_ID||!state.combatants[source.actorId])return snapshot;
  const resolutionId=`barbarian.berserker.intimidating-presence.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  try{
    const targets=targetIds.map((targetId,index)=>{
      const entity=internal.scene.entities.find((entry)=>entry.id===targetId);if(!entity||!state.combatants[targetId])throw new Error("target missing");
      const sheet=entity.id===internal.activeCharacter.id?internal.activeCharacter:projectedCharacterById(this,entity.id)?.sheet;
      const save=resolveRuntimeSaveModifier(entity,sheet??internal.activeCharacter,"wis",internal.combatantDefinitions);
      const spatial=resolveRuntimeTargetingFact(internal.scene,source.actorId,targetId);
      return {id:targetId,kind:"creature" as const,relation:relation(actor,entity),distanceFeet:spatial.distanceFeet,visible:spatial.visible,cover:spatial.cover,wisdomSaveModifier:save.modifier,saveDice:{id:`${resolutionId}:save:${targetId}`,purpose:"Intimidating Presence Wisdom save",sides:20 as const,faces:[(MockAdapter.prototype as unknown as DicePrototype).d20.call(this,actionId,index)]}};
    });
    const strengthModifier=Math.floor((internal.activeCharacter.abilities.str-10)/2);
    const request:BerserkerIntimidatingPresenceRequest={
      id:resolutionId,actorId:source.actorId,expectedRevision:state.revision,barbarianLevel:level,subclassId,
      strengthModifier,proficiencyBonus:internal.activeCharacter.proficiencyBonus,targets,
    };
    const committed=resolvePresence(state,request,internal.sessionMode==="initiative");
    if(committed.status==="rejected")return snapshot;
    const projected=applyResolutionEvents(internal.scene,committed.events,internal.activeCharacter.resources,internal.activeCharacter.items,state);if(projected.status==="rejected")return snapshot;
    const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");if(writeBack.status==="rejected")return snapshot;
    if(!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state)){if(writeBack.changed)await persistCharacterResolutionEvents(this,committed.events,"inverse");return snapshot;}
    internal.scene=projected.scene;internal.activeCharacter.resources=projected.resources;const session=turnRuntimeSessions.get(this);if(session)projectTurnRuntimeToScene(session,internal.scene);
    const names=targetIds.map((id)=>internal.scene.entities.find((entry)=>entry.id===id)?.name??id);
    const affected=targetIds.filter((id)=>committed.state.effects.some((effect)=>effect.targetId===id&&effect.sourceId===BERSERKER_INTIMIDATING_PRESENCE_FEATURE_ID)).length;
    const outcome=`${targetIds.length}명 판정 · ${affected}명 공포`;
    const resolution:ResolutionView={id:resolutionId,actorId:source.actorId,targetIds,actionId,actionName:"위압적인 존재감",rollKind:"save",stage:"complete",authoritativeDice:targets.flatMap((target)=>target.saveDice.faces),saveResults:[],damageComponents:[],compact:outcome,detail:["실패한 대상은 1분간 공포 상태가 됩니다."],provenance:["SRD 5.2.1 · Path of the Berserker · Intimidating Presence"],calculatedOutcome:outcome,finalOutcome:outcome,stateChanges:projected.stateChanges,adjudicated:false,canAdvance:false};
    internal.resolution=resolution;internal.activity.unshift(projectResolutionEventsToActivity({resolution,events:committed.events,actorName:actor.name,targetNames:names}));internal.lastResolutionId=resolutionId;internal.lastBefore=null;recordRuntimeResolutionEvents(this,resolutionId,committed.events);internal.syncChar();return internal.getSnapshot();
  }catch{return snapshot;}
};
