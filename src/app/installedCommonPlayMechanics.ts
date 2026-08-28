import type { CommonPlayOperationDefinition } from "../domain/commonPlayOperationRuntime";
import type { InstalledContentMechanicV1 } from "./installedContentContracts";

const cp=<T,>(value:T):T=>structuredClone(value);
type Obj=Record<string,unknown>;

function object(value:unknown,label:string):Obj {
  if (!value || typeof value!=="object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Obj;
}
function text(value:unknown,label:string) {
  if (typeof value!=="string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}
function only(value:Obj,label:string,allowed:string[]) {
  const allowedSet=new Set(allowed);
  for (const key of Object.keys(value)) if (!allowedSet.has(key)) throw new Error(`${label}.${key} is unsupported by the installed Common Play runtime`);
}
function literalInteger(value:unknown,label:string,{positive=false,nonZero=false}:{positive?:boolean;nonZero?:boolean}={}) {
  const expression=object(value,label);
  only(expression,label,["value"]);
  const amount=expression.value;
  if (typeof amount!=="number" || !Number.isFinite(amount) || !Number.isInteger(amount)) throw new Error(`${label}.value must be a finite integer`);
  if (positive && amount<=0) throw new Error(`${label}.value must be positive`);
  if (nonZero && amount===0) throw new Error(`${label}.value must be non-zero`);
}

export function parseSupportedCommonPlayDefinition(value:unknown,label:string):CommonPlayOperationDefinition {
  const definition=object(value,label);
  only(definition,label,["$schema","schemaVersion","id","payments","entryPoints"]);
  if (definition.schemaVersion!=="0.2-draft") throw new Error(`${label}.schemaVersion must be 0.2-draft`);
  text(definition.id,`${label}.id`);

  if (definition.payments!==undefined) {
    if (!Array.isArray(definition.payments)) throw new Error(`${label}.payments must be an array`);
    definition.payments.forEach((raw,index)=>{
      const payment=object(raw,`${label}.payments[${index}]`);
      only(payment,`${label}.payments[${index}]`,["kind","resource","amount","consumeAt"]);
      if (payment.kind!=="resource") throw new Error(`${label}.payments[${index}].kind is unsupported: ${String(payment.kind)}`);
      text(payment.resource,`${label}.payments[${index}].resource`);
      literalInteger(payment.amount,`${label}.payments[${index}].amount`,{positive:true});
      if (payment.consumeAt!=="commit") throw new Error(`${label}.payments[${index}].consumeAt must be commit`);
    });
  }

  if (!Array.isArray(definition.entryPoints) || !definition.entryPoints.length) throw new Error(`${label}.entryPoints must contain at least one entry`);
  definition.entryPoints.forEach((raw,index)=>{
    const entry=object(raw,`${label}.entryPoints[${index}]`);
    only(entry,`${label}.entryPoints[${index}]`,["id","invocation","operations"]);
    text(entry.id,`${label}.entryPoints[${index}].id`);
    if (entry.invocation!=="manual") throw new Error(`${label}.entryPoints[${index}].invocation is unsupported: ${String(entry.invocation)}`);
    if (!Array.isArray(entry.operations)) throw new Error(`${label}.entryPoints[${index}].operations must be an array`);
    entry.operations.forEach((rawOperation,operationIndex)=>{
      const operationLabel=`${label}.entryPoints[${index}].operations[${operationIndex}]`;
      const operation=object(rawOperation,operationLabel);
      if (operation.kind==="resource.change") {
        only(operation,operationLabel,["kind","resource","amount","target"]);
        text(operation.resource,`${operationLabel}.resource`);
        literalInteger(operation.amount,`${operationLabel}.amount`,{nonZero:true});
        if (operation.target!==undefined && operation.target!=="actor" && operation.target!=="self") throw new Error(`${operationLabel}.target is unsupported: ${String(operation.target)}`);
        return;
      }
      if (operation.kind==="economy.modify") {
        only(operation,operationLabel,["kind","bucket","amount"]);
        text(operation.bucket,`${operationLabel}.bucket`);
        literalInteger(operation.amount,`${operationLabel}.amount`,{positive:true});
        return;
      }
      throw new Error(`${operationLabel}.kind is unsupported by the installed Common Play runtime: ${String(operation.kind)}`);
    });
  });

  return cp(definition) as unknown as CommonPlayOperationDefinition;
}

export function parseInstalledContentMechanics(value:unknown,label:string):InstalledContentMechanicV1[] {
  if (value===undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((raw,index)=>{
    const mechanicLabel=`${label}[${index}]`;
    const mechanic=object(raw,mechanicLabel);
    only(mechanic,mechanicLabel,["id","kind","config"]);
    if (mechanic.kind!=="common-play") throw new Error(`${label} cannot be activated: unsupported mechanic kind ${String(mechanic.kind)}`);
    const id=mechanic.id===undefined ? undefined : text(mechanic.id,`${mechanicLabel}.id`);
    return {
      ...(id?{id}:{}),
      kind:"common-play" as const,
      config:parseSupportedCommonPlayDefinition(mechanic.config,`${mechanicLabel}.config`),
    };
  });
}
