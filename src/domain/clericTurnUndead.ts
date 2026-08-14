import type { FixedDiceInput } from "./d20";
import type { RulesRuntimeState } from "./combatState";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import type { TargetFacts } from "./targeting";
import { CLERIC_CHANNEL_DIVINITY_RESOURCE_ID } from "./coreClassResources";

export const TURN_UNDEAD_SOURCE_ID = "feature:cleric.channel-divinity.turn-undead";
export const TURN_UNDEAD_TAG = "cleric:turn-undead";

interface TurnUndeadDamageOperation extends Extract<ResolutionOperation, { kind:"damage" }> {}

export interface TurnUndeadTarget extends TargetFacts {
  creatureType: string;
  wisdomSaveModifier: number;
  creatureKind: "character" | "monster";
  saveDice: FixedDiceInput;
  concentrationCheck?: TurnUndeadDamageOperation["concentrationCheck"];
}

export interface TurnUndeadRequest {
  id: string;
  actorId: string;
  expectedRevision: number;
  clericLevel: number;
  wisdomModifier: number;
  spellSaveDc: number;
  targets: TurnUndeadTarget[];
  searUndead?: { effectFaces:number[] };
  channelDivinityResourceId?: string;
}

export interface TurnUndeadMovementDirective {
  active: boolean;
  sourceActorIds: string[];
  mustMoveAsFarFromSourcesAsPossible: boolean;
}

function requireClericLevel(level: number) {
  if (!Number.isInteger(level) || level < 2 || level > 20) {
    throw new DomainEvaluationError("Turn Undead requires Cleric level 2-20");
  }
}

export function searUndeadDiceCount(wisdomModifier: number) {
  if (!Number.isInteger(wisdomModifier)) throw new DomainEvaluationError("Wisdom modifier must be an integer");
  return Math.max(1, wisdomModifier);
}

function validateTarget(target: TurnUndeadTarget) {
  if (target.creatureType.toLowerCase() !== "undead") {
    throw new DomainEvaluationError(`Turn Undead target must be Undead: ${target.id}`);
  }
  if (!Number.isFinite(target.wisdomSaveModifier)) {
    throw new DomainEvaluationError(`target Wisdom save modifier must be finite: ${target.id}`);
  }
}

function turnedConditionEffect(
  request: TurnUndeadRequest,
  target: TurnUndeadTarget,
  conditionId: "frightened" | "incapacitated",
) {
  return {
    id:`${request.id}:${target.id}:${conditionId}`,
    sourceId:TURN_UNDEAD_SOURCE_ID,
    sourceActorId:request.actorId,
    targetId:target.id,
    kind:"condition" as const,
    conditionId,
    tags:[TURN_UNDEAD_TAG],
    duration:{ kind:"minutes" as const, amount:1 },
    termination:{
      targetTakesDamage:true,
      sourceBecomesIncapacitated:true,
      sourceDies:true,
    },
    metadata:{ movementDirective:"maximize-distance-from-source" },
  };
}

export function compileTurnUndead(request: TurnUndeadRequest): PendingResolution {
  requireClericLevel(request.clericLevel);
  if (!Number.isFinite(request.spellSaveDc)) throw new DomainEvaluationError("Cleric spell save DC must be finite");
  if (!request.targets.length) throw new DomainEvaluationError("Turn Undead requires at least one chosen Undead target");
  request.targets.forEach(validateTarget);
  if (request.searUndead && request.clericLevel < 5) {
    throw new DomainEvaluationError("Sear Undead requires Cleric level 5 or higher");
  }

  const operations: ResolutionOperation[] = [
    {
      id:`${request.id}:targets`,
      kind:"targeting",
      sourceId:request.actorId,
      rule:{
        kind:"creature",
        rangeFeet:30,
        minTargets:1,
        maxTargets:request.targets.length,
        allowedRelations:["self","ally","enemy","neutral"],
        directTarget:true,
      },
      targets:request.targets,
      harmful:true,
    },
    {
      id:`${request.id}:action`,
      kind:"use-economy",
      actorId:request.actorId,
      slot:"action",
    },
    {
      id:`${request.id}:channel-divinity`,
      kind:"spend-resource",
      actorId:request.actorId,
      resourceId:request.channelDivinityResourceId ?? CLERIC_CHANNEL_DIVINITY_RESOURCE_ID,
      amount:1,
    },
  ];

  const searRollId = `${request.id}:sear-roll`;
  if (request.searUndead) {
    operations.push({
      id:searRollId,
      kind:"damage-roll",
      request:{
        dice:[{
          source:"feature:cleric.sear-undead",
          sides:8,
          count:searUndeadDiceCount(request.wisdomModifier),
          faces:request.searUndead.effectFaces,
        }],
        flat:[],
      },
    });
  }

  request.targets.forEach((target, index) => {
    const saveId = `${request.id}:save:${index}`;
    operations.push({
      id:saveId,
      kind:"d20",
      actorId:target.id,
      targetId:target.id,
      request:{
        family:"saving-throw",
        target:request.spellSaveDc,
        modifierContributions:[{
          source:`target:${target.id}:wisdom-save`,
          value:target.wisdomSaveModifier,
        }],
        dice:target.saveDice,
        targetSource:`${TURN_UNDEAD_SOURCE_ID}:spell-save-dc`,
      },
      condition:{ ability:"wis" },
    });

    if (request.searUndead) {
      operations.push({
        id:`${request.id}:sear-damage:${index}`,
        kind:"damage",
        when:{ operationId:saveId, field:"outcome", equals:"failure" },
        targetId:target.id,
        damageType:"radiant",
        amount:{ operationId:searRollId, field:"total" },
        creatureKind:target.creatureKind,
        concentrationCheck:target.concentrationCheck,
      });
    }

    operations.push(
      {
        id:`${request.id}:frightened:${index}`,
        kind:"apply-effect",
        when:{ operationId:saveId, field:"outcome", equals:"failure" },
        effect:turnedConditionEffect(request, target, "frightened"),
      },
      {
        id:`${request.id}:incapacitated:${index}`,
        kind:"apply-effect",
        when:{ operationId:saveId, field:"outcome", equals:"failure" },
        effect:turnedConditionEffect(request, target, "incapacitated"),
      },
    );
  });

  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:TURN_UNDEAD_SOURCE_ID,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveTurnUndead(
  profile: RulesProfileLike,
  inputState: RulesRuntimeState,
  request: TurnUndeadRequest,
): ResolutionCommit {
  try {
    return resolvePendingResolution(profile, inputState, compileTurnUndead(request));
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

export function turnUndeadMovementDirective(
  state: RulesRuntimeState,
  targetId: string,
): TurnUndeadMovementDirective {
  const sourceActorIds = [...new Set(state.effects
    .filter((effect) => effect.targetId === targetId && effect.sourceId === TURN_UNDEAD_SOURCE_ID && effect.tags.includes(TURN_UNDEAD_TAG))
    .map((effect) => effect.sourceActorId)
    .filter((value): value is string => Boolean(value)))];
  return {
    active:sourceActorIds.length > 0,
    sourceActorIds,
    mustMoveAsFarFromSourcesAsPossible:sourceActorIds.length > 0,
  };
}
