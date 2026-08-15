import "./progressionContracts";
import type { CharacterSheet } from "./contracts";
import type { ProgressionPlan } from "./progressionContracts";
import { PROGRESSION_CATALOG, multiclassEligibility } from "../domain/progressionCatalog";

export const LEVEL_UP_ABILITIES = [
  ["str", "근력"],
  ["dex", "민첩"],
  ["con", "건강"],
  ["int", "지능"],
  ["wis", "지혜"],
  ["cha", "매력"],
] as const;

export function projectLevelUpClassOptions(character:CharacterSheet) {
  const tracks=character.classLevels ?? [];
  return PROGRESSION_CATALOG.classes.map((entry)=>{
    const existing=tracks.some((track)=>track.classId===entry.id);
    const eligibility=existing
      ? { eligible:true,reason:"" }
      : multiclassEligibility(character.abilities,tracks,entry.id);
    return {
      entry,
      existing,
      eligible:eligibility.eligible,
      reason:eligibility.reason,
      currentLevel:tracks.find((track)=>track.classId===entry.id)?.level ?? 0,
    };
  });
}

export function projectLevelUpFixedHpGain(plan:ProgressionPlan) {
  return Math.max(1,Math.floor(plan.hp.hitDie/2)+1+plan.hp.constitutionModifier);
}
