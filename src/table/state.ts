import "../app/combatantRuntimeContracts";
import type { CombatantRuntimeState, RulesRuntimeState } from "../domain/combatState";
import type { EngagementRecord } from "../domain/engagement";
import type { AbilityKey, ConditionId } from "../domain/conditions";
import type { DurationSpec } from "../domain/effects";
import type { CharacterSheet, CombatantDefinitionVm, ItemInstanceVm, ResolutionView } from "../app/contracts";

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

/** An item lying in the scene: dropped, thrown or placed. Nothing is deleted by dropping; anyone may pick it up. */
export interface FloorItem {
  id:string;
  item:ItemInstanceVm;
  droppedBy:string;
  /** A thrown weapon can be recovered; a shattered vial cannot. */
  recoverable:boolean;
}

/** A table question: one card to one peer (the asked actor's controller, or the DM), a few options, one answer. */
export interface TableQuestion {
  id:string;
  kind:"opportunity-attack"|"knock-out"|"ready-trigger"|"ruling-request"|"player-request"|"dm";
  /** The actor whose choice this is. */
  actorId:string;
  /** The peer that may answer (the actor's controller); the DM may always answer or skip. */
  toPeer?:string;
  prompt:string;
  options:Array<{id:string;label:string;cost?:string}>;
  /** What the answer continues: the mover of a withdrawal, the target of a knock-out, the readied action. */
  context:Record<string,string|number|boolean>;
  seq:number;
}

export type MovementDeclarationKind="approach"|"withdraw"|"stay";
export interface MovementDeclaration { kind:MovementDeclarationKind; targetId?:string; round:number }

/** What a ruling does on success or failure (capability inventory §13). Every field is optional; text alone is narration. */
export interface RulingOutcome {
  text?:string;
  damage?:{dice?:string;flat?:number;type:string;targetIds?:string[]};
  conditions?:Array<{conditionId:ConditionId;targetIds?:string[];duration?:DurationSpec}>;
  clearEngagement?:boolean;
  /** Drop the target's main-hand weapon to the floor (무기 뺏기). */
  disarm?:string[];
  nextRoll?:{targetIds:string[];family:"attack-roll"|"ability-check"|"saving-throw";state:"advantage"|"disadvantage"};
}

/** The DM's ruling card for anything the rules do not cover (§13, D8): what to roll, what it costs, what happens. */
export interface RulingSpec {
  check?:
    |{kind:"check";ability:AbilityKey;skill?:string;dc:number}
    |{kind:"save";ability:AbilityKey;dc:number}
    |{kind:"contest";ability:AbilityKey;skill?:string;opponentId:string;opponentAbility:AbilityKey;opponentSkill?:string};
  /** No roll: the DM decides. */
  verdict?:"success"|"failure"|"narration";
  cost:"action"|"bonus-action"|"reaction"|"movement"|"none";
  success?:RulingOutcome;
  failure?:RulingOutcome;
  /** D4: the constraint the DM waived for this once (e.g. "행동을 이미 썼지만 허용"). Recorded, never silent. */
  exception?:string;
}

/** A remembered ruling: the next declaration containing the keyword suggests this spec first. */
export interface HouseRule { id:string; name:string; keyword:string; spec:RulingSpec }

/** A readied action (2024 Ready): the trigger in the actor's words and the action to fire as a reaction. */
export interface ReadiedAction { actionId:string; trigger:string; targetIds:string[]; round:number }

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
  /**
   * The only spatial relation the table stores (theater-of-mind-play.md, domain/engagement.ts): pairs that traded
   * melee attacks, with the rounds that made and last refreshed them. Freeform play counts as round 1.
   */
  engagements:EngagementRecord[];
  /** Items on the scene floor (§6 of the capability inventory). */
  floor:FloorItem[];
  /** Free object interactions used this turn, per actor (2024: one per turn; the second costs the Utilize action). */
  interactions:Record<string,number>;
  /** Pending questions, oldest first. Nothing else blocks on them (D5). */
  questions:TableQuestion[];
  /** 접근/물러남/그대로 per actor; cleared at the actor's next turn start and when the fight ends. */
  declarations:Record<string,MovementDeclaration>;
  readied:Record<string,ReadiedAction>;
  houseRules:Record<string,HouseRule>;
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
    engagements:[],
    floor:[],
    interactions:{},
    questions:[],
    declarations:{},
    readied:{},
    houseRules:{},
    activeResolution:null,
    log:[],
    rollVisibility:"public",
  };
}

export const cloneState=<T>(value:T):T=>structuredClone(value);

/** The round engagement records are stamped with: the initiative round, or 1 in freeform play. */
export function engagementRound(state:Pick<TableState,"mode"|"round">):number { return state.mode==="initiative"?Math.max(1,state.round):1; }

export function actorOf(state:TableState,actorId:string):Actor|undefined { return state.actors[actorId]; }
export function combatantOf(state:TableState,actorId:string):CombatantRuntimeState|undefined { return state.rules.combatants[actorId]; }

/** Every actor in table order: initiative order when it exists, else allies then enemies by insertion. */
export function actorIds(state:TableState):string[] {
  if(state.order.length) return [...state.order,...Object.keys(state.actors).filter((id)=>!state.order.includes(id))];
  const ids=Object.keys(state.actors);
  return [...ids.filter((id)=>state.actors[id].side==="ally"),...ids.filter((id)=>state.actors[id].side==="enemy")];
}
