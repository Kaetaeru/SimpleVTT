/**
 * Level-up planning: which choices a level-up opens (the new tracks' own choices, feat sub-choices they created, and
 * class-wide pools whose size grew), and a summary of what the new levels bring. The wizard is for creation; this
 * keeps the level-up screen to what actually changed.
 */
import type { ChoiceRequest, DerivedCharacter, DerivedFeature } from "./types";

/** Choices a player must (or may) answer after gaining levels from `fromLevel` (the previous total level). */
export function choicesOpenedByLevelUp(derived: DerivedCharacter, fromLevel: number): ChoiceRequest[] {
  return derived.choices.filter((choice) => {
    if (choice.trackIndex !== undefined && choice.trackIndex >= fromLevel) return true;
    const match = /^class\.(\d+)\./.exec(choice.id) ?? /^feat\.class\.(\d+)\./.exec(choice.id);
    if (match && Number(match[1]) >= fromLevel) return true;
    // Class-wide pools (mastery, invocations, metamagic, cantrips, prepared spells, spellbook) that grew.
    if (choice.trackIndex !== undefined && choice.trackIndex < fromLevel && choice.selected.length < choice.count) return true;
    return false;
  });
}

export interface LevelUpSummary {
  fromLevel: number;
  toLevel: number;
  classes: Array<{ name: string; from: number; to: number }>;
  hpFrom: number;
  hpTo: number;
  proficiencyFrom: number;
  proficiencyTo: number;
  newFeatures: DerivedFeature[];
}

export function summarizeLevelUp(before: DerivedCharacter, after: DerivedCharacter): LevelUpSummary {
  const seen = new Set(before.features.map((feature) => `${feature.sourceLabel}|${feature.id}`));
  const classes = after.classes.map((cls) => ({ name: cls.name, from: before.classes.find((item) => item.classId === cls.classId)?.level ?? 0, to: cls.level })).filter((cls) => cls.from !== cls.to);
  return {
    fromLevel: before.level, toLevel: after.level, classes,
    hpFrom: before.hp.max, hpTo: after.hp.max,
    proficiencyFrom: before.proficiencyBonus, proficiencyTo: after.proficiencyBonus,
    newFeatures: after.features.filter((feature) => !seen.has(`${feature.sourceLabel}|${feature.id}`)),
  };
}
