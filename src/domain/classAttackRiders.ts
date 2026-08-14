import type { AttackDamageComponent, AttackSourceKind } from "./attack";
import {
  CLERIC_DIVINE_STRIKE_OPTION,
  CLERIC_POTENT_SPELLCASTING_OPTION,
} from "./clericProgressionChoices";
import { clericBlessedStrikesChoice, clericDivineStrikeDiceCount } from "./clericBlessedStrikes";
import {
  DRUID_POTENT_SPELLCASTING_OPTION,
  DRUID_PRIMAL_STRIKE_OPTION,
} from "./druidProgressionChoices";
import { DomainEvaluationError } from "./profileEngine";

export type ClericDivineStrikeDamageType = "necrotic" | "radiant";
export type DruidPrimalStrikeDamageType = "cold" | "fire" | "lightning" | "thunder";

function optionSet(optionIds: readonly string[] | undefined) {
  return new Set(optionIds ?? []);
}

export function druidPrimalStrikeDiceCount(
  druidLevel: number,
  optionIds: readonly string[] | undefined,
) {
  if (!Number.isInteger(druidLevel) || druidLevel < 0 || druidLevel > 20) {
    throw new DomainEvaluationError("Druid level must be an integer from 0 to 20");
  }
  const ids = optionSet(optionIds);
  if (ids.has(DRUID_PRIMAL_STRIKE_OPTION) && ids.has(DRUID_POTENT_SPELLCASTING_OPTION)) {
    throw new DomainEvaluationError("Elemental Fury cannot contain both persistent options");
  }
  if (!ids.has(DRUID_PRIMAL_STRIKE_OPTION)) return 0;
  if (druidLevel < 7) throw new DomainEvaluationError("Primal Strike requires Druid level 7");
  return druidLevel >= 15 ? 2 : 1;
}

export function clericDivineStrikeRider(args: {
  clericLevel: number;
  persistentFeatureOptionIds?: readonly string[];
  sourceKind: AttackSourceKind;
  damageType: ClericDivineStrikeDamageType;
  faces: number[];
}): AttackDamageComponent | undefined {
  if (clericBlessedStrikesChoice(args.persistentFeatureOptionIds) !== "divine-strike") return undefined;
  if (args.sourceKind !== "weapon") {
    throw new DomainEvaluationError("Divine Strike requires an attack made with a weapon");
  }
  const count = clericDivineStrikeDiceCount(args.clericLevel, args.persistentFeatureOptionIds);
  return {
    sourceId:CLERIC_DIVINE_STRIKE_OPTION,
    damageType:args.damageType,
    oncePerOwnTurnFeatureId:CLERIC_DIVINE_STRIKE_OPTION,
    dice:[{
      source:CLERIC_DIVINE_STRIKE_OPTION,
      count,
      sides:8,
      faces:args.faces,
    }],
  };
}

export function druidPrimalStrikeRider(args: {
  druidLevel: number;
  persistentFeatureOptionIds?: readonly string[];
  sourceKind: AttackSourceKind;
  damageType: DruidPrimalStrikeDamageType;
  faces: number[];
}): AttackDamageComponent | undefined {
  const count = druidPrimalStrikeDiceCount(args.druidLevel, args.persistentFeatureOptionIds);
  if (count === 0) return undefined;
  if (args.sourceKind !== "weapon" && args.sourceKind !== "wild-shape") {
    throw new DomainEvaluationError("Primal Strike requires a weapon or Wild Shape form attack");
  }
  return {
    sourceId:DRUID_PRIMAL_STRIKE_OPTION,
    damageType:args.damageType,
    oncePerOwnTurnFeatureId:DRUID_PRIMAL_STRIKE_OPTION,
    dice:[{
      source:DRUID_PRIMAL_STRIKE_OPTION,
      count,
      sides:8,
      faces:args.faces,
    }],
  };
}
