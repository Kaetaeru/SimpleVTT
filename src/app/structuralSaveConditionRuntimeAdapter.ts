import type { AbilityKey, ActionVm, ActivityEntry, AppRole, AppSnapshot, CharacterSheet, CombatantDefinitionVm, ResolutionView, SceneEntity, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { makeRefusal } from "./sessionRefusal";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { resolveRuntimeSaveModifier } from "./realRuntimeStatProvider";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { projectTurnRuntimeToScene } from "./realTurnRuntimeService";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState, turnRuntimeSessions } from "./turnRuntimeSessionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { resolvePendingResolution } from "../domain/resolution";
import type { D20TestResult } from "../domain/d20";
import { projectedCharacterById } from "./characterSessionProjectionRegistry";

type DicePrototype={d20(actionId:string,index?:number):number};
interface AdapterState {
  role:AppRole;sessionMode:SessionMode;scene:SceneVm;activeCharacter:CharacterSheet;combatantDefinitions:CombatantDefinitionVm[];
  resolution:ResolutionView|null;activity:ActivityEntry[];lastResolutionId:string|null;lastBefore:unknown;syncChar():void;getSnapshot():Promise<AppSnapshot>;
}
const previousResolveAction=MockAdapter.prototype.resolveAction;

function actorAction(scene:SceneVm,actionId:string) {
  for (const actorId of [scene.selectedActorId,scene.currentActorId,...Object.keys(scene.actionsByActor)]) {
    const action=scene.actionsByActor[actorId]?.find((entry)=>entry.id===actionId);
    if (action) return action;
  }
}

function saveFact(adapter:MockAdapter,internal:AdapterState,target:SceneEntity,abilities:AbilityKey[]) {
  const sheet=target.id===internal.activeCharacter.id?internal.activeCharacter:projectedCharacterById(adapter,target.id)?.sheet;
  const active=sheet??internal.activeCharacter;
  const candidates=abilities.map((ability)=>resolveRuntimeSaveModifier(target,active,ability,internal.combatantDefinitions));
  if (!candidates.length) throw new Error("runtimeSaveCondition requires at least one save ability");
  return candidates.reduce((best,candidate)=>candidate.modifier>best.modifier?candidate:best);
}

