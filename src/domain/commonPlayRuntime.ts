import type { D20TestResult } from "./d20";
import type { RulesRuntimeState } from "./combatState";
import { resolvePendingResolution, stagePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import type { RulesProfileLike } from "./profileEngine";
import type { TurnSlot } from "./turnEconomy";

type LiteralExpression = { value:number };

type CommonPlayPayment =
  | {
      kind:"resource";
      resource:string;
      amount:LiteralExpression;
      consumeAt:"stage"|"commit";
      refundOnCancel?:boolean;
    }
  | {
      kind:"economy";
      bucket:string;
      amount:LiteralExpression;
      consumeAt:"stage"|"commit";
      refundOnCancel?:boolean;
    };

export interface CommonPlayPropertyModifyOperation {
  kind:"property.modify";
  property:string;
  operation:"add"|"subtract"|"set"|"min"|"max"|"multiply";
  value:LiteralExpression;
}

export interface CommonPlayInteractionDefinition {
  id:string;
  kind:"choice";
  responder:"actor"|"target"|"actor-owner"|"target-owner"|"dm"|"host";
  mode:"notice"|"input"|"blocking";
  input?:{ type:"boolean" };
  visibility?:"public"|"actor"|"dm"|"actor-and-dm"|"authority-only";
  promptKey?:string;
  revalidate:"always"|"if-revision-changed";
  stalePolicy?:"cancel"|"restart"|"reject";
  idempotencyKey?:string;
}

export interface CommonPlayAttackOutcomeInterceptor {
  id:string;
  timing:"attack.outcome-determined";
  interaction:CommonPlayInteractionDefinition;
  operation:"recalculate";
  slot:"attack.outcome";
  operations:CommonPlayPropertyModifyOperation[];
}

export interface CommonPlayReactionDefinition {
  id:string;
  payments:CommonPlayPayment[];
  interceptors:CommonPlayAttackOutcomeInterceptor[];
}

export interface AwaitingCommonPlayInteraction {
  status:"awaiting-input";
  state:RulesRuntimeState;
  interaction:{
    id:string;
    idempotencyKey:string;
    responder:CommonPlayInteractionDefinition["responder"];
    mode:CommonPlayInteractionDefinition["mode"];
    promptKey?:string;
    expectedRevision:number;
    resolutionId:string;
    sourceId:string;
  };
  context:{
    sourceActorId:string;
    definition:CommonPlayReactionDefinition;
    interceptorId:string;
    attackOperationId:string;
    pending:PendingResolution;
  };
}

export interface InvalidatedCommonPlayInteraction {
  status:"invalidated";
  state:RulesRuntimeState;
  error:string;
}

export type CommonPlayResolutionResult = ResolutionCommit | AwaitingCommonPlayInteraction | InvalidatedCommonPlayInteraction;

export interface CommonPlayInteractionResponse {
  interactionId:string;
  idempotencyKey:string;
  value:boolean;
}

function rejected(state:RulesRuntimeState,error:string):Extract<ResolutionCommit,{status:"rejected"}> {
  return { status:"rejected", state, events:[], results:{}, error };
}

function literalValue(expression:LiteralExpression,label:string) {
  if (!Number.isFinite(expression.value)) throw new Error(`${label} must be finite`);
  return expression.value;
}

function findAttackOperation(pending:PendingResolution) {
  const index=pending.operations.findIndex((operation)=>operation.kind==="d20"&&operation.request.family==="attack-roll");
  if (index<0) return undefined;
  const operation=pending.operations[index];
  if (operation.kind!=="d20") return undefined;
  return { index, operation };
}

function applyDefenseModifier(base:number,modifier:CommonPlayPropertyModifyOperation) {
  if (modifier.property!=="defense.ac") throw new Error(`unsupported attack outcome property: ${modifier.property}`);
  const value=literalValue(modifier.value,`${modifier.kind} value`);
  switch (modifier.operation) {
    case "add": return base+value;
    case "subtract": return base-value;
    case "set": return value;
    case "min": return Math.min(base,value);
    case "max": return Math.max(base,value);
    case "multiply": return base*value;
  }
}

function paymentOperations(
  definition:CommonPlayReactionDefinition,
  sourceActorId:string,
  interceptorId:string,
):ResolutionOperation[] {
  return definition.payments.map((payment,index)=>{
    if (payment.consumeAt!=="commit") throw new Error("reaction runtime supports commit-time payments only");
    const amount=literalValue(payment.amount,`${payment.kind} payment amount`);
    if (payment.kind==="resource") {
      if (amount<=0) throw new Error("resource payment amount must be positive");
      return {
        id:`common-play-${interceptorId}-payment-${index+1}`,
        kind:"spend-resource" as const,
        actorId:sourceActorId,
        resourceId:payment.resource,
        amount,
      };
    }
    if (amount!==1) throw new Error("economy payment amount must be exactly 1 in the reaction runtime slice");
    if (!(["action","bonus-action","reaction"] as string[]).includes(payment.bucket)) {
      throw new Error(`unsupported economy bucket: ${payment.bucket}`);
    }
    return {
      id:`common-play-${interceptorId}-payment-${index+1}`,
      kind:"use-economy" as const,
      actorId:sourceActorId,
      slot:payment.bucket as TurnSlot,
      bonusActionGranted:payment.bucket==="bonus-action",
    };
  });
}

function acceptedPending(awaiting:AwaitingCommonPlayInteraction):PendingResolution {
  const { definition, interceptorId, attackOperationId, pending, sourceActorId }=awaiting.context;
  const interceptor=definition.interceptors.find((entry)=>entry.id===interceptorId);
  if (!interceptor) throw new Error(`interceptor not found: ${interceptorId}`);
  const attackIndex=pending.operations.findIndex((operation)=>operation.id===attackOperationId);
  if (attackIndex<0) throw new Error(`attack operation not found: ${attackOperationId}`);
  const attack=pending.operations[attackIndex];
  if (attack.kind!=="d20"||attack.request.family!=="attack-roll") throw new Error("interceptor target is not an attack roll");
  if (attack.targetId&&attack.targetId!==sourceActorId) {
    throw new Error("reaction defense source actor must be the intercepted attack target in this runtime slice");
  }

  let target=attack.request.target;
  for (const operation of interceptor.operations) target=applyDefenseModifier(target,operation);
  if (!Number.isFinite(target)) throw new Error("recalculated attack target must be finite");

  const recalculated:ResolutionOperation={
    ...attack,
    request:{
      ...attack.request,
      target,
      targetSource:`common-play:${definition.id}:${interceptor.id}`,
    },
  };
  const payments=paymentOperations(definition,sourceActorId,interceptor.id);
  return {
    ...pending,
    operations:[
      ...pending.operations.slice(0,attackIndex),
      ...payments,
      recalculated,
      ...pending.operations.slice(attackIndex+1),
    ],
  };
}

export function startCommonPlayResolution(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  pending:PendingResolution,
  definition:CommonPlayReactionDefinition,
  sourceActorId:string,
):CommonPlayResolutionResult {
  const interceptor=definition.interceptors.find((entry)=>
    entry.timing==="attack.outcome-determined"&&entry.operation==="recalculate"&&entry.slot==="attack.outcome"
  );
  if (!interceptor) return resolvePendingResolution(profile,inputState,pending);
  if (interceptor.interaction.kind!=="choice"||interceptor.interaction.input?.type!=="boolean"||interceptor.interaction.mode!=="blocking") {
    return rejected(inputState,"reaction runtime requires a blocking boolean choice interaction");
  }

  const attack=findAttackOperation(pending);
  if (!attack) return rejected(inputState,"attack.outcome interceptor requires an attack-roll operation");
  const preview=stagePendingResolution(profile,inputState,{
    ...pending,
    operations:pending.operations.slice(0,attack.index+1),
  });
  if (preview.status==="rejected") return preview;
  const result=preview.results[attack.operation.id] as D20TestResult|undefined;
  if (!result||result.family!=="attack-roll") return rejected(inputState,"provisional attack result is missing");
  if (result.outcome!=="success") return resolvePendingResolution(profile,inputState,pending);
  if (attack.operation.targetId&&attack.operation.targetId!==sourceActorId) {
    return resolvePendingResolution(profile,inputState,pending);
  }

  let payments:ResolutionOperation[];
  try {
    let target=attack.operation.request.target;
    for (const operation of interceptor.operations) target=applyDefenseModifier(target,operation);
    if (!Number.isFinite(target)) return rejected(inputState,"recalculated attack target must be finite");
    payments=paymentOperations(definition,sourceActorId,interceptor.id);
  } catch (error) {
    return rejected(inputState,error instanceof Error?error.message:String(error));
  }

  const paymentEligibility=stagePendingResolution(profile,inputState,{
    id:`${pending.id}:eligibility:${interceptor.id}`,
    actorId:sourceActorId,
    sourceId:definition.id,
    expectedRevision:inputState.revision,
    operations:payments,
  });
  if (paymentEligibility.status==="rejected") {
    return resolvePendingResolution(profile,inputState,pending);
  }

  const interactionId=`${pending.id}:${definition.id}:${interceptor.interaction.id}`;
  const idempotencyKey=`${interceptor.interaction.idempotencyKey??interactionId}:${pending.id}`;
  return {
    status:"awaiting-input",
    state:inputState,
    interaction:{
      id:interactionId,
      idempotencyKey,
      responder:interceptor.interaction.responder,
      mode:interceptor.interaction.mode,
      promptKey:interceptor.interaction.promptKey,
      expectedRevision:inputState.revision,
      resolutionId:pending.id,
      sourceId:definition.id,
    },
    context:{
      sourceActorId,
      definition,
      interceptorId:interceptor.id,
      attackOperationId:attack.operation.id,
      pending,
    },
  };
}

export function resumeCommonPlayInteraction(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  awaiting:AwaitingCommonPlayInteraction,
  response:CommonPlayInteractionResponse,
):CommonPlayResolutionResult {
  if (response.interactionId!==awaiting.interaction.id||response.idempotencyKey!==awaiting.interaction.idempotencyKey) {
    return rejected(inputState,"interaction response identity mismatch");
  }

  const interceptor=awaiting.context.definition.interceptors.find((entry)=>entry.id===awaiting.context.interceptorId);
  if (!interceptor) return rejected(inputState,`interceptor not found: ${awaiting.context.interceptorId}`);
  if (inputState.revision!==awaiting.interaction.expectedRevision) {
    if (interceptor.interaction.stalePolicy==="restart") {
      return startCommonPlayResolution(
        profile,
        inputState,
        { ...awaiting.context.pending, expectedRevision:inputState.revision },
        awaiting.context.definition,
        awaiting.context.sourceActorId,
      );
    }
    return {
      status:"invalidated",
      state:inputState,
      error:`interaction is stale: expected revision ${awaiting.interaction.expectedRevision}, current ${inputState.revision}`,
    };
  }

  if (!response.value) return resolvePendingResolution(profile,inputState,awaiting.context.pending);

  try {
    return resolvePendingResolution(profile,inputState,acceptedPending(awaiting));
  } catch (error) {
    return rejected(inputState,error instanceof Error?error.message:String(error));
  }
}
