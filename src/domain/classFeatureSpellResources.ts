import type { ProgressionClassTrack } from "./progression";
import { stableSpellId } from "./spellListCatalog";

export const RANGER_ID = "dnd.srd521.class.ranger";
export const PALADIN_ID = "dnd.srd521.class.paladin";

export const HUNTERS_MARK_ID = stableSpellId("Hunter's Mark");
export const DIVINE_SMITE_ID = stableSpellId("Divine Smite");
export const FIND_STEED_ID = stableSpellId("Find Steed");

export const HUNTERS_MARK_FREE_CAST_RESOURCE_ID = "resource:ranger.favored-enemy.hunters-mark";
export const DIVINE_SMITE_FREE_CAST_RESOURCE_ID = "resource:paladin.smite.divine-smite";
export const FIND_STEED_FREE_CAST_RESOURCE_ID = "resource:paladin.faithful-steed.find-steed";

export interface ClassFeatureSpellResourceDefinition {
  classId: string;
  classLevel: number;
  spellId: string;
  resourceId: string;
  label: string;
  maximum: number;
  source: string;
  recovery: { longRest:"all" };
}

export function rangerFavoredEnemyUses(rangerLevel: number) {
  if (!Number.isInteger(rangerLevel) || rangerLevel < 0 || rangerLevel > 20) {
    throw new Error("Ranger level must be an integer from 0 to 20");
  }
  if (rangerLevel <= 0) return 0;
  return 2 + Math.floor(rangerLevel / 4);
}

export function classFeatureSpellResourceDefinitions(
  classTracks: ProgressionClassTrack[],
): ClassFeatureSpellResourceDefinition[] {
  const definitions: ClassFeatureSpellResourceDefinition[] = [];
  const rangerLevel = classTracks.find((track) => track.classId === RANGER_ID)?.level ?? 0;
  if (rangerLevel >= 1) {
    definitions.push({
      classId:RANGER_ID,
      classLevel:rangerLevel,
      spellId:HUNTERS_MARK_ID,
      resourceId:HUNTERS_MARK_FREE_CAST_RESOURCE_ID,
      label:"주적 · Hunter's Mark 무료 시전",
      maximum:rangerFavoredEnemyUses(rangerLevel),
      source:`레인저 ${rangerLevel}레벨 · 주적 · SRD 5.2.1`,
      recovery:{ longRest:"all" },
    });
  }

  const paladinLevel = classTracks.find((track) => track.classId === PALADIN_ID)?.level ?? 0;
  if (paladinLevel >= 2) {
    definitions.push({
      classId:PALADIN_ID,
      classLevel:paladinLevel,
      spellId:DIVINE_SMITE_ID,
      resourceId:DIVINE_SMITE_FREE_CAST_RESOURCE_ID,
      label:"팔라딘의 강타 · Divine Smite 무료 시전",
      maximum:1,
      source:`팔라딘 ${paladinLevel}레벨 · 팔라딘의 강타 · SRD 5.2.1`,
      recovery:{ longRest:"all" },
    });
  }
  if (paladinLevel >= 5) {
    definitions.push({
      classId:PALADIN_ID,
      classLevel:paladinLevel,
      spellId:FIND_STEED_ID,
      resourceId:FIND_STEED_FREE_CAST_RESOURCE_ID,
      label:"충직한 군마 · Find Steed 무료 시전",
      maximum:1,
      source:`팔라딘 ${paladinLevel}레벨 · 충직한 군마 · SRD 5.2.1`,
      recovery:{ longRest:"all" },
    });
  }
  return definitions;
}

export function classFeatureSpellResourceIds(classTracks: ProgressionClassTrack[]) {
  return Object.fromEntries(
    classFeatureSpellResourceDefinitions(classTracks).map((definition) => [definition.spellId, definition.resourceId]),
  );
}

export function classFeatureSpellSources(classTracks: ProgressionClassTrack[]) {
  return Object.fromEntries(
    classFeatureSpellResourceDefinitions(classTracks).map((definition) => [definition.spellId, definition.source]),
  );
}
