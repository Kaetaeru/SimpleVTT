import type { RulesRuntimeState } from "./combatState";
import type { RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import type { RuntimeArtifactExpiry, RuntimeArtifactInstance } from "./runtimeArtifact";

type LiteralNumberExpression={value:number};
type ZoneEventKind="zone.entered"|"zone.turn-start";

interface CommonPlayArtifactSpawnOperation {
  kind:"artifact.spawn";
  template:string;
}

interface CommonPlayZoneDamageOperation {
  kind:"damage.apply";
  amount:LiteralNumberExpression;
  damageType:string;
  target:"event.subject";
}

interface CommonPlayZoneRule {
  id:string;
  event:ZoneEventKind;
  frequency:"once-per-turn";
  operations:CommonPlayZoneDamageOperation[];
}

interface CommonPlayZoneDuration {
  kind:"elapsed";
  amount:LiteralNumberExpression;
  unit:"seconds"|"minutes"|"hours"|"days";
  decrementAt?:string;
}

interface CommonPlayZoneArtifactTemplate {
  id:string;
  artifactKind:"zone";
  duration:CommonPlayZoneDuration;
  rules:CommonPlayZoneRule[];
  lifetime:{kind:"until-duration";onEnd:"destroy"};
  instancePolicy?:"stack";
}

export interface CommonPlayZoneDefinition {
  $schema?:string;
  schemaVersion:"0.2-draft";
  id:string;
  entryPoints:Array<{
    id:string;
    invocation:"manual"|"triggered"|"automatic"|"granted";
    operations:CommonPlayArtifactSpawnOperation[];
  }>;
  artifactTemplates:CommonPlayZoneArtifactTemplate[];
}

export interface CommonPlayZoneActivationInput {
  resolutionId:string;
  actorId:string;
  entryPointId:string;
  placementRef:string;
}

export interface CommonPlayZoneEventInput {
  id:string;
  kind:ZoneEventKind;
  artifactId:string;
  subjectId:string;
  subjectCreatureKind:"character"|"monster";
}

export interface CommonPlayZoneEventNoMatch {
  status:"no-match";
  state:RulesRuntimeState;
  reason:string;
}

export type CommonPlayZoneEventResult=ResolutionCommit|CommonPlayZoneEventNoMatch;

const DEFINITION_KEYS=["$schema","schemaVersion","id","entryPoints","artifactTemplates"] as const;
const FREQUENCY_PREFIX="commonPlayRuleOncePerTurn";

function rejected(state:RulesRuntimeState,error:string):Extract<ResolutionCommit,{status:"rejected"}> {
  return {status:"rejected",state,events:[],results:{},error};
}

function assertOnlyKeys(value:object,allowed:readonly string[],label:string) {
  const unsupported=Object.keys(value).filter((key)=>!allowed.includes(key));
  if (unsupported.length) throw new Error(`${label} contains unsupported field(s): ${unsupported.join(", ")}`);
}

function literalNumber(expression:LiteralNumberExpression,label:string) {
  if (!expression||typeof expression!=="object"||!Number.isFinite(expression.value)) {
    throw new Error(`${label} requires a finite literal number`);
  }
  return expression.value;
}

function durationSeconds(duration:CommonPlayZoneDuration,label:string) {
  assertOnlyKeys(duration,["kind","amount","unit","decrementAt"],label);
  if (duration.kind!=="elapsed") throw new Error(`${label} must use elapsed duration in this runtime slice`);
  if (duration.decrementAt!==undefined) throw new Error(`${label} decrementAt is not supported in this runtime slice`);
  const amount=literalNumber(duration.amount,`${label} amount`);
  if (amount<=0) throw new Error(`${label} amount must be positive`);
  const multiplier=duration.unit==="seconds"?1
    :duration.unit==="minutes"?60
    :duration.unit==="hours"?3600
    :duration.unit==="days"?86400
    :undefined;
  if (!multiplier) throw new Error(`${label} unit is not supported in this runtime slice`);
  return amount*multiplier;
}

function validateRule(rule:CommonPlayZoneRule,templateId:string,ruleIndex:number) {
  const label=`artifact ${templateId} rule ${ruleIndex+1}`;
  assertOnlyKeys(rule,["id","event","frequency","operations"],label);
  if (!rule.id) throw new Error(`${label} id is required`);
  if (rule.event!=="zone.entered"&&rule.event!=="zone.turn-start") {
    throw new Error(`${label} event is not supported by the zone runtime slice`);
  }
  if (rule.frequency!=="once-per-turn") {
    throw new Error(`${label} supports only once-per-turn frequency in this runtime slice`);
  }
  if (!Array.isArray(rule.operations)||!rule.operations.length) throw new Error(`${label} requires at least one operation`);
  rule.operations.forEach((operation,index)=>{
    const operationLabel=`${label} operation ${index+1}`;
    assertOnlyKeys(operation,["kind","amount","damageType","target"],operationLabel);
    if (operation.kind!=="damage.apply") throw new Error(`${operationLabel} supports only damage.apply`);
    const amount=literalNumber(operation.amount,`${operationLabel} amount`);
    if (!Number.isInteger(amount)||amount<0) throw new Error(`${operationLabel} amount must be a non-negative integer`);
    if (!operation.damageType) throw new Error(`${operationLabel} damageType is required`);
    if (operation.target!=="event.subject") throw new Error(`${operationLabel} target must be event.subject in this runtime slice`);
  });
}

function validateTemplate(template:CommonPlayZoneArtifactTemplate,index:number) {
  const label=`artifact template ${index+1}`;
  assertOnlyKeys(template,["id","artifactKind","duration","rules","lifetime","instancePolicy"],label);
  if (!template.id) throw new Error(`${label} id is required`);
  if (template.artifactKind!=="zone") throw new Error(`${label} must be a zone artifact`);
  durationSeconds(template.duration,`${label} duration`);
  if (!Array.isArray(template.rules)||!template.rules.length) throw new Error(`${label} requires at least one rule`);
  const ruleIds=new Set<string>();
  template.rules.forEach((rule,ruleIndex)=>{
    validateRule(rule,template.id,ruleIndex);
    if (ruleIds.has(rule.id)) throw new Error(`duplicate artifact rule id: ${rule.id}`);
    ruleIds.add(rule.id);
  });
  assertOnlyKeys(template.lifetime,["kind","onEnd"],`${label} lifetime`);
  if (template.lifetime.kind!=="until-duration"||template.lifetime.onEnd!=="destroy") {
    throw new Error(`${label} lifetime must destroy on duration expiry in this runtime slice`);
  }
  if (template.instancePolicy!==undefined&&template.instancePolicy!=="stack") {
    throw new Error(`${label} supports only stack instancePolicy in this runtime slice`);
  }
}

function validateDefinition(definition:CommonPlayZoneDefinition) {
  assertOnlyKeys(definition,DEFINITION_KEYS,"Common Play definition");
  if (definition.schemaVersion!=="0.2-draft") throw new Error(`unsupported Common Play schema version: ${definition.schemaVersion}`);
  if (!definition.id) throw new Error("Common Play definition id is required");
  if (!Array.isArray(definition.entryPoints)) throw new Error("Common Play entryPoints are required");
  if (!Array.isArray(definition.artifactTemplates)||!definition.artifactTemplates.length) {
    throw new Error("Common Play artifactTemplates are required");
  }
  const templateIds=new Set<string>();
  definition.artifactTemplates.forEach((template,index)=>{
    validateTemplate(template,index);
    if (templateIds.has(template.id)) throw new Error(`duplicate artifact template id: ${template.id}`);
    templateIds.add(template.id);
  });
}

function templateById(definition:CommonPlayZoneDefinition,id:string) {
  const template=definition.artifactTemplates.find((candidate)=>candidate.id===id);
  if (!template) throw new Error(`artifact template not found: ${id}`);
  return template;
}

function runtimeExpiry(state:RulesRuntimeState,template:CommonPlayZoneArtifactTemplate):RuntimeArtifactExpiry {
  return {
    kind:"time",
    elapsedSeconds:state.clock.elapsedSeconds+durationSeconds(template.duration,`artifact ${template.id} duration`),
  };
}

function artifactForTemplate(
  inputState:RulesRuntimeState,
  definition:CommonPlayZoneDefinition,
  template:CommonPlayZoneArtifactTemplate,
  input:CommonPlayZoneActivationInput,
  operationIndex:number,
):Extract<ResolutionOperation,{kind:"spawn-artifact"}> {
  if (!input.placementRef) throw new Error("zone activation requires an opaque placementRef from the authoritative spatial layer");
  return {
    id:`common-play-zone-spawn-${operationIndex+1}`,
    kind:"spawn-artifact",
    artifact:{
      id:`${input.resolutionId}:artifact:${operationIndex+1}:${template.id}`,
      sourceId:definition.id,
      sourceActorId:input.actorId,
      templateId:template.id,
      artifactKind:"zone",
      placementRef:input.placementRef,
      expiry:runtimeExpiry(inputState,template),
    },
  };
}

export function compileCommonPlayZoneActivation(
  inputState:RulesRuntimeState,
  definition:CommonPlayZoneDefinition,
  input:CommonPlayZoneActivationInput,
):PendingResolution {
  validateDefinition(definition);
  if (!input.resolutionId||!input.actorId) throw new Error("resolutionId and actorId are required");
  const entryPoint=definition.entryPoints.find((candidate)=>candidate.id===input.entryPointId);
  if (!entryPoint) throw new Error(`Common Play entry point not found: ${input.entryPointId}`);
  assertOnlyKeys(entryPoint,["id","invocation","operations"],`entry point ${entryPoint.id}`);
  if (entryPoint.invocation!=="manual") throw new Error("zone activation runtime requires a manual entry point");
  if (!Array.isArray(entryPoint.operations)||!entryPoint.operations.length) {
    throw new Error("zone activation entry point requires at least one operation");
  }
  const operations=entryPoint.operations.map((operation,index)=>{
    const label=`entry point ${entryPoint.id} operation ${index+1}`;
    assertOnlyKeys(operation,["kind","template"],label);
    if (operation.kind!=="artifact.spawn") throw new Error(`${label} supports only artifact.spawn`);
    return artifactForTemplate(inputState,definition,templateById(definition,operation.template),input,index);
  });
  return {
    id:input.resolutionId,
    actorId:input.actorId,
    sourceId:definition.id,
    expectedRevision:inputState.revision,
    operations,
  };
}

export function resolveCommonPlayZoneActivation(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  definition:CommonPlayZoneDefinition,
  input:CommonPlayZoneActivationInput,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileCommonPlayZoneActivation(inputState,definition,input));
  } catch (error) {
    return rejected(inputState,error instanceof Error?error.message:String(error));
  }
}

