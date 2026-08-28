import type { RulesRuntimeState } from "./combatState";
import type { D20TestFamily, ModifierContribution } from "./d20";
import { DomainEvaluationError, type RollStateContribution, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";

type LiteralNumberExpression={value:number};
type CommonPlayExpression=LiteralNumberExpression|Record<string,unknown>;
type CommonPlayHpTarget="actor"|"self"|"target";

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

type CommonPlayPayment={
  kind:"resource";
  resource:string;
  amount:CommonPlayExpression;
  consumeAt:"commit";
};

export type CommonPlayOperation=
  |CommonPlayResourceChange
  |CommonPlayEconomyModify
  |CommonPlayDamageApply
  |CommonPlayHealingApply;

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
  };
  targetId?:string;
  creatureKinds?:Record<string,"character"|"monster">;
  damageDiceFaces?:Record<number,number[]>;
}

type Obj=Record<string,unknown>;
const DEFINITION_KEYS=new Set(["$schema","schemaVersion","id","payments","entryPoints"]);
const PAYMENT_KEYS=new Set(["kind","resource","amount","consumeAt"]);
const ENTRY_POINT_KEYS=new Set(["id","invocation","test","operations"]);
const D20_TEST_KEYS=new Set(["kind","roller","property","dc","perTarget"]);
const RESOURCE_CHANGE_KEYS=new Set(["kind","resource","amount","target"]);
const ECONOMY_MODIFY_KEYS=new Set(["kind","bucket","amount"]);
const DAMAGE_APPLY_KEYS=new Set(["kind","amount","damageType","target"]);
const HEALING_APPLY_KEYS=new Set(["kind","amount","target"]);
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
  const payments=definition.payments===undefined?undefined:(()=>{
    if(!Array.isArray(definition.payments)) throw new DomainEvaluationError(`${label}.payments must be an array`);
    return definition.payments.map((payment,index)=>parsePayment(payment,`${label}.payments[${index}]`));
  })();
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
      ...(entry.test===undefined?{}:{test:parseD20Test(entry.test,`${label}.entryPoints[${index}].test`)}),
      operations:entry.operations.map((operation,operationIndex)=>parseOperation(operation,`${label}.entryPoints[${index}].operations[${operationIndex}]`)),
    };
  });
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

  const operations:ResolutionOperation[]=[...compilePayments(supported,input)];
  if(entryPoint.test) {
    if(!input.d20) throw new DomainEvaluationError(`Common Play entry point ${entryPoint.id} requires authoritative d20 input`);
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
