import type { RulesRuntimeState } from "./combatState";
import type { RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import type { RuntimeArtifactExpiry, RuntimeArtifactInstance, ZoneMembershipAuthority, ZoneMembershipState } from "./runtimeArtifact";
import { resolveCommonPlayFrequency, type CommonPlayFrequency } from "./commonPlayFrequencyRuntime";
import { compileCommonPlayPayments, parseCommonPlayPayments, type CommonPlayPayment } from "./commonPlayOperationRuntime";
import type { ActionUseKind } from "./turnEconomy";

type LiteralNumberExpression={value:number};
type ZoneEventKind="zone.entered"|"zone.left"|"zone.turn-start"|"zone.turn-end";

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
  frequency:CommonPlayFrequency;
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
  payments?:CommonPlayPayment[];
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
  membershipAuthority:ZoneMembershipAuthority;
  placementRef?:string;
  actionKind?:ActionUseKind;
}

export interface CommonPlayZoneEventInput {
  id:string;
  kind:ZoneEventKind;
  artifactId:string;
  subjectId:string;
  subjectCreatureKind:"character"|"monster";
}

export interface CommonPlayZoneMembershipChangeInput {
  id:string;
  artifactId:string;
  subjectId:string;
  subjectCreatureKind:"character"|"monster";
  authority:ZoneMembershipAuthority;
  present:boolean;
}

export interface CommonPlayZoneTurnEventInput {
  id:string;
  kind:"zone.turn-start"|"zone.turn-end";
  artifactId:string;
  subjectId:string;
  subjectCreatureKind:"character"|"monster";
}

export type CommonPlayZoneTurnOperationsResult=
  | {status:"compiled";actorId:string;operations:ResolutionOperation[]}
  | CommonPlayZoneEventNoMatch;

export interface CommonPlayZoneEventNoMatch {
  status:"no-match";
  state:RulesRuntimeState;
  reason:string;
}

export type CommonPlayZoneEventResult=ResolutionCommit|CommonPlayZoneEventNoMatch;

