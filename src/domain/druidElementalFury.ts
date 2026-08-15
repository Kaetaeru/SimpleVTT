import { addSingleCantripDamageFlatModifier, requireClassCantrip, withClassCantripRangeIncrease } from "./cantripDamageModifier";
import type { RulesRuntimeState } from "./combatState";
import {
  DRUID_ID,
  DRUID_POTENT_SPELLCASTING_OPTION,
  DRUID_PRIMAL_STRIKE_OPTION,
} from "./druidProgressionChoices";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import {
  compileSpellCast,
  type SpellCastRequest,
  type SpellCastResolution,
  type SpellMechanicDefinition,
} from "./spellcasting";

export type DruidElementalFuryChoice = "potent-spellcasting" | "primal-strike" | undefined;

export interface DruidElementalFuryContext {
  druidLevel:number;
  wisdomModifier:number;
  persistentFeatureOptionIds?:readonly string[];
}

function validateLevel(level:number) {
  if (!Number.isInteger(level) || level < 0 || level > 20) {
    throw new DomainEvaluationError("Druid level must be an integer from 0 to 20");
  }
}

export function druidElementalFuryChoice(optionIds:readonly string[]|undefined):DruidElementalFuryChoice {
  const ids = new Set(optionIds ?? []);
  const potent = ids.has(DRUID_POTENT_SPELLCASTING_OPTION);
  const primal = ids.has(DRUID_PRIMAL_STRIKE_OPTION);
  if (potent && primal) throw new DomainEvaluationError("Elemental Fury cannot contain both persistent options");
  if (potent) return "potent-spellcasting";
  if (primal) return "primal-strike";
  return undefined;
}

export function druidPotentSpellcastingModifier(context:DruidElementalFuryContext) {
  validateLevel(context.druidLevel);
  if (!Number.isFinite(context.wisdomModifier)) throw new DomainEvaluationError("Wisdom modifier must be finite");
  if (druidElementalFuryChoice(context.persistentFeatureOptionIds) !== "potent-spellcasting") return 0;
  if (context.druidLevel < 7) throw new DomainEvaluationError("Potent Spellcasting requires Druid level 7");
  return context.wisdomModifier;
}

export function druidPotentSpellcastingDefinition(
  definition:SpellMechanicDefinition,
  context:DruidElementalFuryContext,
) {
  validateLevel(context.druidLevel);
  const choice = druidElementalFuryChoice(context.persistentFeatureOptionIds);
  if (choice !== "potent-spellcasting") return structuredClone(definition);
  requireClassCantrip(definition,DRUID_ID);
  if (context.druidLevel < 7) throw new DomainEvaluationError("Potent Spellcasting requires Druid level 7");
  if (context.druidLevel < 15) return structuredClone(definition);
  return withClassCantripRangeIncrease({
    definition,
    classId:DRUID_ID,
    minimumRangeFeet:10,
    increaseFeet:300,
  });
}

function rejected(
  inputState:RulesRuntimeState,
  request:SpellCastRequest,
  error:unknown,
  failedOperationId?:string,
):SpellCastResolution {
  return {
    status:"rejected",
    state:inputState,
    spellId:request.spellId,
    slotLevel:request.slotLevel,
    error:error instanceof Error ? error.message : String(error),
    failedOperationId,
    events:[],
    results:{},
  };
}

export function resolveDruidCantripWithElementalFury(
  profile:RulesProfileLike,
  definition:SpellMechanicDefinition,
  inputState:RulesRuntimeState,
  request:SpellCastRequest,
  context:DruidElementalFuryContext,
):SpellCastResolution {
  try {
    validateLevel(context.druidLevel);
    if (!Number.isFinite(context.wisdomModifier)) throw new DomainEvaluationError("Wisdom modifier must be finite");
    const choice = druidElementalFuryChoice(context.persistentFeatureOptionIds);
    const effectiveDefinition = druidPotentSpellcastingDefinition(definition,context);
    const compilation = compileSpellCast(effectiveDefinition,inputState,request);
    if (compilation.slotted) throw new DomainEvaluationError("Elemental Fury cantrip wrapper cannot resolve a slotted spell");
    const pending = structuredClone(compilation.pending);

    if (choice === "potent-spellcasting") {
      addSingleCantripDamageFlatModifier({
        definition:effectiveDefinition,
        operations:pending.operations,
        classId:DRUID_ID,
        sourceId:DRUID_POTENT_SPELLCASTING_OPTION,
        value:context.wisdomModifier,
      });
    }

    const commit = resolvePendingResolution(profile,inputState,pending);
    if (commit.status === "rejected") return rejected(inputState,request,commit.error,commit.failedOperationId);
    return {
      status:"committed",
      state:commit.state,
      spellId:request.spellId,
      slotLevel:request.slotLevel,
      events:commit.events,
      results:commit.results,
    };
  } catch (error) {
    return rejected(inputState,request,error);
  }
}
