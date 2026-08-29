import type { MockAdapter } from "./mockAdapter";
import { catalogQualifiedId } from "./contentCatalogIdentity";
import { requiredSessionInstalledContent } from "./installedContentRuntimeAdapter";
import { parseInstalledCommonPlayActionId } from "./installedCommonPlayActionReference";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import type { RulesRuntimeState } from "../domain/combatState";
import { parseCommonPlayDefinition } from "../domain/commonPlayDefinitionRuntime";
import { resolveCommonPlayFrequency, type CommonPlayFrequency } from "../domain/commonPlayFrequencyRuntime";
import { compileCommonPlayEntryPointOperations, parseCommonPlayOperationDefinition } from "../domain/commonPlayOperationRuntime";
import { DomainEvaluationError } from "../domain/profileEngine";
import type { ResolutionOperation } from "../domain/resolutionTypes";

type TurnBoundaryKind="turn-start"|"turn-end";
type RawRule=Record<string,unknown>;

type ActorTurnRule={
  id:string;
  event:TurnBoundaryKind;
  frequency:CommonPlayFrequency;
  operations:Record<string,unknown>[];
};

export interface InstalledCommonPlayActorTurnRuleBinding {
  artifactId:string;
  actorId:string;
  definitionId:string;
  rules:ActorTurnRule[];
}

const FREQUENCIES=new Set<CommonPlayFrequency>(["unlimited","once","once-per-turn","once-per-round","once-per-resolution"]);

function turnRule(value:RawRule,index:number):ActorTurnRule|undefined {
  if(value.event!=="turn-start"&&value.event!=="turn-end") return undefined;
  if(typeof value.id!=="string"||!value.id) throw new DomainEvaluationError(`Common Play turn rule ${index+1} requires an id`);
  if(value.when!==undefined||value.interaction!==undefined) {
    throw new DomainEvaluationError(`Common Play turn rule ${value.id} predicate/interaction is not supported by this production slice`);
  }
  const frequency=value.frequency??"unlimited";
  if(typeof frequency!=="string"||!FREQUENCIES.has(frequency as CommonPlayFrequency)) {
    throw new DomainEvaluationError(`Common Play turn rule ${value.id} frequency is not supported by this production slice`);
  }
  if(!Array.isArray(value.operations)||!value.operations.length) {
    throw new DomainEvaluationError(`Common Play turn rule ${value.id} requires operations`);
  }
  const operations=value.operations.map((operation,operationIndex)=>{
    if(!operation||typeof operation!=="object"||Array.isArray(operation)) {
      throw new DomainEvaluationError(`Common Play turn rule ${value.id} operation ${operationIndex+1} must be an object`);
    }
    const record=structuredClone(operation as Record<string,unknown>);
    if(record.kind!=="resource.change") {
      throw new DomainEvaluationError(`Common Play actor turn rule ${value.id} currently supports resource.change only`);
    }
    return record;
  });
  return {id:value.id,event:value.event,frequency:frequency as CommonPlayFrequency,operations};
}

export async function installedCommonPlayActorTurnRuleBindings(
  adapter:MockAdapter,
  state:RulesRuntimeState,
):Promise<InstalledCommonPlayActorTurnRuleBinding[]> {
  const installed=await requiredSessionInstalledContent(adapter,[]);
  const entries=new Map(installed.map((entry)=>[catalogQualifiedId(entry.contentId,entry.sourceId,entry.version),entry]));
  const bindings:InstalledCommonPlayActorTurnRuleBinding[]=[];
  const seen=new Set<string>();

  for(const artifact of state.artifacts??[]) {
    if(artifact.artifactKind!=="actor"||!artifact.actor) continue;
    for(const actionDefinitionId of artifact.actor.actionDefinitionIds) {
      const reference=parseInstalledCommonPlayActionId(actionDefinitionId);
      if(!reference) continue;
      const entry=entries.get(reference.catalogId);
      const mechanic=entry?.mechanics?.find((candidate)=>candidate.kind==="common-play"&&candidate.config.id===reference.mechanicId);
      if(!mechanic) continue;
      const definition=parseCommonPlayDefinition(mechanic.config,`Installed actor turn Common Play ${reference.catalogId} ${reference.mechanicId}`);
      if(!definition.entryPoints?.some((entryPoint)=>entryPoint.id===reference.entryPointId)) continue;
      const key=`${artifact.id}:${reference.catalogId}:${definition.id}`;
      if(seen.has(key)) continue;
      seen.add(key);
      const rules=(definition.rules??[]).map((rule,index)=>turnRule(rule,index)).filter((rule):rule is ActorTurnRule=>Boolean(rule));
      if(rules.length) bindings.push({artifactId:artifact.id,actorId:artifact.actor.combatantId,definitionId:definition.id,rules});
    }
  }
  return bindings;
}

export function compileInstalledCommonPlayActorTurnRuleOperations(
  state:RulesRuntimeState,
  bindings:InstalledCommonPlayActorTurnRuleBinding[],
  input:{id:string;kind:TurnBoundaryKind;actorId:string},
):ResolutionOperation[] {
  const operations:ResolutionOperation[]=[];
  for(const binding of bindings) {
    if(binding.actorId!==input.actorId) continue;
    const artifact=(state.artifacts??[]).find((candidate)=>candidate.id===binding.artifactId&&candidate.artifactKind==="actor"&&candidate.actor?.combatantId===input.actorId);
    if(!artifact) continue;
    for(const rule of binding.rules) {
      if(rule.event!==input.kind) continue;
      const frequency=resolveCommonPlayFrequency({
        ruleId:`${binding.definitionId}:${rule.id}`,
        subjectId:input.actorId,
        frequency:rule.frequency,
        resolutionId:input.id,
        clock:state.clock,
        markers:artifact.metadata??{},
      });
      if(!frequency.eligible) continue;
      const entryPointId=`turn-rule-${rule.id}`;
      const resolutionId=`${input.id}:${artifact.id}:${rule.id}`;
      const definition=parseCommonPlayOperationDefinition({
        schemaVersion:"0.2-draft",
        id:binding.definitionId,
        entryPoints:[{id:entryPointId,invocation:"manual",operations:rule.operations}],
      },`Common Play actor turn rule ${binding.definitionId}:${rule.id}`);
      const pending=compileCommonPlayEntryPointOperations(SIMPLEVTT_APP_RULES_PROFILE,state,definition,{
        resolutionId,actorId:input.actorId,entryPointId,
      });
      operations.push(...pending.operations);
      if(Object.keys(frequency.metadataPatch).length) operations.push({
        id:`${resolutionId}:frequency`,
        kind:"update-artifact",
        artifactId:artifact.id,
        metadataPatch:frequency.metadataPatch,
      });
    }
  }
  return operations;
}
