import { conditionActionAvailability } from "../domain/conditions";
import { conditionEffectsFor } from "../domain/combatState";
import { effectIsActive } from "../domain/effects";
import type { ActionVm } from "../app/contracts";
import { actionsFor } from "./actors";
import { hostileEngagedIds, isMeleeAttack } from "./engagement";
import type { TableQuestion, TableState } from "./state";

/**
 * Questions (capability inventory §10, D5): one card, to one peer, a few options. Nothing else waits on a question;
 * the DM may answer or skip any of them. Builders here are pure over the table state.
 */

export function isDisengaged(state:TableState,actorId:string):boolean {
  return state.rules.effects.some((effect)=>effect.targetId===actorId&&effectIsActive(effect)&&effect.metadata?.publicLabel==="이탈");
}

/** Melee attacks a reactor could make right now as an opportunity attack: weapon in hand, no cost, no throwing. */
export function opportunityAttackOptions(state:TableState,reactorId:string):ActionVm[] {
  const reactor=state.actors[reactorId];
  const combatant=state.rules.combatants[reactorId];
  if(!reactor||!combatant||combatant.life.dead||combatant.life.hp.current<=0) return [];
  if(!conditionActionAvailability(conditionEffectsFor(state.rules,reactorId)).reaction) return [];
  if(state.mode==="initiative"&&!combatant.economy.reaction) return [];
  return actionsFor(reactor,state).filter((action)=>{
    if(!isMeleeAttack(action)||action.tableThrow||action.tableImprovised||action.resourceCost||action.itemCost) return false;
    if(action.tableWeaponItemId&&reactor.source.kind==="character") {
      const item=reactor.source.sheet.items.find((entry)=>entry.id===action.tableWeaponItemId);
      if(!item||!item.wielded) return false;
    }
    return true;
  });
}

export function questionPeer(state:TableState,actorId:string):string|undefined { return state.actors[actorId]?.controllerPeer; }

/** 물러남 by an engaged creature: every engaged enemy that can still react gets one card (weapon choice + 넘김). */
export function opportunityAttackQuestions(state:TableState,moverId:string,seq:number):TableQuestion[] {
  if(isDisengaged(state,moverId)) return [];
  const mover=state.actors[moverId];
  if(!mover) return [];
  return hostileEngagedIds(state,moverId).flatMap((reactorId)=>{
    const options=opportunityAttackOptions(state,reactorId);
    if(!options.length) return [];
    const reactor=state.actors[reactorId];
    return [{
      id:`question.${seq}.oa.${reactorId}`,kind:"opportunity-attack" as const,actorId:reactorId,toPeer:questionPeer(state,reactorId),
      prompt:`${mover.name}이(가) 물러납니다. ${reactor.name}의 기회공격?`,
      options:[...options.map((action)=>({id:action.id,label:action.name,cost:"반응"})),{id:"decline",label:"넘김"}],
      context:{moverId},seq,
    }];
  });
}

/** A melee attack dropped a creature to 0 HP: the attacker may knock it out instead (D9: melee only). */
export function knockOutQuestion(state:TableState,attackerId:string,targetId:string,seq:number):TableQuestion {
  const target=state.actors[targetId];
  return {
    id:`question.${seq}.ko.${targetId}`,kind:"knock-out",actorId:attackerId,toPeer:questionPeer(state,attackerId),
    prompt:`${target?.name??targetId}이(가) 쓰러집니다. 죽입니까, 기절시킵니까?`,
    options:[{id:"kill",label:"죽임"},{id:"knock-out",label:"기절 (의식불명 · 안정)"}],
    context:{targetId},seq,
  };
}

export function readyTriggerQuestion(state:TableState,actorId:string,seq:number):TableQuestion {
  const readied=state.readied[actorId];
  const actor=state.actors[actorId];
  return {
    id:`question.${seq}.ready.${actorId}`,kind:"ready-trigger",actorId,toPeer:questionPeer(state,actorId),
    prompt:`준비한 조건이 발생했습니다: "${readied?.trigger??""}". ${actor?.name??actorId}, 지금 발동합니까?`,
    options:[{id:"fire",label:"발동",cost:"반응"},{id:"hold",label:"보류"}],
    context:{actionId:readied?.actionId??"",trigger:readied?.trigger??""},seq,
  };
}

export function withoutQuestion(questions:TableQuestion[],questionId:string):TableQuestion[] {
  return questions.filter((question)=>question.id!==questionId);
}
