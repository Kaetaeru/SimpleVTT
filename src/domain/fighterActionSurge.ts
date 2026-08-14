import type { RulesRuntimeState } from "./combatState";
import {
  FIGHTER_ACTION_SURGE_RESOURCE_ID,
  FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID,
} from "./coreClassResources";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";

export const FIGHTER_ACTION_SURGE_SOURCE = "feature:fighter.action-surge";

export interface FighterActionSurgeRequest {
  id: string;
  actorId: string;
  expectedRevision: number;
  fighterLevel: number;
  resourceId?: string;
  turnGateResourceId?: string;
}

export function compileFighterActionSurge(request: FighterActionSurgeRequest): PendingResolution {
  if (!Number.isInteger(request.fighterLevel) || request.fighterLevel < 2 || request.fighterLevel > 20) {
    throw new DomainEvaluationError("Action Surge requires Fighter level 2-20");
  }
  const operations: ResolutionOperation[] = [
    {
      id:`${request.id}:resource`,
      kind:"spend-resource",
      actorId:request.actorId,
      resourceId:request.resourceId ?? FIGHTER_ACTION_SURGE_RESOURCE_ID,
      amount:1,
    },
    {
      id:`${request.id}:turn-gate`,
      kind:"spend-resource",
      actorId:request.actorId,
      resourceId:request.turnGateResourceId ?? FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID,
      amount:1,
    },
    {
      id:`${request.id}:extra-action`,
      kind:"grant-extra-action",
      actorId:request.actorId,
      grantId:`${request.id}:action-surge`,
      allowsMagicAction:false,
    },
  ];
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:FIGHTER_ACTION_SURGE_SOURCE,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveFighterActionSurge(
  profile: RulesProfileLike,
  inputState: RulesRuntimeState,
  request: FighterActionSurgeRequest,
): ResolutionCommit {
  try {
    if (inputState.clock.activeActorId !== request.actorId || inputState.clock.phase === "end") {
      throw new DomainEvaluationError("Action Surge can be used only on the Fighter's turn");
    }
    return resolvePendingResolution(profile, inputState, compileFighterActionSurge(request));
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
