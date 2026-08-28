import type { CommonPlayFactAnswer, CommonPlayFactQuery } from "./commonPlaySpatialFactRuntime";
import type { ResolutionOperation } from "./resolutionTypes";
import { evaluateExpression, type ExpressionNode } from "./profileEngine";

type CommonPlayMovementMode="teleport"|"push"|"pull"|"move";
type CommonPlayMovementType="walk"|"climb"|"swim"|"fly"|"crawl"|"jump";

export interface CommonPlayMovementDefinition {
  kind:"movement.relocate";
  mode:CommonPlayMovementMode;
  movementType?:CommonPlayMovementType;
  target:string;
  distance?:ExpressionNode;
  costMultiplier?:ExpressionNode;
  doesNotProvokeOpportunityAttacks?:boolean;
  destinationFact?:CommonPlayFactQuery;
}

type CompiledMoveOperation=Extract<ResolutionOperation,{kind:"move"|"free-move"}>;

export type CommonPlayMovementCompileResult=
  | {status:"compiled";destination:string;operation:CompiledMoveOperation}
  | {status:"unsupported";reason:string}
  | {status:"rejected";reason:string};

export interface CompileCommonPlayMovementInput {
  id:string;
  definition:CommonPlayMovementDefinition;
  answer?:CommonPlayFactAnswer;
  properties?:Record<string,number>;
}

function numeric(expression:ExpressionNode|undefined,properties:Record<string,number>|undefined,label:string) {
  if(!expression)return undefined;
  const value=evaluateExpression(expression,(property)=>{
    const resolved=properties?.[property];
    if(resolved===undefined)throw new Error(`unresolved ${label} property: ${property}`);
    return resolved;
  });
  return Number.isFinite(value)&&value>=0?value:undefined;
}

export function compileCommonPlayMovement(input:CompileCommonPlayMovementInput):CommonPlayMovementCompileResult {
  const {definition,answer}=input;
  const distanceFeet=numeric(definition.distance,input.properties,"movement distance");
  if(distanceFeet===undefined) {
    return {status:"unsupported",reason:"movement distance requires a supported numeric expression"};
  }

  const query=definition.destinationFact;
  if(!query) return {status:"unsupported",reason:"movement destination requires a semantic destination fact"};
  if(!answer) return {status:"rejected",reason:"movement destination answer is required"};
  if(answer.queryId!==query.id) return {status:"rejected",reason:"movement destination answer query identity mismatch"};
  if(answer.fact!==query.fact) return {status:"rejected",reason:"movement destination answer fact mismatch"};
  if(answer.subject!==query.subject) return {status:"rejected",reason:"movement destination answer subject mismatch"};
  if(typeof answer.value!=="string"||!answer.value) return {status:"rejected",reason:"movement destination answer must be an opaque destination string"};

  if(definition.mode!=="move") return {
    status:"compiled",destination:answer.value,
    operation:{
      id:input.id,kind:"free-move",actorId:definition.target,distanceFeet,maximumDistanceFeet:distanceFeet,
      movementMode:definition.mode,destinationRef:answer.value,
      doesNotProvokeOpportunityAttacks:definition.mode==="teleport"||definition.doesNotProvokeOpportunityAttacks===true,
    },
  };
  const multiplier=numeric(definition.costMultiplier,input.properties,"movement cost multiplier")??1;
  const cost=Math.ceil(distanceFeet*multiplier);
  return {
    status:"compiled",
    destination:answer.value,
    operation:{
      id:input.id,
      kind:"move",
      actorId:definition.target,
      movementMode:definition.movementType??"walk",
      distanceFeet:cost,
      distanceTraveledFeet:distanceFeet,
      destinationRef:answer.value,
      doesNotProvokeOpportunityAttacks:definition.doesNotProvokeOpportunityAttacks===true,
    },
  };
}
