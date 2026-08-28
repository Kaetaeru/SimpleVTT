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
  kind:"resource";
  resource:string;
  amount:CommonPlayExpression;
  consumeAt:"commit";
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
const DEFINITION_KEYS=new Set(["$schema","schemaVersion","id","payments","entryPoints"]);
const PAYMENT_KEYS=new Set(["kind","resource","amount","consumeAt"]);
const ENTRY_POINT_KEYS=new Set(["id","invocation","operations"]);
const RESOURCE_CHANGE_KEYS=new Set(["kind","resource","amount","target"]);
const ECONOMY_MODIFY_KEYS=new Set(["kind","bucket","amount"]);

function object(value:unknown,label:string):Obj {
  if(!value||typeof value!=="object"||Array.isArray(value)) throw new DomainEvaluationError(`${label} must be an object`);
  return value as Obj;
}

function supportedKeys(value:Obj,keys:Set<string>,label:string) {
  const unsupported=Object.keys(value).filter((key)=>!keys.has(key));
  if(unsupported.length) throw new DomainEvaluationError(`${label} contains unsupported fields: ${unsupported.join(", ")}`);
}

function nonEmptyString(value:unknown,label:string) {
  if(typeof value!=="string"||!value.trim()) throw new DomainEvaluationError(`${label} must be a non-empty string`);
  return value.trim();
}

function literalExpression(value:unknown,label:string):LiteralNumberExpression {
  const expression=object(value,label);
  supportedKeys(expression,new Set(["value"]),label);
  const number=expression.value;
  if(typeof number!=="number"||!Number.isFinite(number)||!Number.isInteger(number)) {
    throw new DomainEvaluationError(`${label} requires a finite integer literal`);
  }
  return {value:number};
}

function parsePayment(value:unknown,label:string):CommonPlayPayment {
  const payment=object(value,label);
  supportedKeys(payment,PAYMENT_KEYS,label);
  if(payment.kind!=="resource") throw new DomainEvaluationError(`unsupported Common Play payment kind: ${String(payment.kind)}`);
  if(payment.consumeAt!=="commit") throw new DomainEvaluationError(`unsupported Common Play resource payment consumeAt: ${String(payment.consumeAt??"<missing>")}`);
  const resource=nonEmptyString(payment.resource,`${label}.resource`);
  const amount=literalExpression(payment.amount,`${label}.amount`);
  if(amount.value<=0) throw new DomainEvaluationError("Common Play resource payment amount must be a positive integer");
  return {kind:"resource",resource,amount,consumeAt:"commit"};
}

function parseOperation(value:unknown,label:string):CommonPlayOperation {
  const operation=object(value,label);
  if(operation.kind==="resource.change") {
    supportedKeys(operation,RESOURCE_CHANGE_KEYS,label);
    const amount=literalExpression(operation.amount,`${label}.amount`);
    if(amount.value===0) throw new DomainEvaluationError("resource.change amount must be non-zero");
    const target=operation.target===undefined?undefined:nonEmptyString(operation.target,`${label}.target`);
    if(target!==undefined&&target!=="actor"&&target!=="self") {
      throw new DomainEvaluationError(`${label}.target must be actor or self for portable Common Play resource.change`);
    }
    return {
      kind:"resource.change",
      resource:nonEmptyString(operation.resource,`${label}.resource`),
      amount,
      ...(target===undefined?{}:{target}),
    };
  }
  if(operation.kind==="economy.modify") {
    supportedKeys(operation,ECONOMY_MODIFY_KEYS,label);
    const amount=literalExpression(operation.amount,`${label}.amount`);
    if(amount.value<=0) throw new DomainEvaluationError("economy.modify grant amount must be a positive integer");
    return {
      kind:"economy.modify",
      bucket:nonEmptyString(operation.bucket,`${label}.bucket`),
      amount,
    };
  }
  throw new DomainEvaluationError(`unsupported Common Play operation: ${String(operation.kind)}`);
}

export function parseCommonPlayOperationDefinition(value:unknown,label="Common Play definition"):CommonPlayOperationDefinition {
  const definition=object(value,label);
  supportedKeys(definition,DEFINITION_KEYS,label);
  if(definition.schemaVersion!=="0.2-draft") throw new DomainEvaluationError(`${label}.schemaVersion must be 0.2-draft`);
  const id=nonEmptyString(definition.id,`${label}.id`);
  const payments=definition.payments===undefined?undefined:(()=>{
    if(!Array.isArray(definition.payments)) throw new DomainEvaluationError(`${label}.payments must be an array`);
    return definition.payments.map((payment,index)=>parsePayment(payment,`${label}.payments[${index}]`));
  })();
  if(!Array.isArray(definition.entryPoints)||!definition.entryPoints.length) throw new DomainEvaluationError(`${label}.entryPoints must be a non-empty array`);
  const entryPoints=definition.entryPoints.map((value,index)=>{
    const entry=object(value,`${label}.entryPoints[${index}]`);
    supportedKeys(entry,ENTRY_POINT_KEYS,`${label}.entryPoints[${index}]`);
    const invocation=entry.invocation;
    if(invocation!=="manual"&&invocation!=="triggered"&&invocation!=="automatic"&&invocation!=="granted") {
      throw new DomainEvaluationError(`${label}.entryPoints[${index}].invocation is unsupported`);
    }
    if(!Array.isArray(entry.operations)) throw new DomainEvaluationError(`${label}.entryPoints[${index}].operations must be an array`);
    return {
      id:nonEmptyString(entry.id,`${label}.entryPoints[${index}].id`),
      invocation,
      operations:entry.operations.map((operation,operationIndex)=>parseOperation(operation,`${label}.entryPoints[${index}].operations[${operationIndex}]`)),
    };
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
    const amount=literalInteger(payment.amount,"resource payment amount");
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
  const supported=parseCommonPlayOperationDefinition(definition);
  const entryPoint=supported.entryPoints.find((entry)=>entry.id===input.entryPointId);
  if(!entryPoint) throw new DomainEvaluationError(`Common Play entry point not found: ${input.entryPointId}`);
  if(entryPoint.invocation!=="manual") {
    throw new DomainEvaluationError(`Common Play operation runtime supports manual entry points only: ${entryPoint.invocation}`);
  }

  const operations:ResolutionOperation[]=[...compilePayments(supported,input)];
  for(const [index,operation] of entryPoint.operations.entries()) {
    const operationId=`${input.resolutionId}:operation:${index}`;
    if(operation.kind==="resource.change") {
      if(operation.target!==undefined&&operation.target!=="actor"&&operation.target!=="self"&&operation.target!==input.actorId) {
        throw new DomainEvaluationError("Common Play resource.change currently supports the acting actor only");
      }
      const amount=literalInteger(operation.amount,"resource.change amount");
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

    const amount=literalInteger(operation.amount,"economy.modify amount");
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
    sourceId:supported.id,
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
