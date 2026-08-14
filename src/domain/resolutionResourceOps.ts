import { requireCombatant } from "./combatState";
import { gainResource, type ResourcePool } from "./resources";
import { resourceStateChange } from "./runtimeStateChange";
import { makeEvent, type OperationExecution, type ResolutionExecutionContext } from "./resolutionContext";
import type { ResolutionOperation } from "./resolutionTypes";

type GainResourceOp = Extract<ResolutionOperation, { kind:"gain-resource" }>;

export function executeGainResource(ctx: ResolutionExecutionContext, operation: GainResourceOp): OperationExecution {
  const actorId = operation.actorId ?? ctx.pending.actorId;
  const actor = requireCombatant(ctx.state, actorId);
  let index = actor.resources.findIndex((pool) => pool.id === operation.resourceId);
  if (index < 0) {
    if (!operation.createIfMissing) throw new Error(`resource not found: ${operation.resourceId}`);
    const created: ResourcePool = {
      id:operation.resourceId,
      label:operation.createIfMissing.label,
      current:0,
      maximum:0,
      recovery:operation.createIfMissing.recovery,
    };
    actor.resources.push(created);
    index = actor.resources.length - 1;
  }
  const before = actor.resources[index];
  const resolved = gainResource(before, operation.amount, ctx.pending.sourceId, {
    maximumDelta:operation.maximumDelta,
    temporaryCapacityUntilLongRest:operation.temporaryCapacityUntilLongRest,
  });
  actor.resources[index] = resolved.next;
  const changes = [resourceStateChange(actorId, operation.resourceId, before.current, resolved.next.current, resolved.provenance)];
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
