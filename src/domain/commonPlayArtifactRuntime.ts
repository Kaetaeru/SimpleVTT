import type { RulesRuntimeState } from "./combatState";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import type { RuntimeArtifactExpiry, RuntimeArtifactInstance, RuntimeArtifactSpawnRequest, StoredInvocationArtifactData } from "./runtimeArtifact";
import { compileCommonPlayPayments, parseCommonPlayPayments, type CommonPlayPayment } from "./commonPlayOperationRuntime";
import type { ActionUseKind } from "./turnEconomy";

type PortableArtifactKind="stored-invocation"|"object"|"link"|"actor"|"form";
type Obj=Record<string,unknown>;
type ArtifactLifecycleOperation=
  | {kind:"artifact.damage";artifact:string;amount:{value:number};damageType:string}
  | {kind:"artifact.repair";artifact:string;amount:{value:number}}
  | {kind:"artifact.relocate";artifact:string;placementRef:string}
  | {kind:"artifact.update";artifact:string;metadataPatch:Record<string,string|number|boolean>}
  | {kind:"artifact.remove";artifact:string};
type ArtifactOperation={kind:"artifact.spawn";template:string}|ArtifactLifecycleOperation;

export interface CommonPlayArtifactActivationDefinition {
  $schema?:string;
  schemaVersion:"0.2-draft";
  id:string;
  payments?:CommonPlayPayment[];
  entryPoints:Array<{
    id:string;
    invocation:"manual"|"triggered"|"automatic"|"granted";
    operations:ArtifactOperation[];
  }>;
  artifactTemplates:Array<{
    id:string;
    artifactKind:PortableArtifactKind;
    duration:Obj;
    lifetime:Obj;
    initialState:Obj;
  }>;
}

export interface CommonPlayArtifactActivationInput {
  resolutionId:string;
  actorId:string;
  entryPointId:string;
  placementRefs?:Record<string,string>;
  actionKind?:ActionUseKind;
}

function object(value:unknown,label:string):Obj {
  if(!value||typeof value!=="object"||Array.isArray(value)) throw new DomainEvaluationError(`${label} must be an object`);
  return value as Obj;
}

function seconds(value:unknown,label:string) {
  const duration=object(value,label);
  if(duration.kind==="durable"||duration.kind==="manual"||duration.kind==="instant") return undefined;
  if(duration.kind!=="elapsed") throw new DomainEvaluationError(`${label}.kind is not connected to runtime artifact expiry`);
  const amount=object(duration.amount,`${label}.amount`).value;
  if(typeof amount!=="number"||!Number.isFinite(amount)||amount<0) throw new DomainEvaluationError(`${label}.amount.value must be non-negative`);
  const multiplier=duration.unit==="seconds"?1:duration.unit==="minutes"?60:duration.unit==="hours"?3600:duration.unit==="days"?86400:undefined;
  if(!multiplier) throw new DomainEvaluationError(`${label}.unit is unsupported`);
  return amount*multiplier;
}

function expiry(state:RulesRuntimeState,template:CommonPlayArtifactActivationDefinition["artifactTemplates"][number],actorId:string):RuntimeArtifactExpiry {
  if(template.artifactKind==="stored-invocation") return {kind:"turn-boundary",actorId,round:state.clock.round+1,boundary:"start"};
  const elapsed=seconds(template.duration,`artifact ${template.id} duration`);
  if(elapsed!==undefined) return {kind:"time",elapsedSeconds:state.clock.elapsedSeconds+elapsed};
  const lifetime=object(template.lifetime,`artifact ${template.id} lifetime`);
  if(!["durable","world-persistent","until-destroyed","with-parent","until-source-recast"].includes(String(lifetime.kind))) {
    throw new DomainEvaluationError(`artifact ${template.id} lifetime is not connected to generic artifact activation`);
  }
  return {kind:"permanent"};
}

function boundId(value:unknown,actorId:string,artifacts:Map<string,string>,label:string) {
  if(typeof value!=="string"||!value) throw new DomainEvaluationError(`${label} must be a non-empty string`);
  if(value==="actor") return actorId;
  if(value.startsWith("artifact:")) {
    const id=artifacts.get(value.slice("artifact:".length));
    if(!id) throw new DomainEvaluationError(`${label} references an artifact template that is not spawned by this entry point`);
    return id;
  }
  return value;
}

