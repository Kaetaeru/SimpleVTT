import "./combatantRuntimeContracts";
import type { AbilityKey, AbilityScores, CharacterSheet, CombatantDefinitionVm, SceneEntity } from "./contracts";
import { CLASSES, classMeta } from "./characterCreationV10Data";

export interface RuntimeSaveModifierFact {
  ability:AbilityKey;
  modifier:number;
  source:string;
}

interface CombatantRuntimeStatDefinition {
  abilities:AbilityScores;
  proficiencyBonus?:number;
  savingThrowProficiencies?:AbilityKey[];
}

const ABILITY_LABELS:Record<string,AbilityKey> = {
  str:"str", dex:"dex", con:"con", int:"int", wis:"wis", cha:"cha",
  "근력":"str", "민첩":"dex", "건강":"con", "지능":"int", "지혜":"wis", "매력":"cha",
};

const LEGACY_CLASS_NAMES:Record<string,string> = {
  "전사":"파이터",
  "음유시인":"바드",
  "마법사":"위저드",
  "성직자":"클레릭",
};

const BUILTIN_COMBATANT_RUNTIME_STATS:Record<string,CombatantRuntimeStatDefinition> = {
  "combatant.goblin":{
    abilities:{ str:8, dex:14, con:10, int:10, wis:8, cha:8 },
  },
  "combatant.wolf":{
    abilities:{ str:12, dex:15, con:12, int:3, wis:12, cha:6 },
  },
  "combatant.training-guardian":{
    abilities:{ str:16, dex:10, con:16, int:6, wis:12, cha:10 },
  },
};

const BUILTIN_CREATURE_TYPES:Record<string,string>={"combatant.goblin":"humanoid","combatant.wolf":"beast","combatant.training-guardian":"construct"};

const abilityModifier = (score:number) => Math.floor((score - 10) / 2);

export function runtimeAbilityKey(label:string):AbilityKey {
  const key = ABILITY_LABELS[label.trim().toLowerCase()] ?? ABILITY_LABELS[label.trim()];
  if (!key) throw new Error(`unsupported saving-throw ability label: ${label}`);
  return key;
}

function characterClassId(sheet:CharacterSheet) {
  const normalized = LEGACY_CLASS_NAMES[sheet.className] ?? sheet.className;
  const entry = CLASSES.find((candidate) => candidate.id === normalized || candidate.name === normalized || candidate.nameEn === normalized);
  if (!entry) throw new Error(`missing canonical class definition for runtime character: ${sheet.className}`);
  return entry.id;
}

function characterSaveModifier(sheet:CharacterSheet,ability:AbilityKey):RuntimeSaveModifierFact {
  const classId = characterClassId(sheet);
  const proficient = classMeta(classId).saves.includes(ability);
  const base = abilityModifier(sheet.abilities[ability]);
  const modifier = base + (proficient ? sheet.proficiencyBonus : 0);
  return {
    ability,
    modifier,
    source:`runtime:character:${sheet.id}:save:${ability}:class:${classId}${proficient ? ":proficient" : ""}`,
  };
}

function matchesDefinition(entityId:string,definitionId:string) {
  return entityId === definitionId
    || entityId.startsWith(`${definitionId}.`)
    || entityId.startsWith(`${definitionId}-`);
}

function runtimeCombatantStats(entityId:string,definitions:CombatantDefinitionVm[]) {
  const imported=[...definitions]
    .sort((left,right)=>right.id.length-left.id.length)
    .find((definition)=>matchesDefinition(entityId,definition.id) && definition.runtimeStats);
  if (imported?.runtimeStats) {
    return {
      definitionId:imported.id,
      stats:imported.runtimeStats,
      sourcePrefix:`runtime:combatant-definition:${imported.id}`,
    };
  }
  const definitionId=Object.keys(BUILTIN_COMBATANT_RUNTIME_STATS).find((id)=>matchesDefinition(entityId,id));
  if (!definitionId) return undefined;
  return {
    definitionId,
    stats:BUILTIN_COMBATANT_RUNTIME_STATS[definitionId],
    sourcePrefix:`runtime:combatant:${definitionId}`,
  };
}

function combatantSaveModifier(entity:SceneEntity,ability:AbilityKey,definitions:CombatantDefinitionVm[]):RuntimeSaveModifierFact {
  const resolved=runtimeCombatantStats(entity.id,definitions);
  if (!resolved) throw new Error(`missing runtime combatant stat definition: ${entity.id}`);
  const proficient = resolved.stats.savingThrowProficiencies?.includes(ability) ?? false;
  const proficiency = proficient ? (resolved.stats.proficiencyBonus ?? 0) : 0;
  return {
    ability,
    modifier:abilityModifier(resolved.stats.abilities[ability]) + proficiency,
    source:`${resolved.sourcePrefix}:ability:${ability}${proficient ? ":save-proficient" : ""}`,
  };
}

export function resolveRuntimeSaveModifier(
  entity:SceneEntity,
  activeCharacter:CharacterSheet,
  abilityLabel:string,
  combatantDefinitions:CombatantDefinitionVm[] = [],
):RuntimeSaveModifierFact {
  const ability = runtimeAbilityKey(abilityLabel);
  if (entity.kind === "character") {
    if (entity.id !== activeCharacter.id) {
      throw new Error(`missing runtime CharacterSheet for saving throw: ${entity.id}`);
    }
    return characterSaveModifier(activeCharacter,ability);
  }
  return combatantSaveModifier(entity,ability,combatantDefinitions);
}

export function resolveRuntimeCreatureType(entity:SceneEntity,definitions:CombatantDefinitionVm[]=[]):string|undefined {
  if(entity.kind==="character")return "humanoid";
  const imported=[...definitions].sort((left,right)=>right.id.length-left.id.length).find((definition)=>matchesDefinition(entity.id,definition.id)&&definition.runtimeStats?.creatureType);
  if(imported?.runtimeStats?.creatureType)return imported.runtimeStats.creatureType;
  const definitionId=Object.keys(BUILTIN_CREATURE_TYPES).find((id)=>matchesDefinition(entity.id,id));
  return definitionId?BUILTIN_CREATURE_TYPES[definitionId]:undefined;
}
