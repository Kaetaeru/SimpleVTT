import type { AbilityKey, AbilityScores } from "./contracts";

export interface CombatantRuntimeStatsVm {
  abilities:AbilityScores;
  proficiencyBonus:number;
  savingThrowProficiencies:AbilityKey[];
  speed:number;
  resistances:string[];
  immunities:string[];
  vulnerabilities:string[];
}

export interface CombatantRuntimeAttackVm {
  id:string;
  name:string;
  category:"basic"|"weapon"|"magic";
  sourceKind:"weapon"|"unarmed"|"wild-shape";
  attackBonus:number;
  rangeFeet:number;
  damage:{
    type:string;
    dice:string;
    flat:number;
  };
}

export interface RuntimeAttackFactVm {
  sourceKind:"weapon"|"unarmed"|"wild-shape";
  rangeFeet:number;
  diceSides:number;
  diceCount:number;
  damageSource:string;
}

declare module "./contracts" {
  interface CombatantDefinitionVm {
    runtimeStats?:CombatantRuntimeStatsVm;
    runtimeActions?:CombatantRuntimeAttackVm[];
  }
  interface ActionVm {
    runtimeAttack?:RuntimeAttackFactVm;
  }
}
