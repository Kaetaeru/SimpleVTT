import { SRD_521_CONDITIONS, type AbilityKey, type ConditionId } from "./conditions";
import type { DurationSpec } from "./effects";
import { DomainEvaluationError } from "./profileEngine";
import type {
  SpellConditionEffectDefinition,
  SpellDiceFormula,
  SpellMechanicDefinition,
  SpellPrimaryMechanic,
  SpellTrackedEffectDefinition,
} from "./spellcasting";
import type { SpellComponentRequirements } from "./commonPlaySpellcastingMeta";
import type { TargetingRule } from "./targeting";

/**
 * Structural parser for a `SpellMechanicDefinition` authored as JSON (V1.1 X1-04): the same shape the reviewed
 * TypeScript definitions and the prose-derived definitions use, so an authored builtin file or an installed
 * add-on's `spell-mechanic` content mechanic executes through the unchanged spell runtime.
 * Every field is validated; unknown fields are rejected so typos cannot silently disable a rule.
 */
type Obj=Record<string,unknown>;

const ABILITIES=new Set<AbilityKey>(["str","dex","con","int","wis","cha"]);
const CONDITIONS=new Set<string>(Object.keys(SRD_521_CONDITIONS));
const RUNTIME_SUPPORT=new Set(["combat-executable","tracked-executable","partial","presentation-only"]);
const CASTING_ECONOMY=new Set(["action","bonus-action","reaction"]);
const TARGET_KINDS=new Set(["creature","object","point","any"]);
const TARGET_RELATIONS=new Set(["self","ally","enemy","neutral"]);
const SUCCESS_DAMAGE=new Set(["none","half"]);
const EFFECT_TRIGGERS=new Set(["hit","failed-save","always"]);
const MODIFIER_FAMILIES=new Set(["attack-roll","saving-throw","ability-check"]);
const ROLL_STATES=new Set(["advantage","disadvantage"]);
const MODIFIER_SCOPES=new Set(["actor","target"]);
const DURATION_KINDS=new Set(["instant","seconds","minutes","hours","until-rest","concentration","permanent","special","rounds"]);
const DURATION_ANCHORS=new Set(["$source","$target"]);
const TURN_BOUNDARIES=new Set(["start","end"]);
const REST_KINDS=new Set(["short","long","either"]);
const PRIMARY_KINDS=new Set([
  "attack-damage","multi-attack-damage","save-damage","save-compound-damage","healing","temporary-hp","full-healing",
  "power-word-kill","save-effect","automatic-projectiles","tracked-effect",
]);
const DEFINITION_FIELDS=new Set([
  "spellId","baseLevel","runtimeSupport","castingEconomy","targeting","primary","concentration","effects","trackedEffects",
  "removesConditions","unsupportedInteractions","executionScope","components","castingDurationSeconds","ritual","castingInterruption",
]);

function isObject(value:unknown):value is Obj {
  return Boolean(value)&&typeof value==="object"&&!Array.isArray(value);
}
function object(value:unknown,label:string):Obj {
  if(!isObject(value))throw new DomainEvaluationError(`${label} must be an object`);
  return value;
}
function onlyKeys(value:Obj,label:string,allowed:Iterable<string>) {
  const set=new Set(allowed);
  const unsupported=Object.keys(value).filter((key)=>!set.has(key));
  if(unsupported.length)throw new DomainEvaluationError(`${label} contains unsupported fields: ${unsupported.join(", ")}`);
}
function nonEmptyString(value:unknown,label:string):string {
  if(typeof value!=="string"||!value.trim())throw new DomainEvaluationError(`${label} must be a non-empty string`);
  return value;
}
function optionalString(value:unknown,label:string):string|undefined {
  return value===undefined?undefined:nonEmptyString(value,label);
}
function integer(value:unknown,label:string,minimum=0):number {
  if(typeof value!=="number"||!Number.isInteger(value)||value<minimum)throw new DomainEvaluationError(`${label} must be an integer >= ${minimum}`);
  return value;
}
function optionalInteger(value:unknown,label:string,minimum=0):number|undefined {
  return value===undefined?undefined:integer(value,label,minimum);
}
function optionalBoolean(value:unknown,label:string):boolean|undefined {
  if(value===undefined)return undefined;
  if(typeof value!=="boolean")throw new DomainEvaluationError(`${label} must be a boolean`);
  return value;
}
function oneOf<T extends string>(value:unknown,label:string,allowed:Set<string>):T {
  if(typeof value!=="string"||!allowed.has(value))throw new DomainEvaluationError(`${label} must be one of ${[...allowed].join("|")}`);
  return value as T;
}
function stringList(value:unknown,label:string):string[] {
  if(!Array.isArray(value)||value.some((item)=>typeof item!=="string"||!item.trim()))throw new DomainEvaluationError(`${label} must be an array of non-empty strings`);
  return value as string[];
}

