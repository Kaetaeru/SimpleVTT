import type { RulesRuntimeState } from "./combatState";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";

export type CommonPlayScalar = string | number | boolean | null;

export type CommonPlayExpression =
  | { value: CommonPlayScalar }
  | { ref: string }
  | {
      op: "add" | "subtract" | "multiply" | "divide" | "min" | "max" | "floor" | "ceil";
      args: CommonPlayExpression[];
    };

type CommonPlayReferencePredicateOp =
  | "exists"
  | "has-tag"
  | "activation-is"
  | "mode-is"
  | "source-active"
  | "resource-at-least"
  | "progression-at-least"
  | "relation-matches";

export type CommonPlayPredicate =
  | boolean
  | { op:"all" | "any"; args:CommonPlayPredicate[] }
  | { op:"not"; arg:CommonPlayPredicate }
  | {
      op:"eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "contains";
      left:CommonPlayExpression;
      right:CommonPlayExpression;
    }
  | { op:CommonPlayReferencePredicateOp; ref:string; value?:CommonPlayScalar };

export interface CommonPlayResourceChangeOperation {
  kind:"resource.change";
  resource:string;
  amount:CommonPlayExpression;
  target?:string;
  when?:CommonPlayPredicate;
}

export interface CommonPlayEconomyModifyOperation {
  kind:"economy.modify";
  bucket:string;
  amount:CommonPlayExpression;
  when?:CommonPlayPredicate;
}

export interface CommonPlayUnsupportedOperation {
  kind:string;
  [key:string]:unknown;
}

export type CommonPlayOperation =
  | CommonPlayResourceChangeOperation
  | CommonPlayEconomyModifyOperation
  | CommonPlayUnsupportedOperation;

export interface CommonPlayEntryPointDefinition {
  id:string;
  invocation:"manual" | "triggered" | "automatic" | "granted";
  legality?:CommonPlayPredicate;
  operations?:CommonPlayOperation[];
}

export interface CommonPlayDefinition {
  schemaVersion:string;
  id:string;
  entryPoints?:CommonPlayEntryPointDefinition[];
}

export interface CommonPlayExecutionInput {
  resolutionId:string;
  actorId:string;
  entryPointId:string;
  expectedRevision?:number;
}

export interface CommonPlayExtraActionBucketPolicy {
  kind:"extra-action";
  allowsMagicAction:boolean;
}

export interface CommonPlayRulesProfile extends RulesProfileLike {
  commonPlay?: {
    economyBuckets?:Record<string, CommonPlayExtraActionBucketPolicy>;
  };
}

type EvaluationContext = {
  state:RulesRuntimeState;
  actorId:string;
};

function resolveReference(context:EvaluationContext, reference:string):CommonPlayScalar | undefined {
  switch (reference) {
    case "actor.id": return context.actorId;
    case "clock.activeActorId": return context.state.clock.activeActorId;
    case "clock.phase": return context.state.clock.phase;
    case "state.revision": return context.state.revision;
    default: throw new DomainEvaluationError(`unsupported Common Play reference: ${reference}`);
  }
}

function requireNumber(value:CommonPlayScalar | undefined, label:string):number {
  if (typeof value!=="number" || !Number.isFinite(value)) {
    throw new DomainEvaluationError(`${label} must resolve to a finite number`);
  }
  return value;
}

function evaluateExpression(context:EvaluationContext, expression:CommonPlayExpression):CommonPlayScalar | undefined {
  if ("value" in expression) return expression.value;
  if ("ref" in expression) return resolveReference(context,expression.ref);

  const values=expression.args.map((arg,index)=>
    requireNumber(evaluateExpression(context,arg),`${expression.op} argument ${index + 1}`)
  );
  switch (expression.op) {
    case "add":
      if (values.length<1) throw new DomainEvaluationError("add requires at least one argument");
      return values.reduce((sum,value)=>sum + value,0);
    case "subtract":
      if (values.length!==2) throw new DomainEvaluationError("subtract requires exactly two arguments");
      return values[0] - values[1];
    case "multiply":
      if (values.length<1) throw new DomainEvaluationError("multiply requires at least one argument");
      return values.reduce((product,value)=>product * value,1);
    case "divide":
      if (values.length!==2) throw new DomainEvaluationError("divide requires exactly two arguments");
      if (values[1]===0) throw new DomainEvaluationError("division by zero");
      return values[0] / values[1];
    case "min":
      if (values.length<1) throw new DomainEvaluationError("min requires at least one argument");
      return Math.min(...values);
    case "max":
      if (values.length<1) throw new DomainEvaluationError("max requires at least one argument");
      return Math.max(...values);
    case "floor":
      if (values.length!==1) throw new DomainEvaluationError("floor requires exactly one argument");
      return Math.floor(values[0]);
    case "ceil":
      if (values.length!==1) throw new DomainEvaluationError("ceil requires exactly one argument");
      return Math.ceil(values[0]);
  }
}

