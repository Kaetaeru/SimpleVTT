import { conditionEffectsFor, requireCombatant } from "./combatState";
import { frightenedMovementRestriction } from "./conditions";
import { selectEffectTurnActivity } from "./effects";
import { DomainEvaluationError, type ProvenanceRecord } from "./profileEngine";
import { makeEvent, type OperationExecution, type ResolutionExecutionContext } from "./resolutionContext";
import type { ResolutionOperation } from "./resolutionTypes";

type FreeMoveOp = Extract<ResolutionOperation,{kind:"free-move"}>;

export function executeFreeMove(ctx:ResolutionExecutionContext,operation:FreeMoveOp):OperationExecution {
  const actorId = operation.actorId ?? ctx.pending.actorId;
  requireCombatant(ctx.state,actorId);
  if (!Number.isFinite(operation.distanceFeet) || operation.distanceFeet < 0) {
    throw new DomainEvaluationError("free movement distance must be a non-negative finite number");
  }
  if (!Number.isFinite(operation.maximumDistanceFeet) || operation.maximumDistanceFeet < 0) {
    throw new DomainEvaluationError("free movement maximum must be a non-negative finite number");
  }
  if (operation.distanceFeet > operation.maximumDistanceFeet) {
    throw new DomainEvaluationError(`free movement cannot exceed ${operation.maximumDistanceFeet} feet`);
  }
  const restriction = frightenedMovementRestriction(
    conditionEffectsFor(ctx.state,actorId),
    operation.destinationMovesCloserToVisibleFrighteningSource === true,
    operation.visibleSourceIds ?? [],
  );
  if (restriction) throw new DomainEvaluationError(restriction);

  let restrictionProvenance:ProvenanceRecord[] = [];
  if (ctx.state.clock.activeActorId === actorId) {
    const selected = selectEffectTurnActivity(ctx.state.effects,actorId,"movement");
    ctx.state.effects = selected.effects;
    restrictionProvenance = selected.provenance;
  }
  const provenance:ProvenanceRecord[] = [
    ...restrictionProvenance,
    {
      source:ctx.pending.sourceId,
      status:"applied",
      reason:operation.doesNotProvokeOpportunityAttacks === true
        ? `${actorId} moves ${operation.distanceFeet} ft of granted movement without provoking Opportunity Attacks`
        : `${actorId} moves ${operation.distanceFeet} ft of granted movement`,
    },
  ];
  const result = {
    distanceFeet:operation.distanceFeet,
    maximumDistanceFeet:operation.maximumDistanceFeet,
    regularMovementSpent:0,
    doesNotProvokeOpportunityAttacks:operation.doesNotProvokeOpportunityAttacks === true,
    ...(operation.movementMode?{movementMode:operation.movementMode}:{}),
    ...(operation.destinationRef?{destinationRef:operation.destinationRef}:{}),
  };
  return {
    result,
    event:makeEvent(ctx.pending,operation,`${actorId} uses granted movement`,result,provenance,[],actorId),
  };
}
