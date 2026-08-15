import { BARD_COLLEGE_LORE_SUBCLASS_ID } from "./bardCollegeLore";
import { BARBARIAN_BERSERKER_SUBCLASS_ID } from "./barbarianBerserker";
import { CLERIC_LIFE_DOMAIN_SUBCLASS_ID } from "./clericLifeDomain";
import { DRUID_CIRCLE_LAND_SUBCLASS_ID } from "./druidCircleLand";
import { FIGHTER_CHAMPION_SUBCLASS_ID } from "./fighterChampion";
import { classById } from "./progressionCatalog";

export const MONK_OPEN_HAND_SUBCLASS_ID = "dnd.srd521.subclass.monk.warrior-of-the-open-hand";
export const PALADIN_DEVOTION_SUBCLASS_ID = "dnd.srd521.subclass.paladin.oath-of-devotion";
export const RANGER_HUNTER_SUBCLASS_ID = "dnd.srd521.subclass.ranger.hunter";
export const ROGUE_THIEF_SUBCLASS_ID = "dnd.srd521.subclass.rogue.thief";
export const WARLOCK_FIEND_SUBCLASS_ID = "dnd.srd521.subclass.warlock.fiend-patron";

export interface SrdSubclassDefinition {
  classId: string;
  subclassId: string;
}

const SRD_SUBCLASSES: SrdSubclassDefinition[] = [
  { classId:"dnd.srd521.class.barbarian", subclassId:BARBARIAN_BERSERKER_SUBCLASS_ID },
  { classId:"dnd.srd521.class.bard", subclassId:BARD_COLLEGE_LORE_SUBCLASS_ID },
  { classId:"dnd.srd521.class.cleric", subclassId:CLERIC_LIFE_DOMAIN_SUBCLASS_ID },
  { classId:"dnd.srd521.class.druid", subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID },
  { classId:"dnd.srd521.class.fighter", subclassId:FIGHTER_CHAMPION_SUBCLASS_ID },
  { classId:"dnd.srd521.class.monk", subclassId:MONK_OPEN_HAND_SUBCLASS_ID },
  { classId:"dnd.srd521.class.paladin", subclassId:PALADIN_DEVOTION_SUBCLASS_ID },
  { classId:"dnd.srd521.class.ranger", subclassId:RANGER_HUNTER_SUBCLASS_ID },
  { classId:"dnd.srd521.class.rogue", subclassId:ROGUE_THIEF_SUBCLASS_ID },
  { classId:"dnd.srd521.class.warlock", subclassId:WARLOCK_FIEND_SUBCLASS_ID },
];

const BY_CLASS_ID = new Map(SRD_SUBCLASSES.map((entry) => [entry.classId,entry]));

export function srdSubclassDefinitionForClass(classId:string) {
  return BY_CLASS_ID.get(classId);
}

export function srdSubclassIdForClass(classId:string) {
  return srdSubclassDefinitionForClass(classId)?.subclassId;
}

export function inferSrdSubclassId(classId:string, subclassName:string|undefined) {
  if (!subclassName) return undefined;
  const definition = classById(classId);
  if (!definition || definition.srdSubclassName !== subclassName) return undefined;
  return srdSubclassIdForClass(classId);
}
