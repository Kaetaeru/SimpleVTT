import "./progressionContracts";
import type { ActionVm, ActivityEntry, AppRole, AppSnapshot, CharacterSheet, ResolutionView, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { projectTurnRuntimeToScene } from "./realTurnRuntimeService";
import { commitAdapterTurnRuntimeState, ensureAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState, turnRuntimeSessions } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { PALADIN_ID } from "../domain/coreClassResources";
import {
  DEVOTION_HOLY_NIMBUS_RESOURCE_ID,
  paladinDevotionRuntimeResourceDefinitions,
  resolveDevotionHolyNimbusActivation,
} from "../domain/paladinDevotion";
import { PALADIN_DEVOTION_SUBCLASS_ID } from "../domain/srdSubclassCatalog";

export const DEVOTION_HOLY_NIMBUS_ACTION_ID="action.paladin.devotion.holy-nimbus";

interface AdapterState {
  role:AppRole;
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

function paladinLevel(character:CharacterSheet) {
  return character.classLevels?.find((entry)=>entry.classId===PALADIN_ID)?.level??0;
}

function ensureHolyNimbusResource(character:CharacterSheet) {
  const definition=paladinDevotionRuntimeResourceDefinitions(character.classLevels??[],character.subclassIds??{})
    .find((entry)=>entry.resourceId===DEVOTION_HOLY_NIMBUS_RESOURCE_ID);
  if(!definition)return {resource:undefined,changed:false};
  const existing=character.resources.find((entry)=>entry.id===definition.resourceId);
  if(existing){
    const current=Math.min(existing.current,definition.maximum);
    const changed=existing.label!==definition.label||existing.max!==definition.maximum||existing.current!==current||existing.source!==definition.source||existing.recovery?.longRest!=="all";
    existing.label=definition.label;
    existing.max=definition.maximum;
    existing.current=current;
    existing.source=definition.source;
    existing.recovery={...(existing.recovery??{}),longRest:"all"};
    return {resource:existing,changed};
  }
  const resource={id:definition.resourceId,label:definition.label,current:definition.maximum,max:definition.maximum,source:definition.source,recovery:{longRest:"all" as const}};
  character.resources.push(resource);
  return {resource,changed:true};
}

function holyNimbusAction(internal:AdapterState,snapshot:AppSnapshot):ActionVm|undefined {
  const character=snapshot.activeCharacter;
  if(paladinLevel(character)<20||character.subclassIds?.[PALADIN_ID]!==PALADIN_DEVOTION_SUBCLASS_ID)return undefined;
  const definition=paladinDevotionRuntimeResourceDefinitions(character.classLevels??[],character.subclassIds??{})
    .find((entry)=>entry.resourceId===DEVOTION_HOLY_NIMBUS_RESOURCE_ID);
  const resource=character.resources.find((entry)=>entry.id===DEVOTION_HOLY_NIMBUS_RESOURCE_ID);
  if(!definition||!resource)return undefined;
  const bonusAvailable=internal.sessionMode!=="initiative"||(snapshot.scene.economyByActor[character.id]?.bonusAction??false);
  const available=resource.current>0&&bonusAvailable;
  return {
    id:DEVOTION_HOLY_NIMBUS_ACTION_ID,
    actorId:character.id,
    name:"성스러운 후광",
    category:"basic",
    target:"self",
    economy:"추가 행동",
    resolutionKind:"no-roll",
    summary:"10분 · 햇빛 · 헌신의 맹세 후광",
    available,
    disabledReason:resource.current<=0?"성스러운 후광 사용 횟수가 없습니다.":!bonusAvailable?"추가 행동을 이미 사용했습니다.":undefined,
    eligibleTargetIds:[character.id],
    resourceCost:{resourceId:resource.id,amount:1},
    details:[
      {label:"대상",value:"자신"},
      {label:"지속",value:"10분"},
      {label:"효과",value:"밝은 햇빛의 성스러운 후광 활성화"},
      {label:"비용",value:"추가 행동 1 · 성스러운 후광 1회"},
      {label:"출처",value:definition.source},
    ],
  };
}

function seedResource(adapter:MockAdapter,internal:AdapterState) {
  let state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  if(!state){ensureAdapterTurnRuntimeState(adapter,internal.scene);state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);}
  const combatant=state?.combatants[internal.activeCharacter.id];
  const resource=internal.activeCharacter.resources.find((entry)=>entry.id===DEVOTION_HOLY_NIMBUS_RESOURCE_ID);
  if(!state||!combatant||!resource||combatant.resources.some((entry)=>entry.id===resource.id))return state;
  combatant.resources.push({id:resource.id,label:resource.label,current:resource.current,maximum:resource.max,recovery:resource.recovery?structuredClone(resource.recovery):undefined});
  const expected=state.revision;
  state.revision+=1;
  return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)?snapshotAdapterTurnRuntimeState(adapter,internal.scene):undefined;
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithDevotionHolyNimbus(){
  const internal=this as unknown as AdapterState;
  const ensured=ensureHolyNimbusResource(internal.activeCharacter);
  if(ensured.changed)internal.syncChar();
  const snapshot=await previousGetSnapshot.call(this);
  ensureHolyNimbusResource(snapshot.activeCharacter);
  const actions=snapshot.scene.actionsByActor[snapshot.activeCharacter.id]??[];
  snapshot.scene.actionsByActor[snapshot.activeCharacter.id]=actions;
  const projected=holyNimbusAction(internal,snapshot);
  const index=actions.findIndex((entry)=>entry.id===DEVOTION_HOLY_NIMBUS_ACTION_ID);
  if(!projected){if(index>=0)actions.splice(index,1);return snapshot;}
  if(index>=0)actions[index]=projected;else actions.push(projected);
  return snapshot;
};

MockAdapter.prototype.resolveAction=async function resolveDevotionHolyNimbusAction(actionId:string,targetIds:string[]){
  if(actionId!==DEVOTION_HOLY_NIMBUS_ACTION_ID)return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as AdapterState;
  const snapshot=await internal.getSnapshot();
  const action=snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id===actionId);
  if(!action?.available||targetIds.length!==1||targetIds[0]!==action.actorId)return snapshot;
  if(internal.sessionMode==="initiative"&&internal.role==="player"&&action.actorId!==internal.scene.currentActorId)return snapshot;
  const level=paladinLevel(internal.activeCharacter);
  const subclassId=internal.activeCharacter.subclassIds?.[PALADIN_ID];
  const state=seedResource(this,internal);
  if(!state||level<20||subclassId!==PALADIN_DEVOTION_SUBCLASS_ID||!state.combatants[action.actorId])return snapshot;
  const resolutionId=`paladin.devotion.holy-nimbus.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const charismaModifier=Math.floor((internal.activeCharacter.abilities.cha-10)/2);
  const committed=resolveDevotionHolyNimbusActivation(SIMPLEVTT_APP_RULES_PROFILE,state,{
    id:resolutionId,
    actorId:action.actorId,
    expectedRevision:state.revision,
    paladinLevel:level,
    subclassId,
    charismaModifier,
    proficiencyBonus:internal.activeCharacter.proficiencyBonus,
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
  const outcome="성스러운 후광 활성화 · 10분";
  const resolution:ResolutionView={
    id:resolutionId,actorId:action.actorId,targetIds:[action.actorId],actionId,actionName:"성스러운 후광",
    rollKind:"effect",stage:"complete",authoritativeDice:[],saveResults:[],damageComponents:[],compact:outcome,
    detail:["10분 동안 성스러운 후광이 활성화됩니다.","후광은 밝은 햇빛으로 취급됩니다."],
    provenance:["SRD 5.2.1 · Oath of Devotion · Holy Nimbus"],calculatedOutcome:outcome,finalOutcome:outcome,
    stateChanges:projected.stateChanges,adjudicated:false,canAdvance:false,
  };
  internal.resolution=resolution;
  internal.activity.unshift(projectResolutionEventsToActivity({resolution,events:committed.events,actorName:internal.activeCharacter.name,targetNames:[internal.activeCharacter.name]}));
  internal.lastResolutionId=resolutionId;
  internal.lastBefore=null;
  recordRuntimeResolutionEvents(this,resolutionId,committed.events);
  internal.syncChar();
  return internal.getSnapshot();
};
