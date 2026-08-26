import "./rogueCoreRuntimeAdapter";
import type { AppSnapshot, CharacterSheet, EconomyVm, ResolutionView, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { resolvePendingResolution } from "../domain/resolution";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import { CUNNING_DISENGAGE_ACTION_ID } from "./rogueCoreRuntimeAdapter";

type AdapterState={
  sessionMode:SessionMode;
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  resolution:ResolutionView|null;
  getSnapshot():Promise<AppSnapshot>;
};

const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;

function economyEvent(resolution:ResolutionView,before:EconomyVm,after:EconomyVm):ResolutionEvent {
  const provenance=[{source:"rogue:cunning-action:disengage",status:"applied" as const,reason:"Rogue Cunning Action Disengage authoritative economy"}];
  const fields:Array<{field:"action"|"bonusAction"|"movement"|"movementMaximum";before:boolean|number;after:boolean|number}>=[
    {field:"action",before:before.action,after:after.action},
    {field:"bonusAction",before:before.bonusAction,after:after.bonusAction},
    {field:"movement",before:before.movement,after:after.movement},
    {field:"movementMaximum",before:before.movementMax,after:after.movementMax},
  ];
  return {
    id:`${resolution.id}:cunning-disengage-economy`,
    resolutionId:resolution.id,
    operationId:"cunning-action:disengage:economy",
    kind:"cunning-action-disengage",
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

MockAdapter.prototype.advanceResolution=async function advanceEventNativeCunningDisengage(){
  const internal=this as unknown as AdapterState;
  const resolution=internal.resolution;
  const eventNative=internal.sessionMode==="initiative"
    && resolution?.stage==="effect-preview"
    && resolution.actionId===CUNNING_DISENGAGE_ACTION_ID;
  const economyBefore=eventNative
    ? structuredClone(internal.scene.economyByActor[resolution!.actorId])
    : undefined;
  const snapshot=await previousAdvanceResolution.call(this);
  if(!eventNative||!economyBefore||snapshot.resolution?.id!==resolution!.id||snapshot.resolution.stage!=="complete")return snapshot;

  const state=snapshotAdapterTurnRuntimeState(this,internal.scene);
  if(!state?.combatants[resolution!.actorId])return snapshot;
  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state,{
    id:resolution!.id,
    actorId:resolution!.actorId,
    sourceId:CUNNING_DISENGAGE_ACTION_ID,
    expectedRevision:state.revision,
    operations:[{
      id:`${resolution!.id}:disengage-effect`,
      kind:"apply-effect",
      effect:{
        id:`${resolution!.id}:disengage`,
        sourceId:CUNNING_DISENGAGE_ACTION_ID,
        sourceActorId:resolution!.actorId,
        targetId:resolution!.actorId,
        kind:"marker",
        tags:["rogue:cunning-action:disengage","opportunity-attack:no-provoke"],
        duration:{kind:"until-turn-boundary",actorId:resolution!.actorId,round:state.clock.round,boundary:"end"},
        metadata:{publicLabel:"이탈"},
      },
    }],
  });
  if(committed.status==="rejected")return snapshot;
  if(!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state))return snapshot;
  const actor=internal.scene.entities.find((entry)=>entry.id===resolution!.actorId);
  if(actor)actor.status=actor.status.filter((status)=>status!=="이탈");
  const economyAfter=internal.scene.economyByActor[resolution!.actorId];
  if(!economyAfter)return internal.getSnapshot();
  recordRuntimeResolutionEvents(this,resolution!.id,[economyEvent(resolution!,economyBefore,economyAfter),...committed.events]);
  return internal.getSnapshot();
};
