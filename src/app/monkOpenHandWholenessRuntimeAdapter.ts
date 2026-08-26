import type { ActionVm, ActivityEntry, AppRole, AppSnapshot, CharacterSheet, ResolutionView, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { projectTurnRuntimeToScene } from "./realTurnRuntimeService";
import { commitAdapterTurnRuntimeState, ensureAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState, turnRuntimeSessions } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import {
  MONK_OPEN_HAND_CLASS_ID,
  OPEN_HAND_WHOLENESS_OF_BODY_FEATURE_ID,
  OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID,
  compileOpenHandWholenessOfBody,
  monkMartialArtsDieSides,
  monkOpenHandRuntimeResourceDefinitions,
  resolveOpenHandWholenessOfBody,
} from "../domain/monkOpenHand";
import { resolvePendingResolution } from "../domain/resolution";
import { MONK_OPEN_HAND_SUBCLASS_ID } from "../domain/srdSubclassCatalog";

export const OPEN_HAND_WHOLENESS_ACTION_ID="action.monk.open-hand.wholeness-of-body";
type DicePrototype={d20(actionId:string,index?:number):number};
interface AdapterState {role:AppRole;sessionMode:SessionMode;scene:SceneVm;activeCharacter:CharacterSheet;resolution:ResolutionView|null;activity:ActivityEntry[];lastResolutionId:string|null;lastBefore:unknown;syncChar():void;getSnapshot():Promise<AppSnapshot>}
const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousResolveAction=MockAdapter.prototype.resolveAction;

function monkLevel(sheet:CharacterSheet){return sheet.classLevels?.find((entry)=>entry.classId===MONK_OPEN_HAND_CLASS_ID)?.level??0;}
function qualifies(sheet:CharacterSheet){return monkLevel(sheet)>=6&&sheet.subclassIds?.[MONK_OPEN_HAND_CLASS_ID]===MONK_OPEN_HAND_SUBCLASS_ID;}
function ensureResource(sheet:CharacterSheet){
  if(!qualifies(sheet))return;
  const definition=monkOpenHandRuntimeResourceDefinitions(sheet.classLevels??[],sheet.subclassIds??{},sheet.abilities.wis).find((entry)=>entry.resourceId===OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID);
  if(!definition)return;
  const existing=sheet.resources.find((entry)=>entry.id===definition.resourceId);
  if(existing){existing.label=definition.label;existing.max=definition.maximum;existing.current=Math.min(existing.current,definition.maximum);existing.source=definition.source;existing.recovery={...(existing.recovery??{}),...definition.recovery};return;}
  sheet.resources.push({id:definition.resourceId,label:definition.label,current:definition.maximum,max:definition.maximum,source:definition.source,recovery:{...definition.recovery}});
}
function actionFor(sheet:CharacterSheet,scene:SceneVm,sessionMode:SessionMode):ActionVm|undefined{
  if(!qualifies(sheet))return;
  const resource=sheet.resources.find((entry)=>entry.id===OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID);if(!resource)return;
  const bonusAvailable=sessionMode!=="initiative"||(scene.economyByActor[sheet.id]?.bonusAction??false);
  const available=bonusAvailable&&resource.current>0;const die=monkMartialArtsDieSides(monkLevel(sheet));const wisdom=Math.floor((sheet.abilities.wis-10)/2);
  return {id:OPEN_HAND_WHOLENESS_ACTION_ID,actorId:sheet.id,name:"신체 완성",category:"basic",target:"self",economy:"추가 행동",resolutionKind:"healing",summary:`1d${die}${wisdom>=0?"+":""}${wisdom} HP · ${resource.current}/${resource.max}`,available,disabledReason:!bonusAvailable?"추가 행동을 이미 사용했습니다.":resource.current<1?"신체 완성 사용 횟수가 없습니다.":undefined,eligibleTargetIds:[sheet.id],healing:{dice:`1d${die}`,flat:wisdom,average:Math.max(0,Math.ceil(die/2)+wisdom)},resourceCost:{resourceId:resource.id,amount:1},details:[{label:"효과",value:`1d${die} + 지혜 수정치 HP 회복`},{label:"비용",value:"추가 행동 1 · 신체 완성 1회"},{label:"출처",value:"SRD 5.2.1 · Monk · Warrior of the Open Hand · Wholeness of Body",source:OPEN_HAND_WHOLENESS_OF_BODY_FEATURE_ID}]};
}
function project(scene:SceneVm,action:ActionVm|undefined){
  for(const actorId of Object.keys(scene.actionsByActor))scene.actionsByActor[actorId]=(scene.actionsByActor[actorId]??[]).filter((entry)=>entry.id!==OPEN_HAND_WHOLENESS_ACTION_ID);
  if(action)scene.actionsByActor[action.actorId]=[...(scene.actionsByActor[action.actorId]??[]),structuredClone(action)];
}
function seedResource(adapter:MockAdapter,internal:AdapterState){
  let state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);if(!state){ensureAdapterTurnRuntimeState(adapter,internal.scene);state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);}
  const combatant=state?.combatants[internal.activeCharacter.id];const resource=internal.activeCharacter.resources.find((entry)=>entry.id===OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID);
  if(!state||!combatant||!resource||combatant.resources.some((entry)=>entry.id===resource.id))return state;
  combatant.resources.push({id:resource.id,label:resource.label,current:resource.current,maximum:resource.max,recovery:resource.recovery?structuredClone(resource.recovery):undefined});const expected=state.revision;state.revision+=1;
  return commitAdapterTurnRuntimeState(adapter,internal.scene,expected,state)?snapshotAdapterTurnRuntimeState(adapter,internal.scene):undefined;
}
function rollDie(adapter:MockAdapter,actionId:string,sides:number){const limit=Math.floor(20/sides)*sides;let face:number;let attempt=0;do{face=(MockAdapter.prototype as unknown as DicePrototype).d20.call(adapter,actionId,attempt++);}while(face>limit);return ((face-1)%sides)+1;}
function resolveWholeness(state:Parameters<typeof resolveOpenHandWholenessOfBody>[1],request:Parameters<typeof resolveOpenHandWholenessOfBody>[2],useBonusActionEconomy:boolean){
  if(useBonusActionEconomy)return resolveOpenHandWholenessOfBody(SIMPLEVTT_APP_RULES_PROFILE,state,request);
  try{
    const pending=compileOpenHandWholenessOfBody(request);
    return resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state,{...pending,operations:pending.operations.filter((operation)=>!(operation.kind==="use-economy"&&operation.actorId===request.actorId&&operation.slot==="bonus-action"))});
  }catch(error){return {status:"rejected" as const,state,events:[],results:{},error:error instanceof Error?error.message:String(error)};}
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithOpenHandWholeness(){
  const internal=this as unknown as AdapterState;ensureResource(internal.activeCharacter);const snapshot=await previousGetSnapshot.call(this);ensureResource(snapshot.activeCharacter);const action=actionFor(snapshot.activeCharacter,snapshot.scene,internal.sessionMode);project(internal.scene,action);project(snapshot.scene,action);return snapshot;
};

