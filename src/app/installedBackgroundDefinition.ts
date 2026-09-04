import type { AbilityKey } from "./contracts";

/** Declarative background semantics an external RuleModule may carry; mirrors the builtin SRD `background-definition` mechanic consumed by Character creation. */
export interface InstalledBackgroundDefinitionV1 {
  abilityChoices:AbilityKey[];
  abilityIncreaseModes:Array<"2+1"|"1+1+1">;
  skills:string[];
  tool?:string;
  toolChoice?:string;
  originFeat:string;
  equipmentChoice:boolean;
}

const ABILITY_KEYS=new Set<AbilityKey>(["str","dex","con","int","wis","cha"]);
const INCREASE_MODES=new Set(["2+1","1+1+1"]);
const ALLOWED_FIELDS=new Set(["abilityChoices","abilityIncreaseModes","skills","tool","toolChoice","originFeat","equipmentChoice"]);

function isObject(value:unknown):value is Record<string,unknown> {
  return Boolean(value)&&typeof value==="object"&&!Array.isArray(value);
}
function stringList(value:unknown,label:string,minimum:number) {
  if(!Array.isArray(value)||value.length<minimum||value.some((item)=>typeof item!=="string"||!item.trim())) throw new Error(`${label} must list at least ${minimum} non-empty string(s)`);
  const items=value.map((item)=>String(item).trim());
  if(new Set(items).size!==items.length) throw new Error(`${label} must not repeat entries`);
  return items;
}

export function parseInstalledBackgroundDefinition(value:unknown,label:string):InstalledBackgroundDefinitionV1 {
  if(!isObject(value)) throw new Error(`${label} must be an object`);
  const unsupported=Object.keys(value).filter((key)=>!ALLOWED_FIELDS.has(key));
  if(unsupported.length) throw new Error(`${label} contains unsupported fields: ${unsupported.join(", ")}`);
  const abilityChoices=stringList(value.abilityChoices,`${label}.abilityChoices`,1);
  if(abilityChoices.some((key)=>!ABILITY_KEYS.has(key as AbilityKey))) throw new Error(`${label}.abilityChoices must use str/dex/con/int/wis/cha`);
  const abilityIncreaseModes=stringList(value.abilityIncreaseModes,`${label}.abilityIncreaseModes`,1);
  if(abilityIncreaseModes.some((mode)=>!INCREASE_MODES.has(mode))) throw new Error(`${label}.abilityIncreaseModes must use 2+1 or 1+1+1`);
  const skills=stringList(value.skills,`${label}.skills`,1);
  if(typeof value.originFeat!=="string"||!value.originFeat.trim()) throw new Error(`${label}.originFeat must be a stable feat id`);
  if(value.tool!==undefined&&(typeof value.tool!=="string"||!value.tool.trim())) throw new Error(`${label}.tool must be a non-empty string`);
  if(value.toolChoice!==undefined&&(typeof value.toolChoice!=="string"||!value.toolChoice.trim())) throw new Error(`${label}.toolChoice must be a non-empty string`);
  if(typeof value.equipmentChoice!=="boolean") throw new Error(`${label}.equipmentChoice must be a boolean`);
  return {
    abilityChoices:abilityChoices as AbilityKey[],
    abilityIncreaseModes:abilityIncreaseModes as Array<"2+1"|"1+1+1">,
    skills,
    ...(value.tool?{tool:String(value.tool).trim()}:{}),
    ...(value.toolChoice?{toolChoice:String(value.toolChoice).trim()}:{}),
    originFeat:value.originFeat.trim(),
    equipmentChoice:value.equipmentChoice,
  };
}
