import { DomainEvaluationError } from "./profileEngine";

export interface CommonPlayExposure {
  id:string;
  subjectId:string;
  definitionId:string;
  revision:number;
  elapsedSeconds:number;
  thresholdSeconds:number;
  intervalSeconds:number;
  appliedIntervals:number;
  status:"active"|"recovered";
}

export interface CommonPlayExposureTick {
  exposure:CommonPlayExposure;
  newlyTriggeredIntervals:number[];
}

export function validateCommonPlayExposure(exposure:CommonPlayExposure) {
  if(!exposure.id||!exposure.subjectId||!exposure.definitionId)throw new DomainEvaluationError("exposure requires stable instance, subject, and definition identities");
  if(!Number.isInteger(exposure.revision)||exposure.revision<0||!Number.isFinite(exposure.elapsedSeconds)||exposure.elapsedSeconds<0||!Number.isFinite(exposure.thresholdSeconds)||exposure.thresholdSeconds<0||!Number.isFinite(exposure.intervalSeconds)||exposure.intervalSeconds<=0||!Number.isInteger(exposure.appliedIntervals)||exposure.appliedIntervals<0)throw new DomainEvaluationError("exposure state is invalid");
  if(exposure.status!=="active"&&exposure.status!=="recovered")throw new DomainEvaluationError("exposure status is invalid");
  return structuredClone(exposure);
}

export function advanceCommonPlayExposure(exposure:CommonPlayExposure,expectedRevision:number,seconds:number):CommonPlayExposureTick {
  validateCommonPlayExposure(exposure);
  if(expectedRevision!==exposure.revision)throw new DomainEvaluationError(`exposure revision mismatch: expected ${expectedRevision}, current ${exposure.revision}`);
  if(exposure.status!=="active")return {exposure:structuredClone(exposure),newlyTriggeredIntervals:[]};
  if(!Number.isFinite(seconds)||seconds<0)throw new DomainEvaluationError("exposure elapsed time must be non-negative and finite");
  if(!Number.isFinite(exposure.thresholdSeconds)||exposure.thresholdSeconds<0||!Number.isFinite(exposure.intervalSeconds)||exposure.intervalSeconds<=0)throw new DomainEvaluationError("exposure thresholds are invalid");
  const elapsedSeconds=exposure.elapsedSeconds+seconds;
  const totalIntervals=elapsedSeconds<exposure.thresholdSeconds?0:1+Math.floor((elapsedSeconds-exposure.thresholdSeconds)/exposure.intervalSeconds);
  const newlyTriggeredIntervals=Array.from({length:Math.max(0,totalIntervals-exposure.appliedIntervals)},(_,index)=>exposure.appliedIntervals+index+1);
  return {exposure:{...exposure,revision:exposure.revision+1,elapsedSeconds,appliedIntervals:totalIntervals},newlyTriggeredIntervals};
}

export function recoverCommonPlayExposure(exposure:CommonPlayExposure,expectedRevision:number):CommonPlayExposure {
  validateCommonPlayExposure(exposure);
  if(expectedRevision!==exposure.revision)throw new DomainEvaluationError(`exposure revision mismatch: expected ${expectedRevision}, current ${exposure.revision}`);
  return {...exposure,revision:exposure.revision+1,elapsedSeconds:0,appliedIntervals:0,status:"recovered"};
}
