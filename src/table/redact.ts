import { pruneEngagementsToPresent } from "../domain/engagement";
import type { RulesRuntimeState } from "../domain/combatState";
import { applyEvent, type TableEvent } from "./events";
import type { TableViewer } from "./project";
import { cloneState, hpStageOf, questionPeerOf, type Actor, type LogEntry, type TableQuestion, type TableState } from "./state";

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

function visibleLog(entry:LogEntry,viewer:TableViewer):boolean {
  if(viewer.role==="dm"||entry.visibility==="public") return true;
  return entry.visibility.startsWith("peer:")&&entry.visibility.slice(5).split(",").includes(viewer.peerId??"");
}
function visibleQuestion(question:TableQuestion,viewer:TableViewer,state?:TableState):boolean { return viewer.role==="dm"||(state?questionPeerOf(state,question):question.toPeer)===viewer.peerId; }

/** D22: a player learns a creature's HP as a stage (3 멀쩡 · 2 다침 · 1 위독 · 0 쓰러짐), not as numbers, unless it is theirs. */
function knowsNumbers(actor:Actor|undefined,viewer:TableViewer):boolean { return viewer.role==="dm"||!actor||actor.kind==="character"||actor.controllerPeer===viewer.peerId; }

function redactCombatants(rules:RulesRuntimeState,actors:Record<string,Actor>,viewer:TableViewer):RulesRuntimeState {
  if(viewer.role==="dm") return rules;
  const next=cloneState(rules);
  for(const [id,combatant] of Object.entries(next.combatants)) {
    if(knowsNumbers(actors[id],viewer)) continue;
    combatant.life={...combatant.life,hp:{current:hpStageOf(combatant.life.hp.current,combatant.life.hp.maximum),maximum:3,temporary:combatant.life.hp.temporary>0?1:0}};
    combatant.resources=[];
    combatant.hitDice=[];
  }
  return next;
}

/** A monster's definition as a player receives it: name and identity, none of the stat block. */
function redactActor(actor:Actor,viewer:TableViewer):Actor {
  if(viewer.role==="dm"||actor.source.kind!=="monster"||actor.controllerPeer===viewer.peerId) return actor;
  const definition=actor.source.definition;
  return {...actor,source:{kind:"monster",definitionId:actor.source.definitionId,definition:{id:definition.id,name:definition.name,...(definition.nameEn?{nameEn:definition.nameEn}:{}),ac:0,maxHp:0,source:definition.source,version:definition.version,actions:[],statusImmunities:[],...(definition.portrait?{portrait:structuredClone(definition.portrait)}:{}),...(definition.description?{description:definition.description}:{})}}};
}

export function redactStateFor(state:TableState,viewer:TableViewer):TableState {
  if(viewer.role==="dm") return cloneState(state);
  const hidden=hiddenActorIds(state);
  const next=cloneState(state);
  for(const id of hidden) { delete next.actors[id]; delete next.declarations[id]; delete next.readied[id]; }
  for(const id of Object.keys(next.actors)) next.actors[id]=redactActor(next.actors[id],viewer);
  next.rules=redactCombatants(redactRules(next.rules,hidden),state.actors,viewer);
  next.engagements=pruneEngagementsToPresent(next.engagements,new Set(Object.keys(next.actors)));
  next.log=next.log.filter((entry)=>visibleLog(entry,viewer));
  next.questions=next.questions.filter((question)=>visibleQuestion(question,viewer,state));
  next.timers=[];
  next.replays=[];
  if(next.pending) next.pending={...next.pending,diceRecord:[]};
  if(next.activeResolution&&next.activeResolution.visibility!=="public") next.activeResolution=null;
  return next;
}

/**
 * One Host event as a player should receive it. `after` is the Host's state once the event applied (needed to
 * turn a reveal into an `actors-added` for that player). An event the player learns nothing from still arrives as an
 * empty `table-changed` so the replica's sequence never gaps (a gap would loop on catch-up).
 */
