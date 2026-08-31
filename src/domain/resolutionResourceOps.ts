import { requireCombatant } from "./combatState";
import { gainResource, recoverResource, setResourceRecoveryLockout, type ResourcePool } from "./resources";
import { DomainEvaluationError } from "./profileEngine";
import { resourceStateChange } from "./runtimeStateChange";
import { makeEvent, type OperationExecution, type ResolutionExecutionContext } from "./resolutionContext";
import type { ResolutionOperation } from "./resolutionTypes";

type GainResourceOp = Extract<ResolutionOperation, { kind:"gain-resource" }>;
type SetResourceRecoveryLockoutOp = Extract<ResolutionOperation, { kind:"set-resource-recovery-lockout" }>;
type RechargeResourceOp = Extract<ResolutionOperation,{kind:"recharge-resource"}>;

function capacity(pool:ResourcePool) {
  return {
    maximum:pool.maximum,
    maximumAfterLongRest:pool.maximumAfterLongRest ?? null,
  };
}

export function executeGainResource(ctx: ResolutionExecutionContext, operation: GainResourceOp): OperationExecution {
  const actorId = operation.actorId ?? ctx.pending.actorId;
  const actor = requireCombatant(ctx.state, actorId);
  let index = actor.resources.findIndex((pool) => pool.id === operation.resourceId);
  let created = false;
  if (index < 0) {
    if (!operation.createIfMissing) throw new Error(`resource not found: ${operation.resourceId}`);
    const createdPool: ResourcePool = {
      id:operation.resourceId,
      label:operation.createIfMissing.label,
      current:0,
      maximum:0,
      recovery:operation.createIfMissing.recovery,
    };
    actor.resources.push(createdPool);
    index = actor.resources.length - 1;
    created = true;
  }
  const before = actor.resources[index];
  const resolved = gainResource(before, operation.amount, ctx.pending.sourceId, {
    maximumDelta:operation.maximumDelta,
    temporaryCapacityUntilLongRest:operation.temporaryCapacityUntilLongRest,
  });
  actor.resources[index] = resolved.next;
  const createdResource = created ? {
    label:resolved.next.label,
    maximum:resolved.next.maximum,
    ...(resolved.next.recovery ? { recovery:structuredClone(resolved.next.recovery) } : {}),
    source:ctx.pending.sourceId,
  } : undefined;
  const beforeCapacity=capacity(before);
  const afterCapacity=capacity(resolved.next);
  const capacityChanged=beforeCapacity.maximum!==afterCapacity.maximum
    || beforeCapacity.maximumAfterLongRest!==afterCapacity.maximumAfterLongRest;
  const changes = [resourceStateChange(
    actorId,
    operation.resourceId,
    before.current,
    resolved.next.current,
    resolved.provenance,
    undefined,
    createdResource,
    !created && capacityChanged ? { before:beforeCapacity, after:afterCapacity } : undefined,
  )];
  return {
    result:resolved,
    event:makeEvent(
      ctx.pending,
      operation,
      `${operation.resourceId} gained ${operation.amount}${operation.maximumDelta ? ` (maximum +${operation.maximumDelta})` : ""}`,
      resolved,
      resolved.provenance,
      changes,
      actorId,
    ),
  };
}

export function executeRechargeResource(ctx:ResolutionExecutionContext,operation:RechargeResourceOp):OperationExecution {
  const actorId=operation.actorId??ctx.pending.actorId;
  if(operation.timing!=="turn-start"||ctx.state.clock.phase!=="start"||ctx.state.clock.activeActorId!==actorId)throw new DomainEvaluationError("recharge must resolve at the authoritative actor turn start");
  if(!Number.isInteger(operation.die.sides)||operation.die.sides<2||operation.die.faces.length!==1)throw new DomainEvaluationError("recharge requires exactly one authoritative die face");
  const face=operation.die.faces[0];
  if(!Number.isInteger(face)||face<1||face>operation.die.sides)throw new DomainEvaluationError("recharge die face is out of range");
  const maximum=operation.succeedsOn.maximum??operation.die.sides;
  if(!Number.isInteger(operation.succeedsOn.minimum)||!Number.isInteger(maximum)||operation.succeedsOn.minimum<1||maximum>operation.die.sides||operation.succeedsOn.minimum>maximum)throw new DomainEvaluationError("invalid recharge success range");
  const actor=requireCombatant(ctx.state,actorId);
  const index=actor.resources.findIndex((pool)=>pool.id===operation.resourceId);
  if(index<0)throw new DomainEvaluationError(`resource not found: ${operation.resourceId}`);
  const before=actor.resources[index];
  const success=face>=operation.succeedsOn.minimum&&face<=maximum;
  const resolved=success?recoverResource(before,"all",ctx.pending.sourceId):{next:before,delta:0,provenance:[{source:ctx.pending.sourceId,status:"suppressed" as const,reason:`recharge roll ${face} failed`}]};
  actor.resources[index]=resolved.next;
  const changes=resolved.delta?[resourceStateChange(actorId,operation.resourceId,before.current,resolved.next.current,resolved.provenance)]:[];
  const result={success,face,before:before.current,after:resolved.next.current};
  return {result,event:makeEvent(ctx.pending,operation,success?`${operation.resourceId} recharged`:`${operation.resourceId} recharge failed`,result,resolved.provenance,changes,actorId)};
}

export function executeSetResourceRecoveryLockout(
  ctx:ResolutionExecutionContext,
  operation:SetResourceRecoveryLockoutOp,
):OperationExecution {
  const actorId = operation.actorId ?? ctx.pending.actorId;
  const actor = requireCombatant(ctx.state,actorId);
  const index = actor.resources.findIndex((pool) => pool.id === operation.resourceId);
  if (index < 0) throw new Error(`resource not found: ${operation.resourceId}`);
  const before = actor.resources[index];
  const resolved = setResourceRecoveryLockout(before,operation.trigger,operation.rests,ctx.pending.sourceId);
  actor.resources[index] = resolved.next;
  const changes=[resourceStateChange(
    actorId,
    operation.resourceId,
    before.current,
    resolved.next.current,
    resolved.provenance,
    {
      before:before.recoveryLockouts?structuredClone(before.recoveryLockouts):null,
      after:resolved.next.recoveryLockouts?structuredClone(resolved.next.recoveryLockouts):null,
    },
  )];
  return {
    result:resolved,
    event:makeEvent(
      ctx.pending,
      operation,
      `${operation.resourceId} ${operation.trigger} recovery locked for ${operation.rests} rests`,
      resolved,
      resolved.provenance,
      changes,
      actorId,
    ),
  };
}