MockAdapter.prototype.resolveAction=async function resolveStructuralSaveCondition(actionId:string,targetIds:string[]) {
  const internal=this as unknown as AdapterState;
  const snapshot=await internal.getSnapshot();
  const action=actorAction(snapshot.scene,actionId);
  const control=action?.runtimeSaveCondition;
  if (!control||action?.runtimeCommonPlayActionId) return previousResolveAction.call(this,actionId,targetIds);
  const refuse=(code:string,message:string)=>{(internal as unknown as {refusal:unknown}).refusal=makeRefusal(code,message,{actionId,actorId:action?.actorId});return internal.getSnapshot();};
  if (control.choose!=="highest") return refuse("action-unsupported","지원하지 않는 내성 선택 방식입니다.");
  const targetId=targetIds[0];
  const target=internal.scene.entities.find((entry)=>entry.id===targetId);
  if (!action?.available) return refuse("action-unavailable",action?.disabledReason??"지금은 사용할 수 없는 행동입니다.");
  if (targetIds.length!==1) return refuse("too-many-targets","대상은 한 명입니다.");
  if (!action.eligibleTargetIds.includes(targetId)||!target) return refuse("target-ineligible","그 대상에게는 사용할 수 없습니다.");
  if (target.runtimeLife?.dead) return refuse("target-ineligible","죽은 대상입니다.");
  if (internal.sessionMode==="initiative"&&internal.role==="player"&&action.actorId!==internal.scene.currentActorId) return refuse("action-off-turn","현재 Actor의 턴이 아닙니다.");
  const state=snapshotAdapterTurnRuntimeState(this,internal.scene);
  if (!state?.combatants[action.actorId]||!state.combatants[targetId]) return refuse("runtime-missing","전투 상태에 없는 대상입니다.");
  let save;
  try { save=saveFact(this,internal,target,control.saveAbilities); }
  catch(error) { return refuse("save-unavailable",`대상의 내성을 계산할 수 없습니다 · ${error instanceof Error?error.message:String(error)}`); }
  const resolutionId=`structural-save-condition.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const rollId=`${resolutionId}:save`;
  const faces=[0,1].map((index)=>(MockAdapter.prototype as unknown as DicePrototype).d20.call(this,actionId,index));
  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state,{
    id:resolutionId,actorId:action.actorId,sourceId:actionId,expectedRevision:state.revision,
    operations:[
      ...(internal.sessionMode==="initiative"?[{id:`${resolutionId}:economy`,kind:"use-economy" as const,actorId:action.actorId,slot:"action" as const,actionKind:"attack" as const,attacksPerAction:action.attacksPerAction??1}]:[]),
      {id:rollId,kind:"d20",actorId:targetId,targetId:action.actorId,request:{family:"saving-throw",target:action.saveDc??8,targetSource:`${actionId}:save-dc`,modifierContributions:[{source:save.source,value:save.modifier}],dice:{id:`${resolutionId}:d20`,purpose:`${control.displayName} save`,sides:20,faces}},condition:{ability:save.ability}},
      {id:`${resolutionId}:effect`,kind:"apply-effect",when:{operationId:rollId,field:"outcome",equals:"failure"},effect:{
        id:`effect.${resolutionId}`,sourceId:actionId,sourceActorId:action.actorId,targetId,kind:"condition",conditionId:control.conditionId,
        duration:control.duration,
        termination:control.termination,
        metadata:{displayName:control.displayName},
      }},
    ],
  });
  if (committed.status==="rejected") return refuse("action-rejected",`${control.displayName} 거부 · ${committed.error}`);
  const projected=applyResolutionEvents(internal.scene,committed.events,[],[],state);
  if (projected.status==="rejected") return refuse("action-rejected",`${control.displayName} 거부 · ${projected.error}`);
  if (!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state)) return refuse("action-rejected",`${control.displayName} 거부 · 전투 상태가 바뀌었습니다`);
  internal.scene=projected.scene;
  const session=turnRuntimeSessions.get(this);
  if (session) projectTurnRuntimeToScene(session,internal.scene);
  const roll=committed.results[rollId] as D20TestResult;
  const failed=roll.outcome==="failure";
  const outcome=failed?`${control.label} 적용`:`${control.label} 저항`;
  const provenance=action.details.filter((entry)=>entry.label==="출처").map((entry)=>entry.value);
  const resolution:ResolutionView={
    id:resolutionId,actorId:action.actorId,targetIds:[targetId],actionId,actionName:control.displayName,rollKind:"save",stage:"complete",
    authoritativeDice:[...roll.dice.faces],rollTotal:roll.total,saveResults:[{targetId,targetName:target.name,d20:roll.natural,total:roll.total,dc:roll.target,outcome:failed?"실패":"성공"}],damageComponents:[],
    compact:`${target.name} ${save.ability.toUpperCase()} ${roll.total} vs DC ${roll.target} · ${outcome}`,detail:[`대상은 지정된 내성 중 높은 ${save.ability.toUpperCase()} 사용`],
    provenance:provenance.length?provenance:["Structural save condition"],calculatedOutcome:outcome,finalOutcome:outcome,stateChanges:projected.stateChanges,adjudicated:false,canAdvance:false,
  };
  internal.resolution=resolution;
  internal.activity.unshift(projectResolutionEventsToActivity({resolution,events:committed.events,actorName:internal.scene.entities.find((entry)=>entry.id===action.actorId)?.name??action.actorId,targetNames:[target.name]}));
  internal.lastResolutionId=resolutionId;internal.lastBefore=null;
  recordRuntimeResolutionEvents(this,resolutionId,committed.events);
  return internal.getSnapshot();
};
