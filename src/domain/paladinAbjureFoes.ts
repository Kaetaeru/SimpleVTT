import type { FixedDiceInput } from "./d20";
import type { RulesRuntimeState } from "./combatState";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import type { TargetFacts } from "./targeting";
import { PALADIN_CHANNEL_DIVINITY_RESOURCE_ID } from "./coreClassResources";

export const ABJURE_FOES_SOURCE_ID = "feature:paladin.channel-divinity.abjure-foes";
export const ABJURE_FOES_TAG = "paladin:abjure-foes";

export interface AbjureFoesTarget extends TargetFacts {
  wisdomSaveModifier: number;
  saveDice: FixedDiceInput;
}

export interface AbjureFoesRequest {
  id: string;
  actorId: string;
  expectedRevision: number;
  paladinLevel: number;
  charismaModifier: number;
  spellSaveDc: number;
  targets: AbjureFoesTarget[];
  channelDivinityResourceId?: string;
  useActionEconomy?: boolean;
}

export function abjureFoesMaximumTargets(charismaModifier: number) {
  if (!Number.isInteger(charismaModifier)) throw new DomainEvaluationError("Charisma modifier must be an integer");
  return Math.max(1, charismaModifier);
}

function validateRequest(request: AbjureFoesRequest) {
  if (!Number.isInteger(request.paladinLevel) || request.paladinLevel < 9 || request.paladinLevel > 20) {
    throw new DomainEvaluationError("Abjure Foes requires Paladin level 9-20");
  }
  if (!Number.isFinite(request.spellSaveDc)) throw new DomainEvaluationError("Paladin spell save DC must be finite");
  const maximumTargets = abjureFoesMaximumTargets(request.charismaModifier);
  if (!request.targets.length) throw new DomainEvaluationError("Abjure Foes requires at least one target");
  if (request.targets.length > maximumTargets) {
    throw new DomainEvaluationError(`Abjure Foes can target at most ${maximumTargets} creature(s)`);
  }
  for (const target of request.targets) {
    if (!Number.isFinite(target.wisdomSaveModifier)) {
      throw new DomainEvaluationError(`target Wisdom save modifier must be finite: ${target.id}`);
    }
  }
}

export function compileAbjureFoes(request: AbjureFoesRequest): PendingResolution {
  validateRequest(request);
  const operations: ResolutionOperation[] = [
    {
      id:`${request.id}:targets`,
      kind:"targeting",
      sourceId:request.actorId,
      rule:{
        kind:"creature",
        rangeFeet:60,
        minTargets:1,
        maxTargets:abjureFoesMaximumTargets(request.charismaModifier),
        allowedRelations:["self","ally","enemy","neutral"],
        requiresSight:true,
        directTarget:true,
      },
      targets:request.targets,
      harmful:true,
    },
    ...(request.useActionEconomy===false?[]:[{
      id:`${request.id}:action`,
      kind:"use-economy" as const,
      actorId:request.actorId,
      slot:"action" as const,
      actionKind:"magic" as const,
    }]),
    {
      id:`${request.id}:channel-divinity`,
      kind:"spend-resource",
      actorId:request.actorId,
      resourceId:request.channelDivinityResourceId ?? PALADIN_CHANNEL_DIVINITY_RESOURCE_ID,
      amount:1,
    },
  ];

  request.targets.forEach((target, index) => {
    const saveId = `${request.id}:save:${index}`;
    operations.push(
      {
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
          targetSource:`${ABJURE_FOES_SOURCE_ID}:spell-save-dc`,
        },
        condition:{ ability:"wis" },
      },
      {
        id:`${request.id}:frightened:${index}`,
        kind:"apply-effect",
        when:{ operationId:saveId, field:"outcome", equals:"failure" },
        effect:{
          id:`${request.id}:${target.id}:frightened`,
          sourceId:ABJURE_FOES_SOURCE_ID,
          sourceActorId:request.actorId,
          targetId:target.id,
          kind:"condition",
          conditionId:"frightened",
          tags:[ABJURE_FOES_TAG],
          duration:{ kind:"minutes", amount:1 },
          termination:{ targetTakesDamage:true },
          turnActivity:{ chooseOneOf:["movement","action","bonus-action"] },
          metadata:{ displayName:"적 질책" },
        },
      },
    );
  });

  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:ABJURE_FOES_SOURCE_ID,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveAbjureFoes(
  profile: RulesProfileLike,
  inputState: RulesRuntimeState,
  request: AbjureFoesRequest,
): ResolutionCommit {
  try {
    return resolvePendingResolution(profile, inputState, compileAbjureFoes(request));
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
