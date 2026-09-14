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
export type Side="ally"|"enemy"|"neutral";
/** public: everyone · dm: the DM only · peer:<from>,<to>: the DM and those two peers (a whisper). */
export type Visibility="public"|"dm"|`peer:${string}`;

export type ActorSource=
  |{kind:"character";sheet:CharacterSheet;sourceRevision:number}
  |{kind:"monster";definitionId:string;definition:CombatantDefinitionVm}
  /** An object with AC and HP (2024 Breaking Objects): a door, a rope, a chest. */
  |{kind:"object";material:string;size:string;locked?:{dc:number}};

export interface Actor {
  id:string;
  /** summon: a creature a spell or feature created, owned by another actor; object: a thing that can be attacked. */
  kind:"character"|"npc"|"object"|"summon";
  name:string;
  side:Side;
  source:ActorSource;
  /** Benched (RULES_RUNTIME_SPECS.md §4): absent from the scene but kept whole — HP, effects, death saves. Undefined = present. */
  present?:boolean;
  /** A summon's owner: shares its initiative, acts right after it, and is removed with it. */
  ownerId?:string;
  /** When a summon goes away: with the owner's concentration, with a named effect, or at a clock time. */
  expiresWith?:{concentration?:boolean;effectId?:string;at?:number};
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
  kind:"opportunity-attack"|"knock-out"|"ready-trigger"|"ruling-request"|"player-request"|"dm"|"rest"|"reaction-window";
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

/** The table clock's context (RULES_RUNTIME_SPECS.md §1): where the session sits in the campaign day, and each actor's last long rest. */
export interface TableTime {
  /** Seconds after midnight at elapsedSeconds 0. Dawn is 06:00. */
  dayStartSeconds:number;
  lastLongRest:Record<string,number>;
}

/** Something scheduled on the clock: a DM reminder, dawn, an affliction's periodic save, a stable creature's 1 HP. */
export interface Timer {
  id:string;
  /** Fires when elapsedSeconds reaches this. */
  at:number;
  kind:"reminder"|"dawn"|"affliction-tick"|"stable-recovery";
  label:string;
  targetId?:string;
}

/** A rest in progress (D30): proposed by the DM, answered per actor, completed by the DM. */
export interface RestingState {
  kind:"short"|"long";
  actorIds:string[];
  startedAt:number;
  answers:Record<string,{hitDice:number}>;
  /** Initiative started during a long rest: the rest must start over. */
  interruptedAt?:number;
}

/** Reaction windows (RULES_RUNTIME_SPECS.md §2): where a resolution pauses before its result commits. */
export type ReactionWindow="hit-determined"|"spell-being-cast"|"damage-taken"|"save-failed"|"attack-missed"|"dm-intervention";

/** DM attack-intervention palette (D42): what the DM may change on an attack, before or after it resolves. */
export interface AttackOverrides {
  outcome?:"hit"|"miss"|"crit";
  cover?:"none"|"half"|"three-quarters"|"total";
  rollState?:"advantage"|"disadvantage"|"normal";
  reach?:"in"|"out";
  range?:"normal"|"long"|"out";
  unseen?:{attacker?:boolean;target?:boolean};
  damage?:{mode:"half"|"zero"|"set";value?:number};
  /** Legendary Resistance (D21): these targets' failed saves become successes. */
  autoSuccessSaves?:string[];
  /** Counterspell succeeded: the spell is lost, the slot is spent. */
  cancelled?:boolean;
}

export interface Handout { id:string; name:string; dataUrl:string; toPeer?:string; at:string }

/** A resolution waiting on reaction windows: the command, the dice it drew, and the answers so far. */
export interface PendingResolution {
  id:string;
  actorId:string;
  targetIds:string[];
  command:{type:"act";actorId:string;actionId:string;targetIds:string[];itemId?:string;slotLevel?:number;amount?:number;formId?:string};
  asReaction?:boolean;
  /** Every dice draw of the first run, in order; the final run replays them. */
  diceRecord:number[][];
  /** Windows still open, in order; each is one question. */
  windows:Array<{window:ReactionWindow;reactorId:string;questionId:string}>;
  answers:string[];
  overrides:AttackOverrides;
  label:string;
}

/** What a committed resolution needs to be re-resolved by the DM palette after the fact. */
export interface ResolutionReplay {
  resolutionId:string;
  command:PendingResolution["command"];
  asReaction?:boolean;
  diceRecord:number[][];
  rulesBefore:RulesRuntimeState;
  engagementsBefore:EngagementRecord[];
  questionsBefore:TableQuestion[];
  revisionAfter:number;
  answers:string[];
}

export interface TableSettings {
  /** D42 pre-resolution hold: attacks against DM-controlled creatures wait for the DM card. */
  holdAttacks:boolean;
}

/** The scene (RULES_RUNTIME_SPECS.md §4): a name and reminder conditions; effects belong to creatures, not the scene. */
export interface Scene { id:string; name:string; conditions:string[]; enteredAt:number }

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
  time:TableTime;
  timers:Timer[];
  resting:RestingState|null;
  settings:TableSettings;
  scene:Scene;
  pending:PendingResolution|null;
  /** Replays for the last few committed resolutions (DM palette after the fact); newest first. */
  replays:ResolutionReplay[];
  /** An image the DM is showing: to everyone, or to one peer (DM_WORKSPACE.md §3 자료 · 공개). */
  handout:Handout|null;
  /** The last result cards, newest first, so a 기록 line can reopen its card. */
  recentCards:ResolutionRecord[];
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
    time:{dayStartSeconds:8*3600,lastLongRest:{}},
    timers:[],
    resting:null,
    settings:{holdAttacks:false},
    scene:{id:"scene.1",name:"",conditions:[],enteredAt:0},
    pending:null,
    replays:[],
    handout:null,
    recentCards:[],
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

/** Every present actor in table order: initiative order when it exists, else allies, neutrals, then enemies by insertion. */
export function actorIds(state:TableState):string[] {
  const present=(id:string)=>state.actors[id]&&state.actors[id].present!==false;
  if(state.order.length) return [...state.order.filter(present),...Object.keys(state.actors).filter((id)=>!state.order.includes(id)&&present(id))];
  const ids=Object.keys(state.actors).filter(present);
  return [...ids.filter((id)=>state.actors[id].side==="ally"),...ids.filter((id)=>state.actors[id].side==="neutral"),...ids.filter((id)=>state.actors[id].side==="enemy")];
}

/** Benched actors: kept whole, out of the scene (RULES_RUNTIME_SPECS.md §4). */
export function benchedActorIds(state:TableState):string[] { return Object.keys(state.actors).filter((id)=>state.actors[id].present===false); }

/** The peer that may answer a question: the asked actor's current controller (recomputed so a reconnect can answer). */
export function questionPeerOf(state:TableState,question:TableQuestion):string|undefined {
  if(question.toPeer===undefined) return undefined; // a DM question stays the DM's
  const actor=state.actors[question.actorId];
  return actor?.controllerPeer??question.toPeer;
}

/** HP as the table shows it to those who may not know the numbers (D22): 3 멀쩡 · 2 다침 · 1 위독 · 0 쓰러짐. */
export function hpStageOf(current:number,maximum:number):number {
  if(current<=0) return 0;
  if(maximum<=0) return 3;
  const ratio=current/maximum;
  return ratio>2/3?3:ratio>1/3?2:1;
}
export const HP_STAGE_LABEL=["쓰러짐","위독","다침","멀쩡"] as const;