function activeZone(
  state:RulesRuntimeState,
  definition:CommonPlayZoneDefinition,
  artifactId:string,
):RuntimeArtifactInstance|undefined {
  return (state.artifacts??[]).find((artifact)=>
    artifact.id===artifactId
    && artifact.artifactKind==="zone"
    && artifact.sourceId===definition.id
    && definition.artifactTemplates.some((template)=>template.id===artifact.templateId)
  );
}

function currentTurnToken(state:RulesRuntimeState) {
  if (!state.clock.activeActorId) throw new Error("once-per-turn zone rules require an authoritative active turn");
  return `${state.clock.round}:${state.clock.activeActorId}`;
}

function frequencyKey(ruleId:string,subjectId:string) {
  return `${FREQUENCY_PREFIX}:${ruleId}:${subjectId}`;
}

function validateSemanticEvent(state:RulesRuntimeState,input:CommonPlayZoneEventInput) {
  if (!input.id||!input.artifactId||!input.subjectId) throw new Error("zone event id, artifactId, and subjectId are required");
  if (input.kind!=="zone.entered"&&input.kind!=="zone.turn-start") throw new Error(`unsupported zone event: ${input.kind}`);
  if (input.kind==="zone.turn-start") {
    if (state.clock.phase!=="start"||state.clock.activeActorId!==input.subjectId) {
      throw new Error("zone.turn-start must match the authoritative active actor at turn start");
    }
  }
}

