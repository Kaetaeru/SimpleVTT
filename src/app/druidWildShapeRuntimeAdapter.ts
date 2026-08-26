import "./druidWildShapeContracts";
import "./progressionContracts";
import "./spellcastingRuntimeContracts";
import type { ActionVm, ActivityEntry, AppSnapshot, CharacterSheet, ResolutionView, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { projectTurnRuntimeToScene } from "./realTurnRuntimeService";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { commitAdapterTurnRuntimeState, ensureAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState, turnRuntimeSessions } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { DRUID_ID, DRUID_WILD_SHAPE_RESOURCE_ID } from "../domain/coreClassResources";
import {
  DRUID_WILD_SHAPE_TAG,
  druidWildShapeFormLimits,
  resolveDruidWildShapeEnd,
  resolveDruidWildShapeStart,
  type DruidWildShapeForm,
} from "../domain/druidWildShape";
import type { TemporaryHpChoice } from "../domain/temporaryHp";

const ACTION_PREFIX="action.druid.wild-shape.form.";
const END_ACTION_ID="action.druid.wild-shape.end";

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

interface StartActionDescriptor {
  action:ActionVm;
  form:DruidWildShapeForm;
  temporaryHpChoice?:TemporaryHpChoice;
}

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousResolveAction=MockAdapter.prototype.resolveAction;

function druidLevel(character:CharacterSheet) {
  return character.classLevels?.find((entry)=>entry.classId===DRUID_ID)?.level??0;
}

function activeWildShape(adapter:MockAdapter,internal:AdapterState) {
  return snapshotAdapterTurnRuntimeState(adapter,internal.scene)?.effects.find(
    (effect)=>effect.targetId===internal.activeCharacter.id&&effect.tags.includes(DRUID_WILD_SHAPE_TAG),
  );
}

function seedWildShapeResource(adapter:MockAdapter,internal:AdapterState) {
  let state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  if(!state){
    ensureAdapterTurnRuntimeState(adapter,internal.scene);
    state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  }
  const combatant=state?.combatants[internal.activeCharacter.id];
  const resource=internal.activeCharacter.resources.find((entry)=>entry.id===DRUID_WILD_SHAPE_RESOURCE_ID);
  if(!state||!combatant||!resource)return state;
  if(combatant.resources.some((entry)=>entry.id===resource.id))return state;
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

function formDisabledReason(level:number,form:DruidWildShapeForm) {
  const limits=druidWildShapeFormLimits(level);
  if(level<2)return "드루이드 2레벨부터 야생 변신을 사용할 수 있습니다.";
  if(form.challengeRating>limits.maximumChallengeRating)return `현재 최대 CR은 ${limits.maximumChallengeRating}입니다.`;
  if(form.hasFlySpeed&&!limits.flightAllowed)return "드루이드 8레벨 전에는 비행 이동 속도가 있는 형태를 사용할 수 없습니다.";
  return undefined;
}

function actionId(form:DruidWildShapeForm,choice?:TemporaryHpChoice) {
  return `${ACTION_PREFIX}${encodeURIComponent(form.id)}${choice?`.${choice}`:""}`;
}

function startActionDescriptors(adapter:MockAdapter,internal:AdapterState,snapshot:AppSnapshot):StartActionDescriptor[] {
  const character=snapshot.activeCharacter;
  const level=druidLevel(character);
  if(level<2)return [];
  const forms=character.wildShapeKnownForms??[];
  if(!forms.length)return [];
  const resource=character.resources.find((entry)=>entry.id===DRUID_WILD_SHAPE_RESOURCE_ID);
  if(!resource)return [];
  const bonusAvailable=internal.sessionMode!=="initiative"||(snapshot.scene.economyByActor[character.id]?.bonusAction??false);
  const currentTempHp=snapshot.scene.entities.find((entry)=>entry.id===character.id)?.tempHp??character.tempHp;
  const choices:TemporaryHpChoice[]|undefined=currentTempHp>0?["keep-existing","take-new"]:undefined;
  const descriptors:StartActionDescriptor[]=[];
  for(const form of forms) {
    for(const choice of choices??[undefined]) {
      const formReason=formDisabledReason(level,form);
      const available=resource.current>0&&bonusAvailable&&!formReason;
      const disabledReason=resource.current<=0?"야생 변신 사용 횟수가 없습니다."
        :!bonusAvailable?"추가 행동을 이미 사용했습니다."
          :formReason;
      const choiceLabel=choice==="keep-existing"?" · 기존 임시 HP 유지":choice==="take-new"?" · 새 임시 HP 사용":"";
      descriptors.push({
        form,
        temporaryHpChoice:choice,
        action:{
          id:actionId(form,choice),
          actorId:character.id,
          name:`야생 변신 · ${form.name}${choiceLabel}`,
          category:"basic",
          target:"self",
          economy:"추가 행동",
          resolutionKind:"no-roll",
          summary:`${form.name} 형태 · CR ${form.challengeRating} · 임시 HP ${level}`,
          available,
          disabledReason,
          eligibleTargetIds:[character.id],
          resourceCost:{resourceId:resource.id,amount:1},
          details:[
            {label:"형태",value:`${form.name} · AC ${form.armorClass} · 이동 ${form.speedFeet}ft`},
            {label:"지속",value:`최대 ${level/2}시간`},
            {label:"비용",value:"추가 행동 1 · 야생 변신 1회"},
            {label:"임시 HP",value:choice==="keep-existing"?`현재 ${currentTempHp} 유지`:choice==="take-new"?`드루이드 레벨 ${level} 사용`:`드루이드 레벨 ${level}`},
            {label:"출처",value:"SRD 5.2.1 · Druid Wild Shape"},
          ],
        },
      });
    }
  }
  return descriptors;
}

function endAction(adapter:MockAdapter,internal:AdapterState,snapshot:AppSnapshot):ActionVm|undefined {
  const marker=activeWildShape(adapter,internal);
  if(!marker)return undefined;
  const bonusAvailable=internal.sessionMode!=="initiative"||(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction??false);
  return {
    id:END_ACTION_ID,
    actorId:snapshot.activeCharacter.id,
    name:"야생 변신 해제",
    category:"basic",
    target:"self",
    economy:"추가 행동",
    resolutionKind:"no-roll",
    summary:`${String(marker.metadata?.formName??"야생 형태")} 해제`,
    available:bonusAvailable,
    disabledReason:bonusAvailable?undefined:"추가 행동을 이미 사용했습니다.",
    eligibleTargetIds:[snapshot.activeCharacter.id],
    details:[
      {label:"효과",value:"현재 야생 변신 형태를 끝냅니다."},
      {label:"비용",value:"추가 행동 1"},
      {label:"출처",value:"SRD 5.2.1 · Druid Wild Shape"},
    ],
  };
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithDruidWildShapeActions(){
  const internal=this as unknown as AdapterState;
  const snapshot=await previousGetSnapshot.call(this);
  const actions=snapshot.scene.actionsByActor[snapshot.activeCharacter.id];
  if(!actions)return snapshot;
  for(let index=actions.length-1;index>=0;index--) {
    if(actions[index].id.startsWith("action.druid.wild-shape."))actions.splice(index,1);
  }
  for(const descriptor of startActionDescriptors(this,internal,snapshot))actions.push(descriptor.action);
  const end=endAction(this,internal,snapshot);
  if(end)actions.push(end);
  const marker=activeWildShape(this,internal);
  if(marker&&marker.metadata?.spellcastingAllowed!==true) {
    for(const action of actions) {
      if(!action.spellCast)continue;
      action.available=false;
      action.disabledReason="야생 변신 중에는 주문을 시전할 수 없습니다.";
    }
  }
  return snapshot;
};

MockAdapter.prototype.resolveAction=async function resolveDruidWildShapeFromHotbar(actionIdValue:string,targetIds:string[]){
  if(!actionIdValue.startsWith("action.druid.wild-shape."))return previousResolveAction.call(this,actionIdValue,targetIds);
  const internal=this as unknown as AdapterState;
  const snapshot=await internal.getSnapshot();
  const actor=internal.activeCharacter;
  const level=druidLevel(actor);
  if(level<2||targetIds.length!==1||targetIds[0]!==actor.id)return snapshot;
  const end=endAction(this,internal,snapshot);
  const starts=startActionDescriptors(this,internal,snapshot);
  const start=starts.find((entry)=>entry.action.id===actionIdValue);
  const action=actionIdValue===END_ACTION_ID?end:start?.action;
  if(!action?.available)return snapshot;
  const state=actionIdValue===END_ACTION_ID
    ?snapshotAdapterTurnRuntimeState(this,internal.scene)
    :seedWildShapeResource(this,internal);
  if(!state?.combatants[actor.id])return snapshot;
  const ending=actionIdValue===END_ACTION_ID;
  const endingFormName=ending?String(activeWildShape(this,internal)?.metadata?.formName??"야생 형태"):undefined;
  const resolutionId=`druid.wild-shape.${ending?"end":"start"}.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const committed=ending
    ?resolveDruidWildShapeEnd(SIMPLEVTT_APP_RULES_PROFILE,state,{
      id:resolutionId,
      actorId:actor.id,
      expectedRevision:state.revision,
      useBonusActionEconomy:internal.sessionMode==="initiative",
    })
    :resolveDruidWildShapeStart(SIMPLEVTT_APP_RULES_PROFILE,state,{
      id:resolutionId,
      actorId:actor.id,
      expectedRevision:state.revision,
      druidLevel:level,
      form:start!.form,
      temporaryHpChoice:start!.temporaryHpChoice,
      useBonusActionEconomy:internal.sessionMode==="initiative",
    });
  if(committed.status==="rejected")return snapshot;
  const projected=applyResolutionEvents(internal.scene,committed.events,actor.resources,actor.items,state);
  if(projected.status==="rejected")return snapshot;
  const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");
  if(writeBack.status==="rejected")return snapshot;
  if(!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state)) {
    if(writeBack.changed)await persistCharacterResolutionEvents(this,committed.events,"inverse");
    return snapshot;
  }
  internal.scene=projected.scene;
  internal.activeCharacter.resources=projected.resources;
  const projectedActor=projected.scene.entities.find((entry)=>entry.id===actor.id);
  if(projectedActor)internal.activeCharacter.tempHp=projectedActor.tempHp;
  const session=turnRuntimeSessions.get(this);
  if(session)projectTurnRuntimeToScene(session,internal.scene);
  const formName=ending?endingFormName!:start!.form.name;
  const outcome=ending?`야생 변신 해제 · ${formName}`:`야생 변신 · ${formName}`;
  const resolution:ResolutionView={
    id:resolutionId,
    actorId:actor.id,
    targetIds:[actor.id],
    actionId:actionIdValue,
    actionName:ending?"야생 변신 해제":`야생 변신 · ${start!.form.name}`,
    rollKind:"effect",
    stage:"complete",
    authoritativeDice:[],
    saveResults:[],
    damageComponents:[],
    compact:outcome,
    detail:[ending?`${formName} 형태 종료`:`${start!.form.name} 형태 · 임시 HP ${level}`],
    provenance:["SRD 5.2.1 · Druid Wild Shape"],
    calculatedOutcome:outcome,
    finalOutcome:outcome,
    stateChanges:projected.stateChanges,
    adjudicated:false,
    canAdvance:false,
  };
  internal.resolution=resolution;
  internal.activity.unshift(projectResolutionEventsToActivity({
    resolution,
    events:committed.events,
    actorName:actor.name,
    targetNames:[actor.name],
  }));
  internal.lastResolutionId=resolutionId;
  internal.lastBefore=null;
  recordRuntimeResolutionEvents(this,resolutionId,committed.events);
  internal.syncChar();
  return internal.getSnapshot();
};