function evaluatePredicate(context:EvaluationContext, predicate:CommonPlayPredicate):boolean {
  if (typeof predicate==="boolean") return predicate;
  if (predicate.op==="all" || predicate.op==="any") {
    return predicate.op==="all"
      ? predicate.args.every((entry)=>evaluatePredicate(context,entry))
      : predicate.args.some((entry)=>evaluatePredicate(context,entry));
  }
  if (predicate.op==="not") return !evaluatePredicate(context,predicate.arg);
  if (predicate.op==="eq" || predicate.op==="ne" || predicate.op==="lt" || predicate.op==="lte" || predicate.op==="gt" || predicate.op==="gte" || predicate.op==="contains") {
    const left=evaluateExpression(context,predicate.left);
    const right=evaluateExpression(context,predicate.right);
    switch (predicate.op) {
      case "eq": return left===right;
      case "ne": return left!==right;
      case "lt": return requireNumber(left,"left operand") < requireNumber(right,"right operand");
      case "lte": return requireNumber(left,"left operand") <= requireNumber(right,"right operand");
      case "gt": return requireNumber(left,"left operand") > requireNumber(right,"right operand");
      case "gte": return requireNumber(left,"left operand") >= requireNumber(right,"right operand");
      case "contains":
        if (typeof left!=="string" || typeof right!=="string") {
          throw new DomainEvaluationError("contains requires string operands");
        }
        return left.includes(right);
    }
  }
  throw new DomainEvaluationError(`unsupported Common Play predicate: ${predicate.op}`);
}

function operationAmount(context:EvaluationContext, operation:CommonPlayResourceChangeOperation | CommonPlayEconomyModifyOperation) {
  return requireNumber(evaluateExpression(context,operation.amount),`${operation.kind} amount`);
}

function lowerResourceChange(
  context:EvaluationContext,
  operation:CommonPlayResourceChangeOperation,
  operationId:string,
):ResolutionOperation[] {
  if (operation.target && operation.target!=="actor" && operation.target!==context.actorId) {
    throw new DomainEvaluationError(`unsupported resource.change target: ${operation.target}`);
  }
  const amount=operationAmount(context,operation);
  if (!Number.isInteger(amount) || amount===0) {
    throw new DomainEvaluationError("resource.change amount must be a non-zero integer");
  }
  if (amount<0) {
    return [{
      id:operationId,
      kind:"spend-resource",
      actorId:context.actorId,
      resourceId:operation.resource,
      amount:Math.abs(amount),
    }];
  }
  return [{
    id:operationId,
    kind:"gain-resource",
    actorId:context.actorId,
    resourceId:operation.resource,
    amount,
  }];
}

function lowerEconomyModify(
  profile:CommonPlayRulesProfile,
  context:EvaluationContext,
  operation:CommonPlayEconomyModifyOperation,
  operationId:string,
):ResolutionOperation[] {
  const amount=operationAmount(context,operation);
  if (!Number.isInteger(amount) || amount<=0) {
    throw new DomainEvaluationError("economy.modify amount must be a positive integer for the registered bucket");
  }
  const policy=profile.commonPlay?.economyBuckets?.[operation.bucket];
  if (!policy) throw new DomainEvaluationError(`unsupported Common Play economy bucket: ${operation.bucket}`);
  return Array.from({ length:amount },(_,index)=>({
    id:amount===1 ? operationId : `${operationId}:${index + 1}`,
    kind:"grant-extra-action" as const,
    actorId:context.actorId,
    grantId:`${operationId}:grant:${index + 1}`,
    allowsMagicAction:policy.allowsMagicAction,
  }));
}

function lowerOperation(
  profile:CommonPlayRulesProfile,
  context:EvaluationContext,
  operation:CommonPlayOperation,
  index:number,
  resolutionId:string,
):ResolutionOperation[] {
  if ("when" in operation && operation.when && !evaluatePredicate(context,operation.when as CommonPlayPredicate)) {
    return [];
  }
  const operationId=`${resolutionId}:operation:${index + 1}`;
  switch (operation.kind) {
    case "resource.change": return lowerResourceChange(context,operation as CommonPlayResourceChangeOperation,operationId);
    case "economy.modify": return lowerEconomyModify(profile,context,operation as CommonPlayEconomyModifyOperation,operationId);
    default: throw new DomainEvaluationError(`unsupported Common Play operation in generic execution runtime: ${operation.kind}`);
  }
}

export function compileCommonPlayEntryPoint(
  profile:CommonPlayRulesProfile,
  state:RulesRuntimeState,
  definition:CommonPlayDefinition,
  input:CommonPlayExecutionInput,
):PendingResolution {
  const entryPoint=definition.entryPoints?.find((entry)=>entry.id===input.entryPointId);
  if (!entryPoint) throw new DomainEvaluationError(`Common Play entry point not found: ${input.entryPointId}`);

  const context:EvaluationContext={ state, actorId:input.actorId };
  if (entryPoint.legality && !evaluatePredicate(context,entryPoint.legality)) {
    throw new DomainEvaluationError(`Common Play entry point is not legal: ${input.entryPointId}`);
  }

  return {
    id:input.resolutionId,
    actorId:input.actorId,
    sourceId:definition.id,
    expectedRevision:input.expectedRevision ?? state.revision,
    operations:(entryPoint.operations ?? []).flatMap((operation,index)=>
      lowerOperation(profile,context,operation,index,input.resolutionId)
    ),
  };
}

export function resolveCommonPlayEntryPoint(
  profile:CommonPlayRulesProfile,
  state:RulesRuntimeState,
  definition:CommonPlayDefinition,
  input:CommonPlayExecutionInput,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,state,compileCommonPlayEntryPoint(profile,state,definition,input));
  } catch (error) {
    return {
      status:"rejected",
      state,
      events:[],
      results:{},
      error:error instanceof Error ? error.message : String(error),
    };
  }
}
