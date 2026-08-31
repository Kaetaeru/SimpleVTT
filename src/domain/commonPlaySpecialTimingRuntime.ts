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

export interface CommonPlaySpecialActionAuthoringDefinition {
  id:string;
  timing:CommonPlayTimingWindow;
  options:Array<{id:string;cost:number;entryPointId:string}>;
  poolResourceId?:string;
}

type Obj=Record<string,unknown>;
const STABLE_ID=/^[a-z0-9][a-z0-9._-]*$/;

function authoringObject(value:unknown,label:string):Obj {
  if(!value||typeof value!=="object"||Array.isArray(value)) throw new DomainEvaluationError(`${label} must be an object`);
  return value as Obj;
}

function authoringStableId(value:unknown,label:string) {
  if(typeof value!=="string"||!STABLE_ID.test(value)) throw new DomainEvaluationError(`${label} must be a stable id`);
  return value;
}

function parseTimingWindow(value:unknown,label:string):CommonPlayTimingWindow {
  const timing=authoringObject(value,label);
  const kind=timing.kind;
  if(kind==="initiative-count") {
    const unsupported=Object.keys(timing).filter((key)=>key!=="kind"&&key!=="count");
    if(unsupported.length) throw new DomainEvaluationError(`${label} contains unsupported fields: ${unsupported.join(", ")}`);
    if(!Number.isInteger(timing.count)||Number(timing.count)<0) throw new DomainEvaluationError(`${label}.count must be a non-negative integer`);
    return {kind,count:Number(timing.count)};
  }
  if(kind==="turn-start"||kind==="turn-end") {
    const unsupported=Object.keys(timing).filter((key)=>key!=="kind"&&key!=="actor");
    if(unsupported.length) throw new DomainEvaluationError(`${label} contains unsupported fields: ${unsupported.join(", ")}`);
    if(timing.actor!=="owner"&&timing.actor!=="other") throw new DomainEvaluationError(`${label}.actor must be owner or other`);
    return {kind,actor:timing.actor};
  }
  if(kind==="after-turn") {
    const unsupported=Object.keys(timing).filter((key)=>key!=="kind"&&key!=="actor");
    if(unsupported.length) throw new DomainEvaluationError(`${label} contains unsupported fields: ${unsupported.join(", ")}`);
    if(timing.actor!=="other") throw new DomainEvaluationError(`${label}.actor must be other`);
    return {kind,actor:"other"};
  }
  throw new DomainEvaluationError(`${label}.kind is unsupported`);
}

export function parseCommonPlaySpecialActionAuthoring(
  value:unknown,
  label="Common Play special action",
):CommonPlaySpecialActionAuthoringDefinition {
  const raw=authoringObject(value,label);
  const unsupported=Object.keys(raw).filter((key)=>!new Set(["id","timing","options","poolResourceId"]).has(key));
  if(unsupported.length) throw new DomainEvaluationError(`${label} contains unsupported fields: ${unsupported.join(", ")}`);
  const id=authoringStableId(raw.id,`${label}.id`);
  const timing=parseTimingWindow(raw.timing,`${label}.timing`);
  const poolResourceId=raw.poolResourceId===undefined?undefined:authoringStableId(raw.poolResourceId,`${label}.poolResourceId`);
  if(!Array.isArray(raw.options)||raw.options.length===0) throw new DomainEvaluationError(`${label}.options must be a non-empty array`);
  const optionIds=new Set<string>();
  const options=raw.options.map((value,index)=>{
    const option=authoringObject(value,`${label}.options[${index}]`);
    const optionUnsupported=Object.keys(option).filter((key)=>!new Set(["id","cost","entryPointId"]).has(key));
    if(optionUnsupported.length) throw new DomainEvaluationError(`${label}.options[${index}] contains unsupported fields: ${optionUnsupported.join(", ")}`);
    const optionId=authoringStableId(option.id,`${label}.options[${index}].id`);
    if(optionIds.has(optionId)) throw new DomainEvaluationError(`${label}.options contains duplicate id: ${optionId}`);
    optionIds.add(optionId);
    if(!Number.isInteger(option.cost)||Number(option.cost)<0) throw new DomainEvaluationError(`${label}.options[${index}].cost must be a non-negative integer`);
    return {id:optionId,cost:Number(option.cost),entryPointId:authoringStableId(option.entryPointId,`${label}.options[${index}].entryPointId`)};
  });
  if(options.some((option)=>option.cost>0)&&!poolResourceId) throw new DomainEvaluationError(`${label} requires poolResourceId when an option has a cost`);
  return {id,timing,options,...(poolResourceId?{poolResourceId}:{})};
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
  if(request.event.kind==="initiative-count"&&state.clock.initiativeCount!==request.event.initiativeCount)throw new DomainEvaluationError("initiative-count event must match the authoritative runtime clock");
  if(!eligible(definition,request.event))throw new DomainEvaluationError("special action is outside its eligible timing window");
  const option=definition.options.find((entry)=>entry.id===request.optionId);
  if(!option)throw new DomainEvaluationError(`special action option not found: ${request.optionId}`);
  if(!Number.isInteger(option.cost)||option.cost<0)throw new DomainEvaluationError("special action cost must be a non-negative integer");
  if(option.cost>0&&!definition.poolResourceId)throw new DomainEvaluationError("costly special action requires a pool resource");
  const payment:ResolutionOperation[]=option.cost?[{id:`${request.resolutionId}:cost`,kind:"spend-resource",actorId:definition.ownerActorId,resourceId:definition.poolResourceId!,amount:option.cost}]:[];
  return {id:request.resolutionId,actorId:definition.ownerActorId,sourceId:definition.id,expectedRevision:state.revision,operations:[...payment,...structuredClone(option.operations)]};
}