export function parseSpellDiceFormula(value:unknown,label:string):SpellDiceFormula {
  const raw=object(value,label);
  onlyKeys(raw,label,["count","sides","flat","addSpellcastingModifier","dicePerSlotAboveBase","flatPerSlotAboveBase","cantripScaling"]);
  const count=integer(raw.count,`${label}.count`,0);
  const sides=integer(raw.sides,`${label}.sides`,1);
  const flat=raw.flat===undefined?undefined:(()=>{ if(typeof raw.flat!=="number"||!Number.isInteger(raw.flat))throw new DomainEvaluationError(`${label}.flat must be an integer`); return raw.flat; })();
  return {
    count,sides,
    ...(flat!==undefined?{flat}:{}),
    ...(raw.addSpellcastingModifier!==undefined?{addSpellcastingModifier:optionalBoolean(raw.addSpellcastingModifier,`${label}.addSpellcastingModifier`)}:{}),
    ...(raw.dicePerSlotAboveBase!==undefined?{dicePerSlotAboveBase:integer(raw.dicePerSlotAboveBase,`${label}.dicePerSlotAboveBase`,0)}:{}),
    ...(raw.flatPerSlotAboveBase!==undefined?{flatPerSlotAboveBase:integer(raw.flatPerSlotAboveBase,`${label}.flatPerSlotAboveBase`,0)}:{}),
    ...(raw.cantripScaling!==undefined?{cantripScaling:optionalBoolean(raw.cantripScaling,`${label}.cantripScaling`)}:{}),
  };
}

export function parseSpellDuration(value:unknown,label:string):DurationSpec {
  const raw=object(value,label);
  const kind=oneOf<string>(raw.kind,`${label}.kind`,DURATION_KINDS);
  switch(kind){
    case "instant": onlyKeys(raw,label,["kind"]); return {kind:"instant"};
    case "seconds": case "minutes": case "hours": {
      onlyKeys(raw,label,["kind","amount"]);
      const amount=raw.amount;
      if(typeof amount!=="number"||!Number.isFinite(amount)||amount<=0)throw new DomainEvaluationError(`${label}.amount must be a positive number`);
      return {kind,amount} as DurationSpec;
    }
    case "until-rest": onlyKeys(raw,label,["kind","rest"]); return {kind:"until-rest",rest:oneOf(raw.rest,`${label}.rest`,REST_KINDS)};
    case "concentration": onlyKeys(raw,label,["kind"]); return {kind:"concentration"};
    case "permanent": onlyKeys(raw,label,["kind"]); return {kind:"permanent"};
    case "rounds": {
      onlyKeys(raw,label,["kind","amount","anchorActorId","boundary"]);
      const anchorActorId=oneOf<"$source"|"$target">(raw.anchorActorId,`${label}.anchorActorId`,DURATION_ANCHORS);
      return {kind:"rounds",amount:integer(raw.amount,`${label}.amount`,1),anchorActorId,boundary:oneOf<"start"|"end">(raw.boundary,`${label}.boundary`,TURN_BOUNDARIES)};
    }
    default: onlyKeys(raw,label,["kind","key"]); return {kind:"special",key:nonEmptyString(raw.key,`${label}.key`)};
  }
}

