import type { RulesRuntimeState } from "./combatState";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";

type CommonPlayExpression={ value?:unknown }|Record<string,unknown>;

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

export type CommonPlayEntryPointOperation=CommonPlayResourceChange|CommonPlayEconomyModify;

export interface CommonPlayOperationDefinition {
  $schema?:string;
  schemaVersion:string;
  id:string;
  payments?:CommonPlayPayment[];
  entryPoints:Array<{
    id:string;
    invocation:"manual"|"triggered"|"automatic"|"granted";
    operations:CommonPlayEntryPointOperation[];
  }>;
}

export interface CommonPlayOperationExecutionInput {
  resolutionId:string;
  actorId:string;
  entryPointId:string;
}

function literalInteger(expression:CommonPlayExpression|undefined,label:string) {
  if (!expression||typeof expression!=="object"||!("value" in expression)) {
    throw new DomainEvaluationError(`${label} requires a literal expression`);
  }
  const value=expression.value;
  if (typeof value!=="number"||!Number.isFinite(value)||!Number.isInteger(value)||value===0) {
    throw new DomainEvaluationError(`${label} requires a non-zero finite integer literal`);
  }
  return value;
}

function actorTarget(target:string|undefined,actorId:string,label:string) {
  if (target===undefined||target==="actor"||target==="self"||target===actorId) return actorId;
  throw new DomainEvaluationError(`${label} supports the acting actor only in this runtime slice`);
}

function compilePayments(definition:CommonPlayOperationDefinition,input:CommonPlayOperationExecutionInput):ResolutionOperation[] {
  return (definition.payments??[]).map((payment,index)=>{
    if (payment.kind!=="resource") {
      throw new DomainEvaluationError(`unsupported Common Play payment kind: ${payment.kind}`);
    }
    if (payment.consumeAt!=="commit") {
      throw new DomainEvaluationError(`unsupported Common Play resource payment consumeAt: ${payment.consumeAt??"<missing>"}`);
    }
    if (!payment.resource) throw new DomainEvaluationError("Common Play resource payment requires a resource id");
    const amount=literalInteger(payment.amount,`resource payment ${index+1}`);
    if (amount<0) throw new DomainEvaluationError(`resource payment ${index+1} requires a positive amount`);
    return {
      id:`${input.resolutionId}:payment:${index+1}`,
      kind:"spend-resource" as const,
      actorId:input.actorId,
      resourceId:payment.resource,
      amount,
    };
  });
}

export function compileCommonPlayEntryPointOperations(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  definition:CommonPlayOperationDefinition,
  input:CommonPlayOperationExecutionInput,
):PendingResolution {
  if (definition.schemaVersion!=="0.2-draft") {
    throw new DomainEvaluationError(`unsupported Common Play schema version: ${definition.schemaVersion}`);
  }
  if (!definition.id||!input.resolutionId||!input.actorId) {
    throw new DomainEvaluationError("definition id, resolutionId, and actorId are required");
  }
  const entryPoint=definition.entryPoints.find((entry)=>entry.id===input.entryPointId);
  if (!entryPoint) throw new DomainEvaluationError(`Common Play entry point not found: ${input.entryPointId}`);
  if (entryPoint.invocation!=="manual") {
    throw new DomainEvaluationError(`Common Play operation runtime supports manual entry points only: ${entryPoint.invocation}`);
  }
  if (!entryPoint.operations.length) throw new DomainEvaluationError(`Common Play entry point has no operations: ${entryPoint.id}`);

  const operations:ResolutionOperation[]=[...compilePayments(definition,input)];
  entryPoint.operations.forEach((operation,index)=>{
    const operationId=`${input.resolutionId}:operation:${index+1}`;
    if (operation.kind==="resource.change") {
      const actorId=actorTarget(operation.target,input.actorId,`resource.change ${index+1}`);
      const amount=literalInteger(operation.amount,`resource.change ${index+1}`);
      operations.push(amount<0?{
        id:operationId,
        kind:"spend-resource",
        actorId,
        resourceId:operation.resource,
        amount:-amount,
      }:{
        id:operationId,
        kind:"gain-resource",
        actorId,
        resourceId:operation.resource,
        amount,
      });
      return;
    }
    if (operation.kind==="economy.modify") {
      const amount=literalInteger(operation.amount,`economy.modify ${index+1}`);
      if (amount<0) throw new DomainEvaluationError(`economy.modify ${index+1} negative amounts are unsupported in this runtime slice`);
      const bucket=profile.economy?.grantBuckets[operation.bucket];
      if (!bucket) throw new DomainEvaluationError(`unregistered Common Play economy grant bucket: ${operation.bucket}`);
      if (bucket.kind!=="extra-action") throw new DomainEvaluationError(`unsupported Common Play economy grant bucket kind: ${bucket.kind}`);
      if (bucket.activeTurnOnly&&(inputState.clock.activeActorId!==input.actorId||inputState.clock.phase==="end")) {
        throw new DomainEvaluationError(`economy grant bucket ${operation.bucket} requires the actor's active turn`);
      }
      for (let grantIndex=0;grantIndex<amount;grantIndex+=1) {
        operations.push({
          id:amount===1?operationId:`${operationId}:grant:${grantIndex+1}`,
          kind:"grant-extra-action",
          actorId:input.actorId,
          grantId:`${input.resolutionId}:economy:${index+1}:${grantIndex+1}`,
          allowsMagicAction:bucket.allowsMagicAction,
        });
      }
      return;
    }
    const unsupported=operation as { kind?:string };
    throw new DomainEvaluationError(`unsupported Common Play operation: ${unsupported.kind??"<missing>"}`);
  });

  return {
    id:input.resolutionId,
    actorId:input.actorId,
    sourceId:definition.id,
    expectedRevision:inputState.revision,
    operations,
  };
}

export function resolveCommonPlayEntryPointOperations(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  definition:CommonPlayOperationDefinition,
  input:CommonPlayOperationExecutionInput,
):ResolutionCommit {
  try {
    return resolvePendingResolution(
      profile,
      inputState,
      compileCommonPlayEntryPointOperations(profile,inputState,definition,input),
    );
  } catch (error) {
    return {
      status:"rejected",
      state:inputState,
      events:[],
      results:{},
      error:error instanceof Error?error.message:String(error),
    };
  }
}
