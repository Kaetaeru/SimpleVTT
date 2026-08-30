import type { ActionVm, AppSnapshot, CharacterSheet, ResolutionView, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import {
  commitAdapterTurnRuntimeState,
  ensureAdapterTurnRuntimeState,
  snapshotAdapterTurnRuntimeState,
} from "./turnRuntimeSessionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { resolvePendingResolution } from "../domain/resolution";
import type { EffectInstance } from "../domain/effects";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import {
  recordRuntimeResolutionEvents,
  runtimeResolutionEventHistory,
} from "./runtimeResolutionEventHistory";

const SESSION_STATUS_TAG="session-status";

type AdapterState={
  sessionMode:SessionMode;
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  resolution:ResolutionView|null;
  action(id:string):ActionVm|undefined;
  getSnapshot():Promise<AppSnapshot>;
};

const previousResolveAction=MockAdapter.prototype.resolveAction;
const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const pendingRevealEvents=new WeakMap<MockAdapter,{resolutionId:string;events:ResolutionEvent[]}>();

function statusEffect(action:ActionVm|undefined) {
  const effect=action?.sessionStatusEffect;
  if(!action||!effect||effect.operation==="remove")return;
  if(action.resolutionKind==="ability-check"&&effect.minimumRoll!==undefined)return effect;
  if(action.resolutionKind==="no-roll"&&(effect.durationKey!==undefined||effect.expiresAtActorTurnBoundary!==undefined))return effect;
}

function targetId(action:ActionVm,resolution:ResolutionView) {
  return action.sessionStatusEffect?.target==="first-target"?resolution.targetIds[0]:resolution.actorId;
}

function economyEvent(resolution:ResolutionView,sourceId:string,before:SceneVm["economyByActor"][string],after:SceneVm["economyByActor"][string]):ResolutionEvent {
  const provenance=[{source:sourceId,status:"applied" as const,reason:"Ability-check status effect authoritative economy"}];
  const fields:Array<{field:"action"|"bonusAction"|"movement"|"movementMaximum";before:boolean|number;after:boolean|number}>=[
    {field:"action",before:before.action,after:after.action},
    {field:"bonusAction",before:before.bonusAction,after:after.bonusAction},
    {field:"movement",before:before.movement,after:after.movement},
    {field:"movementMaximum",before:before.movementMax,after:after.movementMax},
  ];
  return {
    id:`${resolution.id}:status-effect:economy`,resolutionId:resolution.id,operationId:"status-effect:economy",kind:"ability-check-status-effect",
    actorId:resolution.actorId,targetId:resolution.actorId,summary:resolution.finalOutcome,provenance,
    stateChanges:fields.filter((entry)=>entry.before!==entry.after).map((entry)=>({kind:"economy" as const,targetId:resolution.actorId,field:entry.field,before:entry.before,after:entry.after,provenance,lifetime:"session-runtime" as const,writeBack:"session" as const})),
    result:{action:after.action,bonusAction:after.bonusAction},
  };
}

function combineEvents(adapter:MockAdapter,resolutionId:string,events:ResolutionEvent[],prepend=false) {
  const existing=runtimeResolutionEventHistory(adapter);
  recordRuntimeResolutionEvents(adapter,resolutionId,existing?.resolutionId===resolutionId?(prepend?[...events,...existing.events]:[...existing.events,...events]):events);
}

function effectFor(action:ActionVm,resolution:ResolutionView,effect:NonNullable<ActionVm["sessionStatusEffect"]>,existing:EffectInstance) {
  return existing.targetId===targetId(action,resolution)&&existing.sourceId===action.id&&existing.tags.includes(SESSION_STATUS_TAG)&&existing.metadata?.sessionStatus===effect.status;
}

function commitStatusEffect(adapter:MockAdapter,internal:AdapterState,action:ActionVm,resolution:ResolutionView,succeeded:boolean):ResolutionEvent[]|undefined {
  const effect=action.sessionStatusEffect!;
  const subjectId=targetId(action,resolution);
  if(!subjectId)return;
  const state=ensureAdapterTurnRuntimeState(adapter,internal.scene);
  const current=state.effects.find((entry)=>effectFor(action,resolution,effect,entry));
  if((succeeded&&current)||(!succeeded&&!current))return [];
  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state,{
    id:`${resolution.id}:status-effect`,actorId:resolution.actorId,sourceId:action.id,expectedRevision:state.revision,
    operations:succeeded?[{
      id:"status-effect:apply",kind:"apply-effect",effect:{
        id:`effect.session-status.${encodeURIComponent(action.id)}.${subjectId}`,sourceId:action.id,sourceActorId:resolution.actorId,targetId:subjectId,kind:"marker",
        tags:[SESSION_STATUS_TAG,...(effect.runtimeTags??[]),...(effect.endsOnAttack?["hidden"]:[])],duration:effect.expiresAtActorTurnBoundary
          ?{kind:"until-turn-boundary",actorId:subjectId,round:state.clock.round+(effect.expiresAtActorTurnBoundary==="start"?1:0),boundary:effect.expiresAtActorTurnBoundary}
          :{kind:"special",key:effect.durationKey!},
        metadata:{publicLabel:effect.status,sessionStatus:effect.status,endsOnAttack:effect.endsOnAttack??false},
      },
    }]:[{id:"status-effect:remove",kind:"remove-effect",effectId:current!.id}],
  });
  if(committed.status==="rejected"||!commitAdapterTurnRuntimeState(adapter,internal.scene,state.revision,committed.state))return;
  const subject=internal.scene.entities.find((entry)=>entry.id===subjectId);
  if(succeeded&&subject?.status.includes(effect.status))subject.status=subject.status.filter((status)=>status!==effect.status);
  return committed.events;
}

