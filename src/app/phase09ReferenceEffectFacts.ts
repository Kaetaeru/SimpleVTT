import type { FixedFormulaDice, FlatFormulaContribution } from "../domain/diceFormula";

export interface Phase09NoRollDamageFact {
  dice:FixedFormulaDice[];
  flat:FlatFormulaContribution[];
}

const REFERENCE_NO_ROLL_DAMAGE_FACTS:Record<string,Phase09NoRollDamageFact> = {
  "action.wand":{
    dice:[{
      source:"phase09:reference-damage:action.wand:d4",
      sides:4,
      count:3,
      faces:[2,2,2],
    }],
    flat:[{
      source:"phase09:reference-damage:action.wand:flat",
      value:3,
    }],
  },
};

export function phase09ReferenceNoRollDamageFact(actionId:string):Phase09NoRollDamageFact {
  const fact = REFERENCE_NO_ROLL_DAMAGE_FACTS[actionId];
  if (!fact) throw new Error(`missing Phase 09 no-roll damage fact: ${actionId}`);
  return structuredClone(fact);
}
