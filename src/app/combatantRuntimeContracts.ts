import type { AbilityKey, AbilityScores } from "./contracts";

export interface CombatantRuntimeStatsVm {
  creatureType?:string;
  abilities:AbilityScores;
  proficiencyBonus:number;
  savingThrowProficiencies:AbilityKey[];
  speed:number;
  resistances:string[];
  immunities:string[];
  vulnerabilities:string[];
}

export interface CombatantRuntimeDamageVm {
  type:string;
  dice:string;
  flat:number;
}

export interface CombatantRuntimeAttackVm {
  id:string;
  name:string;
  category:"basic"|"weapon"|"magic";
  sourceKind:"weapon"|"unarmed"|"wild-shape";
  attackBonus:number;
  rangeFeet:number;
  damage:CombatantRuntimeDamageVm;
  /** Additional damage components rolled on a hit (e.g. "및 3(1d6) 화염 피해"). */
  extraDamage?:CombatantRuntimeDamageVm[];
  /** Thrown/normal range when the attack is "melee or ranged". */
  thrownRangeFeet?:number;
  longRangeFeet?:number;
  /** Multiattack: how many of these attacks one 행동 grants (T1-01: the multiattack line's count applies to every attack). */
  attacksPerAction?:number;
  economy?:"행동"|"추가 행동";
  riderConditionIds?:string[];
  hitText?:string;
}

/** A saving-throw action (breath weapon, spit, shriek): fail damage, success damage rule, area as presented text. */
export interface CombatantRuntimeSaveActionVm {
  id:string;
  name:string;
  saveAbility:AbilityKey;
  saveDc:number;
  damage:CombatantRuntimeDamageVm[];
  successDamage:"half"|"none";
  maxTargets:number;
  areaText?:string;
  failText?:string;
  successText?:string;
  failConditionIds?:string[];
  economy?:"행동"|"추가 행동";
}

export interface CombatantRuntimeTextEntryVm { name:string; text:string; cost?:number }

/** Presentation and not-yet-executable parts of an SRD stat block (T1-02 turns legendary/recharge/spellcasting into counters). */
export interface CombatantRuntimeMonsterVm {
  catalogId:string;
  cr:number;
  crText:string;
  xp:number;
  size:string;
  creatureType:string;
  typeText:string;
  initiativeBonus:number;
  senses:Record<string,number>;
  passivePerception:number;
  multiattackText?:string;
  traits:CombatantRuntimeTextEntryVm[];
  reactions:CombatantRuntimeTextEntryVm[];
  legendaryActions:CombatantRuntimeTextEntryVm[];
  legendaryActionsPerRound:number;
  legendaryResistance:number;
  spellcasting?:{ ability?:AbilityKey; dc:number; attackBonus?:number; lists:Array<{ frequency:"at-will"|"per-day"|"per-rest"; uses?:number; spells:string[] }> };
  textActions:CombatantRuntimeTextEntryVm[];
}

export interface RuntimeAttackFactVm {
  sourceKind:"weapon"|"unarmed"|"wild-shape";
  ability?:AbilityKey;
  rangeFeet:number;
  diceSides:number;
  diceCount:number;
  damageSource:string;
}

declare module "./contracts" {
  interface CombatantDefinitionVm {
    runtimeStats?:CombatantRuntimeStatsVm;
    runtimeActions?:CombatantRuntimeAttackVm[];
    runtimeSaveActions?:CombatantRuntimeSaveActionVm[];
    runtimeMonster?:CombatantRuntimeMonsterVm;
  }
  interface ActionVm {
    runtimeAttack?:RuntimeAttackFactVm;
  }
}