function artifact(
  state:RulesRuntimeState,
  definition:CommonPlayArtifactActivationDefinition,
  template:CommonPlayArtifactActivationDefinition["artifactTemplates"][number],
  input:CommonPlayArtifactActivationInput,
  artifactIds:Map<string,string>,
):RuntimeArtifactSpawnRequest {
  const initial=structuredClone(object(template.initialState,`artifact ${template.id} initialState`));
  const common={
    id:artifactIds.get(template.id)!,sourceId:definition.id,sourceActorId:input.actorId,templateId:template.id,
    artifactKind:template.artifactKind,expiry:expiry(state,template,input.actorId),
    ...(input.placementRefs?.[template.id]?{placementRef:input.placementRefs[template.id]}:{}),
  };
  if(template.artifactKind==="stored-invocation") {
    const definitionId=initial.definitionId,entryPointId=initial.entryPointId,definitionRevision=initial.definitionRevision,binding=initial.binding;
    if(typeof definitionId!=="string"||typeof entryPointId!=="string"||typeof definitionRevision!=="string"||(binding!=="snapshot"&&binding!=="live")) {
      throw new DomainEvaluationError(`artifact ${template.id} stored invocation identity is invalid`);
    }
    if(initial.trigger===undefined) throw new DomainEvaluationError(`artifact ${template.id} stored invocation trigger is required`);
    return {...common,storedInvocation:{
      ownerActorId:boundId(initial.ownerActorId??"actor",input.actorId,artifactIds,`artifact ${template.id} ownerActorId`),
      definitionId,entryPointId,definitionRevision,binding,
      trigger:structuredClone(initial.trigger) as StoredInvocationArtifactData["trigger"],
      ...(typeof initial.concentrationGroupId==="string"?{concentrationGroupId:initial.concentrationGroupId}:{}),
      ...(initial.onTriggerConcentration==="retain"||initial.onTriggerConcentration==="end"?{onTriggerConcentration:initial.onTriggerConcentration}:{}),
    }};
  }
  if(template.artifactKind==="object") return {...common,object:initial as unknown as RuntimeArtifactSpawnRequest["object"]};
  if(template.artifactKind==="link") {
    const endpointIds=initial.endpointIds;
    if(!Array.isArray(endpointIds)||endpointIds.length!==2) throw new DomainEvaluationError(`artifact ${template.id} link endpointIds must contain two bindings`);
    return {...common,link:{...initial,endpointIds:endpointIds.map((id,index)=>boundId(id,input.actorId,artifactIds,`artifact ${template.id} endpointIds[${index}]`))} as RuntimeArtifactSpawnRequest["link"]};
  }
  if(template.artifactKind==="actor") return {...common,actor:{
    ...initial,
    ownerId:boundId(initial.ownerId,input.actorId,artifactIds,`artifact ${template.id} ownerId`),
    controllerId:boundId(initial.controllerId,input.actorId,artifactIds,`artifact ${template.id} controllerId`),
  } as RuntimeArtifactSpawnRequest["actor"]};
  return {...common,form:{
    ...initial,
    targetActorId:boundId(initial.targetActorId,input.actorId,artifactIds,`artifact ${template.id} targetActorId`),
    ...(initial.controllerId===undefined?{}:{controllerId:boundId(initial.controllerId,input.actorId,artifactIds,`artifact ${template.id} controllerId`)}),
  } as RuntimeArtifactSpawnRequest["form"]};
}

function positiveInteger(value:unknown,label:string) {
  const amount=object(value,label).value;
  if(typeof amount!=="number"||!Number.isInteger(amount)||amount<=0) throw new DomainEvaluationError(`${label}.value must be a positive integer`);
  return amount;
}

function lifecycleArtifact(
  state:RulesRuntimeState,
  definition:CommonPlayArtifactActivationDefinition,
  actorId:string,
  templateId:string,
  allowedKinds:readonly PortableArtifactKind[],
):RuntimeArtifactInstance {
  const template=definition.artifactTemplates.find((candidate)=>candidate.id===templateId);
  if(!template) throw new DomainEvaluationError(`artifact template not found: ${templateId}`);
  if(!allowedKinds.includes(template.artifactKind)) throw new DomainEvaluationError(`artifact ${templateId} kind ${template.artifactKind} is not valid for this lifecycle operation`);
  const matches=(state.artifacts??[]).filter((candidate)=>
    candidate.sourceId===definition.id
    && candidate.sourceActorId===actorId
    && candidate.templateId===templateId
    && allowedKinds.includes(candidate.artifactKind as PortableArtifactKind)
  );
  if(matches.length!==1) throw new DomainEvaluationError(`artifact lifecycle reference ${templateId} requires exactly one active source-owned instance, got ${matches.length}`);
  return matches[0];
}

