import type { AbilityKey } from "./conditions";
import type { FixedDiceInput, ModifierContribution } from "./d20";
import type { RulesRuntimeState } from "./combatState";
import { FIGHTER_INDOMITABLE_RESOURCE_ID } from "./coreClassResources";
import { DomainEvaluationError, type RollStateContribution, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";

export const FIGHTER_INDOMITABLE_SOURCE = "feature:fighter.indomitable";

export interface FighterIndomitableRequest {
  id: string;
  actorId: string;
  expectedRevision: number;
  fighterLevel: number;
  originalOutcome: "failure";
  ability: AbilityKey;
  target: number;
  modifierContributions: ModifierContribution[];
  rollStateContributions?: RollStateContribution[];
  dice: FixedDiceInput;
  resourceId?: string;
}

export function compileFighterIndomitable(request: FighterIndomitableRequest): PendingResolution {
  if (!Number.isInteger(request.fighterLevel) || request.fighterLevel < 9 || request.fighterLevel > 20) {
    throw new DomainEvaluationError("Indomitable requires Fighter level 9-20");
  }
  if (request.originalOutcome !== "failure") {
    throw new DomainEvaluationError("Indomitable can only follow a failed saving throw");
  }
  if (!Number.isFinite(request.target)) throw new DomainEvaluationError("Indomitable saving throw target must be finite");
  const operations: ResolutionOperation[] = [
    {
      id:`${request.id}:resource`,
      kind:"spend-resource",
      actorId:request.actorId,
      resourceId:request.resourceId ?? FIGHTER_INDOMITABLE_RESOURCE_ID,
      amount:1,
    },
    {
      id:`${request.id}:reroll`,
      kind:"d20",
      actorId:request.actorId,
      request:{
        family:"saving-throw",
        target:request.target,
        modifierContributions:[
          ...request.modifierContributions,
          { source:FIGHTER_INDOMITABLE_SOURCE, value:request.fighterLevel },
        ],
        rollStateContributions:[...(request.rollStateContributions ?? [])],
        dice:request.dice,
        targetSource:`${FIGHTER_INDOMITABLE_SOURCE}:original-save-dc`,
      },
      condition:{ ability:request.ability },
    },
  ];
  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:FIGHTER_INDOMITABLE_SOURCE,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveFighterIndomitable(
  profile: RulesProfileLike,
  inputState: RulesRuntimeState,
  request: FighterIndomitableRequest,
): ResolutionCommit {
  try {
    return resolvePendingResolution(profile, inputState, compileFighterIndomitable(request));
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
