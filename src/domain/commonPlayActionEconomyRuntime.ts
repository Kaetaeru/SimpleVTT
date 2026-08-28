import type { RulesRuntimeState } from "./combatState";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";

type LiteralNumberExpression={value:number};
type CommonPlayExpression=LiteralNumberExpression|Record<string,unknown>;

type CommonPlayActionEconomyOperation=
  | {
      kind:"resource.change";
      resource:string;
      amount:CommonPlayExpression;
      target?:string;
    }
  | {
      kind:"economy.modify";
      bucket:string;
      amount:CommonPlayExpression;
    };

export interface CommonPlayActionEconomyDefinition {
  schemaVersion:string;
  id:string;
  entryPoints:Array<{
    id:string;
    invocation:"manual"|"triggered"|"automatic"|"granted";
    operations:CommonPlayActionEconomyOperation[];
  }>;
}

export interface CommonPlayActionEconomyRequest {
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

export function compileCommonPlayActionEconomyEntryPoint(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  definition:CommonPlayActionEconomyDefinition,
  request:CommonPlayActionEconomyRequest,
):PendingResolution {
  const entryPoint=definition.entryPoints.find((entry)=>entry.id===request.entryPointId);
  if(!entryPoint) throw new DomainEvaluationError(`Common Play entry point not found: ${request.entryPointId}`);
  if(entryPoint.invocation!=="manual") {
    throw new DomainEvaluationError(`Common Play action economy runtime supports manual entry points only: ${entryPoint.invocation}`);
  }

  const operations:ResolutionOperation[]=[];
  for(const [index,operation] of entryPoint.operations.entries()) {
    const operationId=`${request.resolutionId}:operation:${index}`;
    if(operation.kind==="resource.change") {
      if(operation.target!==undefined&&operation.target!==request.actorId&&operation.target!=="actor"&&operation.target!=="self") {
        throw new DomainEvaluationError("Common Play action economy resource.change currently supports the acting actor only");
      }
      const amount=literalInteger(operation.amount,"resource.change amount");
      if(amount===0) throw new DomainEvaluationError("resource.change amount must be non-zero");
      operations.push(amount<0?{
        id:operationId,
        kind:"spend-resource",
        actorId:request.actorId,
        resourceId:operation.resource,
        amount:-amount,
      }:{
        id:operationId,
        kind:"gain-resource",
        actorId:request.actorId,
        resourceId:operation.resource,
        amount,
      });
      continue;
    }

    if(operation.kind!=="economy.modify") {
      throw new DomainEvaluationError(`unsupported Common Play action economy operation: ${(operation as {kind?:unknown}).kind}`);
    }
    const amount=literalInteger(operation.amount,"economy.modify amount");
    if(amount<=0) throw new DomainEvaluationError("economy.modify extra-action amount must be a positive integer");
    const bucket=profile.actionEconomy?.buckets[operation.bucket];
    if(!bucket) throw new DomainEvaluationError(`unregistered economy bucket: ${operation.bucket}`);
    if(bucket.kind!=="extra-action") throw new DomainEvaluationError(`unsupported economy bucket kind: ${bucket.kind}`);
    if(bucket.activeTurnOnly&&(inputState.clock.activeActorId!==request.actorId||inputState.clock.phase==="end")) {
      throw new DomainEvaluationError(`economy bucket ${operation.bucket} requires the actor's active turn`);
    }
    for(let grantIndex=0;grantIndex<amount;grantIndex+=1) {
      operations.push({
        id:amount===1?operationId:`${operationId}:grant:${grantIndex}`,
        kind:"grant-extra-action",
        actorId:request.actorId,
        grantId:`${request.resolutionId}:economy:${index}:${grantIndex}`,
        allowsMagicAction:bucket.allowsMagicAction,
      });
    }
  }

  return {
    id:request.resolutionId,
    actorId:request.actorId,
    sourceId:definition.id,
    expectedRevision:inputState.revision,
    operations,
  };
}

export function resolveCommonPlayActionEconomyEntryPoint(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  definition:CommonPlayActionEconomyDefinition,
  request:CommonPlayActionEconomyRequest,
):ResolutionCommit {
  try {
    return resolvePendingResolution(
      profile,
      inputState,
      compileCommonPlayActionEconomyEntryPoint(profile,inputState,definition,request),
    );
  } catch(error) {
    return {
      status:"rejected",
      state:inputState,
      events:[],
      results:{},
      error:error instanceof Error?error.message:String(error),
    };
  }
}
