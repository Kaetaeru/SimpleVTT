import type { AbilityKey } from "./contracts";
import type { FixedDamageDice, FlatDamageContribution } from "../domain/damageRoll";
import type { FixedFormulaDice, FlatFormulaContribution } from "../domain/diceFormula";

export interface Phase09SaveModifierFact {
  modifier:number;
  source:string;
}

export interface Phase09AttackFact {
  sourceKind:"weapon"|"unarmed"|"wild-shape";
  ability?:AbilityKey;
  rangeFeet:number;
  damageDice:FixedDamageDice[];
  flatDamage:FlatDamageContribution[];
}

export interface Phase09HealingFact {
  dice:FixedFormulaDice[];
  flat:FlatFormulaContribution[];
}

export interface Phase09TargetingFact {
  distanceFeet:number;
  visible:boolean;
  cover:"none"|"half"|"three-quarters"|"total";
  targetCanSeeAttacker:boolean;
}

const REFERENCE_SAVE_MODIFIERS:Record<string,Record<string,number>> = {
  "char.aelar":{ "근력":7, "민첩":2, "건강":6, "지능":0, "지혜":1, "매력":-1 },
  "char.mira":{ "근력":-1, "민첩":5, "건강":1, "지능":0, "지혜":1, "매력":6 },
  "combatant.goblin-a":{ "근력":-1, "민첩":2, "건강":0, "지능":0, "지혜":-1, "매력":-1 },
  "combatant.goblin-b":{ "근력":-1, "민첩":2, "건강":0, "지능":0, "지혜":-1, "매력":-1 },
  "combatant.wolf":{ "근력":1, "민첩":2, "건강":1, "지능":-4, "지혜":1, "매력":-2 },
  "combatant.training-guardian":{ "근력":3, "민첩":0, "건강":3, "지능":-2, "지혜":1, "매력":0 },
};

const REFERENCE_ATTACK_FACTS:Record<string,Phase09AttackFact> = {
  "action.shortbow":{
    sourceKind:"weapon",
    ability:"dex",
    rangeFeet:80,
    damageDice:[{
      source:"phase09:reference-attack:action.shortbow:d6",
      sides:6,
      count:1,
      faces:[4,4],
    }],
    flatDamage:[{
      source:"phase09:reference-attack:action.shortbow:dexterity",
      value:2,
    }],
  },
};

const REFERENCE_HEALING_FACTS:Record<string,Phase09HealingFact> = {
  "action.second-wind":{
    dice:[{ source:"phase09:reference-healing:action.second-wind:d10", sides:10, count:1, faces:[5] }],
    flat:[{ source:"phase09:reference-healing:action.second-wind:level", value:5 }],
  },
  "action.healing-word":{
    dice:[{ source:"phase09:reference-healing:action.healing-word:d4", sides:4, count:1, faces:[3] }],
    flat:[{ source:"phase09:reference-healing:action.healing-word:spellcasting", value:4 }],
  },
  "action.healing-potion":{
    dice:[{ source:"phase09:reference-healing:action.healing-potion:d4", sides:4, count:2, faces:[3,4] }],
    flat:[{ source:"phase09:reference-healing:action.healing-potion:flat", value:2 }],
  },
};

const REFERENCE_TARGETING_FACTS:Record<string,Phase09TargetingFact> = {
  "combatant.goblin-a":{ distanceFeet:22, visible:true, cover:"none", targetCanSeeAttacker:true },
  "combatant.goblin-b":{ distanceFeet:35, visible:true, cover:"none", targetCanSeeAttacker:true },
  "combatant.wolf":{ distanceFeet:18, visible:true, cover:"none", targetCanSeeAttacker:true },
  "combatant.training-guardian":{ distanceFeet:20, visible:true, cover:"none", targetCanSeeAttacker:true },
};

export function phase09ReferenceSaveModifier(entityId:string,abilityLabel:string):Phase09SaveModifierFact {
  const modifier = REFERENCE_SAVE_MODIFIERS[entityId]?.[abilityLabel];
  if (modifier === undefined) {
    throw new Error(`missing Phase 09 save modifier fact: ${entityId} / ${abilityLabel}`);
  }
  return {
    modifier,
    source:`phase09:reference-save:${entityId}:${abilityLabel}`,
  };
}

export function phase09ReferenceAttackFact(actionId:string):Phase09AttackFact {
  const fact = REFERENCE_ATTACK_FACTS[actionId];
  if (!fact) throw new Error(`missing Phase 09 attack fact: ${actionId}`);
  return structuredClone(fact);
}

export function phase09ReferenceHealingFact(actionId:string):Phase09HealingFact {
  const fact = REFERENCE_HEALING_FACTS[actionId];
  if (!fact) throw new Error(`missing Phase 09 healing fact: ${actionId}`);
  return structuredClone(fact);
}

export function phase09ReferenceTargetingFact(targetId:string):Phase09TargetingFact {
  const fact = REFERENCE_TARGETING_FACTS[targetId];
  if (!fact) throw new Error(`missing Phase 09 targeting fact: ${targetId}`);
  return { ...fact };
}

export function phase09DamageFacesForPreview(actionId:string,critical:boolean) {
  const fact = phase09ReferenceAttackFact(actionId);
  return fact.damageDice.flatMap((die) => die.faces.slice(0,critical ? die.count * 2 : die.count));
}
