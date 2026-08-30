import type { CommonPlayDefinitionIR } from "./commonPlayDefinitionRuntime";
import type {
  CommonPlayAttackOutcomeInterceptor,
  CommonPlayD20RollInterceptor,
  CommonPlayDamageRollInterceptor,
  CommonPlayInteractionDefinition,
  CommonPlayReactionDefinition,
} from "./commonPlayRuntime";
import type { CommonPlayFactQuery } from "./commonPlaySpatialFactRuntime";
import { DomainEvaluationError, evaluateExpression, type ExpressionNode, type SemanticPredicate } from "./profileEngine";

type Obj=Record<string,unknown>;
type ReactionLoweringOptions={ resolveResourceDie?:(resourceId:string)=>number|undefined; resolveNumericReference?:(ref:string)=>number|undefined };
const STABLE_ID=/^[a-z0-9][a-z0-9._-]*$/;
const RESPONDERS=new Set(["actor","target","actor-owner","target-owner","dm","host"]);
const VISIBILITIES=new Set(["public","actor","dm","actor-and-dm","authority-only"]);
const STALE_POLICIES=new Set(["cancel","restart","reject"]);
const PROPERTY_OPERATIONS=new Set(["add","subtract","set","min","max","multiply"]);
const FACT_AUTHORITIES=new Set(["host","actor-owner","target-owner","dm","profile"]);
const FACT_VISIBILITIES=new Set(["public","actor","dm","actor-and-dm","authority-only"]);
const UNKNOWN_POLICIES=new Set(["block","request-authority","treat-false","unsupported"]);
const D20_FAMILIES=new Set(["ability-check","saving-throw","attack-roll"]);
const D20_OUTCOMES=new Set(["success","failure"]);

function object(value:unknown,label:string):Obj {
  if(!value||typeof value!=="object"||Array.isArray(value)) throw new DomainEvaluationError(`${label} must be an object`);
  return value as Obj;
}

function stableId(value:unknown,label:string) {
  if(typeof value!=="string"||!STABLE_ID.test(value)) throw new DomainEvaluationError(`${label} must be a stable id`);
  return value;
}

function literalNumber(value:unknown,label:string) {
  const expression=object(value,label);
  if(Object.keys(expression).some((key)=>key!=="value")||typeof expression.value!=="number"||!Number.isFinite(expression.value)) {
    throw new DomainEvaluationError(`${label} must be a finite literal number expression`);
  }
  return {value:expression.value};
}

const NUMERIC_EXPRESSION_OPERATORS=new Set(["add","subtract","multiply","divide","min","max","floor","ceil"]);
function resolvedNumber(value:unknown,label:string,options:ReactionLoweringOptions) {
  const parse=(candidate:unknown,currentLabel:string):ExpressionNode=>{
    const expression=object(candidate,currentLabel);
    if("value" in expression){
      if(Object.keys(expression).some((key)=>key!=="value")||typeof expression.value!=="number"||!Number.isFinite(expression.value))throw new DomainEvaluationError(`${currentLabel} must contain a finite numeric value`);
      return {value:expression.value};
    }
    if("ref" in expression){
      if(Object.keys(expression).some((key)=>key!=="ref")||typeof expression.ref!=="string"||!expression.ref)throw new DomainEvaluationError(`${currentLabel} must contain a non-empty numeric ref`);
      return {ref:expression.ref};
    }
    if(typeof expression.op!=="string"||!NUMERIC_EXPRESSION_OPERATORS.has(expression.op)||!Array.isArray(expression.args)||!expression.args.length||Object.keys(expression).some((key)=>key!=="op"&&key!=="args"))throw new DomainEvaluationError(`${currentLabel} must be a supported numeric expression`);
    return {op:expression.op as ExpressionNode extends {op:infer T}?T:never,args:expression.args.map((entry,index)=>parse(entry,`${currentLabel}.args[${index}]`))};
  };
  const resolved=evaluateExpression(parse(value,label),(ref)=>{
    const numeric=options.resolveNumericReference?.(ref);
    if(numeric===undefined)throw new DomainEvaluationError(`${label} has unresolved numeric reference: ${ref}`);
    if(!Number.isFinite(numeric))throw new DomainEvaluationError(`${label} resolved non-finite numeric reference: ${ref}`);
    return numeric;
  });
  return {value:resolved};
}

