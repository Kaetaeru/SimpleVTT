import type { D20RollModification, D20TestResult } from "./d20";
import type { DamageRollResolution } from "./damageRoll";
import type { RulesRuntimeState } from "./combatState";
import { resolvePendingResolution, stagePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import type { RulesProfileLike } from "./profileEngine";
import type { SemanticPredicate } from "./profileEngine";
import type { CommonPlayFactQuery } from "./commonPlaySpatialFactRuntime";
import type { TurnSlot } from "./turnEconomy";

type LiteralExpression = { value:number };

type CommonPlayD20ResultCondition={kind:"d20-result";outcome:"success"|"failure"};

type CommonPlayPayment =
  | {
      kind:"resource";
      resource:string;
      amount:LiteralExpression;
      consumeAt:"stage"|"commit";
      refundOnCancel?:boolean;
      condition?:CommonPlayD20ResultCondition;
    }
  | {
      kind:"economy";
      bucket:string;
      amount:LiteralExpression;
      consumeAt:"stage"|"commit";
      refundOnCancel?:boolean;
      condition?:CommonPlayD20ResultCondition;
    };

export interface CommonPlayPropertyModifyOperation {
  kind:"property.modify";
  property:string;
  operation:"add"|"subtract"|"set"|"min"|"max"|"multiply";
  value:LiteralExpression;
}

export type CommonPlayRollModifyOperation =
  | { kind:"roll.modify"; mode:"add-die"; dice:string }
  | { kind:"roll.modify"; mode:"subtract-die"; dice:string }
  | { kind:"roll.modify"; mode:"reroll"; dice:string }
  | { kind:"roll.modify"; mode:"add-flat"|"target-add"|"replace"|"minimum"; value:LiteralExpression };

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
  eligibility?:CommonPlayInterceptorEligibility;
}

export interface CommonPlayD20RollInterceptor {
  id:string;
  timing:"d20.outcome-determined";
  interaction:CommonPlayInteractionDefinition;
  operation:"recalculate";
  slot:"d20.roll";
  families?:Array<"ability-check"|"saving-throw"|"attack-roll">;
  outcomes?:Array<"success"|"failure">;
  operations:CommonPlayRollModifyOperation[];
  eligibility?:CommonPlayInterceptorEligibility;
}

export interface CommonPlayDamageRollInterceptor {
  id:string;
  timing:"damage.rolled";
  interaction:CommonPlayInteractionDefinition;
  operation:"recalculate";
  slot:"primary.damage";
  operations:CommonPlayRollModifyOperation[];
  eligibility?:CommonPlayInterceptorEligibility;
}

export interface CommonPlayInterceptorEligibility {
  factQueries:CommonPlayFactQuery[];
  when:SemanticPredicate;
}

