/**
 * Declarative species semantics an external RuleModule may carry (`species-definition` mechanic); mirrors the
 * builtin SRD `species-definition` consumed by Character creation, plus the creation-index semantics the SRD
 * keeps in `content/indexes` (automatic cantrips/features and lineage-style choices).
 */
export interface InstalledSpeciesChoiceOptionV1 { id:string; name:string; nameEn:string; summary:string }
export interface InstalledSpeciesChoiceEffectV1 { cantrips?:string[]; prepared?:string[]; features?:string[]; speed?:number }
export interface InstalledSpeciesSemanticsV1 {
  baseCantrips?:string[];
  basePrepared?:string[];
  baseFeatures?:string[];
  extraChoices?:Array<{ id:string; label:string; description:string; count:number; options:InstalledSpeciesChoiceOptionV1[] }>;
  byChoice?:Record<string,Record<string,InstalledSpeciesChoiceEffectV1>>;
}
export interface InstalledSpeciesDefinitionV1 {
  size:string[];
  speed:number;
  darkvision?:number;
  traits?:string[];
  choices?:Record<string,unknown>;
  semantics?:InstalledSpeciesSemanticsV1;
}

const ALLOWED=new Set(["size","speed","darkvision","traits","choices","semantics"]);
const SEMANTIC_KEYS=new Set(["baseCantrips","basePrepared","baseFeatures","extraChoices","byChoice"]);
const SIZES=new Set(["tiny","small","medium","large"]);

function isObject(value:unknown):value is Record<string,unknown> { return Boolean(value)&&typeof value==="object"&&!Array.isArray(value); }
function strings(value:unknown,label:string,minimum=0):string[] {
  if(!Array.isArray(value)||value.length<minimum||value.some((item)=>typeof item!=="string"||!item.trim()))throw new Error(`${label} must list at least ${minimum} non-empty string(s)`);
  return (value as string[]).map((item)=>item.trim());
}
function optionalStrings(value:unknown,label:string) { return value===undefined?undefined:strings(value,label,0); }
function positiveInteger(value:unknown,label:string) {
  if(typeof value!=="number"||!Number.isInteger(value)||value<=0)throw new Error(`${label} must be a positive integer`);
  return value;
}

function parseSemantics(value:unknown,label:string):InstalledSpeciesSemanticsV1|undefined {
  if(value===undefined)return undefined;
  if(!isObject(value))throw new Error(`${label} must be an object`);
  const unsupported=Object.keys(value).filter((key)=>!SEMANTIC_KEYS.has(key));
  if(unsupported.length)throw new Error(`${label} contains unsupported fields: ${unsupported.join(", ")}`);
  const extraChoices=value.extraChoices===undefined?undefined:(()=>{
    if(!Array.isArray(value.extraChoices))throw new Error(`${label}.extraChoices must be an array`);
    return value.extraChoices.map((choice,index)=>{
      if(!isObject(choice))throw new Error(`${label}.extraChoices[${index}] must be an object`);
      if(typeof choice.id!=="string"||!choice.id.trim()||typeof choice.label!=="string"||!choice.label.trim())throw new Error(`${label}.extraChoices[${index}] needs id and label`);
      if(!Array.isArray(choice.options)||!choice.options.length)throw new Error(`${label}.extraChoices[${index}].options must be non-empty`);
      return {
        id:choice.id.trim(),label:choice.label.trim(),description:typeof choice.description==="string"?choice.description:"",
        count:choice.count===undefined?1:positiveInteger(choice.count,`${label}.extraChoices[${index}].count`),
        options:choice.options.map((option,optionIndex)=>{
          if(!isObject(option)||typeof option.id!=="string"||!option.id.trim()||typeof option.name!=="string")throw new Error(`${label}.extraChoices[${index}].options[${optionIndex}] needs id and name`);
          return {id:option.id.trim(),name:option.name,nameEn:typeof option.nameEn==="string"?option.nameEn:option.name,summary:typeof option.summary==="string"?option.summary:""};
        }),
      };
    });
  })();
  const byChoice=value.byChoice===undefined?undefined:(()=>{
    if(!isObject(value.byChoice))throw new Error(`${label}.byChoice must be an object`);
    const out:Record<string,Record<string,InstalledSpeciesChoiceEffectV1>>={};
    for(const [choiceId,effects] of Object.entries(value.byChoice)){
      if(!isObject(effects))throw new Error(`${label}.byChoice.${choiceId} must be an object`);
      out[choiceId]={};
      for(const [option,effect] of Object.entries(effects)){
        if(!isObject(effect))throw new Error(`${label}.byChoice.${choiceId}.${option} must be an object`);
        out[choiceId][option]={
          ...(effect.cantrips!==undefined?{cantrips:strings(effect.cantrips,`${label}.byChoice.${choiceId}.${option}.cantrips`)}:{}),
          ...(effect.prepared!==undefined?{prepared:strings(effect.prepared,`${label}.byChoice.${choiceId}.${option}.prepared`)}:{}),
          ...(effect.features!==undefined?{features:strings(effect.features,`${label}.byChoice.${choiceId}.${option}.features`)}:{}),
          ...(effect.speed!==undefined?{speed:positiveInteger(effect.speed,`${label}.byChoice.${choiceId}.${option}.speed`)}:{}),
        };
      }
    }
    return out;
  })();
  return {
    ...(value.baseCantrips!==undefined?{baseCantrips:optionalStrings(value.baseCantrips,`${label}.baseCantrips`)}:{}),
    ...(value.basePrepared!==undefined?{basePrepared:optionalStrings(value.basePrepared,`${label}.basePrepared`)}:{}),
    ...(value.baseFeatures!==undefined?{baseFeatures:optionalStrings(value.baseFeatures,`${label}.baseFeatures`)}:{}),
    ...(extraChoices?{extraChoices}:{}),
    ...(byChoice?{byChoice}:{}),
  };
}

export function parseInstalledSpeciesDefinition(value:unknown,label:string):InstalledSpeciesDefinitionV1 {
  if(!isObject(value))throw new Error(`${label} must be an object`);
  const unsupported=Object.keys(value).filter((key)=>!ALLOWED.has(key));
  if(unsupported.length)throw new Error(`${label} contains unsupported fields: ${unsupported.join(", ")}`);
  const size=strings(value.size,`${label}.size`,1);
  if(size.some((entry)=>!SIZES.has(entry)))throw new Error(`${label}.size must use tiny/small/medium/large`);
  const speed=positiveInteger(value.speed,`${label}.speed`);
  const darkvision=value.darkvision===undefined?undefined:positiveInteger(value.darkvision,`${label}.darkvision`);
  const traits=optionalStrings(value.traits,`${label}.traits`);
  const choices=value.choices===undefined?undefined:(()=>{
    if(!isObject(value.choices))throw new Error(`${label}.choices must be an object`);
    for(const [key,entry] of Object.entries(value.choices)){
      if(!(typeof entry==="string"||(Array.isArray(entry)&&entry.every((item)=>typeof item==="string"))))throw new Error(`${label}.choices.${key} must be a string or a string list`);
    }
    return structuredClone(value.choices);
  })();
  const semantics=parseSemantics(value.semantics,`${label}.semantics`);
  return {size,speed,...(darkvision!==undefined?{darkvision}:{}),...(traits?{traits}:{}),...(choices?{choices}:{}),...(semantics?{semantics}:{})};
}