function d20ResultCondition(value:unknown,label:string):CommonPlayReactionDefinition["payments"][number]["condition"] {
  if(value===undefined)return undefined;
  const raw=object(value,label);
  const unsupported=Object.keys(raw).filter((key)=>key!=="kind"&&key!=="outcome");
  if(unsupported.length)throw new DomainEvaluationError(`${label} contains unsupported fields: ${unsupported.join(", ")}`);
  if(raw.kind!=="d20-result")throw new DomainEvaluationError(`${label}.kind must be d20-result`);
  if(raw.outcome!=="success"&&raw.outcome!=="failure")throw new DomainEvaluationError(`${label}.outcome must be success or failure`);
  return {kind:"d20-result",outcome:raw.outcome};
}

function eligibility(value:Obj,label:string) {
  if(value.when===undefined&&value.factQueries===undefined)return undefined;
  if(value.when===undefined||!Array.isArray(value.factQueries)||!value.factQueries.length) {
    throw new DomainEvaluationError(`${label}.when and non-empty factQueries must be declared together`);
  }
  const factQueries=value.factQueries.map((candidate,index)=>{
    const raw=object(candidate,`${label}.factQueries[${index}]`);
    const id=stableId(raw.id,`${label}.factQueries[${index}].id`);
    if(typeof raw.fact!=="string"||!raw.fact)throw new DomainEvaluationError(`${label}.factQueries[${index}].fact must be a non-empty string`);
    if(raw.subject!==undefined&&(typeof raw.subject!=="string"||!raw.subject))throw new DomainEvaluationError(`${label}.factQueries[${index}].subject must be a non-empty string`);
    if(typeof raw.authority!=="string"||!FACT_AUTHORITIES.has(raw.authority))throw new DomainEvaluationError(`${label}.factQueries[${index}].authority is unsupported`);
    if(typeof raw.visibility!=="string"||!FACT_VISIBILITIES.has(raw.visibility))throw new DomainEvaluationError(`${label}.factQueries[${index}].visibility is unsupported`);
    if(typeof raw.unknownPolicy!=="string"||!UNKNOWN_POLICIES.has(raw.unknownPolicy))throw new DomainEvaluationError(`${label}.factQueries[${index}].unknownPolicy is unsupported`);
    return {
      id,fact:raw.fact,subject:raw.subject,
      authority:raw.authority,visibility:raw.visibility,unknownPolicy:raw.unknownPolicy,
    } as CommonPlayFactQuery;
  });
  if(new Set(factQueries.map((query)=>query.id)).size!==factQueries.length)throw new DomainEvaluationError(`${label}.factQueries contains duplicate ids`);
  return {factQueries,when:structuredClone(value.when) as SemanticPredicate};
}

