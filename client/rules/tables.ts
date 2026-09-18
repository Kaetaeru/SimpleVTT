/**
 * SRD 5.2.1 (2024) tables that are not content entries: proficiency bonus, XP thresholds, ability scores, the
 * multiclass spell-slot table, Pact Magic, sizes. Everything here is a pure function of numbers.
 */
import type { AbilityKey } from "../catalog/types";

export const abilityModifier = (score: number) => Math.floor((score - 10) / 2);

export function proficiencyBonusForLevel(totalLevel: number) {
  if (totalLevel >= 17) return 6;
  if (totalLevel >= 13) return 5;
  if (totalLevel >= 9) return 4;
  if (totalLevel >= 5) return 3;
  return 2;
}

/** Cumulative XP needed to reach each level (index = level). */
export const XP_THRESHOLDS = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000] as const;

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;
export const POINT_BUY_BUDGET = 27;
/** Point cost of a score from 8 to 15 in Point Buy. */
export function pointBuyCost(score: number): number | null {
  const cost: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
  return score in cost ? cost[score] : null;
}
export const ABILITY_SCORE_MAX = 20;
export const EPIC_ABILITY_SCORE_MAX = 30;

/** Full-caster spell slots by caster level (index = caster level, inner index = slot level 1..9). */
const FULL_CASTER_SLOTS: readonly (readonly number[])[] = [
  [],
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

export function fullCasterSlots(casterLevel: number): Record<number, number> {
  const row = FULL_CASTER_SLOTS[Math.max(0, Math.min(20, casterLevel))] ?? [];
  const slots: Record<number, number> = {};
  row.forEach((count, index) => { if (count > 0) slots[index + 1] = count; });
  return slots;
}

/** Pact Magic (Warlock): slot count and slot level by warlock level. */
export function pactMagicSlots(warlockLevel: number): { count: number; level: number } | null {
  if (warlockLevel <= 0) return null;
  const count = warlockLevel >= 17 ? 4 : warlockLevel >= 11 ? 3 : warlockLevel >= 2 ? 2 : 1;
  const level = warlockLevel >= 9 ? 5 : warlockLevel >= 7 ? 4 : warlockLevel >= 5 ? 3 : warlockLevel >= 3 ? 2 : 1;
  return { count, level };
}

export type CasterKind = "full" | "half" | "third" | "pact" | "none";

/** D303: a one-third caster's own slots — the full-caster row at a third of the class level, rounded up. */
export const thirdCasterSlots = (classLevel: number) => fullCasterSlots(Math.ceil(classLevel / 3));

/**
 * Multiclass spellcaster level (SRD 5.2.1 Multiclassing): full casters add every level, half casters (Paladin, Ranger)
 * add half rounded up per class, one-third casters (a subclass that casts, D303) a third rounded down, Pact Magic nothing.
 */
export function multiclassCasterLevel(tracks: Array<{ kind: CasterKind; level: number }>) {
  return tracks.reduce((sum, track) => sum + (track.kind === "full" ? track.level : track.kind === "half" ? Math.ceil(track.level / 2) : track.kind === "third" ? Math.floor(track.level / 3) : 0), 0);
}

export const SIZE_KO: Record<string, string> = { tiny: "초소형", small: "소형", medium: "중형", large: "대형", huge: "거대형", gargantuan: "초대형" };


/** Hit-point gain of a level after the first when the fixed value is chosen: die/2 + 1. */
export const fixedHitPoints = (hitDie: number) => Math.floor(hitDie / 2) + 1;
