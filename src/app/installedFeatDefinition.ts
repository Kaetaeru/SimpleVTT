import type { AbilityKey } from "./contracts";

/** Mirrors the SRD feat rule catalog execution record: how the feat executes in play, and why not when it does not. */
export interface InstalledFeatExecutionV1 {
  status:"common-play"|"derived"|"selection"|"descriptive";
  reason?:string;
}

/**
 * Declarative feat semantics an external RuleModule may carry (`feat-definition` mechanic): the same fields the
 * builtin SRD feat rule catalog reads (tier, prerequisites, ability increase, execution record). Executable
 * behaviour lives in a sibling `common-play` mechanic on the same entry.
 */
export interface InstalledFeatDefinitionV1 {
  tier?:"origin"|"general"|"fighting-style"|"epic-boon";
  minimumLevel?:number;
  repeatable?:boolean;
  requires?:string;
  abilityPrerequisite?:{ any:AbilityKey[]; minimum:number };
  abilityIncrease?:{ any?:AbilityKey[]; amount:number; maximum:number };
  grants?:string[];
  execution?:InstalledFeatExecutionV1;
}

const ALLOWED=new Set(["tier","minimumLevel","repeatable","requires","abilityPrerequisite","abilityIncrease","grants","execution"]);
const TIERS=new Set(["origin","general","fighting-style","epic-boon"]);
const ABILITIES=new Set(["str","dex","con","int","wis","cha"]);
const EXECUTION_STATUSES=new Set(["common-play","derived","selection","descriptive"]);

function isObject(value:unknown):value is Record<string,unknown> { return Boolean(value)&&typeof value==="object"&&!Array.isArray(value); }
function abilities(value:unknown,label:string):AbilityKey[] {
  if(!Array.isArray(value)||!value.length||value.some((item)=>typeof item!=="string"||!ABILITIES.has(item)))throw new Error(`${label} must list ability keys (str/dex/con/int/wis/cha)`);
  return value as AbilityKey[];
}
function integer(value:unknown,label:string,minimum:number) {
  if(typeof value!=="number"||!Number.isInteger(value)||value<minimum)throw new Error(`${label} must be an integer >= ${minimum}`);
  return value;
}

export function parseInstalledFeatDefinition(value:unknown,label:string):InstalledFeatDefinitionV1 {
  if(!isObject(value))throw new Error(`${label} must be an object`);
  const unsupported=Object.keys(value).filter((key)=>!ALLOWED.has(key));
  if(unsupported.length)throw new Error(`${label} contains unsupported fields: ${unsupported.join(", ")}`);
  const out:InstalledFeatDefinitionV1={};
  if(value.tier!==undefined){ if(typeof value.tier!=="string"||!TIERS.has(value.tier))throw new Error(`${label}.tier must be origin/general/fighting-style/epic-boon`); out.tier=value.tier as InstalledFeatDefinitionV1["tier"]; }
  if(value.minimumLevel!==undefined)out.minimumLevel=integer(value.minimumLevel,`${label}.minimumLevel`,1);
  if(value.repeatable!==undefined){ if(typeof value.repeatable!=="boolean")throw new Error(`${label}.repeatable must be a boolean`); out.repeatable=value.repeatable; }
  if(value.requires!==undefined){ if(typeof value.requires!=="string"||!value.requires.trim())throw new Error(`${label}.requires must be a non-empty string`); out.requires=value.requires; }
  if(value.abilityPrerequisite!==undefined){
    if(!isObject(value.abilityPrerequisite))throw new Error(`${label}.abilityPrerequisite must be an object`);
    out.abilityPrerequisite={any:abilities(value.abilityPrerequisite.any,`${label}.abilityPrerequisite.any`),minimum:integer(value.abilityPrerequisite.minimum,`${label}.abilityPrerequisite.minimum`,1)};
  }
  if(value.abilityIncrease!==undefined){
    if(!isObject(value.abilityIncrease))throw new Error(`${label}.abilityIncrease must be an object`);
    out.abilityIncrease={
      ...(value.abilityIncrease.any!==undefined?{any:abilities(value.abilityIncrease.any,`${label}.abilityIncrease.any`)}:{}),
      amount:integer(value.abilityIncrease.amount,`${label}.abilityIncrease.amount`,1),
      maximum:integer(value.abilityIncrease.maximum,`${label}.abilityIncrease.maximum`,1),
    };
  }
  if(value.grants!==undefined){
    if(!Array.isArray(value.grants)||value.grants.some((item)=>typeof item!=="string"||!item.trim()))throw new Error(`${label}.grants must be an array of non-empty strings`);
    out.grants=(value.grants as string[]).map((item)=>item.trim());
  }
  if(value.execution!==undefined){
    if(!isObject(value.execution)||typeof value.execution.status!=="string"||!EXECUTION_STATUSES.has(value.execution.status))throw new Error(`${label}.execution.status must be common-play/derived/selection/descriptive`);
    if(value.execution.reason!==undefined&&typeof value.execution.reason!=="string")throw new Error(`${label}.execution.reason must be a string`);
    out.execution={status:value.execution.status as InstalledFeatExecutionV1["status"],...(typeof value.execution.reason==="string"?{reason:value.execution.reason}:{})};
  }
  return out;
}
