import type { RulesRuntimeState } from "./combatState";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";

type LiteralNumberExpression={value:number};
type CommonPlayExpression=LiteralNumberExpression|Record<string,unknown>;

type CommonPlayResourceChange={
  kind:"resource.change";
  resource:string;
  amount:CommonPlayExpression;
  target?:string;
};

type CommonPlayEconomyModify={
  kind:"economy.modify";
  bucket:string;
  amount:CommonPlayExpression;
};

type CommonPlayPayment={
  kind:string;
  resource?:string;
  amount?:CommonPlayExpression;
  consumeAt?:string;
};

export type CommonPlayOperation=CommonPlayResourceChange|CommonPlayEconomyModify;

export interface CommonPlayOperationDefinition {
  schemaVersion:string;
  id:string;
  payments?:CommonPlayPayment[];
  entryPoints:Array<{
    id:string;
    invocation:"manual"|"triggered"|"automatic"|"granted";
    operations:CommonPlayOperation[];
  }>;
}

export interface CommonPlayOperationExecutionInput {
  resolutionId:string;
  actorId:string;
  entryPointId:string;
}

type Obj=Record<string,unknown>;
function portableObject(value:unknown,label:string):Obj {
  if(!value||typeof value!=="object"||Array.isArray(value)) throw new DomainEvaluationError(`${label} must be an object`);
  return value as Obj;
}
function portableString(value:unknown,label:string) {
  if(typeof value!=="string"||!value.trim()) throw new DomainEvaluationError(`${label} must be a non-empty string`);
  return value.trim();
}
function portableKeys(value:Obj,allowed:string[],label:string) {
  const allowedSet=new Set(allowed);
  const extra=Object.keys(value).find((key)=>!allowedSet.has(key));
  if(extra) throw new DomainEvaluationError(`${label}.${extra} is unsupported by the Common Play operation runtime`);
}
function portableLiteral(value:unknown,label:string):LiteralNumberExpression {
  const expression=portableObject(value,label);
  portableKeys(expression,["value"],label);
  const number=expression.value;
  if(typeof number!=="number"||!Number.isFinite(number)||!Number.isInteger(number)) {
    throw new DomainEvaluationError(`${label}.value must be a finite integer`);
  }
  return {value:number};
}

export function parseCommonPlayOperationDefinition(value:unknown,label="Common Play definition"):CommonPlayOperationDefinition {
  const definition=portableObject(value,label);
  portableKeys(definition,["schemaVersion","id","payments","entryPoints"],label);
  if(definition.schemaVersion!=="0.2-draft") throw new DomainEvaluationError(`${label}.schemaVersion must be 0.2-draft`);
  const id=portableString(definition.id,`${label}.id`);

  let payments:CommonPlayPayment[]|undefined;
  if(definition.payments!==undefined) {
    if(!Array.isArray(definition.payments)) throw new DomainEvaluationError(`${label}.payments must be an array`);
    payments=definition.payments.map((raw,index)=>{
      const payment=portableObject(raw,`${label}.payments[${index}]`);
      portableKeys(payment,["kind","resource","amount","consumeAt"],`${label}.payments[${index}]`);
      if(payment.kind!=="resource") throw new DomainEvaluationError(`${label}.payments[${index}].kind is unsupported: ${String(payment.kind)}`);
      if(payment.consumeAt!=="commit") throw new DomainEvaluationError(`${label}.payments[${index}].consumeAt must be commit`);
      const amount=portableLiteral(payment.amount,`${label}.payments[${index}].amount`);
      if(amount.value<=0) throw new DomainEvaluationError(`${label}.payments[${index}].amount.value must be positive`);
      return {kind:"resource",resource:portableString(payment.resource,`${label}.payments[${index}].resource`),amount,consumeAt:"commit"};
    });
  }

  if(!Array.isArray(definition.entryPoints)||!definition.entryPoints.length) throw new DomainEvaluationError(`${label}.entryPoints must be a non-empty array`);
  const entryPoints=definition.entryPoints.map((raw,index)=>{
    const entry=portableObject(raw,`${label}.entryPoints[${index}]`);
    portableKeys(entry,["id","invocation","operations"],`${label}.entryPoints[${index}]`);
    if(entry.invocation!=="manual") throw new DomainEvaluationError(`${label}.entryPoints[${index}].invocation is unsupported: ${String(entry.invocation)}`);
    if(!Array.isArray(entry.operations)||!entry.operations.length) throw new DomainEvaluationError(`${label}.entryPoints[${index}].operations must be a non-empty array`);
    const operations=entry.operations.map((rawOperation,operationIndex):CommonPlayOperation=>{
      const operation=portableObject(rawOperation,`${label}.entryPoints[${index}].operations[${operationIndex}]`);
      if(operation.kind==="resource.change") {
        portableKeys(operation,["kind","resource","amount","target"],`${label}.entryPoints[${index}].operations[${operationIndex}]`);
        const amount=portableLiteral(operation.amount,`${label}.entryPoints[${index}].operations[${operationIndex}].amount`);
        if(amount.value===0) throw new DomainEvaluationError(`${label}.entryPoints[${index}].operations[${operationIndex}].amount.value must be non-zero`);
        const target=operation.target===undefined?undefined:portableString(operation.target,`${label}.entryPoints[${index}].operations[${operationIndex}].target`);
        return {kind:"resource.change",resource:portableString(operation.resource,`${label}.entryPoints[${index}].operations[${operationIndex}].resource`),amount,...(target?{target}:{})};
      }
      if(operation.kind==="economy.modify") {
        portableKeys(operation,["kind","bucket","amount"],`${label}.entryPoints[${index}].operations[${operationIndex}]`);
        const amount=portableLiteral(operation.amount,`${label}.entryPoints[${index}].operations[${operationIndex}].amount`);
        if(amount.value<=0) throw new DomainEvaluationError(`${label}.entryPoints[${index}].operations[${operationIndex}].amount.value must be positive`);
        return {kind:"economy.modify",bucket:portableString(operation.bucket,`${label}.entryPoints[${index}].operations[${operationIndex}].bucket`),amount};
      }
      throw new DomainEvaluationError(`${label}.entryPoints[${index}].operations[${operationIndex}].kind is unsupported: ${String(operation.kind)}`);
    });
    return {id:portableString(entry.id,`${label}.entryPoints[${index}].id`),invocation:"manual" as const,operations};
  });

  return {schemaVersion:"0.2-draft",id,...(payments?{payments}:{}),entryPoints};
}

