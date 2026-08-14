import type { RulesRuntimeState } from "./combatState";
import { FIGHTER_SECOND_WIND_RESOURCE_ID } from "./coreClassResources";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";

export const FIGHTER_SECOND_WIND_SOURCE = "feature:fighter.second-wind";
export const FIGHTER_TACTICAL_SHIFT_SOURCE = "feature:fighter.tactical-shift";

export interface FighterSecondWindRequest {
  id: string;
  actorId: string;
  expectedRevision: number;
  fighterLevel: number;
  d10Face: number;
  useActionEconomy: boolean;
  resourceId?: string;
  tacticalShift?: {
    speedFeet:number;
    distanceFeet:number;
  };
}

export function compileFighterSecondWind(request: FighterSecondWindRequest): PendingResolution {
  if (!Number.isInteger(request.fighterLevel) || request.fighterLevel < 1 || request.fighterLevel > 20) {
    throw new DomainEvaluationError("Second Wind requires Fighter level 1-20");
  }
  if (!Number.isInteger(request.d10Face) || request.d10Face < 1 || request.d10Face > 10) {
    throw new DomainEvaluationError("Second Wind requires one fixed d10 face from 1 to 10");
  }
  if (request.tacticalShift) {
    if (request.fighterLevel < 5) throw new DomainEvaluationError("Tactical Shift requires Fighter level 5");
    if (!request.useActionEconomy) throw new DomainEvaluationError("Tactical Shift requires Second Wind to be activated with its Bonus Action");
    if (!Number.isFinite(request.tacticalShift.speedFeet) || request.tacticalShift.speedFeet < 0) {
      throw new DomainEvaluationError("Tactical Shift Speed must be a non-negative finite number");
    }
    if (!Number.isFinite(request.tacticalShift.distanceFeet) || request.tacticalShift.distanceFeet < 0) {
      throw new DomainEvaluationError("Tactical Shift movement must be a non-negative finite number");
    }
    const maximum = request.tacticalShift.speedFeet / 2;
    if (request.tacticalShift.distanceFeet > maximum) {
      throw new DomainEvaluationError(`Tactical Shift cannot exceed ${maximum} feet`);
    }
  }
  const rollId = `${request.id}:healing-roll`;
  const operations: ResolutionOperation[] = [];
  if (request.useActionEconomy) {
    operations.push({
      id:`${request.id}:bonus-action`,
      kind:"use-economy",
      actorId:request.actorId,
      slot:"bonus-action",
      bonusActionGranted:true,
    });
  }
  operations.push(
    {
      id:`${request.id}:resource`,
      kind:"spend-resource",
      actorId:request.actorId,
      resourceId:request.resourceId ?? FIGHTER_SECOND_WIND_RESOURCE_ID,
      amount:1,
    },
    {
      id:rollId,
      kind:"damage-roll",
      request:{
        dice:[{
          source:FIGHTER_SECOND_WIND_SOURCE,
          sides:10,
          count:1,
          faces:[request.d10Face],
        }],
        flat:[{
          source:`${FIGHTER_SECOND_WIND_SOURCE}:fighter-level`,
          value:request.fighterLevel,
        }],
      },
    },
    {
      id:`${request.id}:healing`,
      kind:"healing",
      targetId:request.actorId,
      amount:{ operationId:rollId, field:"total" },
    },
  );
  if (request.tacticalShift) {
    operations.push({
      id:`${request.id}:tactical-shift`,
      kind:"free-move",
      actorId:request.actorId,
      distanceFeet:request.tacticalShift.distanceFeet,
      maximumDistanceFeet:request.tacticalShift.speedFeet / 2,
      doesNotProvokeOpportunityAttacks:true,
    });
  }
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:request.tacticalShift ? FIGHTER_TACTICAL_SHIFT_SOURCE : FIGHTER_SECOND_WIND_SOURCE,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveFighterSecondWind(
  profile: RulesProfileLike,
  inputState: RulesRuntimeState,
  request: FighterSecondWindRequest,
): ResolutionCommit {
  try {
    return resolvePendingResolution(profile, inputState, compileFighterSecondWind(request));
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
