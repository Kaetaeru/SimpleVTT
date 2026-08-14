import { requireCombatant, type RulesRuntimeState } from "./combatState";
import { FIGHTER_SECOND_WIND_RESOURCE_ID } from "./coreClassResources";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import { findResource } from "./resources";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";

export const FIGHTER_TACTICAL_MIND_SOURCE = "feature:fighter.tactical-mind";

export interface FighterTacticalMindRequest {
  id: string;
  actorId: string;
  expectedRevision: number;
  fighterLevel: number;
  failedCheckTotal: number;
  target: number;
  d10Face: number;
  secondWindResourceId?: string;
}

export interface FighterTacticalMindCheck {
  initialTotal: number;
  target: number;
  bonus: number;
  finalTotal: number;
  outcome: "success" | "failure";
  secondWindExpended: boolean;
}

function validateRequest(request: FighterTacticalMindRequest) {
  if (!Number.isInteger(request.fighterLevel) || request.fighterLevel < 2 || request.fighterLevel > 20) {
    throw new DomainEvaluationError("Tactical Mind requires Fighter level 2-20");
  }
  if (!Number.isFinite(request.failedCheckTotal) || !Number.isFinite(request.target)) {
    throw new DomainEvaluationError("Tactical Mind check total and target must be finite");
  }
  if (request.failedCheckTotal >= request.target) {
    throw new DomainEvaluationError("Tactical Mind can only follow a failed ability check");
  }
  if (!Number.isInteger(request.d10Face) || request.d10Face < 1 || request.d10Face > 10) {
    throw new DomainEvaluationError("Tactical Mind requires one fixed d10 face from 1 to 10");
  }
}

function checkResult(request: FighterTacticalMindRequest): FighterTacticalMindCheck {
  const finalTotal = request.failedCheckTotal + request.d10Face;
  const outcome = finalTotal >= request.target ? "success" : "failure";
  return {
    initialTotal:request.failedCheckTotal,
    target:request.target,
    bonus:request.d10Face,
    finalTotal,
    outcome,
    secondWindExpended:outcome === "success",
  };
}

function requireSecondWindUse(inputState: RulesRuntimeState, request: FighterTacticalMindRequest) {
  const actor = requireCombatant(inputState, request.actorId);
  const found = findResource(actor.resources, request.secondWindResourceId ?? FIGHTER_SECOND_WIND_RESOURCE_ID);
  if (found.pool.current < 1) throw new DomainEvaluationError("Tactical Mind requires an available Second Wind use");
}

export function compileFighterTacticalMind(
  request: FighterTacticalMindRequest,
  check: FighterTacticalMindCheck = checkResult(request),
): PendingResolution {
  validateRequest(request);
  const operations: ResolutionOperation[] = [{
    id:`${request.id}:bonus-roll`,
    kind:"damage-roll",
    request:{
      dice:[{
        source:FIGHTER_TACTICAL_MIND_SOURCE,
        sides:10,
        count:1,
        faces:[request.d10Face],
      }],
    },
  }];
  if (check.secondWindExpended) {
    operations.push({
      id:`${request.id}:second-wind`,
      kind:"spend-resource",
      actorId:request.actorId,
      resourceId:request.secondWindResourceId ?? FIGHTER_SECOND_WIND_RESOURCE_ID,
      amount:1,
    });
  }
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:FIGHTER_TACTICAL_MIND_SOURCE,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveFighterTacticalMind(
  profile: RulesProfileLike,
  inputState: RulesRuntimeState,
  request: FighterTacticalMindRequest,
): ResolutionCommit & { check?:FighterTacticalMindCheck } {
  try {
    validateRequest(request);
    requireSecondWindUse(inputState, request);
    const check = checkResult(request);
    const commit = resolvePendingResolution(profile, inputState, compileFighterTacticalMind(request, check));
    return { ...commit, check };
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
