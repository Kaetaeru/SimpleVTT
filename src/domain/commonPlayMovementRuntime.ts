import type { CommonPlayFactAnswer, CommonPlayFactQuery } from "./commonPlaySpatialFactRuntime";
import type { ResolutionOperation } from "./resolutionTypes";

type CommonPlayMovementMode="teleport"|"push"|"pull"|"move";
type LiteralDistance={value:number};
type CommonPlayDistanceExpression=LiteralDistance|Record<string,unknown>;

export interface CommonPlayMovementDefinition {
  kind:"movement.relocate";
  mode:CommonPlayMovementMode;
  target:string;
  distance?:CommonPlayDistanceExpression;
  destinationFact?:CommonPlayFactQuery;
}

type CompiledMoveOperation=Extract<ResolutionOperation,{kind:"move"}>;

export type CommonPlayMovementCompileResult=
  | {status:"compiled";destination:string;operation:CompiledMoveOperation}
  | {status:"unsupported";reason:string}
  | {status:"rejected";reason:string};

export interface CompileCommonPlayMovementInput {
  id:string;
  definition:CommonPlayMovementDefinition;
  answer?:CommonPlayFactAnswer;
}

function literalDistance(expression:CommonPlayDistanceExpression|undefined) {
  if(!expression||typeof expression!=="object"||!("value" in expression))return undefined;
  const value=(expression as {value?:unknown}).value;
  return typeof value==="number"&&Number.isFinite(value)&&value>=0?value:undefined;
}

export function compileCommonPlayMovement(input:CompileCommonPlayMovementInput):CommonPlayMovementCompileResult {
  const {definition,answer}=input;
  if(definition.mode!=="move") {
    return {status:"unsupported",reason:`movement mode ${definition.mode} is not represented exactly by current Core movement primitives`};
  }

  const distanceFeet=literalDistance(definition.distance);
  if(distanceFeet===undefined) {
    return {status:"unsupported",reason:"movement distance requires a supported literal expression"};
  }

  const query=definition.destinationFact;
  if(!query) return {status:"unsupported",reason:"movement destination requires a semantic destination fact"};
  if(!answer) return {status:"rejected",reason:"movement destination answer is required"};
  if(answer.queryId!==query.id) return {status:"rejected",reason:"movement destination answer query identity mismatch"};
  if(answer.fact!==query.fact) return {status:"rejected",reason:"movement destination answer fact mismatch"};
  if(answer.subject!==query.subject) return {status:"rejected",reason:"movement destination answer subject mismatch"};
  if(typeof answer.value!=="string"||!answer.value) return {status:"rejected",reason:"movement destination answer must be an opaque destination string"};

  return {
    status:"compiled",
    destination:answer.value,
    operation:{
      id:input.id,
      kind:"move",
      actorId:definition.target,
      distanceFeet,
    },
  };
}