function interaction(value:unknown,label:string):CommonPlayInteractionDefinition {
  const raw=object(value,label);
  const id=stableId(raw.id,`${label}.id`);
  if(raw.kind!=="choice") throw new DomainEvaluationError(`${label}.kind must be choice`);
  if(typeof raw.responder!=="string"||!RESPONDERS.has(raw.responder)) throw new DomainEvaluationError(`${label}.responder is unsupported`);
  if(raw.mode!=="blocking") throw new DomainEvaluationError(`${label}.mode must be blocking`);
  const input=object(raw.input,`${label}.input`);
  if(Object.keys(input).some((key)=>key!=="type")||input.type!=="boolean") throw new DomainEvaluationError(`${label}.input must be boolean`);
  if(raw.revalidate!=="always"&&raw.revalidate!=="if-revision-changed") throw new DomainEvaluationError(`${label}.revalidate is unsupported`);
  if(raw.visibility!==undefined&&(typeof raw.visibility!=="string"||!VISIBILITIES.has(raw.visibility))) throw new DomainEvaluationError(`${label}.visibility is unsupported`);
  if(raw.stalePolicy!==undefined&&(typeof raw.stalePolicy!=="string"||!STALE_POLICIES.has(raw.stalePolicy))) throw new DomainEvaluationError(`${label}.stalePolicy is unsupported`);
  if(raw.promptKey!==undefined&&(typeof raw.promptKey!=="string"||!raw.promptKey)) throw new DomainEvaluationError(`${label}.promptKey must be a non-empty string`);
  if(raw.idempotencyKey!==undefined&&(typeof raw.idempotencyKey!=="string"||!raw.idempotencyKey)) throw new DomainEvaluationError(`${label}.idempotencyKey must be a non-empty string`);
  return {
    id,
    kind:"choice",
    responder:raw.responder as CommonPlayInteractionDefinition["responder"],
    mode:"blocking",
    input:{type:"boolean"},
    ...(raw.visibility?{visibility:raw.visibility as CommonPlayInteractionDefinition["visibility"]}:{}),
    ...(raw.promptKey?{promptKey:raw.promptKey as string}:{}),
    revalidate:raw.revalidate as CommonPlayInteractionDefinition["revalidate"],
    ...(raw.stalePolicy?{stalePolicy:raw.stalePolicy as CommonPlayInteractionDefinition["stalePolicy"]}:{}),
    ...(raw.idempotencyKey?{idempotencyKey:raw.idempotencyKey as string}:{}),
  };
}

function payment(value:Obj,index:number):CommonPlayReactionDefinition["payments"][number] {
  const label=`Common Play reaction payment[${index}]`;
  if(value.consumeAt!=="commit") throw new DomainEvaluationError(`${label}.consumeAt must be commit`);
  const amount=literalNumber(value.amount,`${label}.amount`);
  const condition=d20ResultCondition(value.condition,`${label}.condition`);
  if(value.kind==="resource") {
    if(typeof value.resource!=="string"||!value.resource) throw new DomainEvaluationError(`${label}.resource must be a non-empty string`);
    return {
      kind:"resource",
      resource:value.resource,
      amount,
      consumeAt:"commit",
      ...(typeof value.refundOnCancel==="boolean"?{refundOnCancel:value.refundOnCancel}:{}),
      ...(condition?{condition}:{}),
    };
  }
  if(value.kind==="economy") {
    if(value.bucket!=="action"&&value.bucket!=="bonus-action"&&value.bucket!=="reaction") {
      throw new DomainEvaluationError(`${label}.bucket is unsupported`);
    }
    return {
      kind:"economy",
      bucket:value.bucket,
      amount,
      consumeAt:"commit",
      ...(typeof value.refundOnCancel==="boolean"?{refundOnCancel:value.refundOnCancel}:{}),
      ...(condition?{condition}:{}),
    };
  }
  throw new DomainEvaluationError(`${label}.kind is unsupported by the reaction runtime`);
}

function selectorValues(value:unknown,label:string,allowed:Set<string>) {
  if(value===undefined)return undefined;
  if(!Array.isArray(value)||!value.length||value.some((entry)=>typeof entry!=="string"||!allowed.has(entry))) {
    throw new DomainEvaluationError(`${label} contains unsupported values`);
  }
  if(new Set(value).size!==value.length)throw new DomainEvaluationError(`${label} contains duplicate values`);
  return value as string[];
}