export function redactEventFor(event:TableEvent,before:TableState,after:TableState,viewer:TableViewer):TableEvent {
  if(viewer.role==="dm") return event;
  const hiddenBefore=hiddenActorIds(before);
  const hiddenAfter=hiddenActorIds(after);
  const log=event.log.filter((entry)=>visibleLog(entry,viewer));
  const payload=event.payload;
  switch(payload.type) {
    case "actors-added": {
      const actors=payload.actors.filter((actor)=>!actor.hidden).map((actor)=>redactActor(actor,viewer));
      const combatants=redactCombatants({...after.rules,combatants:Object.fromEntries(Object.entries(payload.combatants).filter(([id])=>!hiddenAfter.includes(id)))},after.actors,viewer).combatants;
      return {...event,log,payload:{...payload,actors,combatants}};
    }
    case "actor-updated": {
      const actor=after.actors[payload.actorId];
      if(hiddenBefore.includes(payload.actorId)&&actor&&!actor.hidden) {
        // A reveal: the player learns of the actor now, whole.
        const combatant=after.rules.combatants[payload.actorId];
        return {...event,log,payload:{type:"actors-added",actors:[redactActor(cloneState(actor),viewer)],...(combatant?{combatants:redactCombatants({...after.rules,combatants:{[payload.actorId]:cloneState(combatant)}},after.actors,viewer).combatants}:{combatants:{}})}};
      }
      if(hiddenAfter.includes(payload.actorId)) {
        if(!hiddenBefore.includes(payload.actorId)) return {...event,log,payload:{type:"actor-removed",actorId:payload.actorId}};
        return {...event,log,payload:{type:"table-changed"}};
      }
      return {...event,log};
    }
    case "actor-removed":
      return hiddenBefore.includes(payload.actorId)?{...event,log,payload:{type:"table-changed"}}:{...event,log};
    case "mode-changed":
      return {...event,log,payload:{...payload,rules:redactCombatants(redactRules(payload.rules,hiddenAfter),after.actors,viewer)}};
    case "turn-changed":
      return {...event,log,payload:{...payload,rules:redactCombatants(redactRules(payload.rules,hiddenAfter),after.actors,viewer),...(payload.questions?{questions:payload.questions.filter((question)=>visibleQuestion(question,viewer,after))}:{}),...(payload.timers?{timers:[]}:{})}};
    case "time-advanced":
      // Timers are the DM's; players see the clock move and the cards addressed to them.
      return {...event,log,payload:{...payload,rules:redactCombatants(redactRules(payload.rules,hiddenAfter),after.actors,viewer),timers:[],...(payload.questions?{questions:payload.questions.filter((question)=>visibleQuestion(question,viewer,after))}:{})}};
    case "rules-committed": {
      const resolution=payload.resolution===undefined?undefined:payload.resolution&&payload.resolution.visibility==="public"?payload.resolution:null;
      const {replay:_replay,...rest}=payload;
      return {...event,log,payload:{...rest,rules:redactCombatants(redactRules(payload.rules,hiddenAfter),after.actors,viewer),...(resolution!==undefined?{resolution}:{}),...(payload.questions?{questions:payload.questions.filter((question)=>visibleQuestion(question,viewer,after))}:{}),...(payload.sheets?{sheets:payload.sheets.filter((patch)=>!hiddenAfter.includes(patch.actorId))}:{}),...(payload.engagements?{engagements:payload.engagements.filter((record)=>!hiddenAfter.includes(record.a)&&!hiddenAfter.includes(record.b))}:{})}};
    }
    case "table-changed":
      return {...event,log,payload:{...payload,...(payload.pending?{pending:{...payload.pending,diceRecord:[]}}:{}),...(payload.rules?{rules:redactCombatants(redactRules(payload.rules,hiddenAfter),after.actors,viewer)}:{}),...(payload.questions?{questions:payload.questions.filter((question)=>visibleQuestion(question,viewer,after))}:{}),...(payload.sheets?{sheets:payload.sheets.filter((patch)=>!hiddenAfter.includes(patch.actorId))}:{}),...(payload.engagements?{engagements:payload.engagements.filter((record)=>!hiddenAfter.includes(record.a)&&!hiddenAfter.includes(record.b))}:{})}};
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
