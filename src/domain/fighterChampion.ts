import type { AttackCriticalFreeMovement, AttackCriticalRange, AttackSourceKind } from "./attack";
import { DomainEvaluationError } from "./profileEngine";

export const FIGHTER_CHAMPION_SUBCLASS_ID = "dnd.srd521.subclass.fighter.champion";
export const FIGHTER_CHAMPION_IMPROVED_CRITICAL_SOURCE = "feature:fighter.champion.improved-critical";
export const FIGHTER_CHAMPION_SUPERIOR_CRITICAL_SOURCE = "feature:fighter.champion.superior-critical";
export const FIGHTER_CHAMPION_REMARKABLE_ATHLETE_CRITICAL_MOVE_SOURCE = "feature:fighter.champion.remarkable-athlete.critical-move";

function validateLevel(level:number) {
  if (!Number.isInteger(level) || level < 0 || level > 20) {
    throw new DomainEvaluationError("Fighter level must be an integer from 0 to 20");
  }
}

export function fighterChampionCriticalRange(args: {
  fighterLevel: number;
  subclassId?: string;
  sourceKind: AttackSourceKind;
}): AttackCriticalRange | undefined {
  validateLevel(args.fighterLevel);
  if (args.subclassId !== FIGHTER_CHAMPION_SUBCLASS_ID) return undefined;
  if (args.sourceKind !== "weapon" && args.sourceKind !== "unarmed") return undefined;
  if (args.fighterLevel < 3) return undefined;
  if (args.fighterLevel >= 15) {
    return { threshold:18, sourceId:FIGHTER_CHAMPION_SUPERIOR_CRITICAL_SOURCE };
  }
  return { threshold:19, sourceId:FIGHTER_CHAMPION_IMPROVED_CRITICAL_SOURCE };
}

export function fighterChampionCriticalMovement(args:{
  fighterLevel:number;
  subclassId?:string;
  speedFeet:number;
  distanceFeet:number;
}):AttackCriticalFreeMovement|undefined {
  validateLevel(args.fighterLevel);
  if (args.subclassId !== FIGHTER_CHAMPION_SUBCLASS_ID || args.fighterLevel < 3) return undefined;
  if (!Number.isFinite(args.speedFeet) || args.speedFeet < 0) {
    throw new DomainEvaluationError("Champion Speed must be a non-negative finite number");
  }
  if (!Number.isFinite(args.distanceFeet) || args.distanceFeet < 0) {
    throw new DomainEvaluationError("Champion critical movement distance must be a non-negative finite number");
  }
  const maximumDistanceFeet = args.speedFeet / 2;
  if (args.distanceFeet > maximumDistanceFeet) {
    throw new DomainEvaluationError(`Remarkable Athlete critical movement cannot exceed ${maximumDistanceFeet} feet`);
  }
  return {
    distanceFeet:args.distanceFeet,
    maximumDistanceFeet,
    doesNotProvokeOpportunityAttacks:true,
  };
}
