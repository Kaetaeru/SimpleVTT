import { CLERIC_LIFE_DOMAIN_SUBCLASS_ID } from "./clericLifeDomain";
import { DRUID_CIRCLE_LAND_SUBCLASS_ID } from "./druidCircleLand";
import { FIGHTER_CHAMPION_SUBCLASS_ID } from "./fighterChampion";
import { classById } from "./progressionCatalog";

export interface SrdSubclassDefinition {
  classId: string;
  subclassId: string;
}

const SRD_SUBCLASSES: SrdSubclassDefinition[] = [
  { classId:"dnd.srd521.class.cleric", subclassId:CLERIC_LIFE_DOMAIN_SUBCLASS_ID },
  { classId:"dnd.srd521.class.druid", subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID },
  { classId:"dnd.srd521.class.fighter", subclassId:FIGHTER_CHAMPION_SUBCLASS_ID },
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
