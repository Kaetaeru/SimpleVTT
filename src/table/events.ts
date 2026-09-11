import type { CombatantRuntimeState, RulesRuntimeState } from "../domain/combatState";
import { type EngagementRecord, pruneEngagementsToPresent } from "../domain/engagement";
import { cloneState, type Actor, type LogEntry, type ResolutionRecord, type TableMode, type TableState, type Visibility } from "./state";

/**
 * Events are the record (TABLE_RUNTIME.md §2.4). `applyEvent` is pure and shared by the Host and every replica, so
 * state after event n is a function of the ledger alone. Kernel commits carry the resulting domain state whole: the
 * table is small (dozens of actors) and a state-carrying event makes replay, reconnect, undo and parity trivial.
 */
export type ActorPatch=Partial<Pick<Actor,"name"|"side"|"hidden"|"controllerPeer"|"badges"|"initiative"|"groupId">>;

export type TableEventPayload=
  |{type:"actors-added";actors:Actor[];combatants:Record<string,CombatantRuntimeState>;order?:string[]}
  |{type:"actor-removed";actorId:string}
  |{type:"actor-updated";actorId:string;patch:ActorPatch}
  |{type:"mode-changed";mode:TableMode;order:string[];round:number;currentActorId:string|null;rules:RulesRuntimeState;engagements?:EngagementRecord[]}
  |{type:"turn-changed";currentActorId:string|null;round:number;order?:string[];rules:RulesRuntimeState;engagements?:EngagementRecord[]}
  |{type:"rules-committed";rules:RulesRuntimeState;resolution?:ResolutionRecord|null;actorPatches?:Array<{actorId:string;patch:ActorPatch}>;engagements?:EngagementRecord[]}
  |{type:"state-restored";state:TableState}
  |{type:"visibility-changed";rollVisibility:Visibility};

export interface TableEvent {
  seq:number;
  at:string;
  commandType:string;
  log:LogEntry[];
  payload:TableEventPayload;
}

export function applyEvent(input:TableState,event:TableEvent):TableState {
  const payload=event.payload;
  const state=payload.type==="state-restored"?cloneState(payload.state):cloneState(input);
  switch(payload.type) {
    case "actors-added": {
      for(const actor of payload.actors) state.actors[actor.id]=cloneState(actor);
      for(const [id,combatant] of Object.entries(payload.combatants)) state.rules.combatants[id]=cloneState(combatant);
      if(payload.order) state.order=[...payload.order];
      break;
    }
    case "actor-removed": {
      delete state.actors[payload.actorId];
      delete state.rules.combatants[payload.actorId];
      delete state.rules.concentration[payload.actorId];
      state.rules.effects=state.rules.effects.filter((effect)=>effect.targetId!==payload.actorId);
      state.order=state.order.filter((id)=>id!==payload.actorId);
      if(state.currentActorId===payload.actorId) state.currentActorId=state.order[0]??null;
      state.engagements=pruneEngagementsToPresent(state.engagements,new Set(Object.keys(state.actors)));
      break;
    }
    case "actor-updated": {
      const actor=state.actors[payload.actorId];
      if(actor) Object.assign(actor,cloneState(payload.patch));
      break;
    }
    case "mode-changed": {
      state.mode=payload.mode;
      state.order=[...payload.order];
      state.round=payload.round;
      state.currentActorId=payload.currentActorId;
      state.rules=cloneState(payload.rules);
      if(payload.engagements) state.engagements=cloneState(payload.engagements);
      state.activeResolution=null;
      break;
    }
    case "turn-changed": {
      state.currentActorId=payload.currentActorId;
      state.round=payload.round;
      if(payload.order) state.order=[...payload.order];
      state.rules=cloneState(payload.rules);
      if(payload.engagements) state.engagements=cloneState(payload.engagements);
      break;
    }
    case "rules-committed": {
      state.rules=cloneState(payload.rules);
      if(payload.resolution!==undefined) state.activeResolution=payload.resolution?cloneState(payload.resolution):null;
      for(const {actorId,patch} of payload.actorPatches??[]) {
        const actor=state.actors[actorId];
        if(actor) Object.assign(actor,cloneState(patch));
      }
      if(payload.engagements) state.engagements=cloneState(payload.engagements);
      break;
    }
    case "state-restored":
      break;
    case "visibility-changed":
      state.rollVisibility=payload.rollVisibility;
      break;
  }
  state.revision=event.seq;
  if(event.log.length) state.log=[...event.log.map((entry)=>cloneState(entry)),...state.log].slice(0,500);
  return state;
}

export function replayEvents(initial:TableState,events:TableEvent[]):TableState {
  return events.reduce((state,event)=>applyEvent(state,event),cloneState(initial));
}
