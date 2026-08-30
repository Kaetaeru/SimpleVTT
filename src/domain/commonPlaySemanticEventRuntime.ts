import type { D20TestResult } from "./d20";
import type { PendingResolution, ResolutionCommit, ResolutionEvent } from "./resolutionTypes";

function semanticKind(result:D20TestResult) {
  if(result.family==="attack-roll") return result.outcome==="success"?"attack.hit":"attack.miss";
  if(result.family==="saving-throw") return result.outcome==="success"?"save.success":"save.failure";
  return undefined;
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
