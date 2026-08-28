import type { CommonPlayOperation, CommonPlayOperationDefinition } from "../domain/commonPlayOperationRuntime";
import type { InstalledPortableCommonPlayMechanicV1 } from "./installedContentContracts";

type Obj=Record<string,unknown>;

function object(value:unknown,label:string):Obj {
  if(!value||typeof value!=="object"||Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Obj;
}
function exactKeys(value:Obj,allowed:string[],label:string) {
  const extras=Object.keys(value).filter((key)=>!allowed.includes(key));
  if(extras.length) throw new Error(`${label} contains unsupported fields: ${extras.join(", ")}`);
}
function string(value:unknown,label:string) {
  if(typeof value!=="string"||!value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
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
  exactKeys(item,["kind","resource","amount","consumeAt"],label);
  if(item.kind!=="resource") throw new Error(`${label}.kind is unsupported: ${String(item.kind)}`);
  if(item.consumeAt!=="commit") throw new Error(`${label}.consumeAt must be commit`);
  const amount=literalInteger(item.amount,`${label}.amount`);
  if(amount.value<=0) throw new Error(`${label}.amount.value must be positive`);
  return {kind:"resource",resource:string(item.resource,`${label}.resource`),amount,consumeAt:"commit"} as const;
}
function operation(value:unknown,label:string):CommonPlayOperation {
  const item=object(value,label);
  if(item.kind==="resource.change") {
    exactKeys(item,["kind","resource","amount","target"],label);
    if(item.target!==undefined&&item.target!=="actor"&&item.target!=="self") {
      throw new Error(`${label}.target must be actor or self for portable content`);
    }
    const amount=literalInteger(item.amount,`${label}.amount`);
    if(amount.value===0) throw new Error(`${label}.amount.value must be non-zero`);
    return {
      kind:"resource.change",
      resource:string(item.resource,`${label}.resource`),
      amount,
      ...(item.target===undefined?{}:{target:item.target}),
    };
  }
  if(item.kind==="economy.modify") {
    exactKeys(item,["kind","bucket","amount"],label);
    const amount=literalInteger(item.amount,`${label}.amount`);
    if(amount.value<=0) throw new Error(`${label}.amount.value must be positive`);
    return {kind:"economy.modify",bucket:string(item.bucket,`${label}.bucket`),amount};
  }
  throw new Error(`${label}.kind is unsupported: ${String(item.kind)}`);
}
function definition(value:unknown,label:string):CommonPlayOperationDefinition {
  const raw=object(value,label);
  exactKeys(raw,["schemaVersion","id","payments","entryPoints"],label);
  if(raw.schemaVersion!=="0.2-draft") throw new Error(`${label}.schemaVersion must be 0.2-draft`);
  if(!Array.isArray(raw.entryPoints)||!raw.entryPoints.length) throw new Error(`${label}.entryPoints must contain at least one entry point`);
  const entryPoints=raw.entryPoints.map((value,index)=>{
    const item=object(value,`${label}.entryPoints[${index}]`);
    exactKeys(item,["id","invocation","operations"],`${label}.entryPoints[${index}]`);
    if(item.invocation!=="manual") throw new Error(`${label}.entryPoints[${index}].invocation is unsupported: ${String(item.invocation)}`);
    if(!Array.isArray(item.operations)) throw new Error(`${label}.entryPoints[${index}].operations must be an array`);
    return {
      id:string(item.id,`${label}.entryPoints[${index}].id`),
      invocation:"manual" as const,
      operations:item.operations.map((entry,operationIndex)=>operation(entry,`${label}.entryPoints[${index}].operations[${operationIndex}]`)),
    };
  });
  const ids=new Set<string>();
  for(const entryPoint of entryPoints) {
    if(ids.has(entryPoint.id)) throw new Error(`${label} contains duplicate entry point id: ${entryPoint.id}`);
    ids.add(entryPoint.id);
  }
  if(raw.payments!==undefined&&!Array.isArray(raw.payments)) throw new Error(`${label}.payments must be an array`);
  return {
    schemaVersion:"0.2-draft",
    id:string(raw.id,`${label}.id`),
    ...(raw.payments===undefined?{}:{payments:raw.payments.map((entry,index)=>payment(entry,`${label}.payments[${index}]`))}),
    entryPoints,
  };
}

export function parseInstalledPortableMechanics(value:unknown,label:string):InstalledPortableCommonPlayMechanicV1[] {
  if(value===undefined) return [];
  if(!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((entry,index)=>{
    const mechanic=object(entry,`${label}[${index}]`);
    exactKeys(mechanic,["id","kind","config"],`${label}[${index}]`);
    if(mechanic.kind!=="common-play") throw new Error(`${label}[${index}] has unsupported mechanic kind: ${String(mechanic.kind)}`);
    const id=mechanic.id===undefined?undefined:string(mechanic.id,`${label}[${index}].id`);
    return {
      ...(id?{id}:{}),
      kind:"common-play",
      config:definition(mechanic.config,`${label}[${index}].config`),
    };
  });
}