function parseTargeting(value:unknown,label:string):TargetingRule {
  const raw=object(value,label);
  onlyKeys(raw,label,["kind","minimumRangeFeet","rangeFeet","minTargets","maxTargets","allowedRelations","requiresSight","directTarget"]);
  const minTargets=integer(raw.minTargets,`${label}.minTargets`,0);
  const maxTargets=integer(raw.maxTargets,`${label}.maxTargets`,0);
  if(maxTargets<minTargets)throw new DomainEvaluationError(`${label}.maxTargets must be >= minTargets`);
  const allowedRelations=raw.allowedRelations===undefined?undefined:stringList(raw.allowedRelations,`${label}.allowedRelations`).map((relation)=>oneOf<TargetingRule["allowedRelations"] extends Array<infer R>|undefined?R:never>(relation,`${label}.allowedRelations[]`,TARGET_RELATIONS));
  return {
    kind:oneOf(raw.kind,`${label}.kind`,TARGET_KINDS),
    minTargets,maxTargets,
    ...(raw.minimumRangeFeet!==undefined?{minimumRangeFeet:integer(raw.minimumRangeFeet,`${label}.minimumRangeFeet`,0)}:{}),
    ...(raw.rangeFeet!==undefined?{rangeFeet:integer(raw.rangeFeet,`${label}.rangeFeet`,0)}:{}),
    ...(allowedRelations?{allowedRelations}:{}),
    ...(raw.requiresSight!==undefined?{requiresSight:optionalBoolean(raw.requiresSight,`${label}.requiresSight`)}:{}),
    ...(raw.directTarget!==undefined?{directTarget:optionalBoolean(raw.directTarget,`${label}.directTarget`)}:{}),
  };
}

function parsePrimary(value:unknown,label:string):SpellPrimaryMechanic {
  const raw=object(value,label);
  const kind=oneOf<string>(raw.kind,`${label}.kind`,PRIMARY_KINDS);
  const ability=()=>oneOf<AbilityKey>(raw.saveAbility,`${label}.saveAbility`,ABILITIES);
  const damageType=()=>nonEmptyString(raw.damageType,`${label}.damageType`);
  switch(kind){
    case "attack-damage":
      onlyKeys(raw,label,["kind","damageType","dice"]);
      return {kind,damageType:damageType(),dice:parseSpellDiceFormula(raw.dice,`${label}.dice`)};
    case "multi-attack-damage":
      onlyKeys(raw,label,["kind","damageType","dicePerAttack","baseAttacks","attacksPerSlotAboveBase","cantripAttackScaling"]);
      return {
        kind,damageType:damageType(),dicePerAttack:parseSpellDiceFormula(raw.dicePerAttack,`${label}.dicePerAttack`),baseAttacks:integer(raw.baseAttacks,`${label}.baseAttacks`,1),
        ...(raw.attacksPerSlotAboveBase!==undefined?{attacksPerSlotAboveBase:integer(raw.attacksPerSlotAboveBase,`${label}.attacksPerSlotAboveBase`,0)}:{}),
        ...(raw.cantripAttackScaling!==undefined?{cantripAttackScaling:optionalBoolean(raw.cantripAttackScaling,`${label}.cantripAttackScaling`)}:{}),
      };
    case "save-damage":
      onlyKeys(raw,label,["kind","saveAbility","damageType","dice","successDamage","ignoresCoverForSave"]);
      return {
        kind,saveAbility:ability(),damageType:damageType(),dice:parseSpellDiceFormula(raw.dice,`${label}.dice`),successDamage:oneOf(raw.successDamage,`${label}.successDamage`,SUCCESS_DAMAGE),
        ...(raw.ignoresCoverForSave!==undefined?{ignoresCoverForSave:optionalBoolean(raw.ignoresCoverForSave,`${label}.ignoresCoverForSave`)}:{}),
      };
    case "save-compound-damage": {
      onlyKeys(raw,label,["kind","saveAbility","components","successDamage","ignoresCoverForSave"]);
      if(!Array.isArray(raw.components)||!raw.components.length)throw new DomainEvaluationError(`${label}.components must be a non-empty array`);
      const components=raw.components.map((component,index)=>{
        const entry=object(component,`${label}.components[${index}]`);
        onlyKeys(entry,`${label}.components[${index}]`,["damageType","dice"]);
        return {damageType:nonEmptyString(entry.damageType,`${label}.components[${index}].damageType`),dice:parseSpellDiceFormula(entry.dice,`${label}.components[${index}].dice`)};
      });
      return {
        kind,saveAbility:ability(),components,successDamage:oneOf(raw.successDamage,`${label}.successDamage`,SUCCESS_DAMAGE),
        ...(raw.ignoresCoverForSave!==undefined?{ignoresCoverForSave:optionalBoolean(raw.ignoresCoverForSave,`${label}.ignoresCoverForSave`)}:{}),
      };
    }
    case "healing": case "temporary-hp":
      onlyKeys(raw,label,["kind","dice"]);
      return {kind,dice:parseSpellDiceFormula(raw.dice,`${label}.dice`)};
    case "full-healing":
      onlyKeys(raw,label,["kind"]);
      return {kind};
    case "power-word-kill":
      onlyKeys(raw,label,["kind","fallbackDamage"]);
      return {kind,fallbackDamage:parseSpellDiceFormula(raw.fallbackDamage,`${label}.fallbackDamage`)};
    case "save-effect":
      onlyKeys(raw,label,["kind","saveAbility","summary","duration"]);
      return {kind,saveAbility:ability(),summary:nonEmptyString(raw.summary,`${label}.summary`),duration:parseSpellDuration(raw.duration,`${label}.duration`)};
    case "automatic-projectiles": {
      onlyKeys(raw,label,["kind","damageType","projectileDice","baseProjectiles","projectilesPerSlotAboveBase"]);
      const dice=object(raw.projectileDice,`${label}.projectileDice`);
      onlyKeys(dice,`${label}.projectileDice`,["sides","flat"]);
      return {
        kind,damageType:damageType(),projectileDice:{sides:integer(dice.sides,`${label}.projectileDice.sides`,1),flat:integer(dice.flat,`${label}.projectileDice.flat`,0)},
        baseProjectiles:integer(raw.baseProjectiles,`${label}.baseProjectiles`,1),
        ...(raw.projectilesPerSlotAboveBase!==undefined?{projectilesPerSlotAboveBase:integer(raw.projectilesPerSlotAboveBase,`${label}.projectilesPerSlotAboveBase`,0)}:{}),
      };
    }
    default:
      onlyKeys(raw,label,["kind","summary","duration"]);
      return {kind:"tracked-effect",summary:nonEmptyString(raw.summary,`${label}.summary`),duration:parseSpellDuration(raw.duration,`${label}.duration`)};
  }
}

