import type { AttackCriticalRange, AttackSourceKind } from "./attack";
import { DomainEvaluationError } from "./profileEngine";

export const FIGHTER_CHAMPION_SUBCLASS_ID = "dnd.srd521.subclass.fighter.champion";
export const FIGHTER_CHAMPION_IMPROVED_CRITICAL_SOURCE = "feature:fighter.champion.improved-critical";
export const FIGHTER_CHAMPION_SUPERIOR_CRITICAL_SOURCE = "feature:fighter.champion.superior-critical";

export function fighterChampionCriticalRange(args: {
  fighterLevel: number;
  subclassId?: string;
  sourceKind: AttackSourceKind;
}): AttackCriticalRange | undefined {
  if (!Number.isInteger(args.fighterLevel) || args.fighterLevel < 0 || args.fighterLevel > 20) {
    throw new DomainEvaluationError("Fighter level must be an integer from 0 to 20");
  }
  if (args.subclassId !== FIGHTER_CHAMPION_SUBCLASS_ID) return undefined;
  if (args.sourceKind !== "weapon" && args.sourceKind !== "unarmed") return undefined;
  if (args.fighterLevel < 3) return undefined;
  if (args.fighterLevel >= 15) {
    return { threshold:18, sourceId:FIGHTER_CHAMPION_SUPERIOR_CRITICAL_SOURCE };
  }
  return { threshold:19, sourceId:FIGHTER_CHAMPION_IMPROVED_CRITICAL_SOURCE };
}
