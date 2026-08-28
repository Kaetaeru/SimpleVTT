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
function object(value:unknown,label:string):Obj {
  if(!value||typeof value!=="object"||Array.isArray(value)) throw new DomainEvaluationError(`${label} must be an object`);
  return value as Obj;
}
function nonEmptyString(value:unknown,label:string) {
  if(typeof value!=="string"||!value.trim()) throw new DomainEvaluationError(`${label} must be a non-empty string`);
  return value.trim();
}
function parsedLiteralInteger(value:unknown,label:string) {
  const expression=object(value,label);
  if(!("value" in expression)||typeof expression.value!=="number"||!Number.isFinite(expression.value)||!Number.isInteger(expression.value)) {
    throw new DomainEvaluationError(`${label} requires a finite integer literal`);
  }
  return {value:expression.value};
}

export function parseCommonPlayOperationDefinition(value:unknown,label="Common Play definition"):CommonPlayOperationDefinition {
  const definition=object(value,label);
  if(definition.schemaVersion!=="0.2-draft") throw new DomainEvaluationError(`${label}.schemaVersion must be 0.2-draft`);
  const id=nonEmptyString(definition.id,`${label}.id`);

  let payments:CommonPlayPayment[]|undefined;
  if(definition.payments!==undefined) {
    if(!Array.isArray(definition.payments)) throw new DomainEvaluationError(`${label}.payments must be an array`);
    payments=definition.payments.map((raw,index)=>{
      const payment=object(raw,`${label}.payments[${index}]`);
      if(payment.kind!=="resource") throw new DomainEvaluationError(`unsupported Common Play payment kind: ${String(payment.kind)}`);
      const resource=nonEmptyString(payment.resource,`${label}.payments[${index}].resource`);
      if(payment.consumeAt!=="commit") throw new DomainEvaluationError(`unsupported Common Play resource payment consumeAt: ${String(payment.consumeAt??"<missing>")}`);
      const amount=parsedLiteralInteger(payment.amount,`${label}.payments[${index}].amount`);
      if(amount.value<=0) throw new DomainEvaluationError("Common Play resource payment amount must be a positive integer");
      return {kind:"resource",resource,amount,consumeAt:"commit"};
    });
  }

  if(!Array.isArray(definition.entryPoints)||!definition.entryPoints.length) throw new DomainEvaluationError(`${label}.entryPoints must contain at least one entry point`);
  const entryPoints=definition.entryPoints.map((raw,index)=>{
    const entry=object(raw,`${label}.entryPoints[${index}]`);
    const entryId=nonEmptyString(entry.id,`${label}.entryPoints[${index}].id`);
    if(entry.invocation!=="manual") throw new DomainEvaluationError(`Common Play operation runtime supports manual entry points only: ${String(entry.invocation)}`);
    if(!Array.isArray(entry.operations)||!entry.operations.length) throw new DomainEvaluationError(`${label}.entryPoints[${index}].operations must contain at least one operation`);
    const operations:CommonPlayOperation[]=entry.operations.map((operationRaw,operationIndex)=>{
      const operation=object(operationRaw,`${label}.entryPoints[${index}].operations[${operationIndex}]`);
      if(operation.kind==="resource.change") {
        const resource=nonEmptyString(operation.resource,`${label}.entryPoints[${index}].operations[${operationIndex}].resource`);
        const amount=parsedLiteralInteger(operation.amount,`${label}.entryPoints[${index}].operations[${operationIndex}].amount`);
        if(amount.value===0) throw new DomainEvaluationError("resource.change amount must be non-zero");
        const target=operation.target===undefined?undefined:nonEmptyString(operation.target,`${label}.entryPoints[${index}].operations[${operationIndex}].target`);
        if(target!==undefined&&target!=="actor"&&target!=="self") throw new DomainEvaluationError("portable Common Play resource.change supports actor/self target bindings only");
        return {kind:"resource.change",resource,amount,...(target?{target}:{})};
      }
      if(operation.kind==="economy.modify") {
        const bucket=nonEmptyString(operation.bucket,`${label}.entryPoints[${index}].operations[${operationIndex}].bucket`);
        const amount=parsedLiteralInteger(operation.amount,`${label}.entryPoints[${index}].operations[${operationIndex}].amount`);
        if(amount.value<=0) throw new DomainEvaluationError("economy.modify grant amount must be a positive integer");
        return {kind:"economy.modify",bucket,amount};
      }
      throw new DomainEvaluationError(`unsupported Common Play operation: ${String(operation.kind??"<missing>")}`);
    });
    return {id:entryId,invocation:"manual" as const,operations};
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
