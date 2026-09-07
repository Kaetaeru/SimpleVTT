import "../app/combatantRuntimeContracts";
import type { CombatantRuntimeState, RulesRuntimeState } from "../domain/combatState";
import type { CharacterSheet, CombatantDefinitionVm, ResolutionView } from "../app/contracts";

/**
 * V2 table runtime — the one mutable play state (docs/design/v2/TABLE_RUNTIME.md §4).
 * HP, temp HP, resources, death saves and effects live only in `rules` (the domain's RulesRuntimeState);
 * `actors` carries identity, presentation and the durable source (sheet or stat block), never HP.
 */
export type TableMode="freeform"|"initiative";
export type Side="ally"|"enemy";
export type Visibility="public"|"dm";

export type ActorSource=
  |{kind:"character";sheet:CharacterSheet;sourceRevision:number}
  |{kind:"monster";definitionId:string;definition:CombatantDefinitionVm};

export interface Actor {
  id:string;
  kind:"character"|"npc";
  name:string;
  side:Side;
  source:ActorSource;
  /** The peer that controls this actor (a player's own character, or a DM assignment). Undefined = DM only. */
  controllerPeer?:string;
  groupId?:string;
  hidden?:boolean;
  badges:string[];
  engagement:string[];
  initiative:number;
}

export interface Peer {
  peerId:string;
  participantId:string;
  name:string;
  role:"dm"|"player";
  characterId?:string;
  state:"connected"|"disconnected";
}

export interface LogEntry {
  id:string;
  seq:number;
  time:string;
  actor:string;
  title:string;
  summary:string;
  detail:string[];
  stateChanges:string[];
  visibility:Visibility;
  resolutionId?:string;
  ruling?:string;
  undoOf?:string;
  reversed?:boolean;
}

export interface ResolutionRecord extends ResolutionView {
  seq:number;
  visibility:Visibility;
}

export interface TableState {
  sessionId:string;
  /** The sequence of the last applied event. */
  revision:number;
  mode:TableMode;
  round:number;
  order:string[];
  currentActorId:string|null;
  rules:RulesRuntimeState;
  actors:Record<string,Actor>;
  peers:Record<string,Peer>;
  activeResolution:ResolutionRecord|null;
  /** Newest first. */
  log:LogEntry[];
  rollVisibility:Visibility;
}

export function createTableState(sessionId:string):TableState {
  return {
    sessionId,
    revision:0,
    mode:"freeform",
    round:0,
    order:[],
    currentActorId:null,
    rules:{revision:0,clock:{round:0,elapsedSeconds:0},combatants:{},effects:[],concentration:{},history:[]},
    actors:{},
    peers:{},
    activeResolution:null,
    log:[],
    rollVisibility:"public",
  };
}

export const cloneState=<T>(value:T):T=>structuredClone(value);

export function actorOf(state:TableState,actorId:string):Actor|undefined { return state.actors[actorId]; }
export function combatantOf(state:TableState,actorId:string):CombatantRuntimeState|undefined { return state.rules.combatants[actorId]; }

/** Every actor in table order: initiative order when it exists, else allies then enemies by insertion. */
export function actorIds(state:TableState):string[] {
  if(state.order.length) return [...state.order,...Object.keys(state.actors).filter((id)=>!state.order.includes(id))];
  const ids=Object.keys(state.actors);
  return [...ids.filter((id)=>state.actors[id].side==="ally"),...ids.filter((id)=>state.actors[id].side==="enemy")];
}
