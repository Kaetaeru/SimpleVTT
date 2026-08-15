export interface Phase09SaveModifierFact {
  modifier:number;
  source:string;
}

const REFERENCE_SAVE_MODIFIERS:Record<string,Record<string,number>> = {
  "char.aelar":{ "근력":7, "민첩":2, "건강":6, "지능":0, "지혜":1, "매력":-1 },
  "char.mira":{ "근력":-1, "민첩":5, "건강":1, "지능":0, "지혜":1, "매력":6 },
  "combatant.goblin-a":{ "근력":-1, "민첩":2, "건강":0, "지능":0, "지혜":-1, "매력":-1 },
  "combatant.goblin-b":{ "근력":-1, "민첩":2, "건강":0, "지능":0, "지혜":-1, "매력":-1 },
  "combatant.wolf":{ "근력":1, "민첩":2, "건강":1, "지능":-4, "지혜":1, "매력":-2 },
  "combatant.training-guardian":{ "근력":3, "민첩":0, "건강":3, "지능":-2, "지혜":1, "매력":0 },
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
