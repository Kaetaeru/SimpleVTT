import type { ActionVm, AppSnapshot, CharacterSheet, ResolutionView, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { CUNNING_HIDE_ACTION_ID } from "./rogueCoreRuntimeAdapter";
import {
  commitAdapterTurnRuntimeState,
  snapshotAdapterTurnRuntimeState,
} from "./turnRuntimeSessionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { resolvePendingResolution } from "../domain/resolution";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import {
  recordRuntimeResolutionEvents,
  runtimeResolutionEventHistory,
} from "./runtimeResolutionEventHistory";

const HIDDEN_TAG="hidden";
const CUNNING_HIDE_TAG="rogue:cunning-hide";
const HIDDEN_LABEL="숨음";

type HideAdapterState={
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

function economyEvent(
  resolution:ResolutionView,
  before:SceneVm["economyByActor"][string],
  after:SceneVm["economyByActor"][string],
):ResolutionEvent {
  const provenance=[{source:CUNNING_HIDE_TAG,status:"applied" as const,reason:"Cunning Hide authoritative economy"}];
  const fields:Array<{field:"action"|"bonusAction"|"movement"|"movementMaximum";before:boolean|number;after:boolean|number}>=[
    {field:"action",before:before.action,after:after.action},
    {field:"bonusAction",before:before.bonusAction,after:after.bonusAction},
    {field:"movement",before:before.movement,after:after.movement},
    {field:"movementMaximum",before:before.movementMax,after:after.movementMax},
  ];
  return {
    id:`${resolution.id}:cunning-hide:economy`,
    resolutionId:resolution.id,
    operationId:"cunning-hide:economy",
    kind:"cunning-action-hide",
    actorId:resolution.actorId,
    targetId:resolution.actorId,
    summary:resolution.finalOutcome,
    provenance,
    stateChanges:fields.filter((entry)=>entry.before!==entry.after).map((entry)=>({
      kind:"economy" as const,
      targetId:resolution.actorId,
      field:entry.field,
      before:entry.before,
      after:entry.after,
      provenance,
      lifetime:"session-runtime" as const,
      writeBack:"session" as const,
    })),
    result:{bonusAction:after.bonusAction},
  };
}

function combineEvents(adapter:MockAdapter,resolutionId:string,events:ResolutionEvent[],prepend=false) {
  const existing=runtimeResolutionEventHistory(adapter);
  const combined=existing?.resolutionId===resolutionId
    ? prepend?[...events,...existing.events]:[...existing.events,...events]
    : events;
  recordRuntimeResolutionEvents(adapter,resolutionId,combined);
}

function hiddenEffectId(actorId:string) {
  return `effect.rogue.cunning-hide.${actorId}`;
}

function hideEffectFor(adapter:MockAdapter,internal:HideAdapterState,actorId:string) {
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  return state?.effects.find((effect)=>effect.targetId===actorId&&effect.tags.includes(HIDDEN_TAG)&&effect.tags.includes(CUNNING_HIDE_TAG));
}

function commitHideEffect(
  adapter:MockAdapter,
  internal:HideAdapterState,
  resolution:ResolutionView,
  succeeded:boolean,
):ResolutionEvent[]|undefined {
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  if(!state)return [];
  const current=state.effects.find((effect)=>effect.targetId===resolution.actorId&&effect.tags.includes(HIDDEN_TAG)&&effect.tags.includes(CUNNING_HIDE_TAG));
  if((succeeded&&current)||(!succeeded&&!current))return [];
  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state,{
    id:`${resolution.id}:cunning-hide-state`,
    actorId:resolution.actorId,
    sourceId:CUNNING_HIDE_TAG,
    expectedRevision:state.revision,
    operations:succeeded?[{
      id:"cunning-hide:apply",
      kind:"apply-effect",
      effect:{
        id:hiddenEffectId(resolution.actorId),
        sourceId:CUNNING_HIDE_TAG,
        sourceActorId:resolution.actorId,
        targetId:resolution.actorId,
        kind:"marker",
        tags:[HIDDEN_TAG,CUNNING_HIDE_TAG],
        duration:{kind:"special",key:"hidden-until-attack-or-discovery"},
        metadata:{publicLabel:HIDDEN_LABEL},
      },
    }]:[{
      id:"cunning-hide:remove",
      kind:"remove-effect",
      effectId:current!.id,
    }],
  });
  if(committed.status==="rejected")return undefined;
  if(!commitAdapterTurnRuntimeState(adapter,internal.scene,state.revision,committed.state))return undefined;
  return committed.events;
}

