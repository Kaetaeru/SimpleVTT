import type { RulesRuntimeState } from "./combatState";
import { DomainEvaluationError } from "./profileEngine";
import type { PendingResolution, ResolutionOperation } from "./resolutionTypes";

export type CommonPlayTimingWindow=
  |{kind:"turn-start"|"turn-end";actor:"owner"|"other"}
  |{kind:"after-turn";actor:"other"}
  |{kind:"initiative-count";count:number};

export interface CommonPlaySpecialActionDefinition {
  id:string;
  ownerActorId:string;
  timing:CommonPlayTimingWindow;
  options:Array<{id:string;cost:number;operations:ResolutionOperation[]}>;
  poolResourceId?:string;
}

export interface CommonPlayTimingEvent {
  kind:"turn-start"|"turn-end"|"after-turn"|"initiative-count";
  actorId?:string;
  initiativeCount?:number;
}

function eligible(definition:CommonPlaySpecialActionDefinition,event:CommonPlayTimingEvent) {
  const timing=definition.timing;
  if(timing.kind!==event.kind)return false;
  if(timing.kind==="initiative-count")return event.initiativeCount===timing.count;
  if(!event.actorId)return false;
  return timing.actor==="owner"?event.actorId===definition.ownerActorId:event.actorId!==definition.ownerActorId;
}

export function compileCommonPlaySpecialAction(
  state:RulesRuntimeState,
  definition:CommonPlaySpecialActionDefinition,
  request:{resolutionId:string;requesterActorId:string;optionId:string;event:CommonPlayTimingEvent},
):PendingResolution {
  if(!definition.id||!definition.ownerActorId||!request.resolutionId)throw new DomainEvaluationError("special action identity is required");
  if(request.requesterActorId!==definition.ownerActorId)throw new DomainEvaluationError("only the special action owner can invoke it");
  if(!eligible(definition,request.event))throw new DomainEvaluationError("special action is outside its eligible timing window");
  const option=definition.options.find((entry)=>entry.id===request.optionId);
  if(!option)throw new DomainEvaluationError(`special action option not found: ${request.optionId}`);
  if(!Number.isInteger(option.cost)||option.cost<0)throw new DomainEvaluationError("special action cost must be a non-negative integer");
  if(option.cost>0&&!definition.poolResourceId)throw new DomainEvaluationError("costly special action requires a pool resource");
  const payment:ResolutionOperation[]=option.cost?[{id:`${request.resolutionId}:cost`,kind:"spend-resource",actorId:definition.ownerActorId,resourceId:definition.poolResourceId!,amount:option.cost}]:[];
  return {id:request.resolutionId,actorId:definition.ownerActorId,sourceId:definition.id,expectedRevision:state.revision,operations:[...payment,...structuredClone(option.operations)]};
}
