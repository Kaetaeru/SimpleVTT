import type { AbilityKey, AbilityScores } from "./contracts";
import type { CombatantRuntimeAttackVm, CombatantRuntimeStatsVm } from "./combatantRuntimeContracts";

/**
 * Pure parsers for structured Combatant runtime definitions (ability block + atomic attack actions).
 * Shared by the Combatant JSON import and the Campaign DM Library NPC definitions.
 */
export const ABILITY_KEYS:AbilityKey[]=["str","dex","con","int","wis","cha"];

export function stringArray(value:unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

export function diceShape(formula:string) {
  const match=formula.match(/^(\d+)d(\d+)$/i);
  if (!match) throw new Error(`unsupported runtime action damage dice: ${formula}`);
  const count=Number(match[1]);
  const sides=Number(match[2]);
  if (!Number.isInteger(count)||count<1||!Number.isInteger(sides)||sides<2) throw new Error(`invalid runtime action damage dice: ${formula}`);
  return { count,sides };
}

export function parseRuntimeStats(payload:Record<string,unknown>):CombatantRuntimeStatsVm|undefined {
  const abilitiesRaw=payload.abilities;
  if (!abilitiesRaw || typeof abilitiesRaw!=="object" || Array.isArray(abilitiesRaw)) return undefined;
  const record=abilitiesRaw as Record<string,unknown>;
  const abilities={} as AbilityScores;
  for (const key of ABILITY_KEYS) {
    const value=record[key];
    if (typeof value!=="number" || !Number.isInteger(value) || value<1 || value>30) {
      throw new Error(`abilities.${key} must be an integer from 1 to 30`);
    }
    abilities[key]=value;
  }
  const proficiencyBonus=payload.proficiencyBonus;
  if (typeof proficiencyBonus!=="number" || !Number.isInteger(proficiencyBonus) || proficiencyBonus<0) {
    throw new Error("proficiencyBonus must be a non-negative integer when runtime abilities are provided");
  }
  const speed=payload.speed;
  if (typeof speed!=="number" || !Number.isInteger(speed) || speed<0) {
    throw new Error("speed must be a non-negative integer when runtime abilities are provided");
  }
  const savesRaw=payload.savingThrowProficiencies;
  if (savesRaw!==undefined && !Array.isArray(savesRaw)) throw new Error("savingThrowProficiencies must be an array");
  const savingThrowProficiencies=stringArray(savesRaw) as AbilityKey[];
  for (const key of savingThrowProficiencies) if (!ABILITY_KEYS.includes(key)) throw new Error(`invalid saving throw proficiency: ${key}`);
  if (payload.creatureType!==undefined&&(typeof payload.creatureType!=="string"||!/^[a-z][a-z-]*$/i.test(payload.creatureType))) throw new Error("creatureType must be a stable creature-type slug");
  return {
    creatureType:typeof payload.creatureType==="string"?payload.creatureType.toLowerCase():undefined,
    abilities,
    proficiencyBonus,
    savingThrowProficiencies,
    speed,
    resistances:stringArray(payload.resistances),
    immunities:stringArray(payload.immunities),
    vulnerabilities:stringArray(payload.vulnerabilities),
  };
}

export function parseRuntimeActions(payload:Record<string,unknown>):CombatantRuntimeAttackVm[]|undefined {
  if (payload.runtimeActions===undefined) return undefined;
  if (!Array.isArray(payload.runtimeActions)) throw new Error("runtimeActions must be an array");
  return payload.runtimeActions.map((raw,index)=>{
    if (!raw || typeof raw!=="object" || Array.isArray(raw)) throw new Error(`runtimeActions[${index}] must be an object`);
    const entry=raw as Record<string,unknown>;
    const damage=entry.damage;
    if (!damage || typeof damage!=="object" || Array.isArray(damage)) throw new Error(`runtimeActions[${index}].damage must be an object`);
    const damageRecord=damage as Record<string,unknown>;
    const id=entry.id;
    const name=entry.name;
    const category=entry.category;
    const sourceKind=entry.sourceKind;
    const attackBonus=entry.attackBonus;
    const rangeFeet=entry.rangeFeet;
    const type=damageRecord.type;
    const dice=damageRecord.dice;
    const flat=damageRecord.flat;
    if (typeof id!=="string" || !/^[a-z0-9][a-z0-9-]*$/i.test(id)) throw new Error(`runtimeActions[${index}].id must be a stable slug`);
    if (typeof name!=="string" || !name.trim()) throw new Error(`runtimeActions[${index}].name is required`);
    if (category!=="basic" && category!=="weapon" && category!=="magic") throw new Error(`runtimeActions[${index}].category is invalid`);
    if (sourceKind!=="weapon" && sourceKind!=="unarmed" && sourceKind!=="wild-shape") throw new Error(`runtimeActions[${index}].sourceKind is invalid for the current atomic attack domain`);
    if (typeof attackBonus!=="number" || !Number.isInteger(attackBonus)) throw new Error(`runtimeActions[${index}].attackBonus must be an integer`);
    if (typeof rangeFeet!=="number" || !Number.isInteger(rangeFeet) || rangeFeet<0) throw new Error(`runtimeActions[${index}].rangeFeet must be a non-negative integer`);
    if (typeof type!=="string" || !type.trim()) throw new Error(`runtimeActions[${index}].damage.type is required`);
    if (typeof dice!=="string") throw new Error(`runtimeActions[${index}].damage.dice is required`);
    diceShape(dice);
    if (typeof flat!=="number" || !Number.isInteger(flat)) throw new Error(`runtimeActions[${index}].damage.flat must be an integer`);
    return { id,name,category,sourceKind,attackBonus,rangeFeet,damage:{ type,dice,flat } };
  });
}