export interface CommonPlayReactionDefinition {
  id:string;
  payments:CommonPlayPayment[];
  interceptors:Array<CommonPlayAttackOutcomeInterceptor|CommonPlayD20RollInterceptor|CommonPlayDamageRollInterceptor>;
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
    interceptedOperationId:string;
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

export interface CommonPlayInteractionAuthority {
  modifierDiceFaces?:Record<number,number[]>;
}

function rejected(state:RulesRuntimeState,error:string|undefined):Extract<ResolutionCommit,{status:"rejected"}> {
  return { status:"rejected", state, events:[], results:{}, error:error??"Common Play reaction rejected" };
}

function literalValue(expression:LiteralExpression,label:string) {
  if (!Number.isFinite(expression.value)) throw new Error(`${label} must be finite`);
  return expression.value;
}

function parseDiceFormula(value:string,label:string) {
  const match=/^([0-9]+)d([0-9]+)([+-][0-9]+)?$/.exec(value.trim());
  if(!match) throw new Error(`${label} must be XdY+Z`);
  const count=Number(match[1]);
  const sides=Number(match[2]);
  const flat=Number(match[3]??0);
  if(!Number.isInteger(count)||count<1||!Number.isInteger(sides)||sides<2) throw new Error(`${label} has invalid dice`);
  return {count,sides,flat};
}

function findAttackOperation(pending:PendingResolution) {
  const index=pending.operations.findIndex((operation)=>operation.kind==="d20"&&operation.request.family==="attack-roll");
  if (index<0) return undefined;
  const operation=pending.operations[index];
  if (operation.kind!=="d20") return undefined;
  return { index, operation };
}

function findDamageRollOperation(pending:PendingResolution) {
  const index=pending.operations.findIndex((operation)=>operation.kind==="damage-roll");
  if(index<0)return undefined;
  const operation=pending.operations[index];
  return operation.kind==="damage-roll"?{index,operation}:undefined;
}

function findMatchingD20Operation(
  profile:RulesProfileLike,
  state:RulesRuntimeState,
  pending:PendingResolution,
  interceptor:CommonPlayD20RollInterceptor,
) {
  const families=interceptor.families??["ability-check","attack-roll"];
  const outcomes=interceptor.outcomes??["success"];
  for(const [index,operation] of pending.operations.entries()) {
    if(operation.kind!=="d20"||!families.includes(operation.request.family))continue;
    const preview=stagePendingResolution(profile,state,{...pending,operations:pending.operations.slice(0,index+1)});
    if(preview.status==="rejected")return {error:preview.error??"d20 preview rejected"};
    const result=preview.results[operation.id] as D20TestResult|undefined;
    if(result&&outcomes.includes(result.outcome))return {index,operation,result};
  }
  return undefined;
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
  d20Outcome?:D20TestResult["outcome"],
  eligibilityOnly=false,
):ResolutionOperation[] {
  return definition.payments.flatMap((payment,index):ResolutionOperation[]=>{
    if (payment.condition) {
      if (payment.condition.kind!=="d20-result") throw new Error(`unsupported reaction payment condition: ${String((payment.condition as {kind?:unknown}).kind)}`);
      if (!eligibilityOnly) {
        if (!d20Outcome) throw new Error("d20-result payment condition requires a d20.roll interceptor");
        if (payment.condition.outcome!==d20Outcome) return [];
      }
    }
    if (payment.consumeAt!=="commit") throw new Error("reaction runtime supports commit-time payments only");
    const amount=literalValue(payment.amount,`${payment.kind} payment amount`);
    if (payment.kind==="resource") {
      if (amount<=0) throw new Error("resource payment amount must be positive");
      return [{
        id:`common-play-${interceptorId}-payment-${index+1}`,
        kind:"spend-resource" as const,
        actorId:sourceActorId,
        resourceId:payment.resource,
        amount,
      }];
    }
    if (amount!==1) throw new Error("economy payment amount must be exactly 1 in the reaction runtime slice");
    if (!(["action","bonus-action","reaction"] as string[]).includes(payment.bucket)) {
      throw new Error(`unsupported economy bucket: ${payment.bucket}`);
    }
    return [{
      id:`common-play-${interceptorId}-payment-${index+1}`,
      kind:"use-economy" as const,
      actorId:sourceActorId,
      slot:payment.bucket as TurnSlot,
      bonusActionGranted:payment.bucket==="bonus-action",
    }];
  });
}

function d20RollModifications(
  definition:CommonPlayReactionDefinition,
  interceptor:CommonPlayD20RollInterceptor,
  authority:CommonPlayInteractionAuthority|undefined,
):D20RollModification[] {
  return interceptor.operations.flatMap((operation,index):D20RollModification[]=>{
    const source=`common-play:${definition.id}:${interceptor.id}:operation:${index}`;
    if(operation.mode==="add-die"||operation.mode==="subtract-die"||operation.mode==="reroll") {
      const formula=parseDiceFormula(operation.dice,`d20.roll ${operation.mode}`);
      if(operation.mode==="reroll"&&(formula.sides!==20||formula.flat!==0)) throw new Error("d20.roll reroll requires Xd20 with no flat modifier");
      const faces=authority?.modifierDiceFaces?.[index];
      if(!faces||faces.length!==formula.count||faces.some((face)=>!Number.isInteger(face)||face<1||face>formula.sides)) {
        throw new Error(`d20.roll interceptor ${index} requires authoritative die face(s)`);
      }
      const dice={id:`${source}:dice`,purpose:source,sides:formula.sides,faces:[...faces]};
      if(operation.mode==="reroll") return [{source,mode:"reroll",dice}];
      const modifications:D20RollModification[]=[{source,mode:operation.mode,dice}];
      if(formula.flat!==0) modifications.push({source:`${source}:flat`,mode:"add-flat",value:operation.mode==="subtract-die"?-formula.flat:formula.flat});
      return modifications;
    }
    const value=literalValue(operation.value,`d20.roll ${operation.mode} value`);
    if(!Number.isInteger(value)) throw new Error(`d20.roll ${operation.mode} value must be an integer`);
    if((operation.mode==="replace"||operation.mode==="minimum")&&(value<1||value>20)) {
      throw new Error(`d20.roll ${operation.mode} value must be between 1 and 20`);
    }
    return [{source,mode:operation.mode,value}];
  });
}

function damageRollReduction(
  definition:CommonPlayReactionDefinition,
  interceptor:CommonPlayDamageRollInterceptor,
  authority:CommonPlayInteractionAuthority|undefined,
) {
  return interceptor.operations.map((operation,index)=>{
    if(operation.kind!=="roll.modify"||operation.mode!=="subtract-die")throw new Error("primary.damage interceptor supports subtract-die only in this bounded slice");
    const formula=parseDiceFormula(operation.dice,"primary.damage subtract-die");
    const faces=authority?.modifierDiceFaces?.[index];
    if(!faces||faces.length!==formula.count||faces.some((face)=>!Number.isInteger(face)||face<1||face>formula.sides))throw new Error(`primary.damage interceptor ${index} requires authoritative die face(s)`);
    return {
      source:`common-play:${definition.id}:${interceptor.id}:operation:${index}`,
      value:-(faces.reduce((sum,face)=>sum+face,0)+formula.flat),
    };
  });
}

function acceptedPending(profile:RulesProfileLike,inputState:RulesRuntimeState,awaiting:AwaitingCommonPlayInteraction,authority?:CommonPlayInteractionAuthority):PendingResolution {
  const { definition, interceptorId, interceptedOperationId, pending, sourceActorId }=awaiting.context;
  const interceptor=definition.interceptors.find((entry)=>entry.id===interceptorId);
  if (!interceptor) throw new Error(`interceptor not found: ${interceptorId}`);
  const operationIndex=pending.operations.findIndex((operation)=>operation.id===interceptedOperationId);
  if (operationIndex<0) throw new Error(`intercepted operation not found: ${interceptedOperationId}`);
  const intercepted=pending.operations[operationIndex];
  if(interceptor.slot==="d20.roll") {
    if(intercepted.kind!=="d20"||(intercepted.request.family!=="ability-check"&&intercepted.request.family!=="saving-throw"&&intercepted.request.family!=="attack-roll")) {
      throw new Error("d20.roll interceptor target is not a supported d20 roll");
    }
    const recalculated:ResolutionOperation={
      ...intercepted,
      request:{
        ...intercepted.request,
        rollModifications:[...(intercepted.request.rollModifications??[]),...d20RollModifications(definition,interceptor,authority)],
      },
    };
    const preview=stagePendingResolution(profile,inputState,{...pending,operations:[...pending.operations.slice(0,operationIndex),recalculated]});
    if(preview.status==="rejected")throw new Error(preview.error??"conditional payment d20 preview rejected");
    const result=preview.results[recalculated.id] as D20TestResult|undefined;
    if(!result)throw new Error("conditional payment d20 preview result is missing");
    const payments=paymentOperations(definition,sourceActorId,interceptor.id,result.outcome);
    return {...pending,operations:[...pending.operations.slice(0,operationIndex),...payments,recalculated,...pending.operations.slice(operationIndex+1)]};
  }

  if(interceptor.slot==="primary.damage") {
    const payments=paymentOperations(definition,sourceActorId,interceptor.id);
    if(intercepted.kind!=="damage-roll")throw new Error("primary.damage interceptor target is not a damage roll");
    const recalculated:ResolutionOperation={
      ...intercepted,
      request:{...intercepted.request,flat:[...(intercepted.request.flat??[]),...damageRollReduction(definition,interceptor,authority)]},
    };
    return {...pending,operations:[...pending.operations.slice(0,operationIndex),...payments,recalculated,...pending.operations.slice(operationIndex+1)]};
  }

  if(intercepted.kind!=="d20"||intercepted.request.family!=="attack-roll") throw new Error("interceptor target is not an attack roll");
  if (intercepted.targetId&&intercepted.targetId!==sourceActorId) {
    throw new Error("reaction defense source actor must be the intercepted attack target in this runtime slice");
  }
  let target=intercepted.request.target;
  for (const operation of interceptor.operations) target=applyDefenseModifier(target,operation);
  if (!Number.isFinite(target)) throw new Error("recalculated attack target must be finite");
  const recalculated:ResolutionOperation={
    ...intercepted,
    request:{...intercepted.request,target,targetSource:`common-play:${definition.id}:${interceptor.id}`},
  };
  const payments=paymentOperations(definition,sourceActorId,interceptor.id);
  return {...pending,operations:[...pending.operations.slice(0,operationIndex),...payments,recalculated,...pending.operations.slice(operationIndex+1)]};
}

export function startCommonPlayResolution(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  pending:PendingResolution,
  definition:CommonPlayReactionDefinition,
  sourceActorId:string,
):CommonPlayResolutionResult {
  const interceptor=definition.interceptors.find((entry)=>
    (entry.timing==="attack.outcome-determined"&&entry.operation==="recalculate"&&entry.slot==="attack.outcome")
    ||(entry.timing==="d20.outcome-determined"&&entry.operation==="recalculate"&&entry.slot==="d20.roll")
    ||(entry.timing==="damage.rolled"&&entry.operation==="recalculate"&&entry.slot==="primary.damage")
  );
  if (!interceptor) return resolvePendingResolution(profile,inputState,pending);
  if (interceptor.interaction.kind!=="choice"||interceptor.interaction.input?.type!=="boolean"||interceptor.interaction.mode!=="blocking") {
    return rejected(inputState,"reaction runtime requires a blocking boolean choice interaction");
  }

  let interceptedOperationId:string;
  if(interceptor.slot==="d20.roll") {
    const d20=findMatchingD20Operation(profile,inputState,pending,interceptor);
    if(d20&&"error" in d20) return rejected(inputState,d20.error);
    if(!d20) return resolvePendingResolution(profile,inputState,pending);
    interceptedOperationId=d20.operation.id;
  } else if(interceptor.slot==="attack.outcome") {
    const attack=findAttackOperation(pending);
    if (!attack) return rejected(inputState,"attack.outcome interceptor requires an attack-roll operation");
    const preview=stagePendingResolution(profile,inputState,{...pending,operations:pending.operations.slice(0,attack.index+1)});
    if (preview.status==="rejected") return preview;
    const result=preview.results[attack.operation.id] as D20TestResult|undefined;
    if (!result||result.family!=="attack-roll") return rejected(inputState,"provisional attack result is missing");
    if (result.outcome!=="success") return resolvePendingResolution(profile,inputState,pending);
    if (attack.operation.targetId&&attack.operation.targetId!==sourceActorId) return resolvePendingResolution(profile,inputState,pending);
    try {
      let target=attack.operation.request.target;
      for (const operation of interceptor.operations) target=applyDefenseModifier(target,operation);
      if (!Number.isFinite(target)) return rejected(inputState,"recalculated attack target must be finite");
    } catch (error) {
      return rejected(inputState,error instanceof Error?error.message:String(error));
    }
    interceptedOperationId=attack.operation.id;
  } else {
    const damage=findDamageRollOperation(pending);
    if(!damage)return resolvePendingResolution(profile,inputState,pending);
    const preview=stagePendingResolution(profile,inputState,{...pending,operations:pending.operations.slice(0,damage.index+1)});
    if(preview.status==="rejected")return preview;
    const result=preview.results[damage.operation.id] as DamageRollResolution|undefined;
    if(!result||!Number.isFinite(result.total))return rejected(inputState,"provisional damage roll result is missing");
    interceptedOperationId=damage.operation.id;
  }

  let payments:ResolutionOperation[];
  try {
    payments=paymentOperations(definition,sourceActorId,interceptor.id,undefined,true);
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
  if (paymentEligibility.status==="rejected") return resolvePendingResolution(profile,inputState,pending);

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
    context:{sourceActorId,definition,interceptorId:interceptor.id,interceptedOperationId,pending},
  };
}

export function resumeCommonPlayInteraction(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  awaiting:AwaitingCommonPlayInteraction,
  response:CommonPlayInteractionResponse,
  authority?:CommonPlayInteractionAuthority,
):CommonPlayResolutionResult {
  if (response.interactionId!==awaiting.interaction.id||response.idempotencyKey!==awaiting.interaction.idempotencyKey) {
    return rejected(inputState,"interaction response identity mismatch");
  }

  const interceptor=awaiting.context.definition.interceptors.find((entry)=>entry.id===awaiting.context.interceptorId);
  if (!interceptor) return rejected(inputState,`interceptor not found: ${awaiting.context.interceptorId}`);
  if (inputState.revision!==awaiting.interaction.expectedRevision) {
    if (interceptor.interaction.stalePolicy==="restart") {
      return startCommonPlayResolution(profile,inputState,{ ...awaiting.context.pending, expectedRevision:inputState.revision },awaiting.context.definition,awaiting.context.sourceActorId);
    }
    return {status:"invalidated",state:inputState,error:`interaction is stale: expected revision ${awaiting.interaction.expectedRevision}, current ${inputState.revision}`};
  }

  if (!response.value) return resolvePendingResolution(profile,inputState,awaiting.context.pending);

  try {
    return resolvePendingResolution(profile,inputState,acceptedPending(profile,inputState,awaiting,authority));
  } catch (error) {
    return rejected(inputState,error instanceof Error?error.message:String(error));
  }
}
