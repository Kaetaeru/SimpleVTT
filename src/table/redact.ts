import { pruneEngagementsToPresent } from "../domain/engagement";
import type { RulesRuntimeState } from "../domain/combatState";
import { applyEvent, type TableEvent } from "./events";
import type { TableViewer } from "./project";
import { cloneState, type LogEntry, type TableQuestion, type TableState } from "./state";

/**
 * Privacy at the wire (capability inventory §19, P0d): a player's payload never contains a hidden actor, a DM-only
 * roll's card or log line, or another peer's question. The DM sees everything. Redaction is a pure function of the
 * Host's state so a redacted replica stays a valid table for `applyEvent` and `projectTable`.
 */
export function hiddenActorIds(state:TableState):string[] {
  return Object.values(state.actors).filter((actor)=>actor.hidden).map((actor)=>actor.id);
}

function redactRules(rules:RulesRuntimeState,hidden:string[]):RulesRuntimeState {
  if(!hidden.length) return rules;
  const next=cloneState(rules);
  for(const id of hidden) { delete next.combatants[id]; delete next.concentration[id]; }
  next.effects=next.effects.filter((effect)=>!hidden.includes(effect.targetId));
  return next;
}

function visibleLog(entry:LogEntry,viewer:TableViewer):boolean { return viewer.role==="dm"||entry.visibility==="public"; }
function visibleQuestion(question:TableQuestion,viewer:TableViewer):boolean { return viewer.role==="dm"||question.toPeer===viewer.peerId; }

export function redactStateFor(state:TableState,viewer:TableViewer):TableState {
  if(viewer.role==="dm") return cloneState(state);
  const hidden=hiddenActorIds(state);
  const next=cloneState(state);
  for(const id of hidden) { delete next.actors[id]; delete next.declarations[id]; delete next.readied[id]; }
  next.rules=redactRules(next.rules,hidden);
  next.engagements=pruneEngagementsToPresent(next.engagements,new Set(Object.keys(next.actors)));
  next.log=next.log.filter((entry)=>visibleLog(entry,viewer));
  next.questions=next.questions.filter((question)=>visibleQuestion(question,viewer));
  if(next.activeResolution&&next.activeResolution.visibility!=="public") next.activeResolution=null;
  return next;
}

/**
 * One Host event as a player should receive it. `after` is the Host's state once the event applied (needed to
 * turn a reveal into an `actors-added` for that player). Returns null when the player receives nothing.
 */
export function redactEventFor(event:TableEvent,before:TableState,after:TableState,viewer:TableViewer):TableEvent|null {
  if(viewer.role==="dm") return event;
  const hiddenBefore=hiddenActorIds(before);
  const hiddenAfter=hiddenActorIds(after);
  const log=event.log.filter((entry)=>visibleLog(entry,viewer));
  const payload=event.payload;
  switch(payload.type) {
    case "actors-added": {
      const actors=payload.actors.filter((actor)=>!actor.hidden);
      const combatants=Object.fromEntries(Object.entries(payload.combatants).filter(([id])=>!hiddenAfter.includes(id)));
      return {...event,log,payload:{...payload,actors,combatants}};
    }
    case "actor-updated": {
      const actor=after.actors[payload.actorId];
      if(hiddenBefore.includes(payload.actorId)&&actor&&!actor.hidden) {
        // A reveal: the player learns of the actor now, whole.
        const combatant=after.rules.combatants[payload.actorId];
        return {...event,log,payload:{type:"actors-added",actors:[cloneState(actor)],...(combatant?{combatants:{[payload.actorId]:cloneState(combatant)}}:{combatants:{}})}};
      }
      if(hiddenAfter.includes(payload.actorId)) {
        if(!hiddenBefore.includes(payload.actorId)) return {...event,log,payload:{type:"actor-removed",actorId:payload.actorId}};
        return log.length?{...event,log,payload:{type:"table-changed"}}:null;
      }
      return {...event,log};
    }
    case "actor-removed":
      return hiddenBefore.includes(payload.actorId)?(log.length?{...event,log,payload:{type:"table-changed"}}:null):{...event,log};
    case "mode-changed": case "turn-changed":
      return {...event,log,payload:{...payload,rules:redactRules(payload.rules,hiddenAfter)}};
    case "rules-committed": {
      const resolution=payload.resolution===undefined?undefined:payload.resolution&&payload.resolution.visibility==="public"?payload.resolution:null;
      return {...event,log,payload:{...payload,rules:redactRules(payload.rules,hiddenAfter),...(resolution!==undefined?{resolution}:{}),...(payload.questions?{questions:payload.questions.filter((question)=>visibleQuestion(question,viewer))}:{}),...(payload.sheets?{sheets:payload.sheets.filter((patch)=>!hiddenAfter.includes(patch.actorId))}:{}),...(payload.engagements?{engagements:payload.engagements.filter((record)=>!hiddenAfter.includes(record.a)&&!hiddenAfter.includes(record.b))}:{})}};
    }
    case "table-changed":
      return {...event,log,payload:{...payload,...(payload.rules?{rules:redactRules(payload.rules,hiddenAfter)}:{}),...(payload.questions?{questions:payload.questions.filter((question)=>visibleQuestion(question,viewer))}:{}),...(payload.sheets?{sheets:payload.sheets.filter((patch)=>!hiddenAfter.includes(patch.actorId))}:{}),...(payload.engagements?{engagements:payload.engagements.filter((record)=>!hiddenAfter.includes(record.a)&&!hiddenAfter.includes(record.b))}:{})}};
    case "state-restored":
      return {...event,log,payload:{type:"state-restored",state:redactStateFor(payload.state,viewer)}};
    case "visibility-changed":
      return {...event,log};
  }
}

/** The states a ledger passes through, for redacting each event against its own before/after. */
export function statesAlong(initial:TableState,events:TableEvent[]):TableState[] {
  const states=[initial];
  for(const event of events) states.push(applyEvent(states[states.length-1],event));
  return states;
}