function literalInteger(expression:CommonPlayExpression|undefined,label:string) {
  if(!expression||typeof expression!=="object"||!("value" in expression)) {
    throw new DomainEvaluationError(`${label} requires a supported literal expression`);
  }
  const value=(expression as {value?:unknown}).value;
  if(typeof value!=="number"||!Number.isFinite(value)||!Number.isInteger(value)) {
    throw new DomainEvaluationError(`${label} requires a finite integer literal`);
  }
  return value;
}

function compilePayments(
  definition:CommonPlayOperationDefinition,
  input:CommonPlayOperationExecutionInput,
):ResolutionOperation[] {
  return (definition.payments??[]).map((payment,index)=>{
    if(payment.kind!=="resource") {
      throw new DomainEvaluationError(`unsupported Common Play payment kind: ${payment.kind}`);
    }
    if(payment.consumeAt!=="commit") {
      throw new DomainEvaluationError(`unsupported Common Play resource payment consumeAt: ${payment.consumeAt??"<missing>"}`);
    }
    if(!payment.resource) throw new DomainEvaluationError("Common Play resource payment requires a resource id");
    const amount=literalInteger(payment.amount,"resource payment amount");
    if(amount<=0) throw new DomainEvaluationError("Common Play resource payment amount must be a positive integer");
    return {
      id:`${input.resolutionId}:payment:${index}`,
      kind:"spend-resource" as const,
      actorId:input.actorId,
      resourceId:payment.resource,
      amount,
    };
  });
}

export function compileCommonPlayEntryPointOperations(
  profile:RulesProfileLike,
  state:RulesRuntimeState,
  definition:CommonPlayOperationDefinition,
  input:CommonPlayOperationExecutionInput,
):PendingResolution {
  const entryPoint=definition.entryPoints.find((entry)=>entry.id===input.entryPointId);
  if(!entryPoint) throw new DomainEvaluationError(`Common Play entry point not found: ${input.entryPointId}`);
  if(entryPoint.invocation!=="manual") {
    throw new DomainEvaluationError(`Common Play operation runtime supports manual entry points only: ${entryPoint.invocation}`);
  }

  const operations:ResolutionOperation[]=[...compilePayments(definition,input)];
  for(const [index,operation] of entryPoint.operations.entries()) {
    const operationId=`${input.resolutionId}:operation:${index}`;
    if(operation.kind==="resource.change") {
      if(operation.target!==undefined&&operation.target!=="actor"&&operation.target!=="self"&&operation.target!==input.actorId) {
        throw new DomainEvaluationError("Common Play resource.change currently supports the acting actor only");
      }
      const amount=literalInteger(operation.amount,"resource.change amount");
      if(amount===0) throw new DomainEvaluationError("resource.change amount must be non-zero");
      operations.push(amount<0?{
        id:operationId,
        kind:"spend-resource",
        actorId:input.actorId,
        resourceId:operation.resource,
        amount:-amount,
      }:{
        id:operationId,
        kind:"gain-resource",
        actorId:input.actorId,
        resourceId:operation.resource,
        amount,
      });
      continue;
    }

    if(operation.kind!=="economy.modify") {
      throw new DomainEvaluationError(`unsupported Common Play operation: ${(operation as {kind?:unknown}).kind}`);
    }
    const amount=literalInteger(operation.amount,"economy.modify amount");
    if(amount<=0) throw new DomainEvaluationError("economy.modify grant amount must be a positive integer");
    const bucket=profile.economy?.grantBuckets?.[operation.bucket];
    if(!bucket) throw new DomainEvaluationError(`unregistered economy grant bucket: ${operation.bucket}`);
    if(bucket.kind!=="extra-action") throw new DomainEvaluationError(`unsupported economy grant bucket kind: ${bucket.kind}`);
    if(bucket.activeTurnOnly&&(state.clock.activeActorId!==input.actorId||state.clock.phase==="end")) {
      throw new DomainEvaluationError(`economy grant bucket ${operation.bucket} requires the actor's active turn`);
    }
    for(let grantIndex=0;grantIndex<amount;grantIndex+=1) {
      operations.push({
        id:amount===1?operationId:`${operationId}:grant:${grantIndex}`,
        kind:"grant-extra-action",
        actorId:input.actorId,
        grantId:`${input.resolutionId}:economy:${index}:${grantIndex}`,
        allowsMagicAction:bucket.allowsMagicAction,
      });
    }
  }

  return {
    id:input.resolutionId,
    actorId:input.actorId,
    sourceId:definition.id,
    expectedRevision:state.revision,
    operations,
  };
}

export function resolveCommonPlayEntryPointOperations(
  profile:RulesProfileLike,
  state:RulesRuntimeState,
  definition:CommonPlayOperationDefinition,
  input:CommonPlayOperationExecutionInput,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,state,compileCommonPlayEntryPointOperations(profile,state,definition,input));
  } catch(error) {
    return {
      status:"rejected",
      state,
      events:[],
      results:{},
      error:error instanceof Error?error.message:String(error),
    };
  }
}
