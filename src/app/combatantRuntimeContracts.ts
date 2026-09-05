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

export type CombatantRuntimeEconomy="행동"|"추가 행동"|"반응"|"없음";

/**
 * Per-action timing (T1-02): how often a stat-block action may be used.
 * - recharge: spent on use; comes back when a d6 rolled at the start of the creature's turn is ≥ min.
 * - usesPerDay: a daily allowance (the DM resets it from the encounter panel).
 * - usesPerRound: "cannot use again until the start of its next turn".
 * - legendaryCost: a legendary action; draws from the creature's per-round legendary pool.
 */
export interface CombatantRuntimeTimingVm {
  recharge?:{ min:number; sides?:number };
  usesPerDay?:number;
  usesPerRound?:number;
  legendaryCost?:number;
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
  economy?:CombatantRuntimeEconomy;
  riderConditionIds?:string[];
  hitText?:string;
  timing?:CombatantRuntimeTimingVm;
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
  economy?:CombatantRuntimeEconomy;
  timing?:CombatantRuntimeTimingVm;
}

/** A stat-block action without a roll of its own (Frightful Presence, Change Shape, legendary "Detect"): the DM narrates; the runtime spends the economy and the counters. */
export interface CombatantRuntimeTextActionVm {
  id:string;
  name:string;
  text:string;
  economy:CombatantRuntimeEconomy;
  timing?:CombatantRuntimeTimingVm;
}

export interface CombatantRuntimeTextEntryVm { name:string; text:string; cost?:number }

/** Presentation and not-yet-executable parts of an SRD stat block. */
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

/** Live counters for one monster instance (T1-02). Kept inside the scene so resolution undo restores them. */
export interface MonsterTimingStateVm {
  legendary?:{ remaining:number; max:number };
  legendaryResistance?:{ remaining:number; max:number };
  /** keyed by runtime spec id */
  recharge:Record<string,{ ready:boolean; min:number; sides:number; label:string }>;
  /** keyed by runtime spec id */
  uses:Record<string,{ remaining:number; max:number; per:"day"|"round"; label:string }>;
}

export interface ActionMonsterTimingVm {
  kind:"recharge"|"uses-per-day"|"uses-per-round"|"legendary";
  /** true when the timing adapter marked the action unavailable because of its counter */
  blocked:boolean;
  label:string;
  legendaryCost?:number;
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
    runtimeTextActions?:CombatantRuntimeTextActionVm[];
    runtimeMonster?:CombatantRuntimeMonsterVm;
  }
  interface ActionVm {
    runtimeAttack?:RuntimeAttackFactVm;
    runtimeMonsterTiming?:ActionMonsterTimingVm;
  }
  interface SceneVm {
    monsterTimingByActor?:Record<string,MonsterTimingStateVm>;
  }
  interface SceneEntity {
    runtimeMonsterTiming?:MonsterTimingStateVm;
  }
}
