import type { RulesRuntimeState } from "./combatState";
import { conditionEffectsFor } from "./combatState";
import type { ConditionId } from "./conditions";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import type { TargetFacts } from "./targeting";
import { PALADIN_LAY_ON_HANDS_RESOURCE_ID } from "./coreClassResources";

export const LAY_ON_HANDS_SOURCE_ID = "feature:paladin.lay-on-hands";

export type LayOnHandsRemovableCondition =
  | "poisoned"
  | "blinded"
  | "charmed"
  | "deafened"
  | "frightened"
  | "paralyzed"
  | "stunned";

const RESTORING_TOUCH_CONDITIONS = new Set<LayOnHandsRemovableCondition>([
  "blinded","charmed","deafened","frightened","paralyzed","stunned",
]);

export interface LayOnHandsRequest {
  id: string;
  actorId: string;
  expectedRevision: number;
  paladinLevel: number;
  target: TargetFacts;
  healingAmount: number;
  removeConditions?: LayOnHandsRemovableCondition[];
  resourceId?: string;
}

function validateRequest(request: LayOnHandsRequest) {
  if (!Number.isInteger(request.paladinLevel) || request.paladinLevel < 1 || request.paladinLevel > 20) {
    throw new DomainEvaluationError("Lay On Hands requires Paladin level 1-20");
  }
  if (!Number.isInteger(request.healingAmount) || request.healingAmount < 0) {
    throw new DomainEvaluationError("Lay On Hands healing amount must be a non-negative integer");
  }
  const removals = request.removeConditions ?? [];
  if (new Set(removals).size !== removals.length) {
    throw new DomainEvaluationError("Lay On Hands cannot remove the same condition more than once");
  }
  for (const condition of removals) {
    if (condition !== "poisoned" && (request.paladinLevel < 14 || !RESTORING_TOUCH_CONDITIONS.has(condition))) {
      throw new DomainEvaluationError(`${condition} requires Paladin level 14 Restoring Touch`);
    }
  }
  if (request.healingAmount === 0 && removals.length === 0) {
    throw new DomainEvaluationError("Lay On Hands must heal or remove at least one condition");
  }
}

function conditionEffectIds(
  state: RulesRuntimeState,
  targetId: string,
  conditions: LayOnHandsRemovableCondition[],
) {
  const effects = conditionEffectsFor(state, targetId);
  const byCondition = new Map<ConditionId,string[]>();
  for (const effect of effects) {
    const ids = byCondition.get(effect.conditionId) ?? [];
    ids.push(effect.id);
    byCondition.set(effect.conditionId, ids);
  }
  const result: string[] = [];
  for (const condition of conditions) {
    const ids = byCondition.get(condition) ?? [];
    if (!ids.length) throw new DomainEvaluationError(`target does not have ${condition}`);
    result.push(...ids);
  }
  return result;
}

export function compileLayOnHands(
  request: LayOnHandsRequest,
  removableEffectIds: string[],
): PendingResolution {
  validateRequest(request);
  const removalCount = request.removeConditions?.length ?? 0;
  const spend = request.healingAmount + removalCount * 5;
  const operations: ResolutionOperation[] = [
    {
      id:`${request.id}:target`,
      kind:"targeting",
      sourceId:request.actorId,
      rule:{
        kind:"creature",
        rangeFeet:5,
        minTargets:1,
        maxTargets:1,
        allowedRelations:["self","ally","enemy","neutral"],
        directTarget:true,
      },
      targets:[request.target],
      harmful:false,
    },
    {
      id:`${request.id}:bonus-action`,
      kind:"use-economy",
      actorId:request.actorId,
      slot:"bonus-action",
      bonusActionGranted:true,
    },
    {
      id:`${request.id}:pool`,
      kind:"spend-resource",
      actorId:request.actorId,
      resourceId:request.resourceId ?? PALADIN_LAY_ON_HANDS_RESOURCE_ID,
      amount:spend,
    },
  ];
  if (request.healingAmount > 0) {
    operations.push({
      id:`${request.id}:healing`,
      kind:"healing",
      targetId:request.target.id,
      amount:request.healingAmount,
    });
  }
  for (const [index, effectId] of removableEffectIds.entries()) {
    operations.push({
      id:`${request.id}:remove-condition:${index}`,
      kind:"remove-effect",
      effectId,
    });
  }
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:LAY_ON_HANDS_SOURCE_ID,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveLayOnHands(
  profile: RulesProfileLike,
  inputState: RulesRuntimeState,
  request: LayOnHandsRequest,
): ResolutionCommit {
  try {
    validateRequest(request);
    if (request.expectedRevision !== inputState.revision) {
      throw new DomainEvaluationError(`revision mismatch: expected ${request.expectedRevision}, current ${inputState.revision}`);
    }
    const effectIds = conditionEffectIds(inputState, request.target.id, request.removeConditions ?? []);
    return resolvePendingResolution(profile, inputState, compileLayOnHands(request, effectIds));
  } catch (error) {
    return {
      status:"rejected",
      state:inputState,
      events:[],
      results:{},
      error:error instanceof Error ? error.message : String(error),
    };
  }
}
