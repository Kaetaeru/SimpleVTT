import type { CommonPlayOperationDefinition } from "../domain/commonPlayOperationRuntime";

export interface InstalledCommonPlayMechanicV1 {
  id?:string;
  kind:"common-play";
  config:CommonPlayOperationDefinition;
}

type Obj=Record<string,unknown>;
const cp=<T,>(value:T):T=>structuredClone(value);

function object(value:unknown,label:string):Obj {
  if (!value || typeof value!=="object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Obj;
}
function string(value:unknown,label:string) {
  if (typeof value!=="string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}
function onlyKeys(value:Obj,allowed:readonly string[],label:string) {
  const unsupported=Object.keys(value).filter((key)=>!allowed.includes(key));
  if (unsupported.length) throw new Error(`${label} contains unsupported field(s): ${unsupported.join(", ")}`);
}
function literalInteger(value:unknown,label:string) {
  const expression=object(value,label);
  onlyKeys(expression,["value"],label);
  if (typeof expression.value!=="number" || !Number.isFinite(expression.value) || !Number.isInteger(expression.value)) {
    throw new Error(`${label} requires a finite integer literal`);
  }
  return {value:expression.value};
}

function normalizeDefinition(value:unknown,label:string):CommonPlayOperationDefinition {
  const definition=object(value,label);
  onlyKeys(definition,["$schema","schemaVersion","id","payments","entryPoints"],label);
  if (definition.schemaVersion!=="0.2-draft") throw new Error(`${label}.schemaVersion must be 0.2-draft`);
  const id=string(definition.id,`${label}.id`);

  const rawPayments=definition.payments===undefined?[]:definition.payments;
  if (!Array.isArray(rawPayments)) throw new Error(`${label}.payments must be an array`);
  const payments=rawPayments.map((item,index)=>{
    const payment=object(item,`${label}.payments[${index}]`);
    onlyKeys(payment,["kind","resource","amount","consumeAt"],`${label}.payments[${index}]`);
    if (payment.kind!=="resource") throw new Error(`${label}.payments[${index}].kind is unsupported: ${String(payment.kind)}`);
    if (payment.consumeAt!=="commit") throw new Error(`${label}.payments[${index}].consumeAt must be commit`);
    const amount=literalInteger(payment.amount,`${label}.payments[${index}].amount`);
    if (amount.value<=0) throw new Error(`${label}.payments[${index}].amount must be positive`);
    return {kind:"resource" as const,resource:string(payment.resource,`${label}.payments[${index}].resource`),amount,consumeAt:"commit" as const};
  });

  if (!Array.isArray(definition.entryPoints) || definition.entryPoints.length!==1) {
    throw new Error(`${label}.entryPoints must contain exactly one manual entry point in the installed action slice`);
  }
  const entryPoints=definition.entryPoints.map((item,index)=>{
    const entry=object(item,`${label}.entryPoints[${index}]`);
    onlyKeys(entry,["id","invocation","operations"],`${label}.entryPoints[${index}]`);
    if (entry.invocation!=="manual") throw new Error(`${label}.entryPoints[${index}].invocation must be manual`);
    if (!Array.isArray(entry.operations) || !entry.operations.length) throw new Error(`${label}.entryPoints[${index}].operations must not be empty`);
    const operations=entry.operations.map((operationValue,operationIndex)=>{
      const operation=object(operationValue,`${label}.entryPoints[${index}].operations[${operationIndex}]`);
      const operationLabel=`${label}.entryPoints[${index}].operations[${operationIndex}]`;
      if (operation.kind==="resource.change") {
        onlyKeys(operation,["kind","resource","amount","target"],operationLabel);
        if (operation.target!==undefined && operation.target!=="actor" && operation.target!=="self") {
          throw new Error(`${operationLabel}.target currently supports actor/self only`);
        }
        const amount=literalInteger(operation.amount,`${operationLabel}.amount`);
        if (amount.value===0) throw new Error(`${operationLabel}.amount must be non-zero`);
        return {
          kind:"resource.change" as const,
          resource:string(operation.resource,`${operationLabel}.resource`),
          amount,
          ...(operation.target!==undefined?{target:operation.target as "actor"|"self"}:{}),
        };
      }
      if (operation.kind==="economy.modify") {
        onlyKeys(operation,["kind","bucket","amount"],operationLabel);
        const amount=literalInteger(operation.amount,`${operationLabel}.amount`);
        if (amount.value<=0) throw new Error(`${operationLabel}.amount must be positive`);
        return {kind:"economy.modify" as const,bucket:string(operation.bucket,`${operationLabel}.bucket`),amount};
      }
      throw new Error(`${operationLabel}.kind is unsupported by the installed Common Play operation slice: ${String(operation.kind)}`);
    });
    return {id:string(entry.id,`${label}.entryPoints[${index}].id`),invocation:"manual" as const,operations};
  });

  return cp({schemaVersion:"0.2-draft",id,payments,entryPoints});
}

export function normalizeInstalledCommonPlayMechanics(value:unknown,label:string):InstalledCommonPlayMechanicV1[] {
  if (value===undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  if (value.length!==1) throw new Error(`${label} must contain exactly one supported Common Play mechanic in this runtime slice`);
  return value.map((item,index)=>{
    const envelope=object(item,`${label}[${index}]`);
    onlyKeys(envelope,["id","kind","config"],`${label}[${index}]`);
    if (envelope.kind!=="common-play") throw new Error(`${label}[${index}].kind is unsupported by the generic installed runtime: ${String(envelope.kind)}`);
    return {
      ...(envelope.id===undefined?{}:{id:string(envelope.id,`${label}[${index}].id`)}),
      kind:"common-play" as const,
      config:normalizeDefinition(envelope.config,`${label}[${index}].config`),
    };
  });
}
