import type { CharacterSheet } from "../app/contracts";
import type { ConditionId } from "../domain/conditions";
import type { DurationSpec } from "../domain/effects";
import type { Side, Visibility } from "./state";

/** What a command may add to the table. */
export type ActorSpec=
  |{kind:"monster";monsterId:string;count?:number;side?:Side;name?:string}
  |{kind:"character";sheet:CharacterSheet;controllerPeer?:string;side?:Side};

/** DM 즉석 재량 (D1-01, absorbed into V2): every ruling is event-native, replicated and undoable. */
export type Ruling=
  |{kind:"damage";amount:number;damageType?:string}
  |{kind:"heal";amount:number}
  |{kind:"temp-hp";amount:number}
  |{kind:"max-hp";delta:number}
  |{kind:"condition";conditionId:ConditionId;on:boolean;duration?:DurationSpec}
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
  |{type:"act";actorId:string;actionId:string;targetIds:string[];itemId?:string}
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
  |{type:"undo"}
  |{type:"set-roll-visibility";visibility:Visibility};

export interface CommandOrigin {
  peerId:string;
  role:"dm"|"player";
}

export const HOST_ORIGIN:CommandOrigin={peerId:"host",role:"dm"};
