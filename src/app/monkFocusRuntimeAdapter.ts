import "./progressionContracts";
import type { ActionVm, AppSnapshot, CharacterSheet, ResolutionView, SceneEntity, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { clearRuntimeResolutionEventHistory } from "./runtimeResolutionEventHistory";
import { MONK_FOCUS_RESOURCE_ID, MONK_OPEN_HAND_CLASS_ID, STEP_OF_THE_WIND_SOURCE_ID } from "../domain/monkOpenHand";

const FLURRY_ACTION_ID="action.monk.flurry-of-blows";
const PATIENT_ACTION_ID="action.monk.patient-defense";
const PATIENT_FOCUS_ACTION_ID="action.monk.patient-defense.focus";
const STEP_ACTION_ID="action.monk.step-of-the-wind";
const STEP_FOCUS_ACTION_ID="action.monk.step-of-the-wind.focus";
const FLURRY_SOURCE_ID="dnd.srd521.feature.monk.flurry-of-blows";
const PATIENT_SOURCE_ID="dnd.srd521.feature.monk.patient-defense";
const MONK_ACTION_IDS=new Set([FLURRY_ACTION_ID,PATIENT_ACTION_ID,PATIENT_FOCUS_ACTION_ID,STEP_ACTION_ID,STEP_FOCUS_ACTION_ID]);

type AdapterState={
  sessionMode:SessionMode;
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  resolution:ResolutionView|null;
  getSnapshot():Promise<AppSnapshot>;
};

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;

function monkLevel(character:CharacterSheet) {
  return character.classLevels?.find((entry)=>entry.classId===MONK_OPEN_HAND_CLASS_ID)?.level??0;
}

function detail(label:string,value:string,source?:string) {
  return {label,value,...(source?{source}:{})};
}

function monkActions(internal:AdapterState,snapshot:AppSnapshot):ActionVm[] {
  const character=snapshot.activeCharacter;
  if(monkLevel(character)<2)return [];
  const focus=character.resources.find((entry)=>entry.id===MONK_FOCUS_RESOURCE_ID);
  if(!focus)return [];
  const bonusAvailable=internal.sessionMode!=="initiative"||(snapshot.scene.economyByActor[character.id]?.bonusAction??false);
  const focusAvailable=focus.current>0;
  const baseDisabled=!bonusAvailable?"추가 행동을 이미 사용했습니다.":undefined;
  const focusDisabled=!focusAvailable?"기 점수가 없습니다.":baseDisabled;
  const self=[character.id];
  return [
    {
      id:FLURRY_ACTION_ID,actorId:character.id,name:"연타",category:"basic",target:"self",economy:"추가 행동",resolutionKind:"no-roll",
      summary:`맨손 타격 2회 · 기 ${focus.current}/${focus.max}`,available:bonusAvailable&&focusAvailable,disabledReason:focusDisabled,eligibleTargetIds:self,
      resourceCost:{resourceId:focus.id,amount:1},
      details:[detail("효과","맨손 타격 2회를 추가로 사용할 수 있음"),detail("비용","추가 행동 1 · 기 1"),detail("출처","SRD 5.2.1 · Monk · Flurry of Blows",FLURRY_SOURCE_ID)],
    },
    {
      id:PATIENT_ACTION_ID,actorId:character.id,name:"인내의 방어 · 이탈",category:"basic",target:"self",economy:"추가 행동",resolutionKind:"no-roll",
      summary:"이탈",available:bonusAvailable,disabledReason:baseDisabled,eligibleTargetIds:self,
      details:[detail("효과","이번 턴 이동이 기회 공격을 유발하지 않음"),detail("비용","추가 행동 1"),detail("출처","SRD 5.2.1 · Monk · Patient Defense",PATIENT_SOURCE_ID)],
    },
    {
      id:PATIENT_FOCUS_ACTION_ID,actorId:character.id,name:"인내의 방어 · 집중",category:"basic",target:"self",economy:"추가 행동",resolutionKind:"no-roll",
      summary:`이탈 + 회피 · 기 ${focus.current}/${focus.max}`,available:bonusAvailable&&focusAvailable,disabledReason:focusDisabled,eligibleTargetIds:self,
      resourceCost:{resourceId:focus.id,amount:1},
      details:[detail("효과","이탈 + 다음 턴 시작까지 회피"),detail("비용","추가 행동 1 · 기 1"),detail("출처","SRD 5.2.1 · Monk · Patient Defense",PATIENT_SOURCE_ID)],
    },
    {
      id:STEP_ACTION_ID,actorId:character.id,name:"바람의 걸음 · 질주",category:"basic",target:"self",economy:"추가 행동",resolutionKind:"no-roll",
      summary:`이동 가능량 +${character.speed}피트`,available:bonusAvailable,disabledReason:baseDisabled,eligibleTargetIds:self,
      details:[detail("효과",`질주 · 이동 가능량 +${character.speed}피트`),detail("비용","추가 행동 1"),detail("출처","SRD 5.2.1 · Monk · Step of the Wind",STEP_OF_THE_WIND_SOURCE_ID)],
    },
    {
      id:STEP_FOCUS_ACTION_ID,actorId:character.id,name:"바람의 걸음 · 집중",category:"basic",target:"self",economy:"추가 행동",resolutionKind:"no-roll",
      summary:`질주 + 이탈 + 도약 거리 2배 · 기 ${focus.current}/${focus.max}`,available:bonusAvailable&&focusAvailable,disabledReason:focusDisabled,eligibleTargetIds:self,
      resourceCost:{resourceId:focus.id,amount:1},
      details:[detail("효과",`질주 + 이탈 · 이동 가능량 +${character.speed}피트 · 도약 거리 2배`),detail("비용","추가 행동 1 · 기 1"),detail("출처","SRD 5.2.1 · Monk · Step of the Wind",STEP_OF_THE_WIND_SOURCE_ID)],
    },
  ];
}

function hasFlurryGrant(scene:SceneVm,actorId:string) {
  return scene.economyByActor[actorId]?.extraAttacks?.some((entry)=>entry.source===FLURRY_SOURCE_ID)??false;
}

function projectActions(scene:SceneVm,actorId:string,actions:ActionVm[]) {
  const current=(scene.actionsByActor[actorId]??[]).filter((entry)=>!MONK_ACTION_IDS.has(entry.id));
  if(hasFlurryGrant(scene,actorId)) {
    for(const action of current) {
      if(action.economy==="행동"&&action.resolutionKind==="attack"&&!action.id.startsWith("action.unarmed-strike.")) {
        action.available=false;
        action.disabledReason="연타의 남은 맨손 타격을 먼저 사용해야 합니다.";
      }
    }
  }
  scene.actionsByActor[actorId]=[...current,...actions.map((action)=>structuredClone(action))];
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithMonkFocusActions(){
  const internal=this as unknown as AdapterState;
  const snapshot=await previousGetSnapshot.call(this);
  const actorId=snapshot.activeCharacter.id;
  const actions=monkActions(internal,snapshot);
  projectActions(internal.scene,actorId,actions);
  projectActions(snapshot.scene,actorId,actions);
  return snapshot;
};

function addStatus(entity:SceneEntity|undefined,status:string,resolution:ResolutionView) {
  if(!entity||entity.status.includes(status))return;
  entity.status.push(status);
  resolution.stateChanges.push(`${entity.name} 상태 추가: ${status}`);
}

MockAdapter.prototype.advanceResolution=async function advanceMonkFocusResolution(){
  const internal=this as unknown as AdapterState;
  const resolution=internal.resolution;
  if(!resolution||resolution.stage!=="effect-preview"||!MONK_ACTION_IDS.has(resolution.actionId)) return previousAdvanceResolution.call(this);
  const actor=internal.scene.entities.find((entry)=>entry.id===resolution.actorId);
  const economy=internal.scene.economyByActor[resolution.actorId];

  if(resolution.actionId===FLURRY_ACTION_ID&&internal.sessionMode==="initiative"&&economy) {
    const grants=economy.extraAttacks??[];
    economy.extraAttacks=[...grants,
      {id:`${resolution.id}:flurry:1`,source:FLURRY_SOURCE_ID},
      {id:`${resolution.id}:flurry:2`,source:FLURRY_SOURCE_ID},
    ];
    resolution.stateChanges.push("연타 맨손 타격 2회 부여");
    resolution.finalOutcome="연타 준비 · 맨손 타격 2회";
  } else if(resolution.actionId===PATIENT_ACTION_ID) {
    addStatus(actor,"이탈",resolution);
    resolution.finalOutcome="이탈 적용";
  } else if(resolution.actionId===PATIENT_FOCUS_ACTION_ID) {
    addStatus(actor,"이탈",resolution);
    addStatus(actor,"회피",resolution);
    resolution.finalOutcome="이탈 + 회피 적용";
  } else if((resolution.actionId===STEP_ACTION_ID||resolution.actionId===STEP_FOCUS_ACTION_ID)&&economy) {
    const before=economy.movementMax;
    economy.movementMax+=internal.activeCharacter.speed;
    economy.movement+=internal.activeCharacter.speed;
    resolution.stateChanges.push(`이동 가능량 ${before} → ${economy.movementMax}`);
    if(resolution.actionId===STEP_FOCUS_ACTION_ID) addStatus(actor,"이탈",resolution);
    resolution.finalOutcome=resolution.actionId===STEP_FOCUS_ACTION_ID?"질주 + 이탈 + 도약 거리 2배":"질주 적용";
  }
  const snapshot=await previousAdvanceResolution.call(this);
  if(snapshot.resolution?.id===resolution.id&&snapshot.resolution.stage==="complete") {
    clearRuntimeResolutionEventHistory(this);
  }
  return snapshot;
};
