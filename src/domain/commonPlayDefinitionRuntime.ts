import { DomainEvaluationError } from "./profileEngine";
import {
  parseCommonPlayOperationDefinition,
  type CommonPlayOperationDefinition,
} from "./commonPlayOperationRuntime";
import type { CommonPlaySaveDamageDefinition } from "./commonPlayEntryPointRuntime";
import type { CommonPlayPersistentEffectDefinition } from "./commonPlayEffectRuntime";
import type { CommonPlayZoneDefinition } from "./commonPlayZoneRuntime";
import type { CommonPlayArtifactActivationDefinition } from "./commonPlayArtifactRuntime";

type Obj=Record<string,unknown>;

export interface CommonPlayEntryPointIR extends Obj {
  id:string;
  invocation:"manual"|"triggered"|"automatic"|"granted";
  operations:Obj[];
}

/** Canonical, data-only Common Play document retained across import and persistence. */
export interface CommonPlayDefinitionIR extends Obj {
  $schema?:string;
  schemaVersion:"0.2-draft";
  id:string;
  requiresCapabilities?:string[];
  castProcess?:Obj;
  payments?:Obj[];
  bindings?:Obj[];
  entryPoints?:CommonPlayEntryPointIR[];
  artifactTemplates?:Obj[];
  rules?:Obj[];
  interceptors?:Obj[];
}

export type LoweredCommonPlayEntryPoint=
  | {kind:"operations";definition:CommonPlayOperationDefinition;entryPointId:string}
  | {kind:"save-damage";definition:CommonPlaySaveDamageDefinition;entryPointId:string}
  | {kind:"effect";definition:CommonPlayPersistentEffectDefinition;entryPointId:string}
  | {kind:"zone";definition:CommonPlayZoneDefinition;entryPointId:string}
  | {kind:"artifacts";definition:CommonPlayArtifactActivationDefinition;entryPointId:string};

const TOP_LEVEL_KEYS=new Set([
  "$schema","schemaVersion","id","requiresCapabilities","castProcess","payments","bindings",
  "entryPoints","artifactTemplates","rules","interceptors",
]);
const INVOCATIONS=new Set(["manual","triggered","automatic","granted"]);
const STABLE_ID=/^[a-z0-9][a-z0-9._-]*$/;

function object(value:unknown,label:string):Obj {
  if(!value||typeof value!=="object"||Array.isArray(value)) throw new DomainEvaluationError(`${label} must be an object`);
  return value as Obj;
}

function stableId(value:unknown,label:string) {
  if(typeof value!=="string"||!STABLE_ID.test(value)) throw new DomainEvaluationError(`${label} must be a stable id`);
  return value;
}

function objectArray(value:unknown,label:string):Obj[]|undefined {
  if(value===undefined) return undefined;
  if(!Array.isArray(value)) throw new DomainEvaluationError(`${label} must be an array`);
  return value.map((item,index)=>structuredClone(object(item,`${label}[${index}]`)));
}

function uniqueIds(values:Obj[]|undefined,label:string) {
  const ids=new Set<string>();
  for(const [index,value] of (values??[]).entries()) {
    const id=stableId(value.id,`${label}[${index}].id`);
    if(ids.has(id)) throw new DomainEvaluationError(`${label} contains duplicate id: ${id}`);
    ids.add(id);
  }
}

/** Structural parse. It preserves all canonical families; family lowerers perform narrower semantic checks. */
export function parseCommonPlayDefinition(value:unknown,label="Common Play definition"):CommonPlayDefinitionIR {
  const raw=object(value,label);
  const unsupported=Object.keys(raw).filter((key)=>!TOP_LEVEL_KEYS.has(key));
  if(unsupported.length) throw new DomainEvaluationError(`${label} contains unsupported fields: ${unsupported.join(", ")}`);
  if(raw.schemaVersion!=="0.2-draft") throw new DomainEvaluationError(`${label}.schemaVersion must be 0.2-draft`);
  const id=stableId(raw.id,`${label}.id`);
  if(raw.$schema!==undefined&&typeof raw.$schema!=="string") throw new DomainEvaluationError(`${label}.$schema must be a string`);
  if(raw.castProcess!==undefined) object(raw.castProcess,`${label}.castProcess`);
  const requiresCapabilities=raw.requiresCapabilities===undefined?undefined:(()=>{
    if(!Array.isArray(raw.requiresCapabilities)||raw.requiresCapabilities.some((item)=>typeof item!=="string"||!item)) {
      throw new DomainEvaluationError(`${label}.requiresCapabilities must contain non-empty strings`);
    }
    if(new Set(raw.requiresCapabilities).size!==raw.requiresCapabilities.length) {
      throw new DomainEvaluationError(`${label}.requiresCapabilities must be unique`);
    }
    return [...raw.requiresCapabilities] as string[];
  })();
  const payments=objectArray(raw.payments,`${label}.payments`);
  const bindings=objectArray(raw.bindings,`${label}.bindings`);
  const artifactTemplates=objectArray(raw.artifactTemplates,`${label}.artifactTemplates`);
  const rules=objectArray(raw.rules,`${label}.rules`);
  const interceptors=objectArray(raw.interceptors,`${label}.interceptors`);
  const entryPointObjects=objectArray(raw.entryPoints,`${label}.entryPoints`);
  const entryPoints=entryPointObjects?.map((entry,index)=>{
    const invocation=entry.invocation;
    if(typeof invocation!=="string"||!INVOCATIONS.has(invocation)) {
      throw new DomainEvaluationError(`${label}.entryPoints[${index}].invocation is unsupported`);
    }
    if(!Array.isArray(entry.operations)) throw new DomainEvaluationError(`${label}.entryPoints[${index}].operations must be an array`);
    return {
      ...entry,
      id:stableId(entry.id,`${label}.entryPoints[${index}].id`),
      invocation:invocation as CommonPlayEntryPointIR["invocation"],
      operations:entry.operations.map((operation,operationIndex)=>structuredClone(object(operation,`${label}.entryPoints[${index}].operations[${operationIndex}]`))),
    };
  });
  uniqueIds(entryPoints,label+".entryPoints");
  uniqueIds(bindings,label+".bindings");
  uniqueIds(artifactTemplates,label+".artifactTemplates");
  uniqueIds(rules,label+".rules");
  uniqueIds(interceptors,label+".interceptors");
  return {
    ...structuredClone(raw),
    schemaVersion:"0.2-draft",
    id,
    ...(requiresCapabilities?{requiresCapabilities}:{}),
    ...(payments?{payments}:{}),
    ...(bindings?{bindings}:{}),
    ...(entryPoints?{entryPoints}:{}),
    ...(artifactTemplates?{artifactTemplates}:{}),
    ...(rules?{rules}:{}),
    ...(interceptors?{interceptors}:{}),
  };
}

