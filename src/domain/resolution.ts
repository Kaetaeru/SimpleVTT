import { cloneRuntimeState, type RulesRuntimeState } from "./combatState";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import {
  makeEvent,
  predicateMatches,
  type OperationExecution,
  type ResolutionExecutionContext,
} from "./resolutionContext";
import { executeCompoundDamage, executeDamage, executeDeathSave, executeHealing, executeStabilize, executeTemporaryHp } from "./resolutionHealthOps";
import {
  executeD20,
  executeDamageRoll,
  executeEconomy,
  executeGrantExtraAction,
  executeMove,
  executeReaction,
  executeResource,
  executeTargeting,
  executeTurnFeature,
} from "./resolutionActionOps";
import { executeFreeMove } from "./resolutionMovementOps";
import { executeGainResource, executeSetResourceRecoveryLockout } from "./resolutionResourceOps";
import {
  executeApplyEffect,
  executeEndConcentration,
  executeRemoveEffect,
  executeStartConcentration,
  executeUpdateEffect,
} from "./resolutionEffectOps";
import { executeAdvanceTime, executeBeginTurn, executeEndTurn } from "./resolutionTurnOps";
import { executeLongRest, executeShortRest } from "./resolutionRestOps";
import type {
  PendingResolution,
  ResolutionCommit,
  ResolutionEvent,
  ResolutionOperation,
} from "./resolutionTypes";

function executeOperation(
  ctx: ResolutionExecutionContext,
  operation: ResolutionOperation,
): OperationExecution {
  switch (operation.kind) {
    case "targeting": return executeTargeting(ctx, operation);
    case "use-economy": return executeEconomy(ctx, operation);
    case "grant-extra-action": return executeGrantExtraAction(ctx, operation);
    case "use-turn-feature": return executeTurnFeature(ctx, operation);
    case "move": return executeMove(ctx, operation);
    case "free-move": return executeFreeMove(ctx, operation);
    case "spend-resource": return executeResource(ctx, operation);
    case "gain-resource": return executeGainResource(ctx, operation);
    case "set-resource-recovery-lockout": return executeSetResourceRecoveryLockout(ctx, operation);
    case "d20": return executeD20(ctx, operation);
    case "damage-roll": return executeDamageRoll(ctx, operation);
    case "damage": return executeDamage(ctx, operation);
    case "compound-damage": return executeCompoundDamage(ctx, operation);
    case "healing": return executeHealing(ctx, operation);
    case "temporary-hp": return executeTemporaryHp(ctx, operation);
    case "death-save": return executeDeathSave(ctx,operation);
    case "stabilize": return executeStabilize(ctx,operation);
    case "apply-effect": return executeApplyEffect(ctx, operation);
    case "update-effect": return executeUpdateEffect(ctx, operation);
    case "remove-effect": return executeRemoveEffect(ctx, operation);
    case "start-concentration": return executeStartConcentration(ctx, operation);
    case "end-concentration": return executeEndConcentration(ctx, operation);
    case "reaction": return executeReaction(ctx, operation);
    case "begin-turn": return executeBeginTurn(ctx, operation);
    case "end-turn": return executeEndTurn(ctx, operation);
    case "advance-time": return executeAdvanceTime(ctx, operation);
    case "short-rest": return executeShortRest(ctx, operation);
    case "long-rest": return executeLongRest(ctx, operation);
  }
}

export function resolvePendingResolution(
  profile: RulesProfileLike,
  inputState: RulesRuntimeState,
  pending: PendingResolution,
): ResolutionCommit {
  if (!pending.id || !pending.actorId || !pending.sourceId) {
    return {
      status:"rejected",
      state:inputState,
      events:[],
      results:{},
      error:"pending resolution id, actorId, and sourceId are required",
    };
  }
  if (pending.expectedRevision !== inputState.revision) {
    return {
      status:"rejected",
      state:inputState,
      events:[],
      results:{},
      error:`revision mismatch: expected ${pending.expectedRevision}, current ${inputState.revision}`,
    };
  }

  const state = cloneRuntimeState(inputState);
  const ctx: ResolutionExecutionContext = {
    profile,
    pending,
    state,
    results:new Map<string, unknown>(),
  };
  const events: ResolutionEvent[] = [];
  let currentOperation: ResolutionOperation | undefined;

  try {
    for (const operation of pending.operations) {
      currentOperation = operation;
      if (!operation.id) throw new DomainEvaluationError("operation id is required");
      if (ctx.results.has(operation.id)) {
        throw new DomainEvaluationError(`duplicate operation id: ${operation.id}`);
      }

      if (!predicateMatches(ctx.results, operation.when)) {
        const skipped = { skipped:true };
        ctx.results.set(operation.id, skipped);
        events.push(makeEvent(pending, operation, "operation skipped by predicate", skipped, [], []));
        continue;
      }

      const execution = executeOperation(ctx, operation);
      ctx.results.set(operation.id, execution.result);
      events.push(execution.event);
    }
  } catch (error) {
    return {
      status:"rejected",
      state:inputState,
      events:[],
      results:{},
      error:error instanceof Error ? error.message : String(error),
      failedOperationId:currentOperation?.id,
    };
  }

  state.revision += 1;
  state.history.push(...events.map((entry) => ({
    id:entry.id,
    resolutionId:entry.resolutionId,
    operationId:entry.operationId,
    kind:entry.kind,
    actorId:entry.actorId,
    targetId:entry.targetId,
    summary:entry.summary,
  })));

  return {
    status:"committed",
    state,
    events,
    results:Object.fromEntries(ctx.results.entries()),
  };
}
