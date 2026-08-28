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

export type CommonPlayOperation=CommonPlayResourceChange|CommonPlayEconomyModify;

export interface CommonPlayOperationDefinition {
  schemaVersion:string;
  id:string;
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

function literalInteger(expression:CommonPlayExpression,label:string) {
  if(!expression||typeof expression!=="object"||!("value" in expression)) {
    throw new DomainEvaluationError(`${label} requires a supported literal expression`);
  }
  const value=(expression as {value?:unknown}).value;
  if(typeof value!=="number"||!Number.isFinite(value)||!Number.isInteger(value)) {
    throw new DomainEvaluationError(`${label} requires a finite integer literal`);
  }
  return value;
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

  const operations:ResolutionOperation[]=[];
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
