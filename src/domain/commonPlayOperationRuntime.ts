import { conditionEffectsFor, type RulesRuntimeState } from "./combatState";
import type { D20RollModification, D20TestFamily, ModifierContribution } from "./d20";
import { DomainEvaluationError, evaluateExpression, type ExpressionNode, type RollStateContribution, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import type { ResourceRecovery } from "./resources";
import type { TargetingFactInput } from "./targeting";
import type { ActionUseKind, TurnSlot } from "./turnEconomy";
import { compileCommonPlayMovement, type CommonPlayMovementDefinition } from "./commonPlayMovementRuntime";
import { effectiveSpeed, proneStandingCost } from "./conditions";
import { effectIsActive } from "./effects";
import type { CommonPlayFactAnswer, CommonPlayFactQuery } from "./commonPlaySpatialFactRuntime";
import { parseCommonPlaySelector, resolveCommonPlaySelector, type CommonPlaySelector, type CommonPlaySelectorCandidate } from "./commonPlaySelectorRuntime";
import { SRD_521_CONDITIONS, type ConditionId } from "./conditions";

type LiteralNumberExpression={value:number};
type CommonPlayExpression=LiteralNumberExpression|Record<string,unknown>;
type CommonPlayHpTarget="actor"|"self"|"target";
type CommonPlayConditionTarget="actor"|"self"|"target";
type CommonPlayTestOutcomePredicate={op:"eq";left:{ref:"test.outcome"};right:{value:"success"|"failure"}};
type CommonPlayConditionChange={
  kind:"condition.apply"|"condition.remove";
  condition:ConditionId;
  target?:CommonPlayConditionTarget;
  when?:CommonPlayTestOutcomePredicate;
};
type CommonPlayEffectRemove={
  kind:"effect.remove";
  selector:CommonPlaySelector&{from:"effects"};
  when?:CommonPlayTestOutcomePredicate;
};
type CommonPlayMovementStand={kind:"movement.stand";target:"actor"|"self"};
type CommonPlayMovementGrant={
  kind:"movement.grant";
  target:"actor"|"self";
  distance:CommonPlayExpression;
  maximumDistance?:CommonPlayExpression;
  doesNotProvokeOpportunityAttacks?:boolean;
};

type CommonPlayResourceCreation={
  label:string;
  maximum:LiteralNumberExpression;
  recovery?:ResourceRecovery;
};

export interface CommonPlayTargetingSelector extends Omit<CommonPlaySelector,"from"|"min"|"max"> {
  from:"targets";
  min:number;
  max:number;
}

export interface CommonPlayAllocationDefinition {
  units:LiteralNumberExpression;
  targets:CommonPlayTargetingSelector;
  minimumPerTarget?:number;
  maximumPerTarget?:number;
  totalMustMatch:boolean;
}

export interface CommonPlayConsentInteraction {
  id:string;
  kind:"consent";
  responder:"actor"|"target"|"actor-owner"|"target-owner"|"dm"|"host";
  mode:"blocking";
  input:{type:"boolean"};
  revalidate:"always"|"if-revision-changed";
  stalePolicy?:"reject";
}

export interface CommonPlayChoiceInteraction {
  id:string;
  kind:"choice";
  responder:"actor"|"target"|"actor-owner"|"target-owner"|"dm"|"host";
  mode:"blocking";
  input:{type:"choice";selector:CommonPlaySelector};
  revalidate:"always"|"if-revision-changed";
  stalePolicy?:"reject";
}

export type CommonPlayInteraction=CommonPlayConsentInteraction|CommonPlayChoiceInteraction;

export interface CommonPlayDamageDiceFormula {
  count:number;
  sides:number;
  flat:number;
}

type CommonPlayPropertyModifier={
  kind:"property.modify";
  property:string;
  operation:"add"|"subtract"|"set"|"min"|"max"|"multiply";
  value:CommonPlayExpression;
  target:"actor"|"target";
  owner:"effect";
  source:"definition";
  duration:{kind:"elapsed";amount:LiteralNumberExpression;unit:"seconds"|"minutes"|"hours"|"days"};
  lifetime:{kind:"until-duration";onEnd:"destroy"};
  instancePolicy:"stack"|"replace"|"unique-by-source"|"profile-policy";
};

type CommonPlayResourceChange={
  kind:"resource.change";
  resource:string;
  amount:CommonPlayExpression;
  target?:string;
  createIfMissing?:CommonPlayResourceCreation;
  maximumDelta?:LiteralNumberExpression;
  temporaryCapacityUntilLongRest?:true;
};

type CommonPlayRechargeResource={
  kind:"resource.recharge";
  resource:string;
  die:{sides:number};
  succeedsOn:{minimum:number;maximum?:number};
};

type CommonPlayEconomyModify={
  kind:"economy.modify";
  bucket:string;
  amount:CommonPlayExpression;
};

type CommonPlayDamageApply={
  kind:"damage.apply";
  amount:LiteralNumberExpression|string;
  damageType:string;
  multiplier?:number;
  target?:CommonPlayHpTarget;
  when?:CommonPlayTestOutcomePredicate;
};

type CommonPlayHealingApply={
  kind:"healing.apply";
  amount:LiteralNumberExpression;
  target?:CommonPlayHpTarget;
};

type CommonPlayTemporaryHpGrant={
  kind:"temp-hp.grant";
  amount:LiteralNumberExpression;
  target?:CommonPlayHpTarget;
  choice?:"keep-existing"|"take-new";
};

type CommonPlayLifeStabilize={
  kind:"life.stabilize";
  target?:CommonPlayHpTarget;
};

type CommonPlayRollModify={
  kind:"roll.modify";
  mode:"advantage"|"disadvantage"|"add-die"|"subtract-die"|"add-flat"|"target-add"|"reroll"|"replace"|"minimum";
  value?:LiteralNumberExpression;
  dice?:string;
};

export type CommonPlayResourcePayment={
  kind:"resource";
  resource:string;
  amount:CommonPlayExpression;
  consumeAt:"commit";
};

export type CommonPlayEconomyPayment={
  kind:"economy";
  bucket:TurnSlot;
  amount:LiteralNumberExpression;
  consumeAt:"commit";
  refundOnCancel:true;
};

export type CommonPlayItemPayment={
  kind:"item";
  selector:{from:"items";definitionId:string};
  quantity:LiteralNumberExpression;
  consumed:true;
  consumeAt:"commit";
  refundOnCancel:true;
};

export type CommonPlayPayment=CommonPlayResourcePayment|CommonPlayEconomyPayment|CommonPlayItemPayment;

export type CommonPlayOperation=
  |CommonPlayPropertyModifier
  |CommonPlayResourceChange
  |CommonPlayRechargeResource
  |CommonPlayEconomyModify
  |CommonPlayDamageApply
  |CommonPlayHealingApply
  |CommonPlayTemporaryHpGrant
  |CommonPlayLifeStabilize
  |CommonPlayMovementDefinition
  |CommonPlayMovementGrant
  |CommonPlayMovementStand
  |CommonPlayConditionChange
  |CommonPlayEffectRemove
  |CommonPlayRollModify;

type CommonPlayD20ModifierProperty=string|{choose:"highest";from:string[]};
type CommonPlayD20Ability="str"|"dex"|"con"|"int"|"wis"|"cha";

export interface CommonPlayD20TestDefinition {
  kind:D20TestFamily;
  roller:"actor"|"target";
  property?:CommonPlayD20ModifierProperty;
  dc:LiteralNumberExpression;
  perTarget?:false;
}

export interface CommonPlayOperationDefinition {
  schemaVersion:string;
  id:string;
  payments?:CommonPlayPayment[];
  entryPoints:Array<{
    id:string;
    invocation:"manual"|"triggered"|"automatic"|"granted";
    interaction?:CommonPlayInteraction;
    targeting?:CommonPlayTargetingSelector;
    allocation?:CommonPlayAllocationDefinition;
    test?:CommonPlayD20TestDefinition;
    operations:CommonPlayOperation[];
  }>;
}

export interface CommonPlayOperationExecutionInput {
  resolutionId:string;
  actorId:string;
  entryPointId:string;
  d20?:{
    faces:number[];
    targetId?:string;
    ability?:CommonPlayD20Ability;
    modifierContributions?:ModifierContribution[];
    rollStateContributions?:RollStateContribution[];
    modifierDiceFaces?:Record<number,number[]>;
  };
  targetId?:string;
  targetingTargets?:TargetingFactInput[];
  targetingCandidates?:CommonPlaySelectorCandidate[];
  creatureKinds?:Record<string,"character"|"monster">;
  damageDiceFaces?:Record<number,number[]>;
  rechargeDiceFaces?:Record<number,number[]>;
  movementFactAnswers?:Record<number,CommonPlayFactAnswer>;
  movementProperties?:Record<string,number>;
  interactionResponse?:
    | {interactionId:string;accepted:true}
    | {interactionId:string;selectedIds:string[]};
  itemPaymentResourceIds?:Record<number,string>;
  actionKind?:ActionUseKind;
}

type Obj=Record<string,unknown>;
const DEFINITION_KEYS=new Set(["$schema","schemaVersion","id","payments","entryPoints"]);
const RESOURCE_PAYMENT_KEYS=new Set(["kind","resource","amount","consumeAt"]);
const ECONOMY_PAYMENT_KEYS=new Set(["kind","bucket","amount","consumeAt","refundOnCancel"]);
const ITEM_PAYMENT_KEYS=new Set(["kind","selector","quantity","consumed","consumeAt","refundOnCancel"]);
const ITEM_PAYMENT_SELECTOR_KEYS=new Set(["from","where","min","max","definitionId"]);
const ITEM_PAYMENT_PREDICATE_KEYS=new Set(["op","left","right"]);
const ENTRY_POINT_KEYS=new Set(["id","invocation","interaction","targeting","allocation","test","operations"]);
const INTERACTION_KEYS=new Set(["id","kind","responder","mode","input","revalidate","stalePolicy"]);
const INTERACTION_INPUT_KEYS=new Set(["type","selector"]);
const TARGETING_KEYS=new Set(["from","where","min","max","area","orderBy","selection"]);
const ALLOCATION_KEYS=new Set(["units","targets","minimumPerTarget","maximumPerTarget","totalMustMatch"]);
const D20_TEST_KEYS=new Set(["kind","roller","property","dc","perTarget"]);
const PROPERTY_MODIFY_KEYS=new Set(["kind","property","operation","value","target","owner","source","duration","lifetime","instancePolicy"]);
const PROPERTY_DURATION_KEYS=new Set(["kind","amount","unit"]);
const PROPERTY_LIFETIME_KEYS=new Set(["kind","onEnd"]);
const RESOURCE_CHANGE_KEYS=new Set(["kind","resource","amount","target","createIfMissing","maximumDelta","temporaryCapacityUntilLongRest"]);
const RESOURCE_CREATION_KEYS=new Set(["label","maximum","recovery"]);
const RESOURCE_RECOVERY_KEYS=new Set(["shortRest","longRest","turnStart"]);
const RESOURCE_RECHARGE_KEYS=new Set(["kind","resource","die","succeedsOn"]);
const RECHARGE_DIE_KEYS=new Set(["sides"]);
const RECHARGE_RANGE_KEYS=new Set(["minimum","maximum"]);
const ECONOMY_MODIFY_KEYS=new Set(["kind","bucket","amount"]);
const DAMAGE_APPLY_KEYS=new Set(["kind","amount","damageType","multiplier","target","when"]);
const HEALING_APPLY_KEYS=new Set(["kind","amount","target"]);
const CONDITION_CHANGE_KEYS=new Set(["kind","condition","target","when"]);
const EFFECT_REMOVE_KEYS=new Set(["kind","selector","when"]);
const TEMP_HP_GRANT_KEYS=new Set(["kind","amount","target","choice"]);
const LIFE_STABILIZE_KEYS=new Set(["kind","target"]);
const ROLL_MODIFY_KEYS=new Set(["kind","mode","value","dice"]);
const MOVEMENT_RELOCATE_KEYS=new Set(["kind","mode","movementType","target","distance","costMultiplier","doesNotProvokeOpportunityAttacks","destinationFact","when"]);
const MOVEMENT_GRANT_KEYS=new Set(["kind","target","distance","maximumDistance","doesNotProvokeOpportunityAttacks"]);
const MOVEMENT_STAND_KEYS=new Set(["kind","target"]);
const FACT_QUERY_KEYS=new Set(["id","fact","subject","authority","visibility","unknownPolicy"]);
const DAMAGE_DICE=/^([0-9]+)d([0-9]+)([+-][0-9]+)?$/;

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

function nonNegativeLiteralExpression(value:unknown,label:string) {
  const expression=literalExpression(value,label);
  if(expression.value<0) throw new DomainEvaluationError(`${label} must be a non-negative integer literal`);
  return expression;
}

function recoveryAmount(value:unknown,label:string) {
  if(value==="all") return "all" as const;
  if(typeof value!=="number"||!Number.isInteger(value)||value<0) {
    throw new DomainEvaluationError(`${label} must be all or a non-negative integer`);
  }
  return value;
}

function parseResourceRecovery(value:unknown,label:string):ResourceRecovery|undefined {
  if(value===undefined) return undefined;
  const recovery=object(value,label);
  supportedKeys(recovery,RESOURCE_RECOVERY_KEYS,label);
  const parsed:ResourceRecovery={};
  if(recovery.shortRest!==undefined) parsed.shortRest=recoveryAmount(recovery.shortRest,`${label}.shortRest`);
  if(recovery.longRest!==undefined) parsed.longRest=recoveryAmount(recovery.longRest,`${label}.longRest`);
  if(recovery.turnStart!==undefined) parsed.turnStart=recoveryAmount(recovery.turnStart,`${label}.turnStart`);
  return parsed;
}

function parseResourceCreation(value:unknown,label:string):CommonPlayResourceCreation {
  const creation=object(value,label);
  supportedKeys(creation,RESOURCE_CREATION_KEYS,label);
  const maximum=literalExpression(creation.maximum,`${label}.maximum`);
  if(maximum.value<=0) throw new DomainEvaluationError(`${label}.maximum must be a positive integer`);
  const recovery=parseResourceRecovery(creation.recovery,`${label}.recovery`);
  return {
    label:nonEmptyString(creation.label,`${label}.label`),
    maximum,
    ...(recovery?{recovery}:{}),
  };
}

export function parseCommonPlayDamageDiceFormula(value:string,label="Common Play damage amount"):CommonPlayDamageDiceFormula {
  const match=DAMAGE_DICE.exec(value.trim());
  if(!match) throw new DomainEvaluationError(`${label} must be a literal integer or XdY+Z damage formula`);
  const count=Number(match[1]);
  const sides=Number(match[2]);
  const flat=Number(match[3]??0);
  if(!Number.isInteger(count)||count<1||count>100) throw new DomainEvaluationError(`${label} dice count must be between 1 and 100`);
  if(!Number.isInteger(sides)||sides<2||sides>20) throw new DomainEvaluationError(`${label} dice sides must be between 2 and 20`);
  return {count,sides,flat};
}

function hpTarget(value:unknown,label:string):CommonPlayHpTarget|undefined {
  if(value===undefined) return undefined;
  if(value!=="actor"&&value!=="self"&&value!=="target") {
    throw new DomainEvaluationError(`${label} must be actor, self, or target for portable Common Play HP operations`);
  }
  return value;
}

function conditionTarget(value:unknown,label:string):CommonPlayConditionTarget|undefined {
  if(value===undefined) return undefined;
  if(value!=="actor"&&value!=="self"&&value!=="target") throw new DomainEvaluationError(`${label} must be actor, self, or target for portable Common Play condition operations`);
  return value;
}

function testOutcomePredicate(value:unknown,label:string):CommonPlayTestOutcomePredicate|undefined {
  if(value===undefined) return undefined;
  const predicate=object(value,label);
  supportedKeys(predicate,new Set(["op","left","right"]),label);
  const left=object(predicate.left,`${label}.left`);
  const right=object(predicate.right,`${label}.right`);
  supportedKeys(left,new Set(["ref"]),`${label}.left`);
  supportedKeys(right,new Set(["value"]),`${label}.right`);
  if(predicate.op!=="eq"||left.ref!=="test.outcome"||(right.value!=="success"&&right.value!=="failure")) throw new DomainEvaluationError(`${label} currently supports only test.outcome == success|failure`);
  return {op:"eq",left:{ref:"test.outcome"},right:{value:right.value}};
}

function numericExpression(value:unknown,label:string):CommonPlayExpression {
  const expression=object(value,label);
  if("value" in expression) return literalExpression(expression,label);
  if("ref" in expression) {
    supportedKeys(expression,new Set(["ref"]),label);
    return {ref:nonEmptyString(expression.ref,`${label}.ref`)};
  }
  supportedKeys(expression,new Set(["op","args"]),label);
  if(expression.op!=="add"&&expression.op!=="subtract"&&expression.op!=="multiply"&&expression.op!=="divide"&&expression.op!=="min"&&expression.op!=="max"&&expression.op!=="floor"&&expression.op!=="ceil") throw new DomainEvaluationError(`${label}.op is unsupported`);
  if(!Array.isArray(expression.args)||!expression.args.length) throw new DomainEvaluationError(`${label}.args must be a non-empty array`);
  return {op:expression.op,args:expression.args.map((arg,index)=>numericExpression(arg,`${label}.args[${index}]`))};
}

function parseTargetingSelector(value:unknown,label:string):CommonPlayTargetingSelector {
  const selector=object(value,label);
  supportedKeys(selector,TARGETING_KEYS,label);
  const parsed=parseCommonPlaySelector(selector,label);
  if(parsed.from!=="targets") throw new DomainEvaluationError(`${label}.from must be targets for portable Common Play targeting`);
  if(parsed.min===undefined||!Number.isInteger(parsed.min)||parsed.min<0) throw new DomainEvaluationError(`${label}.min must be a non-negative integer for portable Common Play targeting`);
  if(parsed.max===undefined||!Number.isInteger(parsed.max)||parsed.max<parsed.min) throw new DomainEvaluationError(`${label}.max must be an integer >= min for portable Common Play targeting`);
  return {...parsed,from:"targets",min:parsed.min,max:parsed.max};
}

function parseAllocation(value:unknown,label:string):CommonPlayAllocationDefinition {
  const allocation=object(value,label);
  supportedKeys(allocation,ALLOCATION_KEYS,label);
  const minimum=allocation.minimumPerTarget;
  const maximum=allocation.maximumPerTarget;
  if(minimum!==undefined&&(!Number.isInteger(minimum)||Number(minimum)<0)) throw new DomainEvaluationError(`${label}.minimumPerTarget must be a non-negative integer`);
  if(maximum!==undefined&&(!Number.isInteger(maximum)||Number(maximum)<1)) throw new DomainEvaluationError(`${label}.maximumPerTarget must be a positive integer`);
  if(minimum!==undefined&&maximum!==undefined&&Number(maximum)<Math.max(1,Number(minimum))) throw new DomainEvaluationError(`${label} per-target bounds are invalid`);
  if(typeof allocation.totalMustMatch!=="boolean") throw new DomainEvaluationError(`${label}.totalMustMatch must be boolean`);
  return {
    units:nonNegativeLiteralExpression(allocation.units,`${label}.units`),
    targets:parseTargetingSelector(allocation.targets,`${label}.targets`),
    ...(minimum===undefined?{}:{minimumPerTarget:Number(minimum)}),
    ...(maximum===undefined?{}:{maximumPerTarget:Number(maximum)}),
    totalMustMatch:allocation.totalMustMatch,
  };
}

function parseItemPaymentSelector(value:unknown,label:string):CommonPlayItemPayment["selector"] {
  const selector=object(value,label);
  supportedKeys(selector,ITEM_PAYMENT_SELECTOR_KEYS,label);
  if(selector.from!=="items") throw new DomainEvaluationError(`${label}.from must be items for portable Common Play item payment`);
  if(typeof selector.definitionId==="string") return {from:"items",definitionId:nonEmptyString(selector.definitionId,`${label}.definitionId`)};
  if(selector.min!==1||selector.max!==1) throw new DomainEvaluationError(`${label} must select exactly one item stack with min=1 and max=1`);
  const where=object(selector.where,`${label}.where`);
  supportedKeys(where,ITEM_PAYMENT_PREDICATE_KEYS,`${label}.where`);
  if(where.op!=="eq") throw new DomainEvaluationError(`${label}.where must use eq for portable Common Play item payment`);
  const left=object(where.left,`${label}.where.left`);
  const right=object(where.right,`${label}.where.right`);
  const leftIsDefinition=Object.keys(left).length===1&&left.ref==="item.definitionId";
  const rightIsDefinition=Object.keys(right).length===1&&right.ref==="item.definitionId";
  const leftValue=Object.keys(left).length===1&&typeof left.value==="string"?left.value:undefined;
  const rightValue=Object.keys(right).length===1&&typeof right.value==="string"?right.value:undefined;
  const definitionId=leftIsDefinition?rightValue:rightIsDefinition?leftValue:undefined;
  if(!definitionId) throw new DomainEvaluationError(`${label}.where must compare item.definitionId to one literal string`);
  return {from:"items",definitionId:nonEmptyString(definitionId,`${label}.where.definitionId`)};
}

function parsePayment(value:unknown,label:string):CommonPlayPayment {
  const payment=object(value,label);
  if(payment.kind==="resource") {
    supportedKeys(payment,RESOURCE_PAYMENT_KEYS,label);
    if(payment.consumeAt!=="commit") throw new DomainEvaluationError(`unsupported Common Play resource payment consumeAt: ${String(payment.consumeAt??"<missing>")}`);
    const resource=nonEmptyString(payment.resource,`${label}.resource`);
    const amount=literalExpression(payment.amount,`${label}.amount`);
    if(amount.value<=0) throw new DomainEvaluationError("Common Play resource payment amount must be a positive integer");
    return {kind:"resource",resource,amount,consumeAt:"commit"};
  }
  if(payment.kind==="item") {
    supportedKeys(payment,ITEM_PAYMENT_KEYS,label);
    const selector=parseItemPaymentSelector(payment.selector,`${label}.selector`);
    const quantity=literalExpression(payment.quantity,`${label}.quantity`);
    if(quantity.value<=0) throw new DomainEvaluationError(`${label}.quantity must be a positive integer`);
    if(payment.consumed!==true) throw new DomainEvaluationError(`${label}.consumed must be true for portable Common Play item payment`);
    if(payment.consumeAt!=="commit") throw new DomainEvaluationError(`${label}.consumeAt must be commit for portable Common Play item payment`);
    if(payment.refundOnCancel!==undefined&&payment.refundOnCancel!==true) throw new DomainEvaluationError(`${label}.refundOnCancel must be true when present`);
    return {kind:"item",selector,quantity,consumed:true,consumeAt:"commit",refundOnCancel:true};
  }
  if(payment.kind==="economy") {
    supportedKeys(payment,ECONOMY_PAYMENT_KEYS,label);
    if(payment.bucket!=="action"&&payment.bucket!=="bonus-action"&&payment.bucket!=="reaction") throw new DomainEvaluationError(`${label}.bucket must be action, bonus-action, or reaction`);
    const amount=literalExpression(payment.amount,`${label}.amount`);
    if(amount.value!==1) throw new DomainEvaluationError(`${label}.amount must be exactly 1 for portable Common Play economy payment`);
    if(payment.consumeAt!=="commit") throw new DomainEvaluationError(`${label}.consumeAt must be commit for portable Common Play economy payment`);
    if(payment.refundOnCancel!==true) throw new DomainEvaluationError(`${label}.refundOnCancel must be true for portable Common Play Reaction payment`);
    return {kind:"economy",bucket:payment.bucket,amount,consumeAt:"commit",refundOnCancel:true};
  }
  throw new DomainEvaluationError(`unsupported Common Play payment kind: ${String(payment.kind)}`);
}

export function parseCommonPlayPayments(value:unknown,label="Common Play definition.payments"):CommonPlayPayment[]|undefined {
  if(value===undefined) return undefined;
  if(!Array.isArray(value)) throw new DomainEvaluationError(`${label} must be an array`);
  return value.map((payment,index)=>parsePayment(payment,`${label}[${index}]`));
}

function parseCommonPlayInteraction(value:unknown,label:string):CommonPlayInteraction {
  const interaction=object(value,label);
  supportedKeys(interaction,INTERACTION_KEYS,label);
  if(interaction.kind!=="consent"&&interaction.kind!=="choice") throw new DomainEvaluationError(`${label}.kind must be consent or choice for portable Common Play interaction`);
  if(interaction.responder!=="actor"&&interaction.responder!=="target"&&interaction.responder!=="actor-owner"&&interaction.responder!=="target-owner"&&interaction.responder!=="dm"&&interaction.responder!=="host") throw new DomainEvaluationError(`${label}.responder must be actor, target, actor-owner, target-owner, dm, or host for portable Common Play interaction`);
  if(interaction.mode!=="blocking") throw new DomainEvaluationError(`${label}.mode must be blocking for portable Common Play interaction`);
  const input=object(interaction.input,`${label}.input`);
  supportedKeys(input,INTERACTION_INPUT_KEYS,`${label}.input`);
  if(interaction.revalidate!=="always"&&interaction.revalidate!=="if-revision-changed") throw new DomainEvaluationError(`${label}.revalidate must be always or if-revision-changed for portable Common Play interaction`);
  if(interaction.stalePolicy!==undefined&&interaction.stalePolicy!=="reject") throw new DomainEvaluationError(`${label}.stalePolicy must be reject for portable Common Play interaction`);
  const responder=interaction.responder as CommonPlayConsentInteraction["responder"];
  const revalidate=interaction.revalidate as CommonPlayConsentInteraction["revalidate"];
  const shared={
    id:nonEmptyString(interaction.id,`${label}.id`),responder,mode:"blocking" as const,revalidate,
    ...(interaction.stalePolicy?{stalePolicy:"reject" as const}:{}),
  };
  if(interaction.kind==="consent") {
    if(input.type!=="boolean"||input.selector!==undefined) throw new DomainEvaluationError(`${label}.input must be boolean without selector for portable consent interaction`);
    return {...shared,kind:"consent",input:{type:"boolean"}};
  }
  if(input.type!=="choice"||input.selector===undefined) throw new DomainEvaluationError(`${label}.input requires type=choice and selector for portable choice interaction`);
  const selector=parseCommonPlaySelector(input.selector,`${label}.input.selector`);
  if(selector.selection==="automatic") throw new DomainEvaluationError(`${label}.input.selector.selection must be manual when present for portable choice interaction`);
  return {...shared,kind:"choice",input:{type:"choice",selector}};
}

function parseOperation(value:unknown,label:string):CommonPlayOperation {
  const operation=object(value,label);
  if(operation.kind==="property.modify") {
    supportedKeys(operation,PROPERTY_MODIFY_KEYS,label);
    const mode=operation.operation;
    if(mode!=="add"&&mode!=="subtract"&&mode!=="set"&&mode!=="min"&&mode!=="max"&&mode!=="multiply") throw new DomainEvaluationError(`${label}.operation is unsupported`);
    if(operation.target!=="actor"&&operation.target!=="target") throw new DomainEvaluationError(`${label}.target must be actor or target`);
    if(operation.owner!=="effect") throw new DomainEvaluationError(`${label}.owner must be effect`);
    if(operation.source!=="definition") throw new DomainEvaluationError(`${label}.source must be definition`);
    const duration=object(operation.duration,`${label}.duration`);
    supportedKeys(duration,PROPERTY_DURATION_KEYS,`${label}.duration`);
    if(duration.kind!=="elapsed") throw new DomainEvaluationError(`${label}.duration.kind must be elapsed for the portable property modifier slice`);
    const amount=literalExpression(duration.amount,`${label}.duration.amount`);
    if(amount.value<=0) throw new DomainEvaluationError(`${label}.duration.amount must be positive`);
    if(duration.unit!=="seconds"&&duration.unit!=="minutes"&&duration.unit!=="hours"&&duration.unit!=="days") throw new DomainEvaluationError(`${label}.duration.unit is unsupported`);
    const lifetime=object(operation.lifetime,`${label}.lifetime`);
    supportedKeys(lifetime,PROPERTY_LIFETIME_KEYS,`${label}.lifetime`);
    if(lifetime.kind!=="until-duration"||lifetime.onEnd!=="destroy") throw new DomainEvaluationError(`${label}.lifetime must destroy at duration end`);
    if(operation.instancePolicy!=="stack"&&operation.instancePolicy!=="replace"&&operation.instancePolicy!=="unique-by-source"&&operation.instancePolicy!=="profile-policy") throw new DomainEvaluationError(`${label}.instancePolicy is unsupported`);
    return {kind:"property.modify",property:nonEmptyString(operation.property,`${label}.property`),operation:mode,value:numericExpression(operation.value,`${label}.value`),target:operation.target,owner:"effect",source:"definition",duration:{kind:"elapsed",amount,unit:duration.unit},lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:operation.instancePolicy};
  }
  if(operation.kind==="movement.grant") {
    supportedKeys(operation,MOVEMENT_GRANT_KEYS,label);
    if(operation.target!=="actor"&&operation.target!=="self") throw new DomainEvaluationError(`${label}.target must be actor or self`);
    if(operation.doesNotProvokeOpportunityAttacks!==undefined&&typeof operation.doesNotProvokeOpportunityAttacks!=="boolean") throw new DomainEvaluationError(`${label}.doesNotProvokeOpportunityAttacks must be boolean`);
    return {
      kind:"movement.grant",
      target:operation.target,
      distance:numericExpression(operation.distance,`${label}.distance`),
      ...(operation.maximumDistance===undefined?{}:{maximumDistance:numericExpression(operation.maximumDistance,`${label}.maximumDistance`)}),
      ...(operation.doesNotProvokeOpportunityAttacks===undefined?{}:{doesNotProvokeOpportunityAttacks:operation.doesNotProvokeOpportunityAttacks===true}),
    };
  }
  if(operation.kind==="movement.stand") {
    supportedKeys(operation,MOVEMENT_STAND_KEYS,label);
    if(operation.target!=="actor"&&operation.target!=="self") throw new DomainEvaluationError(`${label}.target must be actor or self`);
    return {kind:"movement.stand",target:operation.target};
  }
  if(operation.kind==="movement.relocate") {
    supportedKeys(operation,MOVEMENT_RELOCATE_KEYS,label);
    if(operation.mode!=="move"&&operation.mode!=="push"&&operation.mode!=="pull"&&operation.mode!=="teleport"&&operation.mode!=="granted") throw new DomainEvaluationError(`${label}.mode is unsupported`);
    if(operation.movementType!==undefined&&!(["walk","climb","swim","fly","crawl","jump"] as unknown[]).includes(operation.movementType)) throw new DomainEvaluationError(`${label}.movementType is unsupported`);
    if(operation.target!=="actor"&&operation.target!=="self"&&operation.target!=="target") throw new DomainEvaluationError(`${label}.target must be actor, self, or target`);
    if(operation.doesNotProvokeOpportunityAttacks!==undefined&&typeof operation.doesNotProvokeOpportunityAttacks!=="boolean") throw new DomainEvaluationError(`${label}.doesNotProvokeOpportunityAttacks must be boolean`);
    const destinationFact=object(operation.destinationFact,`${label}.destinationFact`);
    supportedKeys(destinationFact,FACT_QUERY_KEYS,`${label}.destinationFact`);
    if(typeof destinationFact.id!=="string"||!destinationFact.id||destinationFact.fact!=="spatial.legal-destination") throw new DomainEvaluationError(`${label}.destinationFact requires a stable id and spatial.legal-destination`);
    if(destinationFact.authority!=="host"&&destinationFact.authority!=="actor-owner"&&destinationFact.authority!=="target-owner"&&destinationFact.authority!=="dm"&&destinationFact.authority!=="profile") throw new DomainEvaluationError(`${label}.destinationFact.authority is unsupported`);
    if(destinationFact.visibility!=="public"&&destinationFact.visibility!=="actor"&&destinationFact.visibility!=="dm"&&destinationFact.visibility!=="actor-and-dm"&&destinationFact.visibility!=="authority-only") throw new DomainEvaluationError(`${label}.destinationFact.visibility is unsupported`);
    if(destinationFact.unknownPolicy!=="block"&&destinationFact.unknownPolicy!=="request-authority"&&destinationFact.unknownPolicy!=="treat-false"&&destinationFact.unknownPolicy!=="unsupported") throw new DomainEvaluationError(`${label}.destinationFact.unknownPolicy is unsupported`);
    const when=testOutcomePredicate(operation.when,`${label}.when`);
    return {
      kind:"movement.relocate",mode:operation.mode,movementType:operation.movementType as CommonPlayMovementDefinition["movementType"],target:operation.target,
      ...(when?{when}:{}),
      distance:numericExpression(operation.distance,`${label}.distance`) as ExpressionNode,
      ...(operation.costMultiplier===undefined?{}:{costMultiplier:numericExpression(operation.costMultiplier,`${label}.costMultiplier`) as ExpressionNode}),
      ...(operation.doesNotProvokeOpportunityAttacks===undefined?{}:{doesNotProvokeOpportunityAttacks:operation.doesNotProvokeOpportunityAttacks===true}),
      destinationFact:destinationFact as unknown as CommonPlayFactQuery,
    };
  }
  if(operation.kind==="roll.modify") {
    supportedKeys(operation,ROLL_MODIFY_KEYS,label);
    const modes=new Set(["advantage","disadvantage","add-die","subtract-die","add-flat","target-add","reroll","replace","minimum"]);
    if(typeof operation.mode!=="string"||!modes.has(operation.mode)) throw new DomainEvaluationError(`${label}.mode is unsupported`);
    const needsValue=operation.mode==="add-flat"||operation.mode==="target-add"||operation.mode==="replace"||operation.mode==="minimum";
    const needsDice=operation.mode==="add-die"||operation.mode==="subtract-die"||operation.mode==="reroll";
    if(needsValue!==Boolean(operation.value!==undefined)) throw new DomainEvaluationError(`${label}.value ${needsValue?"is required":"is not allowed"} for ${operation.mode}`);
    if(needsDice!==Boolean(operation.dice!==undefined)) throw new DomainEvaluationError(`${label}.dice ${needsDice?"is required":"is not allowed"} for ${operation.mode}`);
    if(needsDice) parseCommonPlayDamageDiceFormula(nonEmptyString(operation.dice,`${label}.dice`),`${label}.dice`);
    return {
      kind:"roll.modify",
      mode:operation.mode as CommonPlayRollModify["mode"],
      ...(needsValue?{value:literalExpression(operation.value,`${label}.value`)}:{}),
      ...(needsDice?{dice:nonEmptyString(operation.dice,`${label}.dice`)}:{}),
    };
  }
  if(operation.kind==="resource.change") {
    supportedKeys(operation,RESOURCE_CHANGE_KEYS,label);
    const amount=literalExpression(operation.amount,`${label}.amount`);
    const target=operation.target===undefined?undefined:nonEmptyString(operation.target,`${label}.target`);
    if(target!==undefined&&target!=="actor"&&target!=="self") {
      throw new DomainEvaluationError(`${label}.target must be actor or self for portable Common Play resource.change`);
    }
    const createIfMissing=operation.createIfMissing===undefined?undefined:parseResourceCreation(operation.createIfMissing,`${label}.createIfMissing`);
    const maximumDelta=operation.maximumDelta===undefined?undefined:nonNegativeLiteralExpression(operation.maximumDelta,`${label}.maximumDelta`);
    if(maximumDelta?.value===0) throw new DomainEvaluationError(`${label}.maximumDelta must be a positive integer`);
    if(operation.temporaryCapacityUntilLongRest!==undefined&&operation.temporaryCapacityUntilLongRest!==true) {
      throw new DomainEvaluationError(`${label}.temporaryCapacityUntilLongRest must be true when present`);
    }
    if((maximumDelta===undefined)!==(operation.temporaryCapacityUntilLongRest===undefined)) {
      throw new DomainEvaluationError(`${label}.maximumDelta and temporaryCapacityUntilLongRest must be declared together`);
    }
    if(createIfMissing&&maximumDelta) throw new DomainEvaluationError(`${label}.createIfMissing cannot be combined with temporary maximum capacity`);
    if(amount.value<0&&(createIfMissing||maximumDelta)) throw new DomainEvaluationError(`${label} resource creation/capacity increase requires a non-negative amount`);
    if(amount.value===0&&!maximumDelta) throw new DomainEvaluationError("resource.change requires a non-zero amount or temporary maximum capacity increase");
    return {
      kind:"resource.change",
      resource:nonEmptyString(operation.resource,`${label}.resource`),
      amount,
      ...(target===undefined?{}:{target}),
      ...(createIfMissing?{createIfMissing}:{}),
      ...(maximumDelta?{maximumDelta}:{}),
      ...(operation.temporaryCapacityUntilLongRest===true?{temporaryCapacityUntilLongRest:true as const}:{}),
    };
  }
  if(operation.kind==="effect.remove") {
    supportedKeys(operation,EFFECT_REMOVE_KEYS,label);
    const selector=parseCommonPlaySelector(operation.selector,`${label}.selector`);
    if(selector.from!=="effects") throw new DomainEvaluationError(`${label}.selector.from must be effects for portable Common Play effect.remove`);
    if(selector.selection==="manual") throw new DomainEvaluationError(`${label}.selector.selection must be automatic when removing effects`);
    const when=testOutcomePredicate(operation.when,`${label}.when`);
    return {kind:"effect.remove",selector:{...selector,from:"effects"},...(when?{when}:{})};
  }
  if(operation.kind==="condition.apply"||operation.kind==="condition.remove") {
    supportedKeys(operation,CONDITION_CHANGE_KEYS,label);
    const condition=nonEmptyString(operation.condition,`${label}.condition`) as ConditionId;
    if(!(condition in SRD_521_CONDITIONS)) throw new DomainEvaluationError(`${label}.condition is not a registered SRD condition: ${condition}`);
    const target=conditionTarget(operation.target,`${label}.target`);
    const when=testOutcomePredicate(operation.when,`${label}.when`);
    return {kind:operation.kind,condition,...(target===undefined?{}:{target}),...(when?{when}:{})};
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
  if(operation.kind==="resource.recharge") {
    supportedKeys(operation,RESOURCE_RECHARGE_KEYS,label);
    const resource=nonEmptyString(operation.resource,`${label}.resource`);
    const die=object(operation.die,`${label}.die`);
    supportedKeys(die,RECHARGE_DIE_KEYS,`${label}.die`);
    if(!Number.isInteger(die.sides)||Number(die.sides)<2||Number(die.sides)>20) throw new DomainEvaluationError(`${label}.die.sides must be an integer between 2 and 20`);
    const succeedsOn=object(operation.succeedsOn,`${label}.succeedsOn`);
    supportedKeys(succeedsOn,RECHARGE_RANGE_KEYS,`${label}.succeedsOn`);
    if(!Number.isInteger(succeedsOn.minimum)) throw new DomainEvaluationError(`${label}.succeedsOn.minimum must be an integer`);
    if(succeedsOn.maximum!==undefined&&!Number.isInteger(succeedsOn.maximum)) throw new DomainEvaluationError(`${label}.succeedsOn.maximum must be an integer`);
    const minimum=Number(succeedsOn.minimum);
    const maximum=succeedsOn.maximum===undefined?undefined:Number(succeedsOn.maximum);
    const upper=maximum??Number(die.sides);
    if(minimum<1||upper>Number(die.sides)||minimum>upper) throw new DomainEvaluationError(`${label}.succeedsOn must fit within the recharge die`);
    return {kind:"resource.recharge",resource,die:{sides:Number(die.sides)},succeedsOn:{minimum,...(maximum===undefined?{}:{maximum})}};
  }
  if(operation.kind==="damage.apply") {
    supportedKeys(operation,DAMAGE_APPLY_KEYS,label);
    let amount:LiteralNumberExpression|string;
    if(typeof operation.amount==="string") {
      parseCommonPlayDamageDiceFormula(operation.amount,`${label}.amount`);
      amount=operation.amount.trim();
    } else amount=nonNegativeLiteralExpression(operation.amount,`${label}.amount`);
    const multiplier=operation.multiplier;
    if(multiplier!==undefined&&(typeof multiplier!=="number"||!Number.isFinite(multiplier)||multiplier<0)) throw new DomainEvaluationError(`${label}.multiplier must be a finite non-negative number`);
    const when=testOutcomePredicate(operation.when,`${label}.when`);
    return {
      kind:"damage.apply",
      amount,
      damageType:nonEmptyString(operation.damageType,`${label}.damageType`),
      ...(multiplier===undefined?{}:{multiplier}),
      ...(operation.target===undefined?{}:{target:hpTarget(operation.target,`${label}.target`)}),
      ...(when?{when}:{}),
    };
  }
  if(operation.kind==="healing.apply") {
    supportedKeys(operation,HEALING_APPLY_KEYS,label);
    if(typeof operation.amount==="string") {
      throw new DomainEvaluationError(`${label}.amount healing dice are not supported by this Common Play HP slice`);
    }
    return {
      kind:"healing.apply",
      amount:nonNegativeLiteralExpression(operation.amount,`${label}.amount`),
      ...(operation.target===undefined?{}:{target:hpTarget(operation.target,`${label}.target`)}),
    };
  }
  if(operation.kind==="temp-hp.grant") {
    supportedKeys(operation,TEMP_HP_GRANT_KEYS,label);
    const choice=operation.choice;
    if(choice!==undefined&&choice!=="keep-existing"&&choice!=="take-new") throw new DomainEvaluationError(`${label}.choice must be keep-existing or take-new`);
    return {
      kind:"temp-hp.grant",
      amount:nonNegativeLiteralExpression(operation.amount,`${label}.amount`),
      ...(operation.target===undefined?{}:{target:hpTarget(operation.target,`${label}.target`)}),
      ...(choice===undefined?{}:{choice}),
    };
  }
  if(operation.kind==="life.stabilize") {
    supportedKeys(operation,LIFE_STABILIZE_KEYS,label);
    return {kind:"life.stabilize",...(operation.target===undefined?{}:{target:hpTarget(operation.target,`${label}.target`)})};
  }
  throw new DomainEvaluationError(`unsupported Common Play operation: ${String(operation.kind)}`);
}

function parseD20ModifierProperty(value:unknown,label:string):CommonPlayD20ModifierProperty|undefined {
  if(value===undefined) return undefined;
  if(typeof value==="string") return nonEmptyString(value,label);
  const choice=object(value,label);
  supportedKeys(choice,new Set(["choose","from"]),label);
  if(choice.choose!=="highest") throw new DomainEvaluationError(`${label}.choose must be highest`);
  if(!Array.isArray(choice.from)||choice.from.length<2) throw new DomainEvaluationError(`${label}.from requires at least two property candidates`);
  const from=choice.from.map((candidate,index)=>nonEmptyString(candidate,`${label}.from[${index}]`));
  if(new Set(from).size!==from.length) throw new DomainEvaluationError(`${label}.from must not contain duplicate property candidates`);
  return {choose:"highest",from};
}

function parseD20Test(value:unknown,label:string):CommonPlayD20TestDefinition {
  const definition=object(value,label);
  supportedKeys(definition,D20_TEST_KEYS,label);
  if(definition.kind!=="ability-check"&&definition.kind!=="saving-throw"&&definition.kind!=="attack-roll") throw new DomainEvaluationError(`${label}.kind is unsupported`);
  if(definition.roller!=="actor"&&definition.roller!=="target") throw new DomainEvaluationError(`${label}.roller must be actor or target for portable Common Play d20`);
  const property=parseD20ModifierProperty(definition.property,`${label}.property`);
  if(definition.roller==="target"&&!property) throw new DomainEvaluationError(`${label}.property is required for a target-rolled portable Common Play d20 test`);
  if(definition.perTarget!==undefined&&definition.perTarget!==false) throw new DomainEvaluationError(`${label}.perTarget must be false for a single portable Common Play d20 test`);
  return {kind:definition.kind,roller:definition.roller,...(property?{property}:{}),dc:literalExpression(definition.dc,`${label}.dc`),...(definition.perTarget===false?{perTarget:false}:{})};
}

export function parseCommonPlayOperationDefinition(value:unknown,label="Common Play definition"):CommonPlayOperationDefinition {
  const definition=object(value,label);
  supportedKeys(definition,DEFINITION_KEYS,label);
  if(definition.schemaVersion!=="0.2-draft") throw new DomainEvaluationError(`${label}.schemaVersion must be 0.2-draft`);
  const id=nonEmptyString(definition.id,`${label}.id`);
  const payments=parseCommonPlayPayments(definition.payments,`${label}.payments`);
  if(!Array.isArray(definition.entryPoints)||!definition.entryPoints.length) throw new DomainEvaluationError(`${label}.entryPoints must be a non-empty array`);
  const entryPoints:CommonPlayOperationDefinition["entryPoints"]=definition.entryPoints.map((value,index)=>{
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
      ...(entry.interaction===undefined?{}:{interaction:parseCommonPlayInteraction(entry.interaction,`${label}.entryPoints[${index}].interaction`)}),
      ...(entry.targeting===undefined?{}:{targeting:parseTargetingSelector(entry.targeting,`${label}.entryPoints[${index}].targeting`)}),
      ...(entry.allocation===undefined?{}:{allocation:parseAllocation(entry.allocation,`${label}.entryPoints[${index}].allocation`)}),
      ...(entry.test===undefined?{}:{test:parseD20Test(entry.test,`${label}.entryPoints[${index}].test`)}),
      operations:entry.operations.map((operation,operationIndex)=>parseOperation(operation,`${label}.entryPoints[${index}].operations[${operationIndex}]`)),
    };
  });
for(const [index,entryPoint] of entryPoints.entries()) {
  if((entryPoint.targeting?.max??1)>1&&entryPoint.operations.some((operation)=>(operation.kind==="damage.apply"||operation.kind==="healing.apply"||operation.kind==="temp-hp.grant"||operation.kind==="life.stabilize")&&operation.target==="target")) {
    throw new DomainEvaluationError(`${label}.entryPoints[${index}] multi-target selection requires an explicit per-target effect contract`);
  }
}
for(const [index,entryPoint] of entryPoints.entries()) {
  if(entryPoint.test?.roller==="target"&&(!entryPoint.targeting||entryPoint.targeting.min!==1||entryPoint.targeting.max!==1)) throw new DomainEvaluationError(`${label}.entryPoints[${index}] target-rolled d20 requires targeting exactly one target`);
  if(entryPoint.operations.some((operation)=>(operation.kind==="condition.apply"||operation.kind==="condition.remove"||operation.kind==="effect.remove"||operation.kind==="damage.apply")&&operation.when)&&!entryPoint.test) throw new DomainEvaluationError(`${label}.entryPoints[${index}] test.outcome conditional operation requires a d20 test`);
}
const reactionPaymentCount=payments?.filter((payment)=>payment.kind==="economy"&&payment.bucket==="reaction").length??0;
  const interactionCount=entryPoints.filter((entry)=>entry.interaction).length;
  if(interactionCount>0&&reactionPaymentCount!==1) {
    throw new DomainEvaluationError(`${label} portable consent interaction requires exactly one Reaction economy payment`);
  }
  if(reactionPaymentCount>0&&interactionCount!==entryPoints.length) {
    throw new DomainEvaluationError(`${label} Reaction economy payment requires every entry point to use the bounded consent interaction`);
  }
  return {schemaVersion:"0.2-draft",id,...(payments?{payments}:{}),entryPoints};
}

export function parseManualCommonPlayOperationDefinition(value:unknown,label="Common Play definition"):CommonPlayOperationDefinition {
  const definition=parseCommonPlayOperationDefinition(value,label);
  const nonManual=definition.entryPoints.find((entry)=>entry.invocation!=="manual");
  if(nonManual) throw new DomainEvaluationError(`${label} supports manual entry points only: ${nonManual.invocation}`);
  return definition;
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

function commonPlayD20Ability(property:CommonPlayD20ModifierProperty|undefined):CommonPlayD20Ability|undefined {
  if(typeof property!=="string") return undefined;
  const match=property.match(/^(?:save|ability)\.(str|dex|con|int|wis|cha)\.(?:modifier|score)$/);
  return match?.[1] as CommonPlayD20Ability|undefined;
}

export function compileCommonPlayPayments(
  payments:CommonPlayPayment[]|undefined,
  input:CommonPlayOperationExecutionInput,
):ResolutionOperation[] {
  const operations:ResolutionOperation[]=[];
  for(const {payment,index} of (payments??[])
    .map((payment,index)=>({payment,index}))
    .sort((left,right)=>Number(right.payment.kind==="economy")-Number(left.payment.kind==="economy"))) {
    if(payment.kind==="economy") {
      operations.push({
        id:`${input.resolutionId}:payment:${index}`,kind:"use-economy",actorId:input.actorId,slot:payment.bucket,
        bonusActionGranted:payment.bucket==="bonus-action"||undefined,actionKind:input.actionKind,
      });
      continue;
    }
    const resourceId=payment.kind==="resource"?payment.resource:input.itemPaymentResourceIds?.[index];
    if(!resourceId) throw new DomainEvaluationError(`Common Play item payment ${index} requires one pre-resolved item stack`);
    operations.push({
      id:`${input.resolutionId}:payment:${index}`,kind:"spend-resource",actorId:input.actorId,resourceId,
      amount:literalInteger(payment.kind==="resource"?payment.amount:payment.quantity,payment.kind==="resource"?"resource payment amount":"item payment quantity"),
    });
  }
  return operations;
}

function hpOperationTarget(target:CommonPlayHpTarget|undefined,input:CommonPlayOperationExecutionInput) {
  if(target===undefined||target==="actor"||target==="self") return input.actorId;
  if(!input.targetId) throw new DomainEvaluationError("Common Play target HP operation requires one pre-resolved target");
  return input.targetId;
}

function conditionOperationTarget(target:CommonPlayConditionTarget|undefined,input:CommonPlayOperationExecutionInput) {
  if(target===undefined||target==="actor"||target==="self") return input.actorId;
  if(!input.targetId) throw new DomainEvaluationError("Common Play target condition operation requires one pre-resolved target");
  return input.targetId;
}

function targetingSelectorCandidate(target:TargetingFactInput) {
  return {
    id:target.id,
    targeting:{...target},
    properties:{
      id:target.id,
      kind:target.kind,
      relation:target.relation,
      ...(target.distanceFeet===undefined?{}:{distanceFeet:target.distanceFeet}),
      ...(target.visible===undefined?{}:{visible:target.visible}),
      ...(target.cover===undefined?{}:{cover:target.cover}),
    },
  };
}

export function compileCommonPlayEntryPointOperations(
  profile:RulesProfileLike,
  state:RulesRuntimeState,
  definition:CommonPlayOperationDefinition,
  input:CommonPlayOperationExecutionInput,
):PendingResolution {
  const supported=parseManualCommonPlayOperationDefinition(definition);
  const entryPoint=supported.entryPoints.find((entry)=>entry.id===input.entryPointId);
  if(!entryPoint) throw new DomainEvaluationError(`Common Play entry point not found: ${input.entryPointId}`);
  if(entryPoint.interaction) {
    if(!input.interactionResponse) throw new DomainEvaluationError(`Common Play entry point ${entryPoint.id} requires interaction authorization`);
    if(input.interactionResponse.interactionId!==entryPoint.interaction.id) throw new DomainEvaluationError("Common Play interaction authorization identity mismatch");
    if(entryPoint.interaction.kind==="consent") {
      if(!("accepted" in input.interactionResponse)||input.interactionResponse.accepted!==true) throw new DomainEvaluationError("Common Play consent interaction authorization must be accepted");
    } else {
      if(!("selectedIds" in input.interactionResponse)) throw new DomainEvaluationError("Common Play choice interaction requires selected identities");
      const responder=entryPoint.interaction.responder;
      const authority=responder==="dm"?"dm":responder==="host"?"host":responder==="target"||responder==="target-owner"?"target-owner":"actor-owner";
      const choiceResolution=resolveCommonPlaySelector({
        sourceId:input.actorId,
        selector:entryPoint.interaction.input.selector,
        candidates:input.targetingCandidates??[],
        selectedIds:[...input.interactionResponse.selectedIds],
        selection:"manual",
        authority,
      });
      if(choiceResolution.status!=="resolved") throw new DomainEvaluationError(`Common Play choice selector rejected: ${choiceResolution.reason}`);
    }
  }

  const operations:ResolutionOperation[]=[];
  const materializedResourceIds=new Set(state.combatants[input.actorId]?.resources.map((resource)=>resource.id)??[]);
  if(entryPoint.targeting) {
    if(!input.targetingTargets) throw new DomainEvaluationError(`Common Play entry point ${entryPoint.id} requires pre-resolved targeting facts`);
    if(input.targetId!==undefined&&!input.targetingTargets.some((target)=>target.id===input.targetId)) {
      throw new DomainEvaluationError("Common Play downstream target does not match the validated targeting selection");
    }
    const selectorResolution=resolveCommonPlaySelector({
      sourceId:input.actorId,
      selector:entryPoint.targeting,
      candidates:input.targetingCandidates??input.targetingTargets.map(targetingSelectorCandidate),
      selectedIds:input.targetingTargets.map((target)=>target.id),
      selection:"manual",
      authority:"actor-owner",
      directTarget:false,
    });
    if(selectorResolution.status!=="resolved") throw new DomainEvaluationError(`Common Play targeting selector rejected: ${selectorResolution.reason}`);
    operations.push({
      id:`${input.resolutionId}:targeting`,
      kind:"targeting",
      sourceId:input.actorId,
      rule:{kind:"creature",minTargets:entryPoint.targeting.min,maxTargets:entryPoint.targeting.max,directTarget:false},
      targets:input.targetingTargets.map((target)=>({...target})),
    });
  }
  operations.push(...compileCommonPlayPayments(supported.payments,input));
  if(entryPoint.test) {
    if(!input.d20) throw new DomainEvaluationError(`Common Play entry point ${entryPoint.id} requires authoritative d20 input`);
    const rollerId=entryPoint.test.roller==="target"?input.targetId:input.actorId;
    if(!rollerId) throw new DomainEvaluationError(`Common Play entry point ${entryPoint.id} target roller requires one pre-resolved target`);
    const rollModifications: D20RollModification[]=entryPoint.operations.flatMap((operation,index)=>{
      if(operation.kind!=="roll.modify") return [];
      const source=`common-play:${supported.id}:${entryPoint.id}:operation:${index}`;
      if(operation.mode==="advantage"||operation.mode==="disadvantage") return [{source,mode:operation.mode}];
      if(operation.mode==="add-flat"||operation.mode==="target-add"||operation.mode==="replace"||operation.mode==="minimum") {
        return [{source,mode:operation.mode,value:literalInteger(operation.value,`${operation.mode} value`)}];
      }
      const formula=parseCommonPlayDamageDiceFormula(operation.dice!,`${operation.mode} dice`);
      if(operation.mode==="reroll"&&(formula.count!==1||formula.sides!==20||formula.flat!==0)) {
        throw new DomainEvaluationError("reroll requires exactly 1d20");
      }
      const faces=input.d20!.modifierDiceFaces?.[index];
      const exactModifierDice=operation.mode==="add-die"||operation.mode==="subtract-die";
      if(!faces||(exactModifierDice?faces.length!==formula.count:faces.length<formula.count)) {
        throw new DomainEvaluationError(`Common Play roll modifier ${index} requires authoritative die face(s)`);
      }
      const dice={id:`${input.resolutionId}:roll-modifier:${index}`,purpose:source,sides:formula.sides,faces:[...faces]};
      const result:D20RollModification[]=[{source,mode:operation.mode,dice}];
      if(formula.flat!==0) result.push({source:`${source}:flat`,mode:"add-flat",value:operation.mode==="subtract-die"?-formula.flat:formula.flat});
      return result;
    });
    const conditionAbility=input.d20.ability??commonPlayD20Ability(entryPoint.test.property);
    const selectedTargetFacts=input.targetId
      ? input.targetingTargets?.find((target)=>target.id===input.targetId)
      : undefined;
    const attackCoverTargetModifier=entryPoint.test.kind==="attack-roll"
      ?selectedTargetFacts?.cover==="half"?2:selectedTargetFacts?.cover==="three-quarters"?5:0
      :0;
    if(entryPoint.test.kind==="attack-roll"&&selectedTargetFacts?.cover==="total") {
      throw new DomainEvaluationError("Common Play attack-roll target has total cover");
    }
    const conditionContext={
      ...(conditionAbility?{ability:conditionAbility}:{}),
      ...(selectedTargetFacts?.distanceFeet===undefined?{}:{distanceToTargetFeet:selectedTargetFacts.distanceFeet}),
    };
    operations.push({
      id:`${input.resolutionId}:test`,
      kind:"d20",
      actorId:rollerId,
      targetId:entryPoint.test.roller==="target"?input.actorId:input.d20.targetId,
      ...(Object.keys(conditionContext).length?{condition:conditionContext}:{}),
      request:{
        family:entryPoint.test.kind,
        target:literalInteger(entryPoint.test.dc,"d20 target")+attackCoverTargetModifier,
        targetSource:`common-play:${supported.id}:${entryPoint.id}:dc${attackCoverTargetModifier?":cover":""}`,
        modifierContributions:input.d20.modifierContributions??[],
        rollStateContributions:input.d20.rollStateContributions,
        ...(rollModifications.length?{rollModifications}:{}),
        dice:{
          id:`${input.resolutionId}:d20`,
          purpose:`common-play:${supported.id}:${entryPoint.id}:${entryPoint.test.kind}`,
          sides:20,
          faces:[...input.d20.faces],
        },
      },
    });
  }
  for(const [index,operation] of entryPoint.operations.entries()) {
    const operationId=`${input.resolutionId}:operation:${index}`;
    if(operation.kind==="roll.modify") continue;
    if(operation.kind==="property.modify") {
    const targetId=operation.target==="actor"?input.actorId:input.targetId;
    if(!targetId) throw new DomainEvaluationError("Common Play target property modifier requires one pre-resolved target");
    const duration=operation.duration.unit==="days"
      ? {kind:"hours" as const,amount:operation.duration.amount.value*24}
      : {kind:operation.duration.unit,amount:operation.duration.amount.value};
    operations.push({
      id:operationId,
      kind:"apply-effect",
      effect:{
        id:`${operationId}:effect`,
        sourceId:`common-play:${supported.id}:${entryPoint.id}:operation:${index}`,
        sourceActorId:input.actorId,
        targetId,
        kind:"modifier",
        tags:["common-play:property-modifier"],
        duration,
        propertyModifier:{
          property:operation.property,
          operation:operation.operation,
          value:structuredClone(operation.value) as ExpressionNode,
          source:"definition",
          instancePolicy:operation.instancePolicy,
        },
      },
    });
    continue;
  }
    if(operation.kind==="resource.recharge") {
      const faces=input.rechargeDiceFaces?.[index];
      if(!faces||faces.length!==1) throw new DomainEvaluationError(`Common Play recharge operation ${index} requires exactly one authoritative die face`);
      operations.push({
        id:operationId,kind:"recharge-resource",actorId:input.actorId,resourceId:operation.resource,timing:"turn-start",
        die:{sides:operation.die.sides,faces:[faces[0]]},succeedsOn:{...operation.succeedsOn},
      });
      continue;
    }
    if(operation.kind==="resource.change") {
      if(operation.target!==undefined&&operation.target!=="actor"&&operation.target!=="self"&&operation.target!==input.actorId) {
        throw new DomainEvaluationError("Common Play resource.change currently supports the acting actor only");
      }
      const amount=literalInteger(operation.amount,"resource.change amount");
      const shouldCreate=amount>0&&Boolean(operation.createIfMissing)&&!materializedResourceIds.has(operation.resource);
      if(shouldCreate) materializedResourceIds.add(operation.resource);
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
        ...(shouldCreate&&operation.createIfMissing?{
          maximumDelta:literalInteger(operation.createIfMissing.maximum,"resource.change createIfMissing maximum"),
          createIfMissing:{
            label:operation.createIfMissing.label,
            ...(operation.createIfMissing.recovery?{recovery:structuredClone(operation.createIfMissing.recovery)}:{}),
          },
        }:operation.maximumDelta?{
          maximumDelta:literalInteger(operation.maximumDelta,"resource.change maximumDelta"),
          temporaryCapacityUntilLongRest:operation.temporaryCapacityUntilLongRest,
        }:{}),
      });
      continue;
    }

    if(operation.kind==="effect.remove") {
      const when=operation.when?{operationId:`${input.resolutionId}:test`,field:"outcome" as const,equals:operation.when.right.value}:undefined;
      const candidates=state.effects.filter(effectIsActive).map((effect)=>({
        id:effect.id,
        properties:{
          tags:[...effect.tags],
          targetId:effect.targetId,
          sourceId:effect.sourceId,
          kind:effect.kind,
          "target.selected":input.targetId!==undefined&&effect.targetId===input.targetId,
          "target.actor":effect.targetId===input.actorId,
          ...(effect.sourceActorId?{sourceActorId:effect.sourceActorId}:{}),
          ...(effect.conditionId?{conditionId:effect.conditionId}:{}),
        },
      }));
      const selected=resolveCommonPlaySelector({sourceId:input.actorId,selector:operation.selector,candidates,selection:"automatic",authority:"host"});
      if(selected.status!=="resolved") throw new DomainEvaluationError(`Common Play effect.remove selector rejected: ${selected.reason}`);
      selected.targetIds.forEach((effectId,removeIndex)=>operations.push({id:`${operationId}:remove:${removeIndex}`,kind:"remove-effect",effectId,...(when?{when}:{})}));
      continue;
    }

    if(operation.kind==="condition.apply"||operation.kind==="condition.remove") {
      const targetId=conditionOperationTarget(operation.target,input);
      const when=operation.when?{operationId:`${input.resolutionId}:test`,field:"outcome",equals:operation.when.right.value}:undefined;
      if(operation.kind==="condition.apply") {
        operations.push({
          id:operationId,kind:"apply-effect",...(when?{when}:{}),
          effect:{id:`${operationId}:condition:${operation.condition}`,sourceId:`common-play:${supported.id}:${entryPoint.id}:operation:${index}`,sourceActorId:input.actorId,targetId,kind:"condition",conditionId:operation.condition,tags:["common-play:condition",`condition:${operation.condition}`],duration:{kind:"permanent"}},
        });
      } else {
        const effect=[...state.effects].reverse().find((entry)=>entry.targetId===targetId&&entry.conditionId===operation.condition);
        if(!effect) throw new DomainEvaluationError(`Common Play condition.remove found no ${operation.condition} Effect on ${targetId}`);
        operations.push({id:operationId,kind:"remove-effect",effectId:effect.id,...(when?{when}:{})});
      }
      continue;
    }

    if(operation.kind==="damage.apply") {
      const when=operation.when?{operationId:`${input.resolutionId}:test`,field:"outcome" as const,equals:operation.when.right.value}:undefined;
      const targetId=hpOperationTarget(operation.target,input);
      const creatureKind=input.creatureKinds?.[targetId];
      if(!creatureKind) throw new DomainEvaluationError(`Common Play damage target is not a classified runtime combatant: ${targetId}`);
      const multiplier=operation.multiplier;
      const rounding=multiplier===undefined?undefined:profile.roundingPolicy?.default;
      if(multiplier!==undefined&&!rounding) throw new DomainEvaluationError("damage.apply multiplier requires a RulesProfile rounding policy");
      let amount:number|{operationId:string;field:"total";multiplier?:number;rounding?:"floor"|"ceil"|"round"};
      if(typeof operation.amount==="string") {
        const formula=parseCommonPlayDamageDiceFormula(operation.amount);
        const rollId=`${operationId}:roll`;
        const faces=input.damageDiceFaces?.[index];
        if(!faces) throw new DomainEvaluationError(`Common Play damage operation ${index} requires authoritative dice input`);
        operations.push({
          id:rollId,
          kind:"damage-roll",
          ...(when?{when}:{}),
          request:{
            dice:[{
              source:`common-play:${supported.id}:${entryPoint.id}:operation:${index}`,
              sides:formula.sides,
              count:formula.count,
              faces:[...faces],
            }],
            ...(formula.flat===0?{}:{flat:[{
              source:`common-play:${supported.id}:${entryPoint.id}:operation:${index}:flat`,
              value:formula.flat,
            }]}),
          },
        });
        amount={operationId:rollId,field:"total",...(multiplier===undefined?{}:{multiplier,rounding})};
      } else {
        const literal=literalInteger(operation.amount,"damage.apply amount");
        if(multiplier===undefined) amount=literal;
        else {
          const scaled=literal*multiplier;
          amount=rounding==="ceil"?Math.ceil(scaled):rounding==="round"?Math.round(scaled):Math.floor(scaled);
        }
      }
      operations.push({
        id:operationId,
        kind:"damage",
        ...(when?{when}:{}),
        targetId,
        damageType:operation.damageType,
        amount,
        creatureKind,
      });
      continue;
    }

    if(operation.kind==="healing.apply") {
      operations.push({
        id:operationId,
        kind:"healing",
        targetId:hpOperationTarget(operation.target,input),
        amount:literalInteger(operation.amount,"healing.apply amount"),
      });
      continue;
    }

    if(operation.kind==="temp-hp.grant") {
      operations.push({
        id:operationId,
        kind:"temporary-hp",
        targetId:hpOperationTarget(operation.target,input),
        amount:literalInteger(operation.amount,"temp-hp.grant amount"),
        source:`common-play:${supported.id}:${entryPoint.id}:operation:${index}`,
        ...(operation.choice===undefined?{}:{choice:operation.choice}),
      });
      continue;
    }

    if(operation.kind==="life.stabilize") {
      operations.push({id:operationId,kind:"stabilize",targetId:hpOperationTarget(operation.target,input)});
      continue;
    }

    if(operation.kind==="movement.grant") {
      const properties=input.movementProperties??{};
      const resolveReference=(property:string)=>{
        const value=properties[property];
        if(!Number.isFinite(value)) throw new DomainEvaluationError(`movement.grant property is unavailable: ${property}`);
        return Number(value);
      };
      const distance=evaluateExpression(operation.distance as ExpressionNode,resolveReference);
      const maximumDistance=evaluateExpression((operation.maximumDistance??operation.distance) as ExpressionNode,resolveReference);
      if(!Number.isFinite(distance)||distance<0) throw new DomainEvaluationError("movement.grant distance must be a non-negative finite number");
      if(!Number.isFinite(maximumDistance)||maximumDistance<0) throw new DomainEvaluationError("movement.grant maximumDistance must be a non-negative finite number");
      operations.push({
        id:operationId,
        kind:"free-move",
        actorId:input.actorId,
        distanceFeet:distance,
        maximumDistanceFeet:maximumDistance,
        ...(operation.doesNotProvokeOpportunityAttacks===true?{doesNotProvokeOpportunityAttacks:true}:{}),
      });
      continue;
    }
    if(operation.kind==="movement.stand") {
      const actor=state.combatants[input.actorId];
      if(!actor) throw new DomainEvaluationError(`combatant not found: ${input.actorId}`);
      const conditions=conditionEffectsFor(state,input.actorId);
      const proneEffects=state.effects.filter((effect)=>
        effectIsActive(effect)&&effect.targetId===input.actorId&&effect.kind==="condition"&&effect.conditionId==="prone"
      );
      if(!proneEffects.length) throw new DomainEvaluationError("movement.stand requires an active explicit Prone condition");
      const speed=effectiveSpeed(actor.economy.movementMaximum,conditions);
      const cost=proneStandingCost(speed,conditions);
      if(cost<=0) throw new DomainEvaluationError("movement.stand requires positive effective speed");
      operations.push({id:operationId,kind:"move",actorId:input.actorId,distanceFeet:cost,distanceTraveledFeet:0,movementActivity:"stand"});
      proneEffects.forEach((effect,proneIndex)=>operations.push({id:`${operationId}:remove-prone:${proneIndex}`,kind:"remove-effect",effectId:effect.id}));
      continue;
    }
    if(operation.kind==="movement.relocate") {
      const movementTargetId=operation.target==="target"?input.targetId:input.actorId;
      if(!movementTargetId) throw new DomainEvaluationError("Common Play target movement requires one pre-resolved target");
      const authoredSubject=operation.destinationFact!.subject;
      const subject=authoredSubject==="actor"||authoredSubject==="self"?input.actorId:authoredSubject==="target"?movementTargetId:authoredSubject;
      const definition={...operation,target:movementTargetId,destinationFact:{...operation.destinationFact!,subject}};
      const compiled=compileCommonPlayMovement({id:operationId,definition,answer:input.movementFactAnswers?.[index],properties:input.movementProperties});
      if(compiled.status!=="compiled") throw new DomainEvaluationError(compiled.reason);
      const when=operation.when?{operationId:`${input.resolutionId}:test`,field:"outcome" as const,equals:operation.when.right.value}:undefined;
      operations.push({...compiled.operation,...(when?{when}:{})});
      continue;
    }

    if(operation.kind!=="economy.modify") throw new DomainEvaluationError("unexpected Common Play operation before economy.modify");
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
