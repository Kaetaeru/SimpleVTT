import type { RulesRuntimeState } from "./combatState";
import type { RulesProfileLike } from "./profileEngine";
import type { TargetingResolution } from "./targeting";
import type { NumericOperand, OperationPredicate, PendingResolution, ResolutionEvent, ResolutionOperation } from "./resolutionTypes";

export interface ResolutionExecutionContext {
  profile: RulesProfileLike;
  pending: PendingResolution;
  state: RulesRuntimeState;
  results: Map<string, unknown>;
}

export interface OperationExecution {
  result: unknown;
  event: ResolutionEvent;
}

export function valueFromResult(results: Map<string, unknown>, operand: NumericOperand) {
  if (typeof operand === "number") return operand;
  const result = results.get(operand.operationId);
  if (!result || typeof result !== "object") throw new Error(`numeric result not found: ${operand.operationId}`);
  const value = (result as Record<string, unknown>)[operand.field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`numeric field ${operand.field} missing on ${operand.operationId}`);
  }
  return value;
}

export function predicateMatches(results: Map<string, unknown>, predicate: OperationPredicate | undefined) {
  if (!predicate) return true;
  const result = results.get(predicate.operationId);
  if (!result || typeof result !== "object") throw new Error(`predicate result not found: ${predicate.operationId}`);
  return (result as Record<string, unknown>)[predicate.field] === predicate.equals;
}

export function targetingResult(results: Map<string, unknown>, operationId: string) {
  const result = results.get(operationId) as TargetingResolution | undefined;
  if (!result || !Array.isArray(result.targets)) throw new Error(`targeting result not found: ${operationId}`);
  return result;
}

export function makeEvent(
  pending: PendingResolution,
  operation: ResolutionOperation,
  summary: string,
  result: unknown,
  provenance: ResolutionEvent["provenance"],
  stateChanges: ResolutionEvent["stateChanges"],
  targetId?: string,
): ResolutionEvent {
  return {
    id: `${pending.id}:${operation.id}`,
    resolutionId: pending.id,
    operationId: operation.id,
    kind: operation.kind,
    actorId: pending.actorId,
    targetId,
    summary,
    provenance,
    stateChanges,
    result,
  };
}
