import { resolveD20Test, type D20TestResult } from "./d20";
import { resolveDamageRoll } from "./damageRoll";
import {
  conditionActionAvailability,
  conditionD20Adjustments,
  conditionTargetingRestriction,
  frightenedMovementRestriction,
} from "./conditions";
import { conditionEffectsFor, requireCombatant } from "./combatState";
import { findResource, spendResource } from "./resources";
import { openReactorWindow, resolveReactionChoice } from "./reaction";
import { resolveTargeting } from "./targeting";
import { economyStateChanges } from "./stateChange";
import { resourceStateChange } from "./runtimeStateChange";
import { useMovement } from "./turnEconomy";
import { DomainEvaluationError, type ProvenanceRecord } from "./profileEngine";
import type { OperationExecution, ResolutionExecutionContext } from "./resolutionContext";
import { makeEvent, targetingResult } from "./resolutionContext";
import type { ResolutionOperation } from "./resolutionTypes";

type TargetingOp = Extract<ResolutionOperation, { kind:"targeting" }>;
type EconomyOp = Extract<ResolutionOperation, { kind:"use-economy" }>;
type MoveOp = Extract<ResolutionOperation, { kind:"move" }>;
type ResourceOp = Extract<ResolutionOperation, { kind:"spend-resource" }>;
type D20Op = Extract<ResolutionOperation, { kind:"d20" }>;
type DamageRollOp = Extract<ResolutionOperation, { kind:"damage-roll" }>;
type ReactionOp = Extract<ResolutionOperation, { kind:"reaction" }>;

export function executeTargeting(ctx: ResolutionExecutionContext, operation: TargetingOp): OperationExecution {
  const sourceId = operation.sourceId ?? ctx.pending.actorId;
  const restriction = operation.harmful
    ? operation.targets
        .map((target) => conditionTargetingRestriction(conditionEffectsFor(ctx.state, sourceId), target.id, true))
        .find(Boolean)
    : undefined;
  if (restriction) throw new DomainEvaluationError(restriction);
  const result = resolveTargeting(sourceId, operation.rule, operation.targets);
  if (!result.valid) {
    const reason = result.rejected.flatMap((entry) => entry.reasons).join("; ") || "invalid target selection";
    throw new DomainEvaluationError(reason);
  }
  return {
    result,
    event:makeEvent(ctx.pending, operation, `validated ${result.targets.length} target(s)`, result, result.provenance, []),
  };
}

export function executeEconomy(ctx: ResolutionExecutionContext, operation: EconomyOp): OperationExecution {
  const actorId = operation.actorId ?? ctx.pending.actorId;
  const actor = requireCombatant(ctx.state, actorId);
  const before = actor.economy;
  const availability = conditionActionAvailability(conditionEffectsFor(ctx.state, actorId));
  if (operation.slot === "action" && !availability.action) throw new DomainEvaluationError("action blocked by condition");
  if (operation.slot === "bonus-action" && !availability.bonusAction) throw new DomainEvaluationError("bonus action blocked by condition");
  if (operation.slot === "reaction" && !availability.reaction) throw new DomainEvaluationError("reaction blocked by condition");
  const key = operation.slot === "bonus-action" ? "bonusAction" : operation.slot;
  if (!before[key]) throw new DomainEvaluationError(`${operation.slot} is not available`);
  if (operation.slot === "bonus-action" && !operation.bonusActionGranted) {
    throw new DomainEvaluationError("bonus action requires an explicit granting rule");
  }
  actor.economy = { ...before, [key]:false };
  const provenance: ProvenanceRecord[] = [{ source:ctx.pending.sourceId, status:"applied", reason:`${operation.slot} spent` }];
  const changes = economyStateChanges(actorId, before, actor.economy, provenance);
  const result = { slot:operation.slot, spent:true };
  return {
    result,
    event:makeEvent(ctx.pending, operation, `${actorId} spends ${operation.slot}`, result, provenance, changes, actorId),
  };
}

export function executeMove(ctx:ResolutionExecutionContext, operation:MoveOp):OperationExecution {
  const actorId = operation.actorId ?? ctx.pending.actorId;
  const actor = requireCombatant(ctx.state, actorId);
  const restriction = frightenedMovementRestriction(
    conditionEffectsFor(ctx.state, actorId),
    operation.destinationMovesCloserToVisibleFrighteningSource === true,
    operation.visibleSourceIds ?? [],
  );
  if (restriction) throw new DomainEvaluationError(restriction);
  const before = actor.economy;
  actor.economy = useMovement(before, operation.distanceFeet);
  const provenance:ProvenanceRecord[] = [{
    source:ctx.pending.sourceId,
    status:"applied",
    reason:`${actorId} moves ${operation.distanceFeet} ft`,
  }];
  const changes = economyStateChanges(actorId, before, actor.economy, provenance);
  const result = { distanceFeet:operation.distanceFeet, remaining:actor.economy.movement };
  return {
    result,
    event:makeEvent(ctx.pending, operation, `${actorId} moves ${operation.distanceFeet} ft`, result, provenance, changes, actorId),
  };
}