const DEFINITION_KEYS=["$schema","schemaVersion","id","payments","entryPoints","artifactTemplates"] as const;

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
  if (rule.event!=="zone.entered"&&rule.event!=="zone.left"&&rule.event!=="zone.turn-start"&&rule.event!=="zone.turn-end") {
    throw new Error(`${label} event is not supported by the zone runtime slice`);
  }
  if (!["unlimited","once","once-per-turn","once-per-round","once-per-resolution"].includes(rule.frequency)) throw new Error(`${label} frequency is unsupported`);
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
  return {
    id:`common-play-zone-spawn-${operationIndex+1}`,
    kind:"spawn-artifact",
    zoneMembershipAuthority:input.membershipAuthority,
    artifact:{
      id:`${input.resolutionId}:artifact:${operationIndex+1}:${template.id}`,
      sourceId:definition.id,
      sourceActorId:input.actorId,
      templateId:template.id,
      artifactKind:"zone",
      ...(input.placementRef ? {placementRef:input.placementRef} : {}),
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
  if (input.membershipAuthority!=="manual"&&input.membershipAuthority!=="spatial") {
    throw new Error(`unsupported zone membership authority: ${input.membershipAuthority}`);
  }
  const entryPoint=definition.entryPoints.find((candidate)=>candidate.id===input.entryPointId);
  if (!entryPoint) throw new Error(`Common Play entry point not found: ${input.entryPointId}`);
  assertOnlyKeys(entryPoint,["id","invocation","operations"],`entry point ${entryPoint.id}`);
  if (entryPoint.invocation!=="manual") throw new Error("zone activation runtime requires a manual entry point");
  if (!Array.isArray(entryPoint.operations)||!entryPoint.operations.length) {
    throw new Error("zone activation entry point requires at least one operation");
  }
  const operations:ResolutionOperation[]=[...compileCommonPlayPayments(parseCommonPlayPayments(definition.payments),input),...entryPoint.operations.map((operation,index)=>{
    const label=`entry point ${entryPoint.id} operation ${index+1}`;
    assertOnlyKeys(operation,["kind","template"],label);
    if (operation.kind!=="artifact.spawn") throw new Error(`${label} supports only artifact.spawn`);
    return artifactForTemplate(inputState,definition,templateById(definition,operation.template),input,index);
  })];
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

function activeMembership(state:RulesRuntimeState,artifactId:string):ZoneMembershipState|undefined {
  return (state.zoneMemberships??[]).find((membership)=>membership.artifactId===artifactId);
}

function validateSemanticEvent(state:RulesRuntimeState,input:CommonPlayZoneEventInput) {
  if (!input.id||!input.artifactId||!input.subjectId) throw new Error("zone event id, artifactId, and subjectId are required");
  if (input.kind!=="zone.entered"&&input.kind!=="zone.left"&&input.kind!=="zone.turn-start"&&input.kind!=="zone.turn-end") {
    throw new Error(`unsupported zone event: ${input.kind}`);
  }
  if (input.kind==="zone.turn-start") {
    if (state.clock.phase!=="start"||state.clock.activeActorId!==input.subjectId) {
      throw new Error("zone.turn-start must match the authoritative active actor at turn start");
    }
  }
  if (input.kind==="zone.turn-end") {
    if (state.clock.phase!=="end"||state.clock.activeActorId!==input.subjectId) {
      throw new Error("zone.turn-end must match the authoritative active actor at turn end");
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
  const operations:ResolutionOperation[]=[];
  template.rules.forEach((rule,ruleIndex)=>{
    if (rule.event!==input.kind) return;
    const frequency=resolveCommonPlayFrequency({
      ruleId:rule.id,subjectId:input.subjectId,frequency:rule.frequency,resolutionId:input.id,
      clock:state.clock,markers:artifact.metadata??{},
    });
    if (!frequency.eligible) return;
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
    if(Object.keys(frequency.metadataPatch).length) operations.push({
      id:`common-play-zone-rule-${ruleIndex+1}-frequency`,kind:"update-artifact",artifactId:artifact.id,
      metadataPatch:frequency.metadataPatch,
    });
  });
  return operations;
}

function activeUnexpiredZone(
  state:RulesRuntimeState,
  definition:CommonPlayZoneDefinition,
  artifactId:string,
):RuntimeArtifactInstance|CommonPlayZoneEventNoMatch {
  const artifact=activeZone(state,definition,artifactId);
  if (!artifact) return {status:"no-match",state,reason:"no active Common Play zone matches the authoritative event"};
  if (artifact.expiry.kind==="time"&&state.clock.elapsedSeconds>=artifact.expiry.elapsedSeconds) {
    return {status:"no-match",state,reason:"zone artifact is expired"};
  }
  return artifact;
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
    const artifact=activeUnexpiredZone(inputState,definition,input.artifactId);
    if ("status" in artifact) return artifact;
    const operations=triggerOperations(inputState,definition,artifact,input);
    if (!operations.length) {
      return {status:"no-match",state:inputState,reason:"matching zone rules are already consumed for the active turn or no rule matches the event"};
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

export function resolveCommonPlayZoneMembershipChange(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  definition:CommonPlayZoneDefinition,
  input:CommonPlayZoneMembershipChangeInput,
):CommonPlayZoneEventResult {
  try {
    validateDefinition(definition);
    if (!input.id||!input.artifactId||!input.subjectId) throw new Error("zone membership event id, artifactId, and subjectId are required");
    if (input.authority!=="manual"&&input.authority!=="spatial") throw new Error(`unsupported zone membership authority: ${input.authority}`);
    const artifact=activeUnexpiredZone(inputState,definition,input.artifactId);
    if ("status" in artifact) return artifact;
    const membership=activeMembership(inputState,artifact.id);
    if (!membership) return rejected(inputState,`zone membership not found: ${artifact.id}`);
    if (membership.authority!==input.authority) {
      return rejected(inputState,`zone membership authority mismatch: expected ${membership.authority}, received ${input.authority}`);
    }
    const alreadyPresent=membership.memberIds.includes(input.subjectId);
    if (alreadyPresent===input.present) {
      return {status:"no-match",state:inputState,reason:`zone membership already ${input.present?"contains":"excludes"} subject`};
    }
    const event:CommonPlayZoneEventInput={
      id:input.id,
      kind:input.present?"zone.entered":"zone.left",
      artifactId:input.artifactId,
      subjectId:input.subjectId,
      subjectCreatureKind:input.subjectCreatureKind,
    };
    validateSemanticEvent(inputState,event);
    const operations:ResolutionOperation[]=[{
      id:"common-play-zone-membership",
      kind:"set-zone-membership",
      artifactId:input.artifactId,
      authority:input.authority,
      memberId:input.subjectId,
      present:input.present,
    },...triggerOperations(inputState,definition,artifact,event)];
    return resolvePendingResolution(profile,inputState,{
      id:`${input.id}:${definition.id}:${artifact.id}:zone-membership`,
      actorId:artifact.sourceActorId??input.subjectId,
      sourceId:definition.id,
      expectedRevision:inputState.revision,
      operations,
    });
  } catch (error) {
    return rejected(inputState,error instanceof Error?error.message:String(error));
  }
}

export function resolveCommonPlayZoneTurnEvent(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  definition:CommonPlayZoneDefinition,
  input:CommonPlayZoneTurnEventInput,
):CommonPlayZoneEventResult {
  try {
    const compiled=compileCommonPlayZoneTurnEventOperations(inputState,definition,input);
    if(compiled.status==="no-match") return compiled;
    return resolvePendingResolution(profile,inputState,{
      id:`${input.id}:${definition.id}:${input.artifactId}:zone-turn`,actorId:compiled.actorId,sourceId:definition.id,
      expectedRevision:inputState.revision,operations:compiled.operations,
    });
  } catch (error) {
    return rejected(inputState,error instanceof Error?error.message:String(error));
  }
}

export function compileCommonPlayZoneTurnEventOperations(
  inputState:RulesRuntimeState,
  definition:CommonPlayZoneDefinition,
  input:CommonPlayZoneTurnEventInput,
):CommonPlayZoneTurnOperationsResult {
  validateDefinition(definition);
  const event:CommonPlayZoneEventInput={...input};
  validateSemanticEvent(inputState,event);
  const artifact=activeUnexpiredZone(inputState,definition,input.artifactId);
  if("status" in artifact) return artifact;
  const membership=activeMembership(inputState,artifact.id);
  if(!membership?.memberIds.includes(input.subjectId)) {
    return {status:"no-match",state:inputState,reason:"active subject is not a member of the zone"};
  }
  const operations=triggerOperations(inputState,definition,artifact,event).map((operation)=>({
    ...operation,id:`${input.id}:${artifact.id}:${operation.id}`,
  }));
  if(!operations.length) {
    return {status:"no-match",state:inputState,reason:"matching zone rules are already consumed for the active turn or no rule matches the event"};
  }
  return {status:"compiled",actorId:artifact.sourceActorId??input.subjectId,operations};
}
