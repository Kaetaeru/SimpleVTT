import rawCatalog from "../generated/weaponRuleCatalog.generated.json";

export type WeaponTraining = "simple"|"martial";
export type WeaponMode = "melee"|"ranged";

export interface WeaponRuleDefinition {
  id:string;
  name:string;
  originalName:string;
  training:WeaponTraining;
  mode:WeaponMode;
  damage:string|number;
  damageType:string;
  properties:string[];
  mastery:string;
}

interface WeaponRuleCatalog {
  schemaVersion:string;
  rulesProfileId:string;
  count:number;
  weapons:WeaponRuleDefinition[];
}

export const WEAPON_RULE_CATALOG = rawCatalog as unknown as WeaponRuleCatalog;
if (WEAPON_RULE_CATALOG.count !== WEAPON_RULE_CATALOG.weapons.length) {
  throw new Error(`weapon rule catalog count mismatch: ${WEAPON_RULE_CATALOG.count} != ${WEAPON_RULE_CATALOG.weapons.length}`);
}
const ids = WEAPON_RULE_CATALOG.weapons.map((weapon) => weapon.id);
if (new Set(ids).size !== ids.length) throw new Error("weapon rule catalog contains duplicate weapon IDs");
const BY_ID = new Map(WEAPON_RULE_CATALOG.weapons.map((weapon) => [weapon.id,weapon]));

export function weaponRuleById(weaponId:string) {
  return BY_ID.get(weaponId);
}

export function allWeaponRules() {
  return [...WEAPON_RULE_CATALOG.weapons];
}

export function weaponHasProperty(weapon:WeaponRuleDefinition,property:string) {
  return weapon.properties.some((entry) => entry === property || entry.startsWith(`${property}:`));
}
