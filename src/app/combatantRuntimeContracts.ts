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

declare module "./contracts" {
  interface CombatantDefinitionVm {
    runtimeStats?:CombatantRuntimeStatsVm;
  }
}