function lowerD20Interceptor(value:Obj,index:number,options:ReactionLoweringOptions):CommonPlayD20RollInterceptor {
  const label=`Common Play reaction interceptor[${index}]`;
  const eligibilityDefinition=eligibility(value,label);
  const families=selectorValues(value.families,`${label}.families`,D20_FAMILIES);
  const outcomes=selectorValues(value.outcomes,`${label}.outcomes`,D20_OUTCOMES);
  if(value.timing!=="d20.outcome-determined"||value.operation!=="recalculate"||value.slot!=="d20.roll") {
    throw new DomainEvaluationError(`${label} is not a supported d20 recalculation interceptor`);
  }
  const operations=value.operations;
  if(!Array.isArray(operations)||!operations.length) throw new DomainEvaluationError(`${label}.operations must contain at least one operation`);
  return {
    id:stableId(value.id,`${label}.id`),
    timing:"d20.outcome-determined",
    interaction:interaction(value.interaction,`${label}.interaction`),
    operation:"recalculate",
    slot:"d20.roll",
    ...(families?{families:families as CommonPlayD20RollInterceptor["families"]}:{}),
    ...(outcomes?{outcomes:outcomes as CommonPlayD20RollInterceptor["outcomes"]}:{}),
    ...(eligibilityDefinition?{eligibility:eligibilityDefinition}:{}),
    operations:operations.map((candidate,operationIndex)=>{
      const raw=object(candidate,`${label}.operations[${operationIndex}]`);
      if(raw.when!==undefined) throw new DomainEvaluationError(`${label}.operations[${operationIndex}].when is not connected to the reaction runtime yet`);
      if(raw.kind!=="roll.modify") throw new DomainEvaluationError(`${label}.operations[${operationIndex}] must be roll.modify`);
      if(raw.mode==="add-die"||raw.mode==="subtract-die"||raw.mode==="reroll") {
        const hasLiteral=typeof raw.dice==="string";
        const hasResource=typeof raw.diceResource==="string"&&raw.diceResource.length>0;
        if(hasLiteral===hasResource) throw new DomainEvaluationError(`${label}.operations[${operationIndex}] must declare exactly one of dice or diceResource`);
        if(raw.value!==undefined) throw new DomainEvaluationError(`${label}.operations[${operationIndex}].value is not allowed for ${raw.mode}`);
        if(hasLiteral) {
          const match=/^([0-9]+)d([0-9]+)([+-][0-9]+)?$/.exec(raw.dice as string);
          if(!match) throw new DomainEvaluationError(`${label}.operations[${operationIndex}].dice must be a dice formula`);
          if(raw.mode==="reroll"&&(Number(match[2])!==20||Number(match[3]??0)!==0)) throw new DomainEvaluationError(`${label}.operations[${operationIndex}] reroll requires Xd20 with no flat modifier`);
          return {kind:"roll.modify" as const,mode:raw.mode,dice:raw.dice as string};
        }
        const resourceId=raw.diceResource as string;
        const sides=options.resolveResourceDie?.(resourceId);
        if(typeof sides!=="number"||!Number.isInteger(sides)||sides<2) throw new DomainEvaluationError(`${label}.operations[${operationIndex}].diceResource has no authoritative die size: ${resourceId}`);
        if(raw.mode==="reroll"&&sides!==20) throw new DomainEvaluationError(`${label}.operations[${operationIndex}] reroll diceResource must resolve to d20`);
        return {kind:"roll.modify" as const,mode:raw.mode,dice:`1d${sides}`};
      }
      if(raw.mode!=="add-flat"&&raw.mode!=="target-add"&&raw.mode!=="replace"&&raw.mode!=="minimum") {
        throw new DomainEvaluationError(`${label}.operations[${operationIndex}].mode is not connected to the post-roll reaction runtime`);
      }
      if(raw.dice!==undefined||raw.diceResource!==undefined) throw new DomainEvaluationError(`${label}.operations[${operationIndex}] dice authority is not allowed for ${raw.mode}`);
      const value=resolvedNumber(raw.value,`${label}.operations[${operationIndex}].value`,options);
      if(!Number.isInteger(value.value)) throw new DomainEvaluationError(`${label}.operations[${operationIndex}].value must be an integer`);
      if((raw.mode==="replace"||raw.mode==="minimum")&&(value.value<1||value.value>20)) throw new DomainEvaluationError(`${label}.operations[${operationIndex}].value must be between 1 and 20 for ${raw.mode}`);
      return {kind:"roll.modify" as const,mode:raw.mode,value};
    }),
  };
}

