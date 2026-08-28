import type { CommonPlayOperationDefinition } from "../domain/commonPlayOperationRuntime";

type Obj=Record<string,unknown>;
const STABLE_ID=/^[a-z0-9][a-z0-9._-]*$/;

function object(value:unknown,label:string):Obj {
  if(!value||typeof value!=="object"||Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Obj;
}
function stableId(value:unknown,label:string) {
  if(typeof value!=="string"||!STABLE_ID.test(value)) throw new Error(`${label} must be a stable Common Play id`);
  return value;
}
function string(value:unknown,label:string) {
  if(typeof value!=="string"||!value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}
function exactKeys(value:Obj,allowed:readonly string[],label:string) {
  const unknown=Object.keys(value).filter((key)=>!allowed.includes(key));
  if(unknown.length) throw new Error(`${label} contains unsupported fields: ${unknown.join(", ")}`);
}
function literalInteger(value:unknown,label:string) {
  const expression=object(value,label);
  exactKeys(expression,["value"],label);
  if(typeof expression.value!=="number"||!Number.isFinite(expression.value)||!Number.isInteger(expression.value)) {
    throw new Error(`${label}.value must be a finite integer`);
  }
  return {value:expression.value};
}

function payment(value:unknown,label:string) {
  const item=object(value,label);
  exactKeys(item,["kind","resource","amount","consumeAt","refundOnCancel"],label);
  if(item.kind!=="resource") throw new Error(`${label}.kind is unsupported by the portable Common Play runtime: ${String(item.kind)}`);
  if(item.consumeAt!=="commit") throw new Error(`${label}.consumeAt must be commit`);
  if(item.refundOnCancel!==undefined&&typeof item.refundOnCancel!=="boolean") throw new Error(`${label}.refundOnCancel must be boolean`);
  const amount=literalInteger(item.amount,`${label}.amount`);
  if(amount.value<=0) throw new Error(`${label}.amount must be positive`);
  return {
    kind:"resource" as const,
    resource:string(item.resource,`${label}.resource`),
    amount,
    consumeAt:"commit" as const,
    ...(item.refundOnCancel===undefined?{}:{refundOnCancel:item.refundOnCancel}),
  };
}

function operation(value:unknown,label:string) {
  const item=object(value,label);
  if(item.kind==="resource.change") {
    exactKeys(item,["kind","resource","amount","target"],label);
    if(item.target!==undefined&&typeof item.target!=="string") throw new Error(`${label}.target must be a string`);
    const amount=literalInteger(item.amount,`${label}.amount`);
    if(amount.value===0) throw new Error(`${label}.amount must be non-zero`);
    return {
      kind:"resource.change" as const,
      resource:string(item.resource,`${label}.resource`),
      amount,
      ...(item.target===undefined?{}:{target:item.target}),
    };
  }
  if(item.kind==="economy.modify") {
    exactKeys(item,["kind","bucket","amount"],label);
    const amount=literalInteger(item.amount,`${label}.amount`);
    if(amount.value<=0) throw new Error(`${label}.amount must be positive`);
    return {
      kind:"economy.modify" as const,
      bucket:string(item.bucket,`${label}.bucket`),
      amount,
    };
  }
  throw new Error(`${label}.kind is unsupported by the portable Common Play runtime: ${String(item.kind)}`);
}

function entryPoint(value:unknown,label:string) {
  const item=object(value,label);
  exactKeys(item,["id","invocation","operations"],label);
  if(item.invocation!=="manual") throw new Error(`${label}.invocation must be manual for portable activation`);
  if(!Array.isArray(item.operations)||!item.operations.length) throw new Error(`${label}.operations must be a non-empty array`);
  return {
    id:stableId(item.id,`${label}.id`),
    invocation:"manual" as const,
    operations:item.operations.map((candidate,index)=>operation(candidate,`${label}.operations[${index}]`)),
  };
}

export function normalizePortableCommonPlayDefinition(value:unknown,label="common-play.config"):CommonPlayOperationDefinition {
  const definition=object(value,label);
  exactKeys(definition,["schemaVersion","id","payments","entryPoints"],label);
  if(definition.schemaVersion!=="0.2-draft") throw new Error(`${label}.schemaVersion must be 0.2-draft`);
  if(!Array.isArray(definition.entryPoints)||!definition.entryPoints.length) throw new Error(`${label}.entryPoints must be a non-empty array`);
  if(definition.payments!==undefined&&!Array.isArray(definition.payments)) throw new Error(`${label}.payments must be an array`);
  return {
    schemaVersion:"0.2-draft",
    id:stableId(definition.id,`${label}.id`),
    ...(definition.payments===undefined?{}:{payments:definition.payments.map((candidate,index)=>payment(candidate,`${label}.payments[${index}]`))}),
    entryPoints:definition.entryPoints.map((candidate,index)=>entryPoint(candidate,`${label}.entryPoints[${index}]`)),
  };
}

export function normalizePortableCommonPlayMechanics(value:unknown,label="mechanics"):CommonPlayOperationDefinition[] {
  if(value===undefined) return [];
  if(!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((candidate,index)=>{
    const mechanic=object(candidate,`${label}[${index}]`);
    exactKeys(mechanic,["kind","config"],`${label}[${index}]`);
    if(mechanic.kind!=="common-play") throw new Error(`${label}[${index}] has unsupported mechanic kind: ${String(mechanic.kind)}`);
    return normalizePortableCommonPlayDefinition(mechanic.config,`${label}[${index}].config`);
  });
}