export function normalizeCommonPlayDefinition(value:unknown,label?:string) {
  return parseCommonPlayDefinition(value,label);
}

export function validateCommonPlayCapabilities(
  definition:CommonPlayDefinitionIR,
  availableCapabilities:Iterable<string>,
) {
  const available=new Set(availableCapabilities);
  const missing=(definition.requiresCapabilities??[]).filter((capability)=>!available.has(capability));
  if(missing.length) throw new DomainEvaluationError(`Common Play definition ${definition.id} requires unavailable capabilities: ${missing.join(", ")}`);
  return definition;
}

function base(definition:CommonPlayDefinitionIR) {
  return {
    ...(definition.$schema?{$schema:definition.$schema}:{}),
    schemaVersion:definition.schemaVersion,
    id:definition.id,
    ...(definition.payments?{payments:structuredClone(definition.payments)}:{}),
  };
}

function referencedTemplates(entryPoint:CommonPlayEntryPointIR) {
  return new Set(entryPoint.operations.flatMap((operation)=>typeof operation.template==="string"?[operation.template]:[]));
}

/** Selects a lowerer from authored structure, never content identity or display text. */
export function lowerCommonPlay(
  definition:CommonPlayDefinitionIR,
  entryPointId:string,
):LoweredCommonPlayEntryPoint {
  const entryPoint=definition.entryPoints?.find((candidate)=>candidate.id===entryPointId);
  if(!entryPoint) throw new DomainEvaluationError(`Common Play entry point not found: ${entryPointId}`);
  const operationKinds=new Set(entryPoint.operations.map((operation)=>operation.kind));
  const referenced=referencedTemplates(entryPoint);
  const templates=(definition.artifactTemplates??[]).filter((template)=>typeof template.id==="string"&&referenced.has(template.id));

  if(operationKinds.has("effect.apply")) {
    if([...operationKinds].some((kind)=>kind!=="effect.apply")) throw new DomainEvaluationError(`Common Play entry point ${entryPointId} mixes incompatible effect activation operations`);
    return {
      kind:"effect",entryPointId,
      definition:{...base(definition),entryPoints:[structuredClone(entryPoint)],artifactTemplates:structuredClone(templates)} as unknown as CommonPlayPersistentEffectDefinition,
    };
  }
  if(operationKinds.has("artifact.spawn")) {
    if([...operationKinds].some((kind)=>kind!=="artifact.spawn")) throw new DomainEvaluationError(`Common Play entry point ${entryPointId} mixes incompatible artifact activation operations`);
    const artifactKinds=new Set(templates.map((template)=>template.artifactKind));
    if(artifactKinds.size===1&&artifactKinds.has("zone")) return {
      kind:"zone",entryPointId,
      definition:{...base(definition),entryPoints:[structuredClone(entryPoint)],artifactTemplates:structuredClone(templates)} as unknown as CommonPlayZoneDefinition,
    };
    if([...artifactKinds].every((kind)=>kind==="stored-invocation"||kind==="object"||kind==="link"||kind==="actor"||kind==="form")) return {
      kind:"artifacts",entryPointId,
      definition:{...base(definition),entryPoints:[structuredClone(entryPoint)],artifactTemplates:structuredClone(templates)} as unknown as CommonPlayArtifactActivationDefinition,
    };
    throw new DomainEvaluationError(`Common Play entry point ${entryPointId} references an unsupported artifact family`);
  }
  const test=entryPoint.test as Obj|undefined;
  if(test?.kind==="saving-throw"&&test.roller==="each-target") {
    return {
      kind:"save-damage",entryPointId,
      definition:{...base(definition),entryPoints:[structuredClone(entryPoint)]} as CommonPlaySaveDamageDefinition,
    };
  }
  const projected={...base(definition),entryPoints:[structuredClone(entryPoint)]};
  return {kind:"operations",entryPointId,definition:parseCommonPlayOperationDefinition(projected)};
}

export function lowerAllCommonPlayEntryPoints(definition:CommonPlayDefinitionIR) {
  return (definition.entryPoints??[]).map((entryPoint)=>lowerCommonPlay(definition,entryPoint.id));
}
