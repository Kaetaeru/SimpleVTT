import type { RulesRuntimeState } from "./combatState";
import type { D20TestResult } from "./d20";
import type { CommonPlayAutomaticEffectEvent, CommonPlayPersistentEffectDefinition } from "./commonPlayEffectRuntime";
import { resolveCommonPlayFrequency } from "./commonPlayFrequencyRuntime";
import type { PendingResolution, ResolutionCommit, ResolutionEvent, ResolutionOperation } from "./resolutionTypes";

function semanticKind(result:D20TestResult):CommonPlayAutomaticEffectEvent|undefined {
  if(result.family==="attack-roll") return result.outcome==="success"?"attack.hit":"attack.miss";
  if(result.family==="saving-throw") return result.outcome==="success"?"save.success":"save.failure";
  return undefined;
}

const EFFECT_METADATA_DEFINITION="commonPlayDefinitionId";
const EFFECT_METADATA_TEMPLATE="commonPlayTemplateId";

function semanticContexts(operation:Extract<PendingResolution["operations"][number],{kind:"d20"}>) {
  if(operation.request.family==="attack-roll") return [{event:"attack.hit" as const,outcome:"success" as const},{event:"attack.miss" as const,outcome:"failure" as const}];
  if(operation.request.family==="saving-throw") return [{event:"save.success" as const,outcome:"success" as const},{event:"save.failure" as const,outcome:"failure" as const}];
  return [];
}

export function appendCommonPlaySemanticOutcomeTriggers(
  state:RulesRuntimeState,
  definitions:CommonPlayPersistentEffectDefinition[],
  pending:PendingResolution,
  creatureKinds:Record<string,"character"|"monster">,
):PendingResolution {
  const operations:ResolutionOperation[]=[...pending.operations];
  for(const [d20Index,d20] of pending.operations.entries()) {
    if(d20.kind!=="d20") continue;
    const subjectId=d20.actorId??pending.actorId;
    const creatureKind=creatureKinds[subjectId];
    if(!creatureKind) continue;
    for(const context of semanticContexts(d20)) {
      const when={operationId:d20.id,field:"outcome",equals:context.outcome} as const;
      for(const [definitionIndex,definition] of definitions.entries()) {
        for(const [effectIndex,effect] of state.effects.filter((candidate)=>candidate.targetId===subjectId&&candidate.sourceId===definition.id&&candidate.metadata?.[EFFECT_METADATA_DEFINITION]===definition.id).entries()) {
          const templateId=effect.metadata?.[EFFECT_METADATA_TEMPLATE];
          if(typeof templateId!=="string") continue;
          const template=definition.artifactTemplates.find((candidate)=>candidate.id===templateId);
          if(!template) continue;
          for(const [ruleIndex,rule] of template.rules.filter((candidate)=>candidate.event===context.event).entries()) {
            const frequency=resolveCommonPlayFrequency({ruleId:rule.id,subjectId,frequency:rule.frequency??"once",resolutionId:pending.id,clock:state.clock,markers:effect.metadata??{}});
            if(!frequency.eligible) continue;
            for(const [operationIndex,operation] of rule.operations.entries()) operations.push({
              id:`${pending.id}:automatic:${context.event}:${definitionIndex}:${effectIndex}:${d20Index}:${ruleIndex}:${operationIndex}`,
              kind:"damage",targetId:subjectId,damageType:operation.damageType,amount:operation.amount.value,creatureKind,when,
            });
            if(template.lifetime.kind==="until-duration"&&Object.keys(frequency.metadataPatch).length) operations.push({
              id:`${pending.id}:automatic:${context.event}:${definitionIndex}:${effectIndex}:${d20Index}:${ruleIndex}:frequency`,kind:"update-effect",effectId:effect.id,metadataPatch:frequency.metadataPatch,when,
            });
          }
        }
      }
    }
  }
  return operations.length===pending.operations.length?pending:{...pending,operations};
}

export function appendCommonPlaySemanticOutcomeEvents(
  pending:PendingResolution,
  commit:ResolutionCommit,
):ResolutionCommit {
  if(commit.status==="rejected") return commit;
  const existingIds=new Set(commit.events.map((event)=>event.id));
  const semanticEvents:ResolutionEvent[]=[];
  for(const operation of pending.operations) {
    if(operation.kind!=="d20") continue;
    const result=commit.results[operation.id] as D20TestResult|undefined;
    if(!result||result.family!==operation.request.family) continue;
    const kind=semanticKind(result);
    if(!kind) continue;
    const id=`${pending.id}:${operation.id}:semantic:${kind}`;
    if(existingIds.has(id)) continue;
    semanticEvents.push({
      id,
      resolutionId:pending.id,
      operationId:operation.id,
      kind,
      actorId:operation.actorId??pending.actorId,
      targetId:operation.targetId,
      summary:`${kind} (${result.total} vs ${result.target})`,
      provenance:[...result.provenance],
      stateChanges:[],
      result:structuredClone(result),
    });
  }
  if(!semanticEvents.length) return commit;
  return {
    ...commit,
    state:{
      ...commit.state,
      history:[...commit.state.history,...semanticEvents.map((event)=>({
        id:event.id,
        resolutionId:event.resolutionId,
        operationId:event.operationId,
        kind:event.kind,
        actorId:event.actorId,
        targetId:event.targetId,
        summary:event.summary,
      }))],
    },
    events:[...commit.events,...semanticEvents],
  };
}
