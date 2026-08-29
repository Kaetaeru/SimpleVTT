import type { CommonPlayDefinitionIR } from "./commonPlayDefinitionRuntime";
import type {
  CommonPlayAttackOutcomeInterceptor,
  CommonPlayD20RollInterceptor,
  CommonPlayInteractionDefinition,
  CommonPlayReactionDefinition,
} from "./commonPlayRuntime";
import { DomainEvaluationError } from "./profileEngine";

type Obj=Record<string,unknown>;
const STABLE_ID=/^[a-z0-9][a-z0-9._-]*$/;
const RESPONDERS=new Set(["actor","target","actor-owner","target-owner","dm","host"]);
const VISIBILITIES=new Set(["public","actor","dm","actor-and-dm","authority-only"]);
const STALE_POLICIES=new Set(["cancel","restart","reject"]);
const PROPERTY_OPERATIONS=new Set(["add","subtract","set","min","max","multiply"]);

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
  if(value.kind==="resource") {
    if(typeof value.resource!=="string"||!value.resource) throw new DomainEvaluationError(`${label}.resource must be a non-empty string`);
    return {
      kind:"resource",
      resource:value.resource,
      amount,
      consumeAt:"commit",
      ...(typeof value.refundOnCancel==="boolean"?{refundOnCancel:value.refundOnCancel}:{}),
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
    };
  }
  throw new DomainEvaluationError(`${label}.kind is unsupported by the reaction runtime`);
}

function lowerD20Interceptor(value:Obj,index:number):CommonPlayD20RollInterceptor {
  const label=`Common Play reaction interceptor[${index}]`;
  if(value.when!==undefined) throw new DomainEvaluationError(`${label}.when is not connected to the reaction runtime yet`);
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
    operations:operations.map((candidate,operationIndex)=>{
      const raw=object(candidate,`${label}.operations[${operationIndex}]`);
      if(raw.when!==undefined) throw new DomainEvaluationError(`${label}.operations[${operationIndex}].when is not connected to the reaction runtime yet`);
      if(raw.kind!=="roll.modify"||raw.mode!=="subtract-die"||typeof raw.dice!=="string"||!/^([0-9]+)d([0-9]+)([+-][0-9]+)?$/.test(raw.dice)) {
        throw new DomainEvaluationError(`${label}.operations[${operationIndex}] must be roll.modify subtract-die with a dice formula`);
      }
      return {kind:"roll.modify" as const,mode:"subtract-die" as const,dice:raw.dice};
    }),
  };
}

function lowerAttackOutcomeInterceptor(value:Obj,index:number):CommonPlayAttackOutcomeInterceptor {
  const label=`Common Play reaction interceptor[${index}]`;
  if(value.when!==undefined) throw new DomainEvaluationError(`${label}.when is not connected to the reaction runtime yet`);
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
    ||(value.timing==="attack.outcome-determined"&&value.slot==="attack.outcome");
}

/**
 * Lowers only the generic interceptor families currently owned by the Gate A reaction kernel.
 * If a definition declares another interceptor shape, fail explicitly instead of silently
 * routing supported portable content into a named compatibility path.
 */
export function lowerCommonPlayReactionDefinition(definition:CommonPlayDefinitionIR):CommonPlayReactionDefinition|undefined {
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
        ? lowerD20Interceptor(candidate,index)
        : lowerAttackOutcomeInterceptor(candidate,index)
    ),
  };
}
