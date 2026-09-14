import type { CharacterSheet } from "../app/contracts";
import type { ConditionId } from "../domain/conditions";
import type { DurationSpec } from "../domain/effects";
import type { AttackOverrides, RulingSpec, Side, TableSettings, Visibility } from "./state";

/** What a command may add to the table. */
export type ActorSpec=
  |{kind:"monster";monsterId:string;count?:number;side?:Side;name?:string}
  |{kind:"character";sheet:CharacterSheet;controllerPeer?:string;side?:Side}
  /** An object (2024 Breaking Objects): AC by material, HP by size; immune to poison and psychic; fails saves. */
  |{kind:"object";name:string;material:"cloth"|"wood"|"stone"|"iron"|"mithral"|"adamantine";size:"tiny"|"small"|"medium"|"large";hp?:number;ac?:number;locked?:{dc:number}}
  /** A summoned or created creature: a stat block owned by an actor, sharing its initiative, gone with what made it. */
  |{kind:"summon";monsterId:string;ownerId:string;name?:string;count?:number;expiresWith?:{concentration?:boolean;effectId?:string;seconds?:number}};

/** DM 즉석 재량 (D1-01, absorbed into V2): every ruling is event-native, replicated and undoable. */
export type Ruling=
  |{kind:"damage";amount:number;damageType?:string}
  |{kind:"heal";amount:number}
  |{kind:"temp-hp";amount:number}
  |{kind:"max-hp";delta:number}
  |{kind:"condition";conditionId:ConditionId;on:boolean;duration?:DurationSpec;sourceActorId?:string}
  |{kind:"exhaustion";level:number}
  |{kind:"next-roll";state:"advantage"|"disadvantage";family:"attack-roll"|"ability-check"|"saving-throw"|"any"}
  |{kind:"inspiration";on:boolean}
  |{kind:"life";state:"down"|"stable"|"dead"|"revive"}
  |{kind:"resource";resourceId:string;delta:number}
  |{kind:"engage";otherId:string;on:boolean}
  |{kind:"badge";badge:"hidden"|"cover-half"|"cover-three-quarters";on:boolean};

export type TableCommand=
  |{type:"add-actors";specs:ActorSpec[]}
  |{type:"remove-actor";actorId:string}
  |{type:"set-actor";actorId:string;patch:{name?:string;side?:Side;hidden?:boolean;controllerPeer?:string|null;initiative?:number}}
  |{type:"start-initiative"}
  |{type:"end-initiative"}
  |{type:"end-turn"}
  |{type:"set-current-actor";actorId:string}
  |{type:"set-order";order:string[]}
  |{type:"act";actorId:string;actionId:string;targetIds:string[];itemId?:string;/** Upcast: the slot level to spend (spells only). */slotLevel?:number;/** A feature that takes a number (Lay on Hands healing). */amount?:number;/** Wild Shape: the beast (monster id) to become. */formId?:string}
  /** 엎드리기 (free, any time) / 일어나기 (half speed of movement in Initiative). */
  |{type:"posture";actorId:string;posture:"prone"|"stand"}
  /** Hands and objects: draw/stow (free interaction, then Utilize), drop (free), pick-up, give (adjacent), throw-to (an ally, at range). */
  |{type:"object";actorId:string;op:"draw"|"stow"|"drop"|"pick-up"|"give"|"throw-to";itemId:string;slot?:"main-hand"|"off-hand"|"two-hand";targetId?:string;quantity?:number}
  |{type:"ruling";targetIds:string[];ruling:Ruling;note?:string}
  /** 접근(대상) · 물러남 · 그대로 — movement without feet. 물러남 while engaged asks the engaged enemies for an opportunity attack. */
  |{type:"declare";actorId:string;movement:"approach"|"withdraw"|"stay";targetId?:string}
  /** Answer a pending question (the asked peer, or the DM). */
  |{type:"answer-question";questionId:string;optionId:string}
  /** DM: pass over a question (D5: no automatic forfeit, the DM may skip). */
  |{type:"skip-question";questionId:string}
  /** Ready: spend the action now, name the trigger, fire the action later as a reaction. */
  |{type:"ready";actorId:string;actionId:string;trigger:string;targetIds?:string[]}
  /** DM: the readied trigger happened — asks the actor whether to fire. */
  |{type:"trigger-ready";actorId:string}
  /** Grade R: anything the rules do not cover. One line from the player; the DM gets a ruling card (§13). */
  |{type:"improvise";actorId:string;text:string;targetIds?:string[];itemId?:string}
  /** Grade N: words and gestures. Recorded, changes nothing; the DM may later rule on it. A whisper reaches one peer and the DM. */
  |{type:"narrate";actorId?:string;text:string;toPeer?:string}
  /** DM: rule on an improvised action (or on nothing in particular): roll, cost, outcome, or a verdict. */
  |{type:"rule";questionId?:string;actorId:string;targetIds?:string[];text?:string;spec:RulingSpec;note?:string}
  /** A player asks the DM: undo, a correction, an item/resource fix (D10), a visibility change. */
  |{type:"request";actorId:string;kind:"undo"|"correction"|"item-fix"|"visibility";text:string;payload?:{itemId?:string;quantity?:number;resourceId?:string;current?:number}}
  /** DM: remember a ruling as a house rule for this table. */
  |{type:"remember-ruling";name:string;keyword:string;spec:RulingSpec}
  /** DM proposes a short or long rest (freeform only, D30). Hit dice given here count as those actors' answers; the rest completes with rest-complete. */
  |{type:"rest";kind:"short"|"long";actorIds:string[];hitDice?:Record<string,number>}
  /** DM completes the proposed rest: unanswered actors spend no hit dice; the clock advances 1 hour or 8 hours. */
  |{type:"rest-complete";/** D4: complete an interrupted long rest anyway. */force?:boolean}
  /** DM moves the clock (RULES_RUNTIME_SPECS.md §1). Rounds and rests move it by themselves. */
  |{type:"advance-time";preset?:"round"|"1min"|"10min"|"1h"|"8h"|"1d"|"to-dawn";seconds?:number;reason?:string}
  /** DM schedules a reminder card on the clock. */
  |{type:"set-timer";label:string;inSeconds:number}
  |{type:"clear-timer";timerId:string}
  /** DM attack-intervention palette (D42): on the pending resolution, or after the fact on the latest committed one. */
  |{type:"override";resolutionId:string;changes:AttackOverrides;note?:string}
  |{type:"set-setting";settings:Partial<TableSettings>}
  /** DM: a new scene. Scene-bound state ends (hidden, engagements, declarations, readied, pending); creature effects stay. */
  |{type:"scene";name:string;conditions?:string[]}
  /** DM: reminder conditions on the current scene (어둠·안개·침묵·좁음…). They are reminders (D42), never automatic modifiers. */
  |{type:"scene-conditions";conditions:string[]}
  /** DM: bench an actor (out of the scene, kept whole) or bring it back. */
  |{type:"bench";actorId:string;present:boolean}
  /** DM: XP or a milestone for the named characters (D34); the owner's sheet records it. */
  |{type:"award";actorIds:string[];xp?:number;milestone?:boolean;note?:string}
  |{type:"forget-ruling";ruleId:string}
  |{type:"undo"}
  |{type:"set-roll-visibility";visibility:Visibility};

export interface CommandOrigin {
  peerId:string;
  role:"dm"|"player";
}

export const HOST_ORIGIN:CommandOrigin={peerId:"host",role:"dm"};
