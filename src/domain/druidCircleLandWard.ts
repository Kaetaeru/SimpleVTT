import type { CombatantRuntimeState } from "./combatState";
import type { DamageDefenseContribution } from "./damage";
import type { ConditionId } from "./conditions";
import { DRUID_CIRCLE_LAND_SUBCLASS_ID } from "./druidCircleLand";
import type { CircleLandType } from "./druidCircleLandRecovery";
import { DomainEvaluationError } from "./profileEngine";

export const DRUID_NATURES_WARD_SOURCE = "feature:druid.circle-of-the-land.natures-ward";

const LAND_RESISTANCE: Record<CircleLandType,"fire"|"cold"|"lightning"|"poison"> = {
  arid:"fire",
  polar:"cold",
  temperate:"lightning",
  tropical:"poison",
};

export interface NaturesWardBenefits {
  conditionImmunities: ConditionId[];
  damageDefenses: DamageDefenseContribution[];
}

export function naturesWardResistance(
  druidLevel:number,
  subclassId:string|undefined,
  landType:CircleLandType,
) {
  if (!Number.isInteger(druidLevel) || druidLevel < 10 || druidLevel > 20) {
    throw new DomainEvaluationError("Nature's Ward requires Druid level 10-20");
  }
  if (subclassId !== DRUID_CIRCLE_LAND_SUBCLASS_ID) {
    throw new DomainEvaluationError("Nature's Ward requires the Circle of the Land subclass");
  }
  return LAND_RESISTANCE[landType];
}

export function naturesWardBenefits(
  druidLevel:number,
  subclassId:string|undefined,
  landType:CircleLandType,
):NaturesWardBenefits {
  const damageType = naturesWardResistance(druidLevel,subclassId,landType);
  return {
    conditionImmunities:["poisoned"],
    damageDefenses:[{
      source:`${DRUID_NATURES_WARD_SOURCE}:${landType}`,
      kind:"resistance",
      damageType,
    }],
  };
}

export function applyNaturesWard(
  combatant:CombatantRuntimeState,
  druidLevel:number,
  subclassId:string|undefined,
  landType:CircleLandType,
):CombatantRuntimeState {
  const benefits = naturesWardBenefits(druidLevel,subclassId,landType);
  const conditionImmunities = [...new Set([...(combatant.conditionImmunities ?? []),...benefits.conditionImmunities])];
  const existingDefenses = combatant.damageDefenses ?? [];
  const wardSourcePrefix = `${DRUID_NATURES_WARD_SOURCE}:`;
  const damageDefenses = [
    ...existingDefenses.filter((entry) => !entry.source.startsWith(wardSourcePrefix)),
    ...benefits.damageDefenses,
  ];
  return {
    ...combatant,
    conditionImmunities,
    damageDefenses,
  };
}
