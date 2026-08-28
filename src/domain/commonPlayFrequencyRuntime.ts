import type { RuntimeClock } from "./effects";
import { DomainEvaluationError } from "./profileEngine";

export type CommonPlayFrequency="unlimited"|"once"|"once-per-turn"|"once-per-round"|"once-per-resolution";

export interface CommonPlayFrequencyRequest {
  ruleId:string;
  subjectId?:string;
  frequency:CommonPlayFrequency;
  resolutionId:string;
  clock:RuntimeClock;
  markers:Record<string,string|number|boolean>;
}

export interface CommonPlayFrequencyResolution {
  eligible:boolean;
  markerKey?:string;
  token?:string;
  metadataPatch:Record<string,string>;
}

function token(request:CommonPlayFrequencyRequest) {
  if(request.frequency==="once") return "consumed";
  if(request.frequency==="once-per-resolution") return request.resolutionId;
  if(request.frequency==="once-per-round") return `round:${request.clock.round}`;
  if(!request.clock.activeActorId) throw new DomainEvaluationError("once-per-turn frequency requires an authoritative active actor");
  return `turn:${request.clock.round}:${request.clock.activeActorId}`;
}

export function resolveCommonPlayFrequency(request:CommonPlayFrequencyRequest):CommonPlayFrequencyResolution {
  if(!request.ruleId) throw new DomainEvaluationError("frequency ruleId is required");
  if(!request.resolutionId) throw new DomainEvaluationError("frequency resolutionId is required");
  if(request.frequency==="unlimited") return {eligible:true,metadataPatch:{}};
  const markerKey=`commonPlay.frequency:${request.ruleId}:${request.subjectId??"global"}`;
  const nextToken=token(request);
  return {
    eligible:request.markers[markerKey]!==nextToken,
    markerKey,
    token:nextToken,
    metadataPatch:{[markerKey]:nextToken},
  };
}
