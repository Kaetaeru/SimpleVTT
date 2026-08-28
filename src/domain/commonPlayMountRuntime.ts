import { DomainEvaluationError } from "./profileEngine";

export type CommonPlaySize="tiny"|"small"|"medium"|"large"|"huge"|"gargantuan";
const SIZE_ORDER:CommonPlaySize[]=["tiny","small","medium","large","huge","gargantuan"];

export interface CommonPlayMountRelationship {
  riderId:string;
  mountId:string;
  controllerId:string;
  mode:"controlled"|"independent";
  riderSize:CommonPlaySize;
  mountSize:CommonPlaySize;
  movementCostFeet:number;
  controlledActionIds:string[];
}

export function validateCommonPlayMount(relationship:CommonPlayMountRelationship) {
  if(!relationship.riderId||!relationship.mountId||relationship.riderId===relationship.mountId||!relationship.controllerId)throw new DomainEvaluationError("mount requires distinct rider/mount and controller identities");
  if(SIZE_ORDER.indexOf(relationship.mountSize)<SIZE_ORDER.indexOf(relationship.riderSize)+1)throw new DomainEvaluationError("mount must be at least one size larger than rider");
  if(!Number.isFinite(relationship.movementCostFeet)||relationship.movementCostFeet<0)throw new DomainEvaluationError("mount movement cost must be non-negative and finite");
  if(new Set(relationship.controlledActionIds).size!==relationship.controlledActionIds.length)throw new DomainEvaluationError("controlled mount actions must be unique");
  if(relationship.mode==="controlled"&&relationship.controllerId!==relationship.riderId)throw new DomainEvaluationError("controlled mount controller must be the rider");
  return structuredClone(relationship);
}

export function mountFallOffOutcome(saveSucceeded:boolean) {
  return saveSucceeded?{fallsOff:false,prone:false}:{fallsOff:true,prone:true};
}
