import type { AppSnapshot, DmAdjudicationCommand, SceneEntity } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { runtimeResolutionEventHistories } from "./runtimeResolutionEventHistory";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import type { RuntimeStateChange } from "../domain/runtimeStateChange";

const previousApplyDmAdjudication=MockAdapter.prototype.applyDmAdjudication;

function hpTarget(snapshot:AppSnapshot,command:DmAdjudicationCommand) {
  if (command.type!=="damage-correction"&&command.type!=="healing-correction") return undefined;
  const targetId=command.targetId??snapshot.resolution?.targetIds[0];
  if (!targetId) return undefined;
  return snapshot.scene.entities.find((entity)=>entity.id===targetId);
}

function hpChange(target:SceneEntity,before:number,after:number):RuntimeStateChange {
  const provenance=[{
    source:"dm-adjudication:hp-correction",
    status:"applied" as const,
    reason:`DM corrected ${target.id} HP inside the committed resolution`,
  }];
  return {
    kind:"hp",
    targetId:target.id,
    field:"current",
    before,
    after,
    provenance,
    lifetime:target.kind==="character" ? "character-durable" : "session-runtime",
    writeBack:target.kind==="character" ? "character" : "session",
  };
}

function correctionEvent(
  resolutionId:string,
  target:SceneEntity,
  before:number,
  after:number,
  command:DmAdjudicationCommand,
):ResolutionEvent {
  const operationId=`${resolutionId}:dm-${command.type}`;
  const provenance=[{
    source:`dm-adjudication:${command.type}`,
    status:"applied" as const,
    reason:`scope=${command.scope}${command.reason ? `; reason=${command.reason}` : ""}`,
  }];
  return {
    id:`${operationId}:event`,
    resolutionId,
    operationId,
    kind:"dm-correction",
    actorId:"dm",
    targetId:target.id,
    summary:`DM ${command.type}: ${target.id} HP ${before} -> ${after}`,
    provenance,
    stateChanges:[hpChange(target,before,after)],
    result:{
      type:command.type,
      value:Number(command.value??0),
      scope:command.scope,
      reason:command.reason,
      before,
      after,
    },
  };
}

MockAdapter.prototype.applyDmAdjudication=async function applyEventNativeDmAdjudication(command:DmAdjudicationCommand) {
  const before=await this.getSnapshot();
  const resolutionId=before.resolution?.id;
  const history=resolutionId ? runtimeResolutionEventHistories.get(this) : undefined;
  const targetBefore=hpTarget(before,command);
  const next=await previousApplyDmAdjudication.call(this,command);
  if (!resolutionId || !history || history.resolutionId!==resolutionId || !targetBefore) return next;

  const targetAfter=next.scene.entities.find((entity)=>entity.id===targetBefore.id);
  if (!targetAfter || targetAfter.hp===targetBefore.hp) return next;

  runtimeResolutionEventHistories.set(this,{
    resolutionId,
    events:[
      ...history.events,
      correctionEvent(resolutionId,targetAfter,targetBefore.hp,targetAfter.hp,command),
    ],
  });
  return next;
};