function triggerOperations(
  state:RulesRuntimeState,
  definition:CommonPlayZoneDefinition,
  artifact:RuntimeArtifactInstance,
  input:CommonPlayZoneEventInput,
):ResolutionOperation[] {
  const template=templateById(definition,artifact.templateId);
  const turnToken=currentTurnToken(state);
  const operations:ResolutionOperation[]=[];
  template.rules.forEach((rule,ruleIndex)=>{
    if (rule.event!==input.kind) return;
    const markerKey=frequencyKey(rule.id,input.subjectId);
    if (artifact.metadata?.[markerKey]===turnToken) return;
    rule.operations.forEach((operation,operationIndex)=>{
      operations.push({
        id:`common-play-zone-rule-${ruleIndex+1}-damage-${operationIndex+1}`,
        kind:"damage",
        targetId:input.subjectId,
        damageType:operation.damageType,
        amount:literalNumber(operation.amount,`artifact ${template.id} rule ${rule.id} damage amount`),
        creatureKind:input.subjectCreatureKind,
      });
    });
    operations.push({
      id:`common-play-zone-rule-${ruleIndex+1}-frequency`,
      kind:"update-artifact",
      artifactId:artifact.id,
      metadataPatch:{[markerKey]:turnToken},
    });
  });
  return operations;
}

export function resolveCommonPlayZoneEvent(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  definition:CommonPlayZoneDefinition,
  input:CommonPlayZoneEventInput,
):CommonPlayZoneEventResult {
  try {
    validateDefinition(definition);
    validateSemanticEvent(inputState,input);
    const artifact=activeZone(inputState,definition,input.artifactId);
    if (!artifact) return {status:"no-match",state:inputState,reason:"no active Common Play zone matches the authoritative event"};
    if (artifact.expiry.kind==="time"&&inputState.clock.elapsedSeconds>=artifact.expiry.elapsedSeconds) {
      return {status:"no-match",state:inputState,reason:"zone artifact is expired"};
    }
    const operations=triggerOperations(inputState,definition,artifact,input);
    if (!operations.length) {
      return {status:"no-match",state:inputState,reason:"matching zone rules are already consumed for the active turn"};
    }
    return resolvePendingResolution(profile,inputState,{
      id:`${input.id}:${definition.id}:${artifact.id}:zone-rules`,
      actorId:artifact.sourceActorId??input.subjectId,
      sourceId:definition.id,
      expectedRevision:inputState.revision,
      operations,
    });
  } catch (error) {
    return rejected(inputState,error instanceof Error?error.message:String(error));
  }
}
