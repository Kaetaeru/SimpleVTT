import type { ActionVm, ActivityEntry, AppRole, AppSnapshot, CharacterSheet, CombatantDefinitionVm, ResolutionView, SceneEntity, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
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

const CONTROL={
  "action.unarmed-strike.grapple":{conditionId:"grappled" as const,label:"붙잡힘",displayName:"맨손 타격 · 붙잡기"},
  "action.unarmed-strike.shove-prone":{conditionId:"prone" as const,label:"넘어짐",displayName:"맨손 타격 · 넘어뜨리기"},
};
type ControlActionId=keyof typeof CONTROL;
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

function saveFact(adapter:MockAdapter,internal:AdapterState,target:SceneEntity) {
  const sheet=target.id===internal.activeCharacter.id?internal.activeCharacter:projectedCharacterById(adapter,target.id)?.sheet;
  const active=sheet??internal.activeCharacter;
  const strength=resolveRuntimeSaveModifier(target,active,"str",internal.combatantDefinitions);
  const dexterity=resolveRuntimeSaveModifier(target,active,"dex",internal.combatantDefinitions);
  return strength.modifier>=dexterity.modifier?strength:dexterity;
}

MockAdapter.prototype.resolveAction=async function resolveUnarmedControl(actionId:string,targetIds:string[]) {
  const control=CONTROL[actionId as ControlActionId];
  if (!control) return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as AdapterState;
  const snapshot=await internal.getSnapshot();
  const action=actorAction(snapshot.scene,actionId);
  const targetId=targetIds[0];
  const target=internal.scene.entities.find((entry)=>entry.id===targetId);
  if (!action?.available||targetIds.length!==1||!action.eligibleTargetIds.includes(targetId)||!target||target.runtimeLife?.dead) return snapshot;
  if (internal.sessionMode==="initiative"&&internal.role==="player"&&action.actorId!==internal.scene.currentActorId) return snapshot;
  const state=snapshotAdapterTurnRuntimeState(this,internal.scene);
  if (!state?.combatants[action.actorId]||!state.combatants[targetId]) return snapshot;
  let save;
  try { save=saveFact(this,internal,target); }
  catch { return snapshot; }
  const resolutionId=`unarmed-control.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const rollId=`${resolutionId}:save`;
  const faces=[0,1].map((index)=>(MockAdapter.prototype as unknown as DicePrototype).d20.call(this,actionId,index));
  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state,{
    id:resolutionId,actorId:action.actorId,sourceId:actionId,expectedRevision:state.revision,
    operations:[
      ...(internal.sessionMode==="initiative"?[{id:`${resolutionId}:economy`,kind:"use-economy" as const,actorId:action.actorId,slot:"action" as const,actionKind:"attack" as const,attacksPerAction:action.attacksPerAction??1}]:[]),
      {id:rollId,kind:"d20",actorId:targetId,targetId:action.actorId,request:{family:"saving-throw",target:action.saveDc??8,targetSource:`${actionId}:save-dc`,modifierContributions:[{source:save.source,value:save.modifier}],dice:{id:`${resolutionId}:d20`,purpose:`${control.displayName} save`,sides:20,faces}},condition:{ability:save.ability}},
      {id:`${resolutionId}:effect`,kind:"apply-effect",when:{operationId:rollId,field:"outcome",equals:"failure"},effect:{
        id:`effect.${resolutionId}`,sourceId:actionId,sourceActorId:action.actorId,targetId,kind:"condition",conditionId:control.conditionId,
        duration:{kind:"special",key:control.conditionId==="grappled"?`escape:${action.actorId}`:"stand-up"},
        termination:control.conditionId==="grappled"?{sourceBecomesIncapacitated:true,sourceDies:true}:undefined,
        metadata:{displayName:control.displayName},
      }},
    ],
  });
  if (committed.status==="rejected") return snapshot;
  const projected=applyResolutionEvents(internal.scene,committed.events,[],[],state);
  if (projected.status==="rejected") return snapshot;
  if (!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state)) return snapshot;
  internal.scene=projected.scene;
  const session=turnRuntimeSessions.get(this);
  if (session) projectTurnRuntimeToScene(session,internal.scene);
  const roll=committed.results[rollId] as D20TestResult;
  const failed=roll.outcome==="failure";
  const outcome=failed?`${control.label} 적용`:`${control.label} 저항`;
  const resolution:ResolutionView={
    id:resolutionId,actorId:action.actorId,targetIds:[targetId],actionId,actionName:control.displayName,rollKind:"save",stage:"complete",
    authoritativeDice:[...roll.dice.faces],rollTotal:roll.total,saveResults:[{targetId,targetName:target.name,d20:roll.natural,total:roll.total,dc:roll.target,outcome:failed?"실패":"성공"}],damageComponents:[],
    compact:`${target.name} ${save.ability.toUpperCase()} ${roll.total} vs DC ${roll.target} · ${outcome}`,detail:[`대상은 근력/민첩 내성 중 높은 ${save.ability.toUpperCase()} 사용`],
    provenance:["SRD 5.2.1 · Unarmed Strike"],calculatedOutcome:outcome,finalOutcome:outcome,stateChanges:projected.stateChanges,adjudicated:false,canAdvance:false,
  };
  internal.resolution=resolution;
  internal.activity.unshift(projectResolutionEventsToActivity({resolution,events:committed.events,actorName:internal.scene.entities.find((entry)=>entry.id===action.actorId)?.name??action.actorId,targetNames:[target.name]}));
  internal.lastResolutionId=resolutionId;internal.lastBefore=null;
  recordRuntimeResolutionEvents(this,resolutionId,committed.events);
  return internal.getSnapshot();
};
