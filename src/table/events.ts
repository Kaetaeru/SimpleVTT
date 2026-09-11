import type { CombatantRuntimeState, RulesRuntimeState } from "../domain/combatState";
import { type EngagementRecord, pruneEngagementsToPresent } from "../domain/engagement";
import type { CharacterSheet } from "../app/contracts";
import { cloneState, type Actor, type FloorItem, type LogEntry, type MovementDeclaration, type ReadiedAction, type ResolutionRecord, type TableMode, type TableQuestion, type TableState, type Visibility } from "./state";

/** Durable character changes (items moved, quantities) ride with the commit so the owner's client can write them back. */
export type SheetPatch={actorId:string;sheet:CharacterSheet};

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
  |{type:"rules-committed";rules:RulesRuntimeState;resolution?:ResolutionRecord|null;actorPatches?:Array<{actorId:string;patch:ActorPatch}>;engagements?:EngagementRecord[];sheets?:SheetPatch[];floor?:FloorItem[];interactions?:Record<string,number>;questions?:TableQuestion[];declarations?:Record<string,MovementDeclaration>;readied?:Record<string,ReadiedAction>}
  /** Table bookkeeping that needs no kernel commit: hands, floor, transfers, interaction count, questions, declarations, readied actions. */
  |{type:"table-changed";sheets?:SheetPatch[];floor?:FloorItem[];interactions?:Record<string,number>;rules?:RulesRuntimeState;engagements?:EngagementRecord[];questions?:TableQuestion[];declarations?:Record<string,MovementDeclaration>;readied?:Record<string,ReadiedAction>}
  |{type:"state-restored";state:TableState}
  |{type:"visibility-changed";rollVisibility:Visibility};

export interface TableEvent {
  seq:number;
  at:string;
  commandType:string;
  log:LogEntry[];
  payload:TableEventPayload;
}

function applySheets(state:TableState,sheets:SheetPatch[]|undefined) {
  for(const {actorId,sheet} of sheets??[]) {
    const actor=state.actors[actorId];
    if(actor&&actor.source.kind==="character") actor.source={...actor.source,sheet:cloneState(sheet)};
  }
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
      state.questions=state.questions.filter((question)=>question.actorId!==payload.actorId&&Object.values(question.context).every((value)=>value!==payload.actorId));
      delete state.declarations[payload.actorId];
      delete state.readied[payload.actorId];
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
      state.interactions={};
      if(payload.mode==="freeform") { state.declarations={}; state.readied={}; state.questions=state.questions.filter((question)=>question.kind!=="ready-trigger"); }
      state.activeResolution=null;
      break;
    }
    case "turn-changed": {
      state.currentActorId=payload.currentActorId;
      state.round=payload.round;
      if(payload.order) state.order=[...payload.order];
      state.rules=cloneState(payload.rules);
      if(payload.engagements) state.engagements=cloneState(payload.engagements);
      state.interactions={};
      if(payload.currentActorId) { delete state.declarations[payload.currentActorId]; delete state.readied[payload.currentActorId]; }
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
      applySheets(state,payload.sheets);
      if(payload.floor) state.floor=cloneState(payload.floor);
      if(payload.interactions) state.interactions=cloneState(payload.interactions);
      if(payload.questions) state.questions=cloneState(payload.questions);
      if(payload.declarations) state.declarations=cloneState(payload.declarations);
      if(payload.readied) state.readied=cloneState(payload.readied);
      break;
    }
    case "table-changed":
      applySheets(state,payload.sheets);
      if(payload.floor) state.floor=cloneState(payload.floor);
      if(payload.interactions) state.interactions=cloneState(payload.interactions);
      if(payload.rules) state.rules=cloneState(payload.rules);
      if(payload.engagements) state.engagements=cloneState(payload.engagements);
      if(payload.questions) state.questions=cloneState(payload.questions);
      if(payload.declarations) state.declarations=cloneState(payload.declarations);
      if(payload.readied) state.readied=cloneState(payload.readied);
      break;
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
