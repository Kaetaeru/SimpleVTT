import type { RulesRuntimeState } from "./combatState";
import type { CommonPlayDefinitionIR } from "./commonPlayDefinitionRuntime";
import { DomainEvaluationError, type RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";

type Obj=Record<string,unknown>;

export interface CommonPlayArtifactLifecycleInput {
  resolutionId:string;
  actorId:string;
  artifactId:string;
  entryPointId:string;
}

export interface CommonPlayArtifactGrantedEntryPoint {
  id:string;
  invocation:"granted";
  operations:Obj[];
}

function object(value:unknown,label:string):Obj {
  if(!value||typeof value!=="object"||Array.isArray(value)) throw new DomainEvaluationError(`${label} must be an object`);
  return value as Obj;
}

function nonEmptyString(value:unknown,label:string) {
  if(typeof value!=="string"||!value.trim()) throw new DomainEvaluationError(`${label} must be a non-empty string`);
  return value.trim();
}

function literalNonNegativeInteger(value:unknown,label:string) {
  const expression=object(value,label);
  if(Object.keys(expression).some((key)=>key!=="value")) throw new DomainEvaluationError(`${label} supports only a literal value`);
  const amount=expression.value;
  if(typeof amount!=="number"||!Number.isInteger(amount)||amount<0) throw new DomainEvaluationError(`${label}.value must be a non-negative integer`);
  return amount;
}

function metadataPatch(value:unknown,label:string) {
  const patch=object(value,label);
  if(!Object.keys(patch).length) throw new DomainEvaluationError(`${label} must not be empty`);
  for(const [key,item] of Object.entries(patch)) {
    if(!key||!(typeof item==="string"||typeof item==="number"||typeof item==="boolean")) throw new DomainEvaluationError(`${label}.${key} must be a string, number, or boolean`);
  }
  return structuredClone(patch) as Record<string,string|number|boolean>;
}

function artifactTemplate(state:RulesRuntimeState,definition:CommonPlayDefinitionIR,artifactId:string) {
  const artifact=(state.artifacts??[]).find((candidate)=>candidate.id===artifactId&&candidate.sourceId===definition.id&&(candidate.artifactKind==="object"||candidate.artifactKind==="link"));
  if(!artifact) throw new DomainEvaluationError(`active portable object/link artifact not found: ${artifactId}`);
  const template=(definition.artifactTemplates??[]).find((candidate)=>candidate.id===artifact.templateId&&candidate.artifactKind===artifact.artifactKind);
  if(!template) throw new DomainEvaluationError(`artifact template not found for active artifact: ${artifact.templateId}`);
  return {artifact,template};
}

function grantedEntryPoints(template:Obj):CommonPlayArtifactGrantedEntryPoint[] {
  const value=template.grantedEntryPoints;
  if(value===undefined) return [];
  if(!Array.isArray(value)) throw new DomainEvaluationError(`artifact ${String(template.id)} grantedEntryPoints must be an array`);
  return value.map((candidate,index)=>{
    const entry=object(candidate,`artifact ${String(template.id)} grantedEntryPoints[${index}]`);
    if(entry.invocation!=="granted") throw new DomainEvaluationError(`artifact ${String(template.id)} granted entry point must use granted invocation`);
    if(!Array.isArray(entry.operations)||!entry.operations.length) throw new DomainEvaluationError(`artifact ${String(template.id)} granted entry point requires operations`);
    return {
      id:nonEmptyString(entry.id,`artifact ${String(template.id)} grantedEntryPoints[${index}].id`),
      invocation:"granted",
      operations:entry.operations.map((operation,operationIndex)=>structuredClone(object(operation,`artifact ${String(template.id)} grantedEntryPoints[${index}].operations[${operationIndex}]`))),
    };
  });
}

export function commonPlayArtifactGrantedEntryPoints(
  state:RulesRuntimeState,
  definition:CommonPlayDefinitionIR,
  artifactId:string,
) {
  const {template}=artifactTemplate(state,definition,artifactId);
  return grantedEntryPoints(template);
}

export function compileCommonPlayArtifactLifecycle(
  state:RulesRuntimeState,
  definition:CommonPlayDefinitionIR,
  input:CommonPlayArtifactLifecycleInput,
):PendingResolution {
  if(!input.resolutionId||!input.actorId||!input.artifactId||!input.entryPointId) throw new DomainEvaluationError("artifact lifecycle resolution, actor, artifact, and entry-point identities are required");
  const {artifact,template}=artifactTemplate(state,definition,input.artifactId);
  if(artifact.sourceActorId!==input.actorId) throw new DomainEvaluationError("artifact lifecycle actor must be the artifact source actor");
  const entry=grantedEntryPoints(template).find((candidate)=>candidate.id===input.entryPointId);
  if(!entry) throw new DomainEvaluationError(`artifact granted entry point not found: ${input.entryPointId}`);
  const operations:ResolutionOperation[]=entry.operations.map((raw,index)=>{
    const operation=object(raw,`artifact granted operation ${index}`);
    const operationId=`${input.resolutionId}:operation:${index}`;
    if(operation.kind==="damage.apply"||operation.kind==="healing.apply") {
      if(operation.target!=="artifact") throw new DomainEvaluationError(`artifact granted operation ${index} target must be artifact`);
      if(artifact.artifactKind!=="object") throw new DomainEvaluationError(`artifact ${operation.kind==="damage.apply"?"damage":"repair"} applies only to object artifacts in this portable slice`);
      if(operation.kind==="damage.apply") return {
        id:operationId,
        kind:"damage-artifact" as const,
        artifactId:artifact.id,
        damageType:nonEmptyString(operation.damageType,`artifact granted operation ${index}.damageType`),
        amount:literalNonNegativeInteger(operation.amount,`artifact granted operation ${index}.amount`),
      };
      return {
        id:operationId,
        kind:"repair-artifact" as const,
        artifactId:artifact.id,
        amount:literalNonNegativeInteger(operation.amount,`artifact granted operation ${index}.amount`),
      };
    }
    const referencedArtifact=nonEmptyString(operation.artifact,`artifact granted operation ${index}.artifact`);
    if(referencedArtifact!==String(template.id)) throw new DomainEvaluationError(`artifact granted operation ${index} must reference its owning template ${String(template.id)}`);
    if(operation.kind==="artifact.damage") {
      if(artifact.artifactKind!=="object") throw new DomainEvaluationError("artifact damage applies only to object artifacts in this portable slice");
      return {
        id:operationId,
        kind:"damage-artifact" as const,
        artifactId:artifact.id,
        damageType:nonEmptyString(operation.damageType,`artifact granted operation ${index}.damageType`),
        amount:literalNonNegativeInteger(operation.amount,`artifact granted operation ${index}.amount`),
      };
    }
    if(operation.kind==="artifact.repair") {
      if(artifact.artifactKind!=="object") throw new DomainEvaluationError("artifact repair applies only to object artifacts in this portable slice");
      return {
        id:operationId,
        kind:"repair-artifact" as const,
        artifactId:artifact.id,
        amount:literalNonNegativeInteger(operation.amount,`artifact granted operation ${index}.amount`),
      };
    }
    if(operation.kind==="artifact.relocate") return {
      id:operationId,
      kind:"relocate-artifact" as const,
      artifactId:artifact.id,
      placementRef:nonEmptyString(operation.placementRef,`artifact granted operation ${index}.placementRef`),
    };
    if(operation.kind==="artifact.update") return {
      id:operationId,
      kind:"update-artifact" as const,
      artifactId:artifact.id,
      metadataPatch:metadataPatch(operation.metadataPatch,`artifact granted operation ${index}.metadataPatch`),
    };
    if(operation.kind==="artifact.remove") return {
      id:operationId,
      kind:"remove-artifact" as const,
      artifactId:artifact.id,
    };
    throw new DomainEvaluationError(`unsupported portable artifact granted operation: ${String(operation.kind)}`);
  });
  return {
    id:input.resolutionId,
    actorId:input.actorId,
    sourceId:definition.id,
    expectedRevision:state.revision,
    operations,
  };
}

export function resolveCommonPlayArtifactLifecycle(
  profile:RulesProfileLike,
  state:RulesRuntimeState,
  definition:CommonPlayDefinitionIR,
  input:CommonPlayArtifactLifecycleInput,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,state,compileCommonPlayArtifactLifecycle(state,definition,input));
  } catch(error) {
    return {status:"rejected",state,events:[],results:{},error:error instanceof Error?error.message:String(error)};
  }
}
