import type { ModifierContribution } from "./d20";
import type { AbilityKey } from "./conditions";
import type { RulesRuntimeState } from "./combatState";
import type { RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import type { TargetFacts } from "./targeting";

type LiteralNumberExpression = { value:number };
type SaveOutcome = "success"|"failure";
type SaveOutcomePredicate =
  | { op:"eq"; left:{ ref:"test.outcome" }; right:{ value:SaveOutcome } }
  | { op:"eq"; left:{ value:SaveOutcome }; right:{ ref:"test.outcome" } };

export interface CommonPlaySaveDamageDefinition {
  $schema?:string;
  schemaVersion:"0.2-draft";
  id:string;
  entryPoints:Array<{
    id:string;
    invocation:"manual"|"triggered"|"automatic"|"granted";
    targeting:{
      from:"targets";
      min?:number;
      max?:number;
    };
    test:{
      kind:"saving-throw";
      roller:"each-target";
      property:AbilityKey;
      dc:LiteralNumberExpression;
      perTarget?:boolean;
    };
    operations:Array<{
      kind:"damage.apply";
      amount:string;
      damageType:string;
      multiplier?:number;
      when?:SaveOutcomePredicate;
    }>;
  }>;
}

export interface CommonPlaySaveDamageTargetInput {
  facts:TargetFacts;
  creatureKind:"character"|"monster";
  save:{
    faces:number[];
    modifierContributions?:ModifierContribution[];
  };
}

export interface CommonPlaySaveDamageExecutionInput {
  resolutionId:string;
  actorId:string;
  entryPointId:string;
  targets:CommonPlaySaveDamageTargetInput[];
  damageFaces:number[];
}

interface ParsedDamageFormula {
  count:number;
  sides:number;
  flat:number;
}

interface NormalizedDamageOperation {
  damageType:string;
  amount:string;
  multiplier:number;
  outcome?:SaveOutcome;
}

const ABILITIES = new Set<AbilityKey>(["str","dex","con","int","wis","cha"]);

function rejected(state:RulesRuntimeState,error:string):Extract<ResolutionCommit,{status:"rejected"}> {
  return { status:"rejected", state, events:[], results:{}, error };
}

function assertOnlyKeys(value:object,allowed:readonly string[],label:string) {
  const unsupported=Object.keys(value).filter((key)=>!allowed.includes(key));
  if (unsupported.length) throw new Error(`${label} contains unsupported field(s): ${unsupported.join(", ")}`);
}

function literalNumber(expression:LiteralNumberExpression,label:string) {
  if (!expression||typeof expression!=="object"||!Number.isFinite(expression.value)) {
    throw new Error(`${label} requires a finite literal number`);
  }
  return expression.value;
}

function parseDamageFormula(formula:string):ParsedDamageFormula {
  const match=/^([0-9]+)d([0-9]+)([+-][0-9]+)?$/.exec(formula);
  if (!match) throw new Error(`unsupported Common Play damage formula: ${formula}`);
  const count=Number(match[1]);
  const sides=Number(match[2]);
  const flat=match[3]?Number(match[3]):0;
  if (!Number.isInteger(count)||count<0) throw new Error("damage dice count must be a non-negative integer");
  if (!Number.isInteger(sides)||sides<2) throw new Error("damage dice must have at least 2 sides");
  return { count, sides, flat };
}

function saveOutcomeFromPredicate(predicate:SaveOutcomePredicate|undefined,label:string):SaveOutcome|undefined {
  if (!predicate) return undefined;
  assertOnlyKeys(predicate,["op","left","right"],label);
  if (predicate.op!=="eq") throw new Error(`${label} supports only eq`);

  const left=predicate.left as Record<string,unknown>;
  const right=predicate.right as Record<string,unknown>;
  const leftIsRef=left.ref==="test.outcome";
  const rightIsRef=right.ref==="test.outcome";
  const value=leftIsRef?right.value:rightIsRef?left.value:undefined;
  if (leftIsRef===rightIsRef||(value!=="success"&&value!=="failure")) {
    throw new Error(`${label} must compare test.outcome with success or failure`);
  }
  assertOnlyKeys(left,leftIsRef?["ref"]:["value"],`${label} left expression`);
  assertOnlyKeys(right,rightIsRef?["ref"]:["value"],`${label} right expression`);
  return value;
}

function requireEntryPoint(definition:CommonPlaySaveDamageDefinition,entryPointId:string) {
  assertOnlyKeys(definition,["$schema","schemaVersion","id","entryPoints"],"Common Play definition");
  if (definition.schemaVersion!=="0.2-draft") throw new Error(`unsupported Common Play schema version: ${definition.schemaVersion}`);
  if (!definition.id) throw new Error("Common Play definition id is required");
  const entryPoint=definition.entryPoints.find((entry)=>entry.id===entryPointId);
  if (!entryPoint) throw new Error(`Common Play entry point not found: ${entryPointId}`);
  assertOnlyKeys(entryPoint,["id","invocation","targeting","test","operations"],`entry point ${entryPoint.id}`);
  if (entryPoint.targeting.from!=="targets") throw new Error("save-damage entry point requires a targets selector");
  assertOnlyKeys(entryPoint.targeting,["from","min","max"],`entry point ${entryPoint.id} targeting`);
  if (entryPoint.test.kind!=="saving-throw"||entryPoint.test.roller!=="each-target"||entryPoint.test.perTarget===false) {
    throw new Error("save-damage entry point requires an each-target saving throw");
  }
  assertOnlyKeys(entryPoint.test,["kind","roller","property","dc","perTarget"],`entry point ${entryPoint.id} test`);
  if (!ABILITIES.has(entryPoint.test.property)) throw new Error(`unsupported saving throw ability: ${entryPoint.test.property}`);
  if (entryPoint.operations.length<1||entryPoint.operations.some((operation)=>operation.kind!=="damage.apply")) {
    throw new Error("save-damage entry point requires one or more damage.apply operations in this runtime slice");
  }

  const damages:NormalizedDamageOperation[]=entryPoint.operations.map((damage,index)=>{
    const label=`entry point ${entryPoint.id} damage operation ${index+1}`;
    assertOnlyKeys(damage,["kind","amount","damageType","multiplier","when"],label);
    if (typeof damage.amount!=="string") throw new Error(`${label} requires a dice-formula damage amount`);
    if (!damage.damageType) throw new Error(`${label} damageType is required`);
    if (damage.multiplier!==undefined&&(!Number.isFinite(damage.multiplier)||damage.multiplier<0)) {
      throw new Error(`${label} multiplier must be a non-negative finite number`);
    }
    return {
      damageType:damage.damageType,
      amount:damage.amount,
      multiplier:damage.multiplier??1,
      outcome:saveOutcomeFromPredicate(damage.when,`${label} when`),
    };
  });
  const sharedFormula=damages[0].amount;
  if (damages.some((damage)=>damage.amount!==sharedFormula)) {
    throw new Error("save-damage runtime slice requires damage.apply operations to share one dice formula");
  }
  return { entryPoint, damages, sharedFormula };
}

function numericDamageOperand(
  damageRollOperationId:string,
  multiplier:number,
):Extract<ResolutionOperation,{kind:"damage"}>["amount"] {
  return {
    operationId:damageRollOperationId,
    field:"total",
    multiplier,
    rounding:"floor",
  };
}

export function compileCommonPlaySaveDamageEntryPoint(
  inputState:RulesRuntimeState,
  definition:CommonPlaySaveDamageDefinition,
  input:CommonPlaySaveDamageExecutionInput,
):PendingResolution {
  if (!input.resolutionId||!input.actorId) throw new Error("resolutionId and actorId are required");
  const { entryPoint, damages, sharedFormula }=requireEntryPoint(definition,input.entryPointId);
  const dc=literalNumber(entryPoint.test.dc,"saving throw DC");
  const formula=parseDamageFormula(sharedFormula);
  const minTargets=entryPoint.targeting.min??1;
  const maxTargets=entryPoint.targeting.max??Math.max(minTargets,input.targets.length);
  const damageRollOperationId="common-play-shared-damage-roll";

  const operations:ResolutionOperation[]=[
    {
      id:"common-play-targets",
      kind:"targeting",
      sourceId:input.actorId,
      harmful:true,
      rule:{
        kind:"creature",
        minTargets,
        maxTargets,
        directTarget:false,
      },
      targets:input.targets.map((target)=>target.facts),
    },
    {
      id:damageRollOperationId,
      kind:"damage-roll",
      request:{
        dice:[{
          source:`common-play:${definition.id}:${entryPoint.id}:damage`,
          sides:formula.sides,
          count:formula.count,
          faces:input.damageFaces,
        }],
        flat:formula.flat===0?[]:[{
          source:`common-play:${definition.id}:${entryPoint.id}:flat-damage`,
          value:formula.flat,
        }],
      },
    },
  ];

  input.targets.forEach((target,targetIndex)=>{
    const targetSuffix=targetIndex+1;
    const saveOperationId=`common-play-save-${targetSuffix}`;
    operations.push({
      id:saveOperationId,
      kind:"d20",
      actorId:target.facts.id,
      request:{
        family:"saving-throw",
        target:dc,
        modifierContributions:target.save.modifierContributions??[],
        dice:{
          id:`${input.resolutionId}:save:${target.facts.id}`,
          purpose:`common-play:${definition.id}:${entryPoint.id}:saving-throw`,
          sides:20,
          faces:target.save.faces,
        },
        targetSource:`common-play:${definition.id}:${entryPoint.id}:dc`,
      },
      condition:{ ability:entryPoint.test.property },
    });
    damages.forEach((damage,damageIndex)=>{
      operations.push({
        id:`common-play-damage-${targetSuffix}-${damageIndex+1}`,
        kind:"damage",
        targetId:target.facts.id,
        damageType:damage.damageType,
        amount:numericDamageOperand(damageRollOperationId,damage.multiplier),
        creatureKind:target.creatureKind,
        when:damage.outcome
          ? { operationId:saveOperationId, field:"outcome", equals:damage.outcome }
          : undefined,
      });
    });
  });

  return {
    id:input.resolutionId,
    actorId:input.actorId,
    sourceId:definition.id,
    expectedRevision:inputState.revision,
    operations,
  };
}

export function resolveCommonPlaySaveDamageEntryPoint(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  definition:CommonPlaySaveDamageDefinition,
  input:CommonPlaySaveDamageExecutionInput,
):ResolutionCommit {
  try {
    return resolvePendingResolution(
      profile,
      inputState,
      compileCommonPlaySaveDamageEntryPoint(inputState,definition,input),
    );
  } catch (error) {
    return rejected(inputState,error instanceof Error?error.message:String(error));
  }
}
