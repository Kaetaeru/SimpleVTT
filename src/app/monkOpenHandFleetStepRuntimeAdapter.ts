import type { ActionVm, AppSnapshot, CharacterSheet, ResolutionView, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import {
  MONK_FOCUS_RESOURCE_ID,
  MONK_OPEN_HAND_CLASS_ID,
  OPEN_HAND_FLEET_STEP_FEATURE_ID,
  OPEN_HAND_FLEET_STEP_JUMP_TAG,
  STEP_OF_THE_WIND_SOURCE_ID,
} from "../domain/monkOpenHand";
import { MONK_OPEN_HAND_SUBCLASS_ID } from "../domain/srdSubclassCatalog";

export const OPEN_HAND_FLEET_STEP_ACTION_ID="action.monk.open-hand.fleet-step";
export const OPEN_HAND_FLEET_STEP_FOCUS_ACTION_ID="action.monk.open-hand.fleet-step.focus";
const FLEET_STEP_ACTION_IDS=new Set([OPEN_HAND_FLEET_STEP_ACTION_ID,OPEN_HAND_FLEET_STEP_FOCUS_ACTION_ID]);

type FleetTrigger={actorId:string;resolutionId:string;sourceId:string};
interface AdapterState {
  sessionMode:SessionMode;
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  resolution:ResolutionView|null;
  getSnapshot():Promise<AppSnapshot>;
}

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousResolveAction=MockAdapter.prototype.resolveAction;
const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const triggers=new WeakMap<MockAdapter,FleetTrigger>();

function monkLevel(sheet:CharacterSheet){return sheet.classLevels?.find((entry)=>entry.classId===MONK_OPEN_HAND_CLASS_ID)?.level??0;}
function qualifies(sheet:CharacterSheet){return monkLevel(sheet)>=11&&sheet.subclassIds?.[MONK_OPEN_HAND_CLASS_ID]===MONK_OPEN_HAND_SUBCLASS_ID;}
function actionFor(scene:SceneVm,actorId:string,actionId:string){return scene.actionsByActor[actorId]?.find((entry)=>entry.id===actionId);}
function sourceFor(action:ActionVm|undefined){return action?.details.find((entry)=>entry.label==="출처"&&entry.source)?.source??action?.id;}

function validTrigger(adapter:MockAdapter,internal:AdapterState,trigger:FleetTrigger|undefined){
  if(!trigger||internal.sessionMode!=="initiative"||!qualifies(internal.activeCharacter))return false;
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);const actorId=internal.activeCharacter.id;
  if(trigger.actorId!==actorId||!state||state.clock.activeActorId!==actorId)return false;
  const actorHistory=state.history.filter((entry)=>entry.actorId===actorId);const latest=actorHistory[actorHistory.length-1];
  return Boolean(latest?.resolutionId===trigger.resolutionId&&actorHistory.some((entry)=>entry.resolutionId===trigger.resolutionId&&entry.kind==="use-economy"&&entry.summary.includes("spends bonus-action"))&&trigger.sourceId!==STEP_OF_THE_WIND_SOURCE_ID);
}

function rememberTrigger(adapter:MockAdapter,internal:AdapterState){
  const resolution=internal.resolution;if(!resolution||resolution.stage!=="complete"||resolution.actorId!==internal.activeCharacter.id||FLEET_STEP_ACTION_IDS.has(resolution.actionId)){return;}
  const action=actionFor(internal.scene,resolution.actorId,resolution.actionId);const sourceId=sourceFor(action);const candidate=sourceId?{actorId:resolution.actorId,resolutionId:resolution.id,sourceId}:undefined;
  if(candidate&&validTrigger(adapter,internal,candidate))triggers.set(adapter,candidate);else if(triggers.get(adapter)?.actorId===resolution.actorId)triggers.delete(adapter);
}

