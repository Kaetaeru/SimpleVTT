import { conditionActionAvailability } from "../domain/conditions";
import { conditionEffectsFor } from "../domain/combatState";
import { effectIsActive } from "../domain/effects";
import type { ActionVm } from "../app/contracts";
import { actionsFor } from "./actors";
import { hostileEngagedIds, isMeleeAttack } from "./engagement";
import type { RulingSpec, TableQuestion, TableState } from "./state";
import { actorSizeRank } from "./actors";

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

/** A player's improvised declaration: the DM gets the card; the suggestion is only a starting point (D8). */
export function rulingRequestQuestion(state:TableState,actorId:string,text:string,targetIds:string[],seq:number,itemId?:string):TableQuestion {
  const actor=state.actors[actorId];
  const suggestion=suggestRuling(state,actorId,text,targetIds);
  return {
    id:`question.${seq}.rule.${actorId}`,kind:"ruling-request",actorId,toPeer:undefined,
    prompt:`${actor?.name??actorId}: "${text}"`,
    options:[],
    context:{text,targetIds:targetIds.join(","),...(itemId?{itemId}:{}),suggestion:JSON.stringify(suggestion.spec),suggestionName:suggestion.name},
    seq,
  };
}

/** A player's request to the DM: approve or deny. */
export function playerRequestQuestion(state:TableState,actorId:string,kind:"undo"|"correction"|"item-fix"|"visibility",text:string,payload:Record<string,string|number|boolean>,seq:number):TableQuestion {
  const actor=state.actors[actorId];
  const label={undo:"되돌리기 요청","correction":"정정 요청","item-fix":"아이템·자원 정정 요청",visibility:"굴림 공개 설정 요청"}[kind];
  return {
    id:`question.${seq}.request.${actorId}`,kind:"player-request",actorId,toPeer:undefined,
    prompt:`${actor?.name??actorId} · ${label}: ${text}`,
    options:[{id:"approve",label:"승인"},{id:"deny",label:"거절"}],
    context:{requestKind:kind,text,...payload},
    seq,
  };
}

/**
 * Suggested defaults for the DM card (capability inventory §13). House rules first, then the built-in table.
 * The DM edits or replaces anything here; nothing rolls until the DM commits (D8).
 */
export function suggestRuling(state:TableState,actorId:string,text:string,targetIds:string[]):{name:string;spec:RulingSpec} {
  const lower=text.toLowerCase();
  for(const rule of Object.values(state.houseRules)) if(rule.keyword&&lower.includes(rule.keyword.toLowerCase())) return {name:`즉석 규칙 · ${rule.name}`,spec:rule.spec};
  const actor=state.actors[actorId];
  const targetId=targetIds[0];
  const target=targetId?state.actors[targetId]:undefined;
  const grappledByActor=Boolean(target&&state.rules.effects.some((effect)=>effect.targetId===targetId&&effect.conditionId==="grappled"&&effect.sourceActorId===actorId));
  if(/던[지져진]|집어던/.test(lower)&&target&&grappledByActor) {
    const sizeGap=Math.max(0,actorSizeRank(target)-(actor?actorSizeRank(actor):2));
    return {name:"붙잡은 대상 던지기",spec:{check:{kind:"check",ability:"str",skill:"운동",dc:10+sizeGap*5},cost:"action",success:{text:"대상이 던져져 넘어진다",conditions:[{conditionId:"prone",targetIds:[targetId]}],damage:{dice:"1d6",type:"타격",targetIds:[targetId]},clearEngagement:true},failure:{text:"들어 올리지 못한다"}}};
  }
  if(/던[지져진]|집어던/.test(lower)) return {name:"물건 던져 맞히기",spec:{check:{kind:"save",ability:"dex",dc:12},cost:"action",failure:{text:"맞는다",damage:{dice:"1d4",type:"타격",targetIds}},success:{text:"피한다"}}};
  if(/모래|눈을|눈에|가루/.test(lower)) return {name:"눈 가리기",spec:{check:{kind:"save",ability:"dex",dc:12},cost:"action",failure:{text:"앞이 보이지 않는다",conditions:[{conditionId:"blinded",targetIds,duration:{kind:"rounds",amount:1,anchorActorId:actorId,boundary:"end"}}]},success:{text:"눈을 가린다"}}};
  if(/무기.*(뺏|떨어)|뺏|디스암|disarm/.test(lower)&&target) return {name:"무기 뺏기",spec:{check:{kind:"contest",ability:"str",skill:"운동",opponentId:targetId,opponentAbility:"str",opponentSkill:"운동"},cost:"action",success:{text:"무기가 바닥에 떨어진다",disarm:[targetId]},failure:{text:"무기를 놓치지 않는다"}}};
  if(/절벽|떨어뜨|밀어|밀치/.test(lower)) return {name:"밀어 떨어뜨리기",spec:{check:{kind:"save",ability:"str",dc:13},cost:"action",failure:{text:"밀려 넘어진다",conditions:[{conditionId:"prone",targetIds}],clearEngagement:true},success:{text:"버틴다"}}};
  if(/위협|협박|겁/.test(lower)) return {name:"위협",spec:{check:{kind:"check",ability:"cha",skill:"위협",dc:15},cost:"action",success:{text:"태도가 바뀐다"},failure:{text:"통하지 않는다"}}};
  if(/샹들리에|줄|곡예|뛰어|매달|구르/.test(lower)) return {name:"곡예",spec:{check:{kind:"check",ability:"dex",skill:"곡예",dc:15},cost:"movement",success:{text:"멋지게 해낸다",nextRoll:{targetIds:[actorId],family:"attack-roll",state:"advantage"}},failure:{text:"미끄러져 넘어진다",conditions:[{conditionId:"prone",targetIds:[actorId]}]}}};
  if(/기름|불|횃불|태우/.test(lower)) return {name:"불 붙이기",spec:{check:{kind:"save",ability:"dex",dc:13},cost:"action",failure:{text:"불이 붙는다",damage:{dice:"1d6",type:"화염",targetIds}},success:{text:"피한다"}}};
  if(/설득|말로|대화|부탁/.test(lower)) return {name:"설득",spec:{check:{kind:"check",ability:"cha",skill:"설득",dc:15},cost:"action",success:{text:"받아들인다"},failure:{text:"거절한다"}}};
  if(/조사|살펴|찾아|수색/.test(lower)) return {name:"조사",spec:{check:{kind:"check",ability:"wis",skill:"지각",dc:15},cost:"action",success:{text:"알아낸다"},failure:{text:"아무것도 못 찾는다"}}};
  return {name:"일반 판정",spec:{check:{kind:"check",ability:"str",skill:"운동",dc:15},cost:"action",success:{text:"성공"},failure:{text:"실패"}}};
}