function removeHideForAttack(adapter:MockAdapter,internal:HideAdapterState,resolution:ResolutionView) {
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  const effect=state?.effects.find((entry)=>entry.targetId===resolution.actorId&&entry.tags.includes(HIDDEN_TAG)&&entry.tags.includes(CUNNING_HIDE_TAG));
  if(!state||!effect)return;
  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state,{
    id:`${resolution.id}:hidden-reveal`,
    actorId:resolution.actorId,
    sourceId:CUNNING_HIDE_TAG,
    expectedRevision:state.revision,
    operations:[{id:"hidden-reveal:remove",kind:"remove-effect",effectId:effect.id}],
  });
  if(committed.status==="rejected")return;
  if(!commitAdapterTurnRuntimeState(adapter,internal.scene,state.revision,committed.state))return;
  pendingRevealEvents.set(adapter,{resolutionId:resolution.id,events:committed.events});
  const actor=internal.scene.entities.find((entry)=>entry.id===resolution.actorId);
  resolution.stateChanges.push(`${actor?.name??resolution.actorId} 상태 제거: ${HIDDEN_LABEL} · 공격 선언`);
}

MockAdapter.prototype.resolveAction=async function resolveActionWithCunningHideReveal(actionId:string,targetIds:string[]) {
  const internal=this as unknown as HideAdapterState;
  const action=internal.action(actionId);
  const snapshot=await previousResolveAction.call(this,actionId,targetIds);
  const resolution=internal.resolution;
  if(action?.resolutionKind==="attack"&&resolution?.actionId===actionId&&internal.sessionMode==="initiative"&&hideEffectFor(this,internal,resolution.actorId)) {
    removeHideForAttack(this,internal,resolution);
    return internal.getSnapshot();
  }
  return snapshot;
};

MockAdapter.prototype.advanceResolution=async function advanceCunningHideWithEvents() {
  const internal=this as unknown as HideAdapterState;
  const resolution=internal.resolution;
  if(!resolution)return previousAdvanceResolution.call(this);

  const hideBefore=resolution.actionId===CUNNING_HIDE_ACTION_ID&&resolution.stage==="roll-animation"&&internal.sessionMode==="initiative"
    ? structuredClone(internal.scene.economyByActor[resolution.actorId])
    : undefined;
  const snapshot=await previousAdvanceResolution.call(this);

  if(hideBefore&&snapshot.resolution?.id===resolution.id&&snapshot.resolution.stage==="complete") {
    const after=internal.scene.economyByActor[resolution.actorId];
    const succeeded=(resolution.rollTotal??0)>=15;
    resolution.finalOutcome=`${resolution.rollTotal} · 숨기 ${succeeded?"성공":"실패"}`;
    resolution.compact=resolution.finalOutcome;
    const effectEvents=commitHideEffect(this,internal,resolution,succeeded);
    if(after&&effectEvents) {
      const stateLabel=`${internal.scene.entities.find((entry)=>entry.id===resolution.actorId)?.name??resolution.actorId} 상태 ${succeeded?"추가":"제거"}: ${HIDDEN_LABEL} · DC 15 ${succeeded?"충족":"미충족"}`;
      if(effectEvents.length&&!resolution.stateChanges.includes(stateLabel))resolution.stateChanges.push(stateLabel);
      combineEvents(this,resolution.id,[economyEvent(resolution,hideBefore,after),...effectEvents]);
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