function parseTermination(value:unknown,label:string) {
  if(value===undefined)return undefined;
  const raw=object(value,label);
  onlyKeys(raw,label,["targetTakesDamage"]);
  return {...(raw.targetTakesDamage!==undefined?{targetTakesDamage:optionalBoolean(raw.targetTakesDamage,`${label}.targetTakesDamage`)}:{})};
}

function parseConditionEffect(value:unknown,label:string):SpellConditionEffectDefinition {
  const raw=object(value,label);
  onlyKeys(raw,label,["conditionId","trigger","duration","termination"]);
  const conditionId=nonEmptyString(raw.conditionId,`${label}.conditionId`);
  if(!CONDITIONS.has(conditionId))throw new DomainEvaluationError(`${label}.conditionId is not an SRD condition: ${conditionId}`);
  const termination=parseTermination(raw.termination,`${label}.termination`);
  return {
    conditionId:conditionId as ConditionId,
    trigger:oneOf(raw.trigger,`${label}.trigger`,EFFECT_TRIGGERS),
    duration:parseSpellDuration(raw.duration,`${label}.duration`),
    ...(termination?{termination}:{}),
  };
}

function parseTrackedEffect(value:unknown,label:string):SpellTrackedEffectDefinition {
  const raw=object(value,label);
  onlyKeys(raw,label,["summary","trigger","duration","termination","modifier","armorClass","damageDefenses","attackDamage"]);
  const termination=parseTermination(raw.termination,`${label}.termination`);
  const modifier=raw.modifier===undefined?undefined:(()=>{
    const entry=object(raw.modifier,`${label}.modifier`);
    onlyKeys(entry,`${label}.modifier`,["family","rollState","scope","consumeOnUse","ability","bonus"]);
    if(entry.rollState===undefined&&entry.bonus===undefined)throw new DomainEvaluationError(`${label}.modifier needs a rollState or a bonus`);
    return {
      family:oneOf<SpellTrackedEffectDefinition["modifier"] extends infer M|undefined?M extends {family:infer F}?F:never:never>(entry.family,`${label}.modifier.family`,MODIFIER_FAMILIES),
      ...(entry.rollState!==undefined?{rollState:oneOf<"advantage"|"disadvantage">(entry.rollState,`${label}.modifier.rollState`,ROLL_STATES)}:{}),
      scope:oneOf<"actor"|"target">(entry.scope,`${label}.modifier.scope`,MODIFIER_SCOPES),
      ...(entry.consumeOnUse!==undefined?{consumeOnUse:optionalBoolean(entry.consumeOnUse,`${label}.modifier.consumeOnUse`)}:{}),
      ...(entry.ability!==undefined?{ability:oneOf<AbilityKey>(entry.ability,`${label}.modifier.ability`,ABILITIES)}:{}),
      ...(entry.bonus!==undefined?{bonus:parseD20Bonus(entry.bonus,`${label}.modifier.bonus`)}:{}),
    };
  })();
  const armorClass=raw.armorClass===undefined?undefined:(()=>{
    const entry=object(raw.armorClass,`${label}.armorClass`);
    onlyKeys(entry,`${label}.armorClass`,["bonus","floor"]);
    if(entry.bonus===undefined&&entry.floor===undefined)throw new DomainEvaluationError(`${label}.armorClass needs a bonus or a floor`);
    return {
      ...(entry.bonus!==undefined?{bonus:integer(entry.bonus,`${label}.armorClass.bonus`,1)}:{}),
      ...(entry.floor!==undefined?{floor:integer(entry.floor,`${label}.armorClass.floor`,1)}:{}),
    };
  })();
  const damageDefenses=raw.damageDefenses===undefined?undefined:(()=>{
    if(!Array.isArray(raw.damageDefenses)||!raw.damageDefenses.length)throw new DomainEvaluationError(`${label}.damageDefenses must be a non-empty array`);
    return raw.damageDefenses.map((defense,index)=>{
      const entry=object(defense,`${label}.damageDefenses[${index}]`);
      onlyKeys(entry,`${label}.damageDefenses[${index}]`,["kind","damageType"]);
      return {kind:oneOf<"resistance"|"immunity"|"vulnerability">(entry.kind,`${label}.damageDefenses[${index}].kind`,DEFENSE_KINDS),damageType:nonEmptyString(entry.damageType,`${label}.damageDefenses[${index}].damageType`)};
    });
  })();
  const attackDamage=raw.attackDamage===undefined?undefined:(()=>{
    const entry=object(raw.attackDamage,`${label}.attackDamage`);
    onlyKeys(entry,`${label}.attackDamage`,["damageType","dice","flat","sourceKinds","againstTargetOnly"]);
    if(entry.dice===undefined&&entry.flat===undefined)throw new DomainEvaluationError(`${label}.attackDamage needs dice or a flat value`);
    const sourceKinds=entry.sourceKinds===undefined?undefined:(()=>{
      if(!Array.isArray(entry.sourceKinds)||!entry.sourceKinds.length)throw new DomainEvaluationError(`${label}.attackDamage.sourceKinds must be a non-empty array`);
      return entry.sourceKinds.map((kind,index)=>oneOf<"weapon"|"unarmed"|"wild-shape">(kind,`${label}.attackDamage.sourceKinds[${index}]`,ATTACK_SOURCE_KINDS));
    })();
    return {
      damageType:nonEmptyString(entry.damageType,`${label}.attackDamage.damageType`),
      ...(entry.dice!==undefined?{dice:parseSimpleDice(entry.dice,`${label}.attackDamage.dice`)}:{}),
      ...(entry.flat!==undefined?{flat:integer(entry.flat,`${label}.attackDamage.flat`,1)}:{}),
      ...(sourceKinds?{sourceKinds}:{}),
      ...(entry.againstTargetOnly!==undefined?{againstTargetOnly:optionalBoolean(entry.againstTargetOnly,`${label}.attackDamage.againstTargetOnly`)}:{}),
    };
  })();
  return {
    summary:nonEmptyString(raw.summary,`${label}.summary`),
    trigger:oneOf(raw.trigger,`${label}.trigger`,EFFECT_TRIGGERS),
    duration:parseSpellDuration(raw.duration,`${label}.duration`),
    ...(termination?{termination}:{}),
    ...(modifier?{modifier}:{}),
    ...(armorClass?{armorClass}:{}),
    ...(damageDefenses?{damageDefenses}:{}),
    ...(attackDamage?{attackDamage}:{}),
  };
}

