import type { RulesRuntimeState } from "./combatState";
import type { RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";

type LiteralNumberExpression={ value:number };
type CommonPlayResourceChange={
  kind:"resource.change";
  resource:string;
  amount:LiteralNumberExpression;
  target?:string;
};
type CommonPlayEconomyModify={
  kind:"economy.modify";
  bucket:string;
  amount:LiteralNumberExpression;
};
type CommonPlayActionEconomyOperation=CommonPlayResourceChange|CommonPlayEconomyModify;

export interface CommonPlayActionEconomyDefinition {
  $schema?:string;
  schemaVersion:"0.2-draft";
  id:string;
  entryPoints:Array<{
    id:string;
    invocation:"manual"|"triggered"|"automatic"|"granted";
    operations:CommonPlayActionEconomyOperation[];
  }>;
}

export interface CommonPlayActionEconomyExecutionInput {
  resolutionId:string;
  actorId:string;
  entryPointId:string;
}

function rejected(state:RulesRuntimeState,error:string):Extract<ResolutionCommit,{status:"rejected"}> {
  return { status:"rejected", state, events:[], results:{}, error };
}

function literalInteger(expression:LiteralNumberExpression,label:string) {
  if (!expression||typeof expression!=="object"||!Number.isInteger(expression.value)) {
    throw new Error(`${label} requires a literal integer amount`);
  }
  if (expression.value===0) throw new Error(`${label} amount must not be zero`);
  return expression.value;
}

function requireEntryPoint(definition:CommonPlayActionEconomyDefinition,entryPointId:string) {
  if (definition.schemaVersion!=="0.2-draft") throw new Error(`unsupported Common Play schema version: ${definition.schemaVersion}`);
  if (!definition.id) throw new Error("Common Play definition id is required");
  const entryPoint=definition.entryPoints.find((entry)=>entry.id===entryPointId);
  if (!entryPoint) throw new Error(`Common Play entry point not found: ${entryPointId}`);
  if (!entryPoint.operations.length) throw new Error(`Common Play entry point has no operations: ${entryPointId}`);
  return entryPoint;
}

function compileResourceChange(
  actorId:string,
  operation:CommonPlayResourceChange,
  index:number,
):ResolutionOperation {
  if (!operation.resource) throw new Error(`resource.change ${index+1} requires a resource id`);
  if (operation.target&&operation.target!==actorId) {
    throw new Error(`resource.change ${index+1} target binding is unsupported in this runtime slice`);
  }
  const amount=literalInteger(operation.amount,`resource.change ${index+1}`);
  return amount<0
    ? {
        id:`common-play-resource-${index+1}`,
        kind:"spend-resource",
        actorId,
        resourceId:operation.resource,
        amount:Math.abs(amount),
      }
    : {
        id:`common-play-resource-${index+1}`,
        kind:"gain-resource",
        actorId,
        resourceId:operation.resource,
        amount,
      };
}

function compileEconomyModify(
  profile:RulesProfileLike,
  state:RulesRuntimeState,
  definition:CommonPlayActionEconomyDefinition,
  input:CommonPlayActionEconomyExecutionInput,
  operation:CommonPlayEconomyModify,
  index:number,
):ResolutionOperation[] {
  const amount=literalInteger(operation.amount,`economy.modify ${index+1}`);
  if (amount<0) throw new Error(`economy.modify ${index+1} negative amounts are unsupported in this runtime slice`);
  const bucket=profile.actionEconomy?.buckets[operation.bucket];
  if (!bucket) throw new Error(`unregistered Common Play economy bucket: ${operation.bucket}`);
  if (bucket.kind!=="extra-action") throw new Error(`unsupported Common Play economy bucket kind: ${bucket.kind}`);
  if (bucket.activeTurnOnly&&state.clock.activeActorId!==input.actorId) {
    throw new Error(`economy bucket ${operation.bucket} requires the actor's active turn`);
  }
  return Array.from({length:amount},(_,grantIndex)=>({
    id:`common-play-economy-${index+1}-${grantIndex+1}`,
    kind:"grant-extra-action" as const,
    actorId:input.actorId,
    grantId:`${input.resolutionId}:economy:${index+1}:${grantIndex+1}`,
    allowsMagicAction:bucket.allowsMagicAction,
  }));
}

export function compileCommonPlayActionEconomyEntryPoint(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  definition:CommonPlayActionEconomyDefinition,
  input:CommonPlayActionEconomyExecutionInput,
):PendingResolution {
  if (!input.resolutionId||!input.actorId) throw new Error("resolutionId and actorId are required");
  const entryPoint=requireEntryPoint(definition,input.entryPointId);
  const operations:ResolutionOperation[]=[];
  entryPoint.operations.forEach((operation,index)=>{
    if (operation.kind==="resource.change") {
      operations.push(compileResourceChange(input.actorId,operation,index));
      return;
    }
    if (operation.kind==="economy.modify") {
      operations.push(...compileEconomyModify(profile,inputState,definition,input,operation,index));
      return;
    }
    const unsupported=operation as { kind?:string };
    throw new Error(`unsupported Common Play operation in action/economy runtime: ${unsupported.kind??"<missing>"}`);
  });
  return {
    id:input.resolutionId,
    actorId:input.actorId,
    sourceId:definition.id,
    expectedRevision:inputState.revision,
    operations,
  };
}

export function resolveCommonPlayActionEconomyEntryPoint(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  definition:CommonPlayActionEconomyDefinition,
  input:CommonPlayActionEconomyExecutionInput,
):ResolutionCommit {
  try {
    return resolvePendingResolution(
      profile,
      inputState,
      compileCommonPlayActionEconomyEntryPoint(profile,inputState,definition,input),
    );
  } catch (error) {
    return rejected(inputState,error instanceof Error?error.message:String(error));
  }
}