export function executeResource(ctx: ResolutionExecutionContext, operation: ResourceOp): OperationExecution {
  const actorId = operation.actorId ?? ctx.pending.actorId;
  const actor = requireCombatant(ctx.state, actorId);
  const found = findResource(actor.resources, operation.resourceId);
  const resolved = spendResource(found.pool, operation.amount, ctx.pending.sourceId);
  actor.resources[found.index] = resolved.next;
  const changes = [resourceStateChange(actorId, operation.resourceId, found.pool.current, resolved.next.current, resolved.provenance)];
  return {
    result:resolved,
    event:makeEvent(ctx.pending, operation, `${operation.resourceId} spent`, resolved, resolved.provenance, changes, actorId),
  };
}

export function executeD20(ctx: ResolutionExecutionContext, operation: D20Op): OperationExecution {
  const actorId = operation.actorId ?? ctx.pending.actorId;
  const adjustments = conditionD20Adjustments({
    actorId,
    targetId:operation.targetId,
    family:operation.request.family,
    ability:operation.condition?.ability,
    requiresSight:operation.condition?.requiresSight,
    requiresHearing:operation.condition?.requiresHearing,
    socialInteraction:operation.condition?.socialInteraction,
    distanceToTargetFeet:operation.condition?.distanceToTargetFeet,
    actorCanSeeTarget:operation.condition?.actorCanSeeTarget,
    targetCanSeeActor:operation.condition?.targetCanSeeActor,
    visibleSourceIds:operation.condition?.visibleSourceIds,
    actorConditions:conditionEffectsFor(ctx.state, actorId),
    targetConditions:operation.targetId ? conditionEffectsFor(ctx.state, operation.targetId) : [],
  });
  let target = operation.request.target;
  const modifiers = [...operation.request.modifierContributions, ...adjustments.modifierContributions];
  if (operation.cover) {
    const targetEntry = targetingResult(ctx.results, operation.cover.targetingOperationId).targets
      .find((entry) => entry.targetId === operation.cover!.targetId);
    if (!targetEntry) throw new DomainEvaluationError(`cover target not found: ${operation.cover.targetId}`);
    if (operation.cover.appliesTo === "ac") target += targetEntry.acBonus;
    else modifiers.push({ source:`cover:${targetEntry.cover}`, value:targetEntry.dexteritySaveBonus });
  }
  let resolved:D20TestResult = resolveD20Test(ctx.profile, {
    ...operation.request,
    target,
    modifierContributions:modifiers,
    rollStateContributions:[...(operation.request.rollStateContributions ?? []), ...adjustments.rollStateContributions],
  });
  if (adjustments.autoFailure) {
    resolved = {
      ...resolved,
      outcome:"failure",
      critical:false,
      provenance:[...resolved.provenance, { source:"condition:auto-failure", status:"applied", reason:"condition causes automatic failure" }],
    };
  }
  if (resolved.family === "attack-roll" && resolved.outcome === "success" && adjustments.criticalOnHit && !resolved.critical) {
    resolved = {
      ...resolved,
      critical:true,
      provenance:[...resolved.provenance, { source:"condition:auto-critical", status:"applied", reason:"condition makes a hit within 5 feet a Critical Hit" }],
    };
  }
  return {
    result:resolved,
    event:makeEvent(
      ctx.pending,
      operation,
      `${resolved.family} ${resolved.outcome} (${resolved.total} vs ${resolved.target})`,
      resolved,
      resolved.provenance,
      [],
      operation.targetId,
    ),
  };
}

export function executeDamageRoll(ctx: ResolutionExecutionContext, operation: DamageRollOp): OperationExecution {
  const critical = operation.criticalFrom
    ? Boolean((ctx.results.get(operation.criticalFrom) as D20TestResult | undefined)?.critical)
    : operation.request.critical;
  const resolved = resolveDamageRoll({ ...operation.request, critical });
  return {
    result:resolved,
    event:makeEvent(ctx.pending, operation, `damage roll ${resolved.total}`, resolved, resolved.provenance, []),
  };
}

export function executeReaction(ctx: ResolutionExecutionContext, operation: ReactionOp): OperationExecution {
  const reactor = requireCombatant(ctx.state, operation.reactorId);
  const window = openReactorWindow(operation.reactorId, reactor.economy, operation.trigger, operation.options);
  const resolved = resolveReactionChoice(operation.reactorId, reactor.economy, window, operation.optionId);
  reactor.economy = resolved.nextEconomy;
  return {
    result:resolved,
    event:makeEvent(
      ctx.pending,
      operation,
      `${operation.reactorId} uses reaction ${operation.optionId}`,
      resolved,
      resolved.provenance,
      resolved.stateChanges,
      operation.reactorId,
    ),
  };
}
