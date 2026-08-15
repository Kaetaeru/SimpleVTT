import type { DamageDefenseContribution } from "./damage";
import { DomainEvaluationError } from "./profileEngine";
import { stableSpellId } from "./spellListCatalog";

export const SORCERER_ID = "dnd.srd521.class.sorcerer";
export const SORCERER_DRACONIC_SUBCLASS_ID = "dnd.srd521.subclass.sorcerer.draconic-sorcery";
export const DRACONIC_RESILIENCE_FEATURE_ID = "dnd.srd521.feature.sorcerer.draconic-resilience";
export const DRACONIC_SPELLS_FEATURE_ID = "dnd.srd521.feature.sorcerer.draconic-spells";
export const ELEMENTAL_AFFINITY_FEATURE_ID = "dnd.srd521.feature.sorcerer.elemental-affinity";
export const DRAGON_WINGS_FEATURE_ID = "dnd.srd521.feature.sorcerer.dragon-wings";
export const DRAGON_COMPANION_FEATURE_ID = "dnd.srd521.feature.sorcerer.dragon-companion";

export type DraconicAffinityDamageType = "acid"|"cold"|"fire"|"lightning"|"poison";
export const DRACONIC_AFFINITY_TYPES:readonly DraconicAffinityDamageType[] = ["acid","cold","fire","lightning","poison"];

const DRACONIC_SPELL_ROWS:readonly { sorcererLevel:number; names:string[] }[] = [
  { sorcererLevel:3, names:["Alter Self","Chromatic Orb","Command","Dragon's Breath"] },
  { sorcererLevel:5, names:["Fear","Fly"] },
  { sorcererLevel:7, names:["Arcane Eye","Charm Monster"] },
  { sorcererLevel:9, names:["Legend Lore","Summon Dragon"] },
];

export function draconicSpellsUnlockedAtLevel(sorcererLevel:number) {
  if (!Number.isInteger(sorcererLevel) || sorcererLevel < 1 || sorcererLevel > 20) throw new DomainEvaluationError("Sorcerer level must be 1-20");
  return DRACONIC_SPELL_ROWS.filter((row) => row.sorcererLevel === sorcererLevel)
    .flatMap((row) => row.names.map((name) => ({ spellId:stableSpellId(name), source:`드라코닉 소서리 ${row.sorcererLevel}레벨 · 드라코닉 주문 · SRD 5.2.1` })));
}

export function allDraconicSpellsAtLevel(sorcererLevel:number) {
  if (!Number.isInteger(sorcererLevel) || sorcererLevel < 1 || sorcererLevel > 20) throw new DomainEvaluationError("Sorcerer level must be 1-20");
  return DRACONIC_SPELL_ROWS.filter((row) => row.sorcererLevel <= sorcererLevel)
    .flatMap((row) => row.names.map((name) => stableSpellId(name)));
}

export function draconicResilienceMaximumHpBonus(sorcererLevel:number) {
  if (!Number.isInteger(sorcererLevel) || sorcererLevel < 3 || sorcererLevel > 20) throw new DomainEvaluationError("Draconic Resilience requires Sorcerer level 3-20");
  return sorcererLevel;
}

export function draconicResilienceArmorClass(args:{ sorcererLevel:number; dexterityModifier:number; charismaModifier:number; wearingArmor:boolean }) {
  if (args.sorcererLevel < 3) throw new DomainEvaluationError("Draconic Resilience requires Sorcerer level 3+");
  if (args.wearingArmor) return undefined;
  return 10 + args.dexterityModifier + args.charismaModifier;
}

export function draconicElementalResistance(args:{ sorcererLevel:number; subclassId?:string; affinity?:DraconicAffinityDamageType }):DamageDefenseContribution|undefined {
  if (args.subclassId !== SORCERER_DRACONIC_SUBCLASS_ID || args.sorcererLevel < 6 || !args.affinity) return undefined;
  return { source:ELEMENTAL_AFFINITY_FEATURE_ID, kind:"resistance", damageType:args.affinity };
}

export function draconicElementalSpellDamageBonus(args:{
  sorcererLevel:number;
  subclassId?:string;
  affinity?:DraconicAffinityDamageType;
  spellDamageType:string;
  charismaModifier:number;
}) {
  if (args.subclassId !== SORCERER_DRACONIC_SUBCLASS_ID || args.sorcererLevel < 6 || !args.affinity) return 0;
  return args.spellDamageType === args.affinity ? args.charismaModifier : 0;
}