function attackEndingEffects(adapter:MockAdapter,internal:AdapterState,actorId:string) {
  return snapshotAdapterTurnRuntimeState(adapter,internal.scene)?.effects.filter((effect)=>effect.targetId===actorId&&effect.metadata?.endsOnAttack===true)??[];
}

function removeAttackEndingEffects(adapter:MockAdapter,internal:AdapterState,resolution:ResolutionView,effects:EffectInstance[]) {
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  if(!state||!effects.length)return;
  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state,{
    id:`${resolution.id}:attack-ending-effects`,actorId:resolution.actorId,sourceId:resolution.actionId,expectedRevision:state.revision,
    operations:effects.map((effect,index)=>({id:`attack-ending-effect:remove:${index}`,kind:"remove-effect" as const,effectId:effect.id})),
  });
  if(committed.status==="rejected"||!commitAdapterTurnRuntimeState(adapter,internal.scene,state.revision,committed.state))return;
  pendingRevealEvents.set(adapter,{resolutionId:resolution.id,events:committed.events});
  const actor=internal.scene.entities.find((entry)=>entry.id===resolution.actorId);
  for(const effect of effects) {
    const label=typeof effect.metadata?.sessionStatus==="string"?effect.metadata.sessionStatus:undefined;
    if(label&&actor?.status.includes(label))actor.status=actor.status.filter((status)=>status!==label);
    if(label)resolution.stateChanges.push(`${actor?.name??resolution.actorId} 상태 제거: ${label} · 공격 선언`);
  }
}

MockAdapter.prototype.resolveAction=async function resolveActionWithStatusEffectEvents(actionId:string,targetIds:string[]) {
  const internal=this as unknown as AdapterState;
  const action=internal.action(actionId);
  const snapshot=await previousResolveAction.call(this,actionId,targetIds);
  const resolution=internal.resolution;
  const resolvedAction=internal.action(actionId)??action;
  const effect=statusEffect(resolvedAction);
  if(effect&&resolution?.actionId===actionId&&resolution.rollKind==="check"&&resolution.checkTarget===undefined) {
    resolution.checkTarget=effect.minimumRoll;
    return internal.getSnapshot();
  }
  if(resolvedAction?.resolutionKind==="attack"&&resolution?.actionId===actionId&&internal.sessionMode==="initiative") {
    const ending=attackEndingEffects(this,internal,resolution.actorId);
    if(ending.length) {
      removeAttackEndingEffects(this,internal,resolution,ending);
      return internal.getSnapshot();
    }
  }
  return snapshot;
};

MockAdapter.prototype.advanceResolution=async function advanceSessionStatusEffectEvents() {
  const internal=this as unknown as AdapterState;
  const resolution=internal.resolution;
  const action=resolution?internal.action(resolution.actionId):undefined;
  const effect=statusEffect(action);
  if(!resolution||!action)return previousAdvanceResolution.call(this);
  const expectedStage=action.resolutionKind==="ability-check"?"roll-animation":"effect-preview";
  const before=effect&&resolution.stage===expectedStage&&internal.sessionMode==="initiative"?structuredClone(internal.scene.economyByActor[resolution.actorId]):undefined;
  const snapshot=await previousAdvanceResolution.call(this);
  if(before&&snapshot.resolution?.id===resolution.id&&snapshot.resolution.stage==="complete") {
    const after=internal.scene.economyByActor[resolution.actorId];
    const succeeded=effect!.minimumRoll===undefined||(resolution.rollTotal??0)>=effect!.minimumRoll;
    const events=commitStatusEffect(this,internal,action,resolution,succeeded);
    if(after&&events) {
      combineEvents(this,resolution.id,[economyEvent(resolution,action.id,before,after),...events]);
      return internal.getSnapshot();
    }
  }
  const reveal=pendingRevealEvents.get(this);
  if(reveal&&reveal.resolutionId===resolution.id&&snapshot.resolution?.stage==="complete") {
    pendingRevealEvents.delete(this);
    combineEvents(this,resolution.id,reveal.events,true);
  }
  return snapshot;
};