const DEFENSE_KINDS=new Set(["resistance","immunity","vulnerability"]);
const ATTACK_SOURCE_KINDS=new Set(["weapon","unarmed","wild-shape"]);

function parseSimpleDice(value:unknown,label:string) {
  const entry=object(value,label);
  onlyKeys(entry,label,["count","sides"]);
  return {count:integer(entry.count,`${label}.count`,1),sides:integer(entry.sides,`${label}.sides`,1)};
}

function parseD20Bonus(value:unknown,label:string) {
  const entry=object(value,label);
  onlyKeys(entry,label,["flat","dice","sign"]);
  if(entry.flat===undefined&&entry.dice===undefined)throw new DomainEvaluationError(`${label} needs a flat value or dice`);
  if(entry.sign!==undefined&&entry.sign!==1&&entry.sign!==-1)throw new DomainEvaluationError(`${label}.sign must be 1 or -1`);
  return {
    ...(entry.flat!==undefined?{flat:integer(entry.flat,`${label}.flat`,1)}:{}),
    ...(entry.dice!==undefined?{dice:parseSimpleDice(entry.dice,`${label}.dice`)}:{}),
    ...(entry.sign!==undefined?{sign:entry.sign as 1|-1}:{}),
  };
}

function parseComponents(value:unknown,label:string):SpellComponentRequirements|undefined {
  if(value===undefined)return undefined;
  const raw=object(value,label);
  onlyKeys(raw,label,["verbal","somatic","materials"]);
  const materials=raw.materials===undefined?undefined:(()=>{
    if(!Array.isArray(raw.materials))throw new DomainEvaluationError(`${label}.materials must be an array`);
    return raw.materials.map((material,index)=>{
      const entry=object(material,`${label}.materials[${index}]`);
      onlyKeys(entry,`${label}.materials[${index}]`,["id","costGp","consumed","perTarget"]);
      return {
        ...(entry.id!==undefined?{id:nonEmptyString(entry.id,`${label}.materials[${index}].id`)}:{}),
        ...(entry.costGp!==undefined?{costGp:(()=>{ if(typeof entry.costGp!=="number"||entry.costGp<0)throw new DomainEvaluationError(`${label}.materials[${index}].costGp must be a non-negative number`); return entry.costGp; })()}:{}),
        ...(entry.consumed!==undefined?{consumed:optionalBoolean(entry.consumed,`${label}.materials[${index}].consumed`)}:{}),
        ...(entry.perTarget!==undefined?{perTarget:optionalBoolean(entry.perTarget,`${label}.materials[${index}].perTarget`)}:{}),
      };
    });
  })();
  return {
    ...(raw.verbal!==undefined?{verbal:optionalBoolean(raw.verbal,`${label}.verbal`)}:{}),
    ...(raw.somatic!==undefined?{somatic:optionalBoolean(raw.somatic,`${label}.somatic`)}:{}),
    ...(materials?{materials}:{}),
  };
}

