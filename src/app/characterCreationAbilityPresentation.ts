import type { AbilityKey, AbilityScores, CharacterCreateDraft } from "./contracts";

export const STANDARD_ABILITY_ARRAY=[15,14,13,12,10,8] as const;
const POINT_BUY_COST:Record<number,number>={ 8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9 };
const POINT_BUY_BUDGET=27;

export function abilityModifierValue(score:number) {
  return Math.floor((score-10)/2);
}

export function abilityModifierText(score:number) {
  const value=abilityModifierValue(score);
  return value>=0 ? `+${value}` : String(value);
}

export function pointBuyUsed(scores:AbilityScores) {
  return Object.values(scores).reduce((sum,score)=>sum+(POINT_BUY_COST[score] ?? 0),0);
}

export function pointBuyPresentation(scores:AbilityScores) {
  const used=pointBuyUsed(scores);
  const remaining=POINT_BUY_BUDGET-used;
  return {
    budget:POINT_BUY_BUDGET,
    used,
    remaining,
    usedPercent:Math.max(0,Math.min(100,(used/POINT_BUY_BUDGET)*100)),
    remainingPercent:Math.max(0,Math.min(100,(remaining/POINT_BUY_BUDGET)*100)),
  };
}

export function abilityEditorFacts(draft:CharacterCreateDraft,key:AbilityKey) {
  const score=draft.abilities[key];
  const custom=draft.abilityMethod==="custom";
  const minimum=custom ? 1 : 8;
  const maximum=custom ? 30 : 15;
  const used=draft.abilityMethod==="point-buy" ? pointBuyUsed(draft.abilities) : 0;
  const currentCost=draft.abilityMethod==="point-buy" ? (POINT_BUY_COST[score] ?? 0) : 0;
  const nextCost=draft.abilityMethod==="point-buy" ? (POINT_BUY_COST[score+1] ?? Number.POSITIVE_INFINITY) : 0;
  const canIncrease=score<maximum && (draft.abilityMethod!=="point-buy" || used-currentCost+nextCost<=POINT_BUY_BUDGET);
  return {
    score,
    modifier:abilityModifierValue(score),
    modifierText:abilityModifierText(score),
    minimum,
    maximum,
    canDecrease:score>minimum,
    canIncrease,
    pointBuyCost:draft.abilityMethod==="point-buy" ? currentCost : undefined,
  };
}
