import type { ModifierContribution } from "./d20";
import type { AbilityKey } from "./conditions";
import type { RulesRuntimeState } from "./combatState";
import type { RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import type { TargetFacts } from "./targeting";

type LiteralNumberExpression = { value:number };

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
  if (entryPoint.operations.length!==1||entryPoint.operations[0]?.kind!=="damage.apply") {
    throw new Error("save-damage entry point requires exactly one damage.apply operation in this runtime slice");
  }
  const damage=entryPoint.operations[0];
  assertOnlyKeys(damage,["kind","amount","damageType","multiplier"],`entry point ${entryPoint.id} damage operation`);
  if (typeof damage.amount!=="string") throw new Error("save-damage entry point requires a dice-formula damage amount");
  if (!damage.damageType) throw new Error("damage.apply damageType is required");
  if (damage.multiplier!==undefined&&(!Number.isFinite(damage.multiplier)||damage.multiplier<0)) {
    throw new Error("damage.apply multiplier must be a non-negative finite number");
  }
  return { entryPoint, damage };
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
  const { entryPoint, damage }=requireEntryPoint(definition,input.entryPointId);
  const dc=literalNumber(entryPoint.test.dc,"saving throw DC");
  const formula=parseDamageFormula(damage.amount);
  const minTargets=entryPoint.targeting.min??1;
  const maxTargets=entryPoint.targeting.max??Math.max(minTargets,input.targets.length);
  const damageRollOperationId="common-play-shared-damage-roll";
  const baseMultiplier=damage.multiplier??1;

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

  input.targets.forEach((target,index)=>{
    const suffix=index+1;
    const saveOperationId=`common-play-save-${suffix}`;
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
    operations.push({
      id:`common-play-damage-${suffix}-full`,
      kind:"damage",
      targetId:target.facts.id,
      damageType:damage.damageType,
      amount:numericDamageOperand(damageRollOperationId,baseMultiplier),
      creatureKind:target.creatureKind,
      when:{ operationId:saveOperationId, field:"outcome", equals:"failure" },
    });
    operations.push({
      id:`common-play-damage-${suffix}-half`,
      kind:"damage",
      targetId:target.facts.id,
      damageType:damage.damageType,
      amount:numericDamageOperand(damageRollOperationId,baseMultiplier*0.5),
      creatureKind:target.creatureKind,
      when:{ operationId:saveOperationId, field:"outcome", equals:"success" },
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