MockAdapter.prototype.resolveAction=async function resolveOpenHandWholenessAction(actionId:string,targetIds:string[]){
  if(actionId!==OPEN_HAND_WHOLENESS_ACTION_ID)return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as AdapterState;const snapshot=await internal.getSnapshot();const source=snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id===actionId);const actor=internal.scene.entities.find((entry)=>entry.id===snapshot.activeCharacter.id);
  if(!source?.available||!actor||targetIds.length!==1||targetIds[0]!==actor.id)return snapshot;if(internal.sessionMode==="initiative"&&internal.role==="player"&&actor.id!==internal.scene.currentActorId)return snapshot;
  const level=monkLevel(internal.activeCharacter);const state=seedResource(this,internal);if(!state||!state.combatants[actor.id])return snapshot;const die=monkMartialArtsDieSides(level);const face=rollDie(this,actionId,die);const wisdomModifier=Math.floor((internal.activeCharacter.abilities.wis-10)/2);const resolutionId=`monk.open-hand.wholeness.${Date.now()}.${Math.floor(Math.random()*1000)}`;const beforeHp=actor.hp;
  const request={id:resolutionId,actorId:actor.id,expectedRevision:state.revision,monkLevel:level,subclassId:internal.activeCharacter.subclassIds?.[MONK_OPEN_HAND_CLASS_ID],wisdomModifier,martialArtsDieFace:face};
  const committed=resolveWholeness(state,request,internal.sessionMode==="initiative");if(committed.status==="rejected")return snapshot;
  const projected=applyResolutionEvents(internal.scene,committed.events,internal.activeCharacter.resources,internal.activeCharacter.items,state);if(projected.status==="rejected")return snapshot;const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");if(writeBack.status==="rejected")return snapshot;if(!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state)){if(writeBack.changed)await persistCharacterResolutionEvents(this,committed.events,"inverse");return snapshot;}
  internal.scene=projected.scene;internal.activeCharacter.resources=projected.resources;const session=turnRuntimeSessions.get(this);if(session)projectTurnRuntimeToScene(session,internal.scene);const after=internal.scene.entities.find((entry)=>entry.id===actor.id)!;const healed=Math.max(0,after.hp-beforeHp);const outcome=`${healed} HP 회복`;
  const resolution:ResolutionView={id:resolutionId,actorId:actor.id,targetIds:[actor.id],actionId,actionName:"신체 완성",rollKind:"healing",stage:"complete",authoritativeDice:[face],rollTotal:face+wisdomModifier,saveResults:[],damageComponents:[],compact:`${actor.name} · ${outcome}`,detail:[`신체 완성 ${face}+${wisdomModifier}`],provenance:["SRD 5.2.1 · Monk · Warrior of the Open Hand · Wholeness of Body"],calculatedOutcome:outcome,finalOutcome:outcome,stateChanges:projected.stateChanges,adjudicated:false,canAdvance:false};
  internal.resolution=resolution;internal.activity.unshift(projectResolutionEventsToActivity({resolution,events:committed.events,actorName:actor.name,targetNames:[actor.name]}));internal.lastResolutionId=resolutionId;internal.lastBefore=null;recordRuntimeResolutionEvents(this,resolutionId,committed.events);internal.syncChar();return internal.getSnapshot();
};
