import type { FixedDiceInput } from "./d20";
import type { RulesRuntimeState } from "./combatState";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import type { TargetFacts } from "./targeting";
import { CLERIC_CHANNEL_DIVINITY_RESOURCE_ID } from "./coreClassResources";

export const DIVINE_SPARK_SOURCE_ID = "feature:cleric.channel-divinity.divine-spark";

export interface DivineSparkTarget extends TargetFacts {
  constitutionSaveModifier: number;
  creatureKind: "character" | "monster";
}

type DamageOperation = Extract<ResolutionOperation, { kind:"damage" }>;

export type DivineSparkRequest = {
  id: string;
  actorId: string;
  expectedRevision: number;
  clericLevel: number;
  wisdomModifier: number;
  spellSaveDc: number;
  target: DivineSparkTarget;
  effectFaces: number[];
  channelDivinityResourceId?: string;
} & (
  | { mode:"healing" }
  | {
      mode:"damage";
      damageType:"necrotic" | "radiant";
      saveDice:FixedDiceInput;
      concentrationCheck?:DamageOperation["concentrationCheck"];
    }
);

export function clericDivineSparkDiceCount(clericLevel: number) {
  if (!Number.isInteger(clericLevel) || clericLevel < 2 || clericLevel > 20) {
    throw new DomainEvaluationError("Divine Spark requires Cleric level 2-20");
  }
  if (clericLevel >= 18) return 4;
  if (clericLevel >= 13) return 3;
  if (clericLevel >= 7) return 2;
  return 1;
}

export function compileDivineSpark(request: DivineSparkRequest): PendingResolution {
  const diceCount = clericDivineSparkDiceCount(request.clericLevel);
  if (!Number.isFinite(request.wisdomModifier)) throw new DomainEvaluationError("Wisdom modifier must be finite");
  if (!Number.isFinite(request.spellSaveDc)) throw new DomainEvaluationError("Cleric spell save DC must be finite");
  const targetId = request.target.id;
  const targetOpId = `${request.id}:target`;
  const rollId = `${request.id}:effect-roll`;
  const operations: ResolutionOperation[] = [
    {
      id:targetOpId,
      kind:"targeting",
      sourceId:request.actorId,
      rule:{
        kind:"creature",
        rangeFeet:30,
        minTargets:1,
        maxTargets:1,
        allowedRelations:["ally","enemy","neutral"],
        requiresSight:true,
        directTarget:true,
      },
      targets:[request.target],
      harmful:request.mode === "damage",
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
    {
      id:rollId,
      kind:"damage-roll",
      request:{
        dice:[{
          source:DIVINE_SPARK_SOURCE_ID,
          sides:8,
          count:diceCount,
          faces:request.effectFaces,
        }],
        flat:[{ source:`${DIVINE_SPARK_SOURCE_ID}:wisdom`, value:request.wisdomModifier }],
      },
    },
  ];

  if (request.mode === "healing") {
    operations.push({
      id:`${request.id}:healing`,
      kind:"healing",
      targetId,
      amount:{ operationId:rollId, field:"total" },
    });
  } else {
    if (!Number.isFinite(request.target.constitutionSaveModifier)) {
      throw new DomainEvaluationError("target Constitution save modifier must be finite");
    }
    const saveId = `${request.id}:save`;
    operations.push(
      {
        id:saveId,
        kind:"d20",
        actorId:targetId,
        targetId,
        request:{
          family:"saving-throw",
          target:request.spellSaveDc,
          modifierContributions:[{
            source:`target:${targetId}:constitution-save`,
            value:request.target.constitutionSaveModifier,
          }],
          dice:request.saveDice,
          targetSource:`${DIVINE_SPARK_SOURCE_ID}:spell-save-dc`,
        },
        condition:{ ability:"con" },
      },
      {
        id:`${request.id}:damage:failure`,
        kind:"damage",
        when:{ operationId:saveId, field:"outcome", equals:"failure" },
        targetId,
        damageType:request.damageType,
        amount:{ operationId:rollId, field:"total" },
        creatureKind:request.target.creatureKind,
        concentrationCheck:request.concentrationCheck,
      },
      {
        id:`${request.id}:damage:success`,
        kind:"damage",
        when:{ operationId:saveId, field:"outcome", equals:"success" },
        targetId,
        damageType:request.damageType,
        amount:{ operationId:rollId, field:"total", multiplier:0.5, rounding:"floor" },
        creatureKind:request.target.creatureKind,
        concentrationCheck:request.concentrationCheck,
      },
    );
  }

  return {
    id:request.id,
    actorId:request.actorId,
    sourceId:DIVINE_SPARK_SOURCE_ID,
    expectedRevision:request.expectedRevision,
    operations,
  };
}

export function resolveDivineSpark(
  profile: RulesProfileLike,
  inputState: RulesRuntimeState,
  request: DivineSparkRequest,
): ResolutionCommit {
  try {
    return resolvePendingResolution(profile, inputState, compileDivineSpark(request));
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