function lowerDamageInterceptor(value:Obj,index:number,options:ReactionLoweringOptions):CommonPlayDamageRollInterceptor {
  const label=`Common Play reaction interceptor[${index}]`;
  if(value.families!==undefined||value.outcomes!==undefined)throw new DomainEvaluationError(`${label} d20 selectors require slot d20.roll`);
  const lowered=lowerD20Interceptor({...value,timing:"d20.outcome-determined",slot:"d20.roll"},index,options);
  if(lowered.operations.some((operation)=>operation.mode!=="subtract-die")) throw new DomainEvaluationError(`${label} primary.damage supports subtract-die only`);
  return {...lowered,timing:"damage.rolled",slot:"primary.damage"};
}

function lowerAttackOutcomeInterceptor(value:Obj,index:number):CommonPlayAttackOutcomeInterceptor {
  const label=`Common Play reaction interceptor[${index}]`;
  if(value.families!==undefined||value.outcomes!==undefined)throw new DomainEvaluationError(`${label} d20 selectors require slot d20.roll`);
  const eligibilityDefinition=eligibility(value,label);
  if(value.timing!=="attack.outcome-determined"||value.operation!=="recalculate"||value.slot!=="attack.outcome") {
    throw new DomainEvaluationError(`${label} is not a supported attack outcome recalculation interceptor`);
  }
  const operations=value.operations;
  if(!Array.isArray(operations)||!operations.length) throw new DomainEvaluationError(`${label}.operations must contain at least one operation`);
  return {
    id:stableId(value.id,`${label}.id`),
    timing:"attack.outcome-determined",
    interaction:interaction(value.interaction,`${label}.interaction`),
    operation:"recalculate",
    slot:"attack.outcome",
    ...(eligibilityDefinition?{eligibility:eligibilityDefinition}:{}),
    operations:operations.map((candidate,operationIndex)=>{
      const raw=object(candidate,`${label}.operations[${operationIndex}]`);
      if(raw.when!==undefined) throw new DomainEvaluationError(`${label}.operations[${operationIndex}].when is not connected to the reaction runtime yet`);
      if(raw.kind!=="property.modify"||typeof raw.property!=="string"||typeof raw.operation!=="string"||!PROPERTY_OPERATIONS.has(raw.operation)) {
        throw new DomainEvaluationError(`${label}.operations[${operationIndex}] must be a supported property.modify operation`);
      }
      return {
        kind:"property.modify" as const,
        property:raw.property,
        operation:raw.operation as CommonPlayAttackOutcomeInterceptor["operations"][number]["operation"],
        value:literalNumber(raw.value,`${label}.operations[${operationIndex}].value`),
      };
    }),
  };
}

function supportedInterceptor(value:Obj) {
  if(value.operation!=="recalculate") return false;
  return (value.timing==="d20.outcome-determined"&&value.slot==="d20.roll")
    ||(value.timing==="attack.outcome-determined"&&value.slot==="attack.outcome")
    ||(value.timing==="damage.rolled"&&value.slot==="primary.damage");
}

/**
 * Lowers only the generic interceptor families currently owned by the Gate A reaction kernel.
 * If a definition declares another interceptor shape, fail explicitly instead of silently
 * routing supported portable content into a named compatibility path.
 */
export function lowerCommonPlayReactionDefinition(definition:CommonPlayDefinitionIR,options:ReactionLoweringOptions={}):CommonPlayReactionDefinition|undefined {
  const rawInterceptors=definition.interceptors??[];
  if(!rawInterceptors.length) return undefined;
  const unsupportedIndex=rawInterceptors.findIndex((candidate)=>!supportedInterceptor(candidate));
  if(unsupportedIndex>=0) {
    const unsupported=rawInterceptors[unsupportedIndex];
    throw new DomainEvaluationError(
      `Common Play reaction interceptor[${unsupportedIndex}] is not connected to the generic reaction runtime: ${String(unsupported.timing)} / ${String(unsupported.slot)}`,
    );
  }
  return {
    id:definition.id,
    payments:(definition.payments??[]).map((candidate,index)=>payment(candidate,index)),
    interceptors:rawInterceptors.map((candidate,index)=>
      candidate.slot==="d20.roll"
        ? lowerD20Interceptor(candidate,index,options)
        : candidate.slot==="primary.damage"
          ? lowerDamageInterceptor(candidate,index,options)
          : lowerAttackOutcomeInterceptor(candidate,index)
    ),
  };
}