function metadataPatch(value:unknown,label:string) {
  const patch=object(value,label);
  if(!Object.keys(patch).length) throw new DomainEvaluationError(`${label} must not be empty`);
  for(const [key,item] of Object.entries(patch)) {
    if(!key||!(typeof item==="string"||typeof item==="number"||typeof item==="boolean")) throw new DomainEvaluationError(`${label}.${key} must be a string, number, or boolean`);
  }
  return structuredClone(patch) as Record<string,string|number|boolean>;
}

function lifecycleOperation(
  state:RulesRuntimeState,
  definition:CommonPlayArtifactActivationDefinition,
  input:CommonPlayArtifactActivationInput,
  operation:ArtifactLifecycleOperation,
  index:number,
):ResolutionOperation {
  const id=`common-play-artifact-lifecycle-${index+1}`;
  if(operation.kind==="artifact.damage") {
    const target=lifecycleArtifact(state,definition,input.actorId,operation.artifact,["object"]);
    if(typeof operation.damageType!=="string"||!operation.damageType) throw new DomainEvaluationError("artifact.damage damageType is required");
    return {id,kind:"damage-artifact",artifactId:target.id,amount:positiveInteger(operation.amount,"artifact.damage amount"),damageType:operation.damageType};
  }
  if(operation.kind==="artifact.repair") {
    const target=lifecycleArtifact(state,definition,input.actorId,operation.artifact,["object"]);
    return {id,kind:"repair-artifact",artifactId:target.id,amount:positiveInteger(operation.amount,"artifact.repair amount")};
  }
  if(operation.kind==="artifact.relocate") {
    const target=lifecycleArtifact(state,definition,input.actorId,operation.artifact,["object","link"]);
    if(typeof operation.placementRef!=="string"||!operation.placementRef) throw new DomainEvaluationError("artifact.relocate requires an opaque placementRef");
    return {id,kind:"relocate-artifact",artifactId:target.id,placementRef:operation.placementRef};
  }
  if(operation.kind==="artifact.update") {
    const target=lifecycleArtifact(state,definition,input.actorId,operation.artifact,["object","link"]);
    return {id,kind:"update-artifact",artifactId:target.id,metadataPatch:metadataPatch(operation.metadataPatch,"artifact.update metadataPatch")};
  }
  const target=lifecycleArtifact(state,definition,input.actorId,operation.artifact,["object","link"]);
  return {id,kind:"remove-artifact",artifactId:target.id};
}

export function compileCommonPlayArtifactActivation(
  state:RulesRuntimeState,
  definition:CommonPlayArtifactActivationDefinition,
  input:CommonPlayArtifactActivationInput,
):PendingResolution {
  const entryPoint=definition.entryPoints.find((candidate)=>candidate.id===input.entryPointId);
  if(!entryPoint||entryPoint.invocation!=="manual"||!entryPoint.operations.length) throw new DomainEvaluationError("artifact activation requires a non-empty manual entry point");
  const templates=new Map(definition.artifactTemplates.map((template)=>[template.id,template]));
  const artifactIds=new Map(entryPoint.operations.flatMap((operation,index)=>operation.kind==="artifact.spawn"?[[operation.template,`${input.resolutionId}:artifact:${index+1}:${operation.template}`] as const]:[]));
  const operations:ResolutionOperation[]=[...compileCommonPlayPayments(parseCommonPlayPayments(definition.payments),input),...entryPoint.operations.map((operation,index)=>{
    if(operation.kind!=="artifact.spawn") return lifecycleOperation(state,definition,input,operation,index);
    const template=templates.get(operation.template);
    if(!template) throw new DomainEvaluationError(`artifact template not found: ${operation.template}`);
    if(!["stored-invocation","object","link","actor","form"].includes(template.artifactKind)) throw new DomainEvaluationError(`artifact ${template.id} kind is not handled by the generic artifact activation runtime`);
    return {id:`common-play-artifact-spawn-${index+1}`,kind:"spawn-artifact" as const,artifact:artifact(state,definition,template,input,artifactIds)};
  })];
  return {id:input.resolutionId,actorId:input.actorId,sourceId:definition.id,expectedRevision:state.revision,operations};
}

export function resolveCommonPlayArtifactActivation(
  profile:RulesProfileLike,
  state:RulesRuntimeState,
  definition:CommonPlayArtifactActivationDefinition,
  input:CommonPlayArtifactActivationInput,
):ResolutionCommit {
  try { return resolvePendingResolution(profile,state,compileCommonPlayArtifactActivation(state,definition,input)); }
  catch(error) { return {status:"rejected",state,events:[],results:{},error:error instanceof Error?error.message:String(error)}; }
}
