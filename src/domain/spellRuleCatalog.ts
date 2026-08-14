import rawCatalog from "../generated/spellRuleCatalog.generated.json";
import { PROGRESSION_CATALOG } from "./progressionCatalog";
import { classCantripListEntries, classSpellListEntries } from "./spellListCatalog";

export interface SpellRuleMetadata {
  id:string;
  level:number;
  ritual:boolean;
}

interface SpellRuleCatalog {
  schemaVersion:string;
  rulesProfileId:string;
  count:number;
  spells:SpellRuleMetadata[];
}

export const SPELL_RULE_CATALOG = rawCatalog as SpellRuleCatalog;
const BY_ID = new Map(SPELL_RULE_CATALOG.spells.map((entry) => [entry.id,entry]));

export function spellRuleMetadataById(spellId:string) {
  return BY_ID.get(spellId);
}

export function allClassCantripIds() {
  return [...new Set(
    PROGRESSION_CATALOG.classes.flatMap((definition) => classCantripListEntries(definition.id).map((entry) => entry.id)),
  )].sort((left,right) => left.localeCompare(right,"en"));
}

export function allClassLeveledSpellIds() {
  return [...new Set(
    PROGRESSION_CATALOG.classes.flatMap((definition) => classSpellListEntries(definition.id).map((entry) => entry.id)),
  )].sort((left,right) => left.localeCompare(right,"en"));
}

export function allClassLevelOneRitualSpellIds() {
  const classSpells = new Set(allClassLeveledSpellIds());
  return SPELL_RULE_CATALOG.spells
    .filter((entry) => entry.level === 1 && entry.ritual && classSpells.has(entry.id))
    .map((entry) => entry.id)
    .sort((left,right) => left.localeCompare(right,"en"));
}