export interface ParseSpellMechanicOptions {
  /** When set, the definition's spellId must be absent or equal to this id (installed content keys spells by content id). */
  spellId?:string;
}

export function parseSpellMechanicDefinition(value:unknown,label:string,options:ParseSpellMechanicOptions={}):SpellMechanicDefinition {
  const raw=object(value,label);
  onlyKeys(raw,label,DEFINITION_FIELDS);
  const spellId=raw.spellId===undefined?options.spellId:nonEmptyString(raw.spellId,`${label}.spellId`);
  if(!spellId)throw new DomainEvaluationError(`${label}.spellId is required`);
  if(options.spellId&&spellId!==options.spellId)throw new DomainEvaluationError(`${label}.spellId must match the content id ${options.spellId}`);
  const primary=parsePrimary(raw.primary,`${label}.primary`);
  const targeting=parseTargeting(raw.targeting,`${label}.targeting`);
  if(primary.kind!=="tracked-effect"&&targeting.maxTargets<1)throw new DomainEvaluationError(`${label}.targeting.maxTargets must be at least 1 for ${primary.kind}`);
  const effects=raw.effects===undefined?undefined:(()=>{
    if(!Array.isArray(raw.effects))throw new DomainEvaluationError(`${label}.effects must be an array`);
    return raw.effects.map((effect,index)=>parseConditionEffect(effect,`${label}.effects[${index}]`));
  })();
  const trackedEffects=raw.trackedEffects===undefined?undefined:(()=>{
    if(!Array.isArray(raw.trackedEffects))throw new DomainEvaluationError(`${label}.trackedEffects must be an array`);
    return raw.trackedEffects.map((effect,index)=>parseTrackedEffect(effect,`${label}.trackedEffects[${index}]`));
  })();
  const removesConditions=raw.removesConditions===undefined?undefined:stringList(raw.removesConditions,`${label}.removesConditions`).map((conditionId)=>{
    if(!CONDITIONS.has(conditionId))throw new DomainEvaluationError(`${label}.removesConditions contains a non-SRD condition: ${conditionId}`);
    return conditionId as ConditionId;
  });
  const castingInterruption=raw.castingInterruption===undefined?undefined:(()=>{
    const entry=object(raw.castingInterruption,`${label}.castingInterruption`);
    onlyKeys(entry,`${label}.castingInterruption`,["trigger","outcome","interruptedSlot"]);
    if(entry.trigger!=="visible-component-spell-cast"||entry.outcome!=="cancel-on-failed-save"||entry.interruptedSlot!=="preserve")throw new DomainEvaluationError(`${label}.castingInterruption is not a supported interruption shape`);
    return {trigger:"visible-component-spell-cast" as const,outcome:"cancel-on-failed-save" as const,interruptedSlot:"preserve" as const};
  })();
  const components=parseComponents(raw.components,`${label}.components`);
  return {
    spellId,
    baseLevel:integer(raw.baseLevel,`${label}.baseLevel`,0),
    runtimeSupport:oneOf(raw.runtimeSupport,`${label}.runtimeSupport`,RUNTIME_SUPPORT),
    castingEconomy:oneOf(raw.castingEconomy,`${label}.castingEconomy`,CASTING_ECONOMY),
    targeting,
    primary,
    ...(raw.concentration!==undefined?{concentration:optionalBoolean(raw.concentration,`${label}.concentration`)}:{}),
    ...(effects&&effects.length?{effects}:{}),
    ...(trackedEffects&&trackedEffects.length?{trackedEffects}:{}),
    ...(removesConditions&&removesConditions.length?{removesConditions}:{}),
    ...(raw.unsupportedInteractions!==undefined?{unsupportedInteractions:stringList(raw.unsupportedInteractions,`${label}.unsupportedInteractions`)}:{}),
    ...(raw.executionScope!==undefined?{executionScope:nonEmptyString(raw.executionScope,`${label}.executionScope`)}:{}),
    ...(components?{components}:{}),
    ...(raw.castingDurationSeconds!==undefined?{castingDurationSeconds:integer(raw.castingDurationSeconds,`${label}.castingDurationSeconds`,1)}:{}),
    ...(raw.ritual!==undefined?{ritual:optionalBoolean(raw.ritual,`${label}.ritual`)}:{}),
    ...(castingInterruption?{castingInterruption}:{}),
  };
}

/** Parses an authored file: either one definition or `{ definitions:[...] }`. */
export function parseSpellMechanicFile(value:unknown,label:string):SpellMechanicDefinition[] {
  const raw=object(value,label);
  if(Array.isArray(raw.definitions)){
    onlyKeys(raw,label,["$schema","schemaVersion","source","definitions"]);
    return raw.definitions.map((definition,index)=>parseSpellMechanicDefinition(definition,`${label}.definitions[${index}]`));
  }
  const {$schema:_schema,schemaVersion:_version,source:_source,...definition}=raw;
  return [parseSpellMechanicDefinition(definition,label)];
}
