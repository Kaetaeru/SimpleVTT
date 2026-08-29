import type { ResolutionEvent } from "../domain/resolutionTypes";

export function inverseResolutionEvents(events:ResolutionEvent[],undoId:string):ResolutionEvent[] {
  return [...events].reverse().map((event,eventIndex)=>({
    ...structuredClone(event),
    id:`${undoId}:event:${eventIndex+1}`,
    resolutionId:undoId,
    operationId:`undo:${event.operationId}`,
    summary:`Undo · ${event.summary}`,
    provenance:[...event.provenance,{source:`undo:${event.resolutionId}`,status:"applied" as const,reason:"Host-authoritative compensating event"}],
    stateChanges:[...event.stateChanges].reverse().map((change)=>{
      if(change.kind==="effect")return {...structuredClone(change),operation:change.operation==="added"?"removed":change.operation==="removed"?"added":"updated",before:structuredClone(change.after),after:structuredClone(change.before)};
      if(change.kind==="artifact")return {...structuredClone(change),operation:change.operation==="added"?"removed":change.operation==="removed"?"added":"updated",before:structuredClone(change.after),after:structuredClone(change.before)};
      if(change.kind==="combatant")return {...structuredClone(change),operation:change.operation==="added"?"removed":change.operation==="removed"?"added":"updated",before:structuredClone(change.after),after:structuredClone(change.before)};
      if(change.kind==="zone-membership")return {...structuredClone(change),operation:change.operation==="added"?"removed":change.operation==="removed"?"added":"updated",before:structuredClone(change.after),after:structuredClone(change.before)};
      if(change.kind==="concentration")return {...structuredClone(change),before:structuredClone(change.after),after:structuredClone(change.before)};
      if(change.kind==="spellcasting-turn")return {...structuredClone(change),before:structuredClone(change.after),after:structuredClone(change.before)};
      if(change.kind==="hp")return {...structuredClone(change),before:change.after,after:change.before};
      if(change.kind==="economy"&&change.field==="extraActions")return {...structuredClone(change),before:structuredClone(change.after),after:structuredClone(change.before)};
      if(change.kind==="economy"&&change.field==="extraAttacks")return {...structuredClone(change),before:structuredClone(change.after),after:structuredClone(change.before)};
      if(change.kind==="economy")return {...structuredClone(change),before:change.after,after:change.before};
      if(change.kind==="resource")return {...structuredClone(change),before:change.after,after:change.before,recoveryLockouts:change.recoveryLockouts?{before:structuredClone(change.recoveryLockouts.after),after:structuredClone(change.recoveryLockouts.before)}:undefined};
      if(change.kind==="death-save")return {...structuredClone(change),before:change.after,after:change.before};
      return {...structuredClone(change),before:change.after,after:change.before};
    }),
    result:{undoOf:event.id},
  }));
}
