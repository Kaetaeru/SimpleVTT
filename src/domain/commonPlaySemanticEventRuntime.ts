import type { RulesRuntimeState } from "./combatState";
import type { D20TestResult } from "./d20";
import type { CommonPlayAutomaticEffectEvent, CommonPlayPersistentEffectDefinition } from "./commonPlayEffectRuntime";
import { resolveCommonPlayFrequency } from "./commonPlayFrequencyRuntime";
import type { EffectStateChange } from "./runtimeStateChange";
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
    if(!creatureKinds[subjectId]) continue;
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
            for(const [operationIndex,operation] of rule.operations.entries()) {
              const targetId=operation.target==="event.target"?d20.targetId:subjectId;
              if(!targetId) continue;
              const targetCreatureKind=creatureKinds[targetId];
              if(!targetCreatureKind) continue;
              operations.push({
                id:`${pending.id}:automatic:${context.event}:${definitionIndex}:${effectIndex}:${d20Index}:${ruleIndex}:${operationIndex}`,
                kind:"damage",targetId,damageType:operation.damageType,amount:operation.amount.value,creatureKind:targetCreatureKind,when,
              });
            }
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

function lifecycleSemanticEvent(
  pending:PendingResolution,
  operation:PendingResolution["operations"][number],
  authoritativeEvent:ResolutionEvent|undefined,
):ResolutionEvent|undefined {
  if(!authoritativeEvent) return undefined;
  if(operation.kind==="apply-effect") {
    const applied=authoritativeEvent.stateChanges.filter((change):change is EffectStateChange=>change.kind==="effect"&&change.operation==="added");
    if(!applied.length) return undefined;
    return {
      id:`${pending.id}:${operation.id}:semantic:state.applied`,
      resolutionId:pending.id,
      operationId:operation.id,
      kind:"state.applied",
      actorId:authoritativeEvent.actorId,
      targetId:authoritativeEvent.targetId,
      summary:`state.applied (${applied.map((change)=>change.effectId).join(", ")})`,
      provenance:[...authoritativeEvent.provenance],
      stateChanges:[],
      result:structuredClone(applied),
    };
  }
  const lifecycleBoundary=operation.kind==="advance-time"||operation.kind==="begin-turn"||operation.kind==="end-turn"||operation.kind==="short-rest"||operation.kind==="long-rest";
  if(!lifecycleBoundary) return undefined;
  const expired=authoritativeEvent.stateChanges.filter((change):change is EffectStateChange=>change.kind==="effect"&&change.operation==="removed");
  if(!expired.length) return undefined;
  return {
    id:`${pending.id}:${operation.id}:semantic:effect.expired`,
    resolutionId:pending.id,
    operationId:operation.id,
    kind:"effect.expired",
    actorId:authoritativeEvent.actorId,
    targetId:authoritativeEvent.targetId??expired[0].targetId,
    summary:`effect.expired (${expired.map((change)=>change.effectId).join(", ")})`,
    provenance:[...authoritativeEvent.provenance],
    stateChanges:[],
    result:structuredClone(expired),
  };
}

export function appendCommonPlaySemanticOutcomeEvents(
  pending:PendingResolution,
  commit:ResolutionCommit,
):ResolutionCommit {
  if(commit.status==="rejected") return commit;
  const existingIds=new Set(commit.events.map((event)=>event.id));
  const semanticEvents:ResolutionEvent[]=[];
  for(const operation of pending.operations) {
    const lifecycle=lifecycleSemanticEvent(pending,operation,commit.events.find((event)=>event.operationId===operation.id));
    if(lifecycle&&!existingIds.has(lifecycle.id)) semanticEvents.push(lifecycle);
    if(operation.kind==="d20") {
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
      continue;
    }
    if(operation.kind==="short-rest"||operation.kind==="long-rest") {
      const result=commit.results[operation.id];
      if(result===undefined) continue;
      const kind=operation.kind==="short-rest"?"rest.short.complete":"rest.long.complete";
      const id=`${pending.id}:${operation.id}:semantic:${kind}`;
      if(existingIds.has(id)) continue;
      const authoritativeEvent=commit.events.find((event)=>event.operationId===operation.id);
      semanticEvents.push({
        id,
        resolutionId:pending.id,
        operationId:operation.id,
        kind,
        actorId:operation.targetId,
        targetId:operation.targetId,
        summary:`${operation.targetId} completes ${operation.kind}`,
        provenance:authoritativeEvent?[...authoritativeEvent.provenance]:[],
        stateChanges:[],
        result:structuredClone(result),
      });
      continue;
    }
    if(operation.kind!=="recharge-resource") continue;
    const result=commit.results[operation.id] as {success?:unknown;face?:unknown;before?:unknown;after?:unknown}|undefined;
    if(!result||typeof result.success!=="boolean"||typeof result.face!=="number") continue;
    const kind=result.success?"resource.recharge.success":"resource.recharge.failure";
    const id=`${pending.id}:${operation.id}:semantic:${kind}`;
    if(existingIds.has(id)) continue;
    const authoritativeEvent=commit.events.find((event)=>event.operationId===operation.id);
    semanticEvents.push({
      id,
      resolutionId:pending.id,
      operationId:operation.id,
      kind,
      actorId:operation.actorId??pending.actorId,
      targetId:operation.actorId??pending.actorId,
      summary:`${kind} (d${operation.die.sides}=${result.face})`,
      provenance:authoritativeEvent?[...authoritativeEvent.provenance]:[],
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