function actions(adapter:MockAdapter,internal:AdapterState,snapshot:AppSnapshot):ActionVm[]{
  const trigger=triggers.get(adapter);if(!trigger||trigger.actorId!==snapshot.activeCharacter.id)return[];if(!validTrigger(adapter,internal,trigger)){triggers.delete(adapter);return [];}
  const sheet=snapshot.activeCharacter;const focus=sheet.resources.find((entry)=>entry.id===MONK_FOCUS_RESOURCE_ID);const distance=sheet.speed;const self=[sheet.id];
  return [
    {id:OPEN_HAND_FLEET_STEP_ACTION_ID,actorId:sheet.id,name:"날랜 발걸음 · 질주",category:"basic",target:"self",economy:"없음",resolutionKind:"no-roll",summary:`즉시 ${distance}피트 추가 이동`,available:true,eligibleTargetIds:self,runtimeGrantedMovement:{distanceFeet:distance,maximumDistanceFeet:distance},details:[{label:"효과",value:`직전 추가 행동 후 최대 ${distance}피트 추가 이동`},{label:"비용",value:"없음"},{label:"출처",value:"SRD 5.2.1 · Monk · Warrior of the Open Hand · Fleet Step",source:OPEN_HAND_FLEET_STEP_FEATURE_ID}]},
    {id:OPEN_HAND_FLEET_STEP_FOCUS_ACTION_ID,actorId:sheet.id,name:"날랜 발걸음 · 집중",category:"basic",target:"self",economy:"없음",resolutionKind:"no-roll",summary:`${distance}피트 추가 이동 · 기 ${focus?.current??0}/${focus?.max??0}`,available:Boolean(focus&&focus.current>0),disabledReason:focus&&focus.current>0?undefined:"기 점수가 없습니다.",eligibleTargetIds:self,resourceCost:focus?{resourceId:focus.id,amount:1}:undefined,runtimeGrantedMovement:{distanceFeet:distance,maximumDistanceFeet:distance,doesNotProvokeOpportunityAttacks:true},runtimeEffectGrant:{tags:[OPEN_HAND_FLEET_STEP_JUMP_TAG],duration:{kind:"until-turn-boundary",actorId:sheet.id,round:snapshot.scene.round,boundary:"end"},metadata:{jumpDistanceMultiplier:2,publicLabel:"날랜 발걸음 · 도약 거리 2배"}},details:[{label:"효과",value:`최대 ${distance}피트 추가 이동 · 기회 공격 유발 안 함 · 도약 거리 2배`},{label:"비용",value:"기 1"},{label:"출처",value:"SRD 5.2.1 · Monk · Warrior of the Open Hand · Fleet Step",source:OPEN_HAND_FLEET_STEP_FEATURE_ID}]},
  ];
}

function project(scene:SceneVm,actorId:string,projected:ActionVm[]){
  const current=(scene.actionsByActor[actorId]??[]).filter((entry)=>!FLEET_STEP_ACTION_IDS.has(entry.id));scene.actionsByActor[actorId]=[...current,...projected.map((entry)=>structuredClone(entry))];
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithOpenHandFleetStep(){
  const internal=this as unknown as AdapterState;const snapshot=await previousGetSnapshot.call(this);const actorId=snapshot.activeCharacter.id;const projected=actions(this,internal,snapshot);project(internal.scene,actorId,projected);project(snapshot.scene,actorId,projected);return snapshot;
};

MockAdapter.prototype.resolveAction=async function trackOpenHandFleetStepTrigger(actionId:string,targetIds:string[]){
  const internal=this as unknown as AdapterState;
  const snapshot=await previousResolveAction.call(this,actionId,targetIds);
  rememberTrigger(this,internal);
  return snapshot;
};
MockAdapter.prototype.advanceResolution=async function advanceWithOpenHandFleetStepTrigger(){const snapshot=await previousAdvanceResolution.call(this);rememberTrigger(this,this as unknown as AdapterState);return this.getSnapshot();};
