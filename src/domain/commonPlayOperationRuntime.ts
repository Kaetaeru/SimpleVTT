import type { RulesRuntimeState } from "./combatState";
import type { D20RollModification, D20TestFamily, ModifierContribution } from "./d20";
import { DomainEvaluationError, type RollStateContribution, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import type { TargetingFactInput } from "./targeting";
import type { ActionUseKind, TurnSlot } from "./turnEconomy";

type LiteralNumberExpression={value:number};
type CommonPlayExpression=LiteralNumberExpression|Record<string,unknown>;
type CommonPlayHpTarget="actor"|"self"|"target";

export interface CommonPlayTargetingSelector {
  from:"targets";
  min:1;
  max:1;
}

export interface CommonPlayConsentInteraction {
  id:string;
  kind:"consent";
  responder:"actor";
  mode:"blocking";
  input:{type:"boolean"};
  revalidate:"always";
}

export interface CommonPlayDamageDiceFormula {
  count:number;
  sides:number;
  flat:number;
}

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

type CommonPlayDamageApply={
  kind:"damage.apply";
  amount:LiteralNumberExpression|string;
  damageType:string;
  target?:CommonPlayHpTarget;
};

type CommonPlayHealingApply={
  kind:"healing.apply";
  amount:LiteralNumberExpression;
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

export type CommonPlayPayment=CommonPlayResourcePayment|CommonPlayEconomyPayment;

export type CommonPlayOperation=
  |CommonPlayResourceChange
  |CommonPlayEconomyModify
  |CommonPlayDamageApply
  |CommonPlayHealingApply
  |CommonPlayRollModify;

export interface CommonPlayD20TestDefinition {
  kind:D20TestFamily;
  roller:"actor";
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
    interaction?:CommonPlayConsentInteraction;
    targeting?:CommonPlayTargetingSelector;
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
    modifierContributions?:ModifierContribution[];
    rollStateContributions?:RollStateContribution[];
    modifierDiceFaces?:Record<number,number[]>;
  };
  targetId?:string;
  targetingTargets?:TargetingFactInput[];
  creatureKinds?:Record<string,"character"|"monster">;
  damageDiceFaces?:Record<number,number[]>;
  interactionResponse?:{
    interactionId:string;
    accepted:true;
  };
  actionKind?:ActionUseKind;
}

type Obj=Record<string,unknown>;
const DEFINITION_KEYS=new Set(["$schema","schemaVersion","id","payments","entryPoints"]);
const RESOURCE_PAYMENT_KEYS=new Set(["kind","resource","amount","consumeAt"]);
const ECONOMY_PAYMENT_KEYS=new Set(["kind","bucket","amount","consumeAt","refundOnCancel"]);
const ENTRY_POINT_KEYS=new Set(["id","invocation","interaction","targeting","test","operations"]);
const INTERACTION_KEYS=new Set(["id","kind","responder","mode","input","revalidate"]);
const INTERACTION_INPUT_KEYS=new Set(["type"]);
const TARGETING_KEYS=new Set(["from","min","max"]);
const D20_TEST_KEYS=new Set(["kind","roller","property","dc","perTarget"]);
const RESOURCE_CHANGE_KEYS=new Set(["kind","resource","amount","target"]);
const ECONOMY_MODIFY_KEYS=new Set(["kind","bucket","amount"]);
const DAMAGE_APPLY_KEYS=new Set(["kind","amount","damageType","target"]);
const HEALING_APPLY_KEYS=new Set(["kind","amount","target"]);
const ROLL_MODIFY_KEYS=new Set(["kind","mode","value","dice"]);
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

function parseTargetingSelector(value:unknown,label:string):CommonPlayTargetingSelector {
  const selector=object(value,label);
  supportedKeys(selector,TARGETING_KEYS,label);
  if(selector.from!=="targets") throw new DomainEvaluationError(`${label}.from must be targets for portable Common Play targeting`);
  if(selector.min!==1||selector.max!==1) throw new DomainEvaluationError(`${label}.min and .max must both be 1 for portable Common Play targeting`);
  return {from:"targets",min:1,max:1};
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

function parseConsentInteraction(value:unknown,label:string):CommonPlayConsentInteraction {
  const interaction=object(value,label);
  supportedKeys(interaction,INTERACTION_KEYS,label);
  if(interaction.kind!=="consent") throw new DomainEvaluationError(`${label}.kind must be consent for portable Common Play interaction`);
  if(interaction.responder!=="actor") throw new DomainEvaluationError(`${label}.responder must be actor for portable Common Play interaction`);
  if(interaction.mode!=="blocking") throw new DomainEvaluationError(`${label}.mode must be blocking for portable Common Play interaction`);
  const input=object(interaction.input,`${label}.input`);
  supportedKeys(input,INTERACTION_INPUT_KEYS,`${label}.input`);
  if(input.type!=="boolean") throw new DomainEvaluationError(`${label}.input.type must be boolean for portable Common Play interaction`);
  if(interaction.revalidate!=="always") throw new DomainEvaluationError(`${label}.revalidate must be always for portable Common Play interaction`);
  return {
    id:nonEmptyString(interaction.id,`${label}.id`),
    kind:"consent",
    responder:"actor",
    mode:"blocking",
    input:{type:"boolean"},
    revalidate:"always",
  };
}

function parseOperation(value:unknown,label:string):CommonPlayOperation {
  const operation=object(value,label);
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
  if(operation.kind==="damage.apply") {
    supportedKeys(operation,DAMAGE_APPLY_KEYS,label);
    let amount:LiteralNumberExpression|string;
    if(typeof operation.amount==="string") {
      parseCommonPlayDamageDiceFormula(operation.amount,`${label}.amount`);
      amount=operation.amount.trim();
    } else amount=nonNegativeLiteralExpression(operation.amount,`${label}.amount`);
    return {
      kind:"damage.apply",
      amount,
      damageType:nonEmptyString(operation.damageType,`${label}.damageType`),
      ...(operation.target===undefined?{}:{target:hpTarget(operation.target,`${label}.target`)}),
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
  throw new DomainEvaluationError(`unsupported Common Play operation: ${String(operation.kind)}`);
}

function parseD20Test(value:unknown,label:string):CommonPlayD20TestDefinition {
  const definition=object(value,label);
  supportedKeys(definition,D20_TEST_KEYS,label);
  if(definition.kind!=="ability-check"&&definition.kind!=="saving-throw"&&definition.kind!=="attack-roll") {
    throw new DomainEvaluationError(`${label}.kind is unsupported`);
  }
  if(definition.roller!=="actor") throw new DomainEvaluationError(`${label}.roller must be actor for portable Common Play d20`);
  if(definition.property!==undefined) throw new DomainEvaluationError(`${label}.property-backed modifiers are not supported by this Common Play d20 slice`);
  if(definition.perTarget!==undefined&&definition.perTarget!==false) throw new DomainEvaluationError(`${label}.perTarget must be false for an actor d20 test`);
  return {
    kind:definition.kind,
    roller:"actor",
    dc:literalExpression(definition.dc,`${label}.dc`),
    ...(definition.perTarget===false?{perTarget:false}:{}),
  };
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
      ...(entry.interaction===undefined?{}:{interaction:parseConsentInteraction(entry.interaction,`${label}.entryPoints[${index}].interaction`)}),
      ...(entry.targeting===undefined?{}:{targeting:parseTargetingSelector(entry.targeting,`${label}.entryPoints[${index}].targeting`)}),
      ...(entry.test===undefined?{}:{test:parseD20Test(entry.test,`${label}.entryPoints[${index}].test`)}),
      operations:entry.operations.map((operation,operationIndex)=>parseOperation(operation,`${label}.entryPoints[${index}].operations[${operationIndex}]`)),
    };
  });
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

export function compileCommonPlayPayments(
  payments:CommonPlayPayment[]|undefined,
  input:CommonPlayOperationExecutionInput,
):ResolutionOperation[] {
  return (payments??[])
    .map((payment,index)=>({payment,index}))
    .sort((left,right)=>Number(right.payment.kind==="economy")-Number(left.payment.kind==="economy"))
    .map(({payment,index})=>payment.kind==="economy"?{
      id:`${input.resolutionId}:payment:${index}`,
      kind:"use-economy" as const,
      actorId:input.actorId,
      slot:payment.bucket,
      bonusActionGranted:payment.bucket==="bonus-action"||undefined,
      actionKind:input.actionKind,
    }:{
      id:`${input.resolutionId}:payment:${index}`,
      kind:"spend-resource" as const,
      actorId:input.actorId,
      resourceId:payment.resource,
      amount:literalInteger(payment.amount,"resource payment amount"),
    });
}

function hpOperationTarget(target:CommonPlayHpTarget|undefined,input:CommonPlayOperationExecutionInput) {
  if(target===undefined||target==="actor"||target==="self") return input.actorId;
  if(!input.targetId) throw new DomainEvaluationError("Common Play target HP operation requires one pre-resolved target");
  return input.targetId;
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
    if(!input.interactionResponse) throw new DomainEvaluationError(`Common Play entry point ${entryPoint.id} requires accepted interaction authorization`);
    if(input.interactionResponse.interactionId!==entryPoint.interaction.id) throw new DomainEvaluationError("Common Play interaction authorization identity mismatch");
    if(input.interactionResponse.accepted!==true) throw new DomainEvaluationError("Common Play interaction authorization must be accepted");
  }

  const operations:ResolutionOperation[]=[];
  if(entryPoint.targeting) {
    if(!input.targetingTargets) throw new DomainEvaluationError(`Common Play entry point ${entryPoint.id} requires pre-resolved targeting facts`);
    if(input.targetingTargets.length===1&&input.targetId!==undefined&&input.targetId!==input.targetingTargets[0].id) {
      throw new DomainEvaluationError("Common Play downstream target does not match the validated targeting selection");
    }
    operations.push({
      id:`${input.resolutionId}:targeting`,
      kind:"targeting",
      sourceId:input.actorId,
      rule:{kind:"creature",minTargets:1,maxTargets:1,directTarget:false},
      targets:input.targetingTargets.map((target)=>({...target})),
    });
  }
  operations.push(...compileCommonPlayPayments(supported.payments,input));
  if(entryPoint.test) {
    if(!input.d20) throw new DomainEvaluationError(`Common Play entry point ${entryPoint.id} requires authoritative d20 input`);
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
    operations.push({
      id:`${input.resolutionId}:test`,
      kind:"d20",
      actorId:input.actorId,
      targetId:input.d20.targetId,
      request:{
        family:entryPoint.test.kind,
        target:literalInteger(entryPoint.test.dc,"d20 target"),
        targetSource:`common-play:${supported.id}:${entryPoint.id}:dc`,
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

    if(operation.kind==="damage.apply") {
      const targetId=hpOperationTarget(operation.target,input);
      const creatureKind=input.creatureKinds?.[targetId];
      if(!creatureKind) throw new DomainEvaluationError(`Common Play damage target is not a classified runtime combatant: ${targetId}`);
      let amount:number|{operationId:string;field:"total"};
      if(typeof operation.amount==="string") {
        const formula=parseCommonPlayDamageDiceFormula(operation.amount);
        const rollId=`${operationId}:roll`;
        const faces=input.damageDiceFaces?.[index];
        if(!faces) throw new DomainEvaluationError(`Common Play damage operation ${index} requires authoritative dice input`);
        operations.push({
          id:rollId,
          kind:"damage-roll",
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
        amount={operationId:rollId,field:"total"};
      } else amount=literalInteger(operation.amount,"damage.apply amount");
      operations.push({
        id:operationId,
        kind:"damage",
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
