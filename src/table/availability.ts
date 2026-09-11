import { conditionEffectsFor } from "../domain/combatState";
import { conditionActionAvailability } from "../domain/conditions";
import type { ActionVm } from "../app/contracts";
import type { TableState } from "./state";

export interface Availability { available:boolean; reason?:string }

const unavailable=(reason:string):Availability=>({available:false,reason});

/**
 * The one judgement of whether an actor may use an action now (TABLE_RUNTIME.md §2.5): the same function narrows
 * the projected tile and refuses the command, so the tile's reason and the refusal's reason never differ.
 */
export function availabilityOf(state:TableState,action:ActionVm,options:{asReaction?:boolean}={}):Availability {
  const actor=state.actors[action.actorId];
  const combatant=state.rules.combatants[action.actorId];
  if(!actor||!combatant) return unavailable("테이블에 없는 액터입니다.");
  if(action.available===false&&action.disabledReason) return unavailable(action.disabledReason);
  if(combatant.life.dead) return unavailable("죽은 액터는 행동할 수 없습니다.");
  const deathSave=action.id==="action.death-save";
  if(combatant.life.hp.current<=0) {
    if(actor.kind!=="character") return unavailable("쓰러진 상태라 행동할 수 없습니다.");
    if(!deathSave) return unavailable("의식불명 · 죽음 내성 굴림만 할 수 있습니다.");
    if(combatant.life.stable) return unavailable("안정된 상태입니다. 죽음 내성을 굴리지 않습니다.");
  } else if(deathSave) return unavailable("HP가 0일 때만 죽음 내성을 굴립니다.");
  const conditions=conditionActionAvailability(conditionEffectsFor(state.rules,action.actorId));
  const economyKind=options.asReaction?"반응":action.economy;
  if(economyKind==="행동"&&!conditions.action) return unavailable("행동불능 상태라 행동할 수 없습니다.");
  if(economyKind==="추가 행동"&&!conditions.bonusAction) return unavailable("행동불능 상태라 추가 행동을 할 수 없습니다.");
  if(economyKind==="반응"&&!conditions.reaction) return unavailable("행동불능 상태라 반응할 수 없습니다.");
  if(state.mode==="initiative") {
    const offTurn=state.currentActorId!==action.actorId;
    if(offTurn&&economyKind!=="반응"&&economyKind!=="없음"&&action.readyActionRole!=="trigger"&&!deathSave) return unavailable("현재 Actor의 턴이 아닙니다.");
    const economy=combatant.economy;
    if(economyKind==="행동"&&!economy.action&&!(economy.extraActions?.length)&&!(action.resolutionKind==="attack"&&economy.extraAttacks?.length)) return unavailable("행동을 이미 사용했습니다.");
    if(economyKind==="추가 행동"&&!economy.bonusAction) return unavailable("추가 행동을 이미 사용했습니다.");
    if(economyKind==="반응"&&!economy.reaction) return unavailable("반응을 이미 사용했습니다.");
  }
  if(action.resourceCost) {
    const resource=combatant.resources.find((entry)=>entry.id===action.resourceCost!.resourceId);
    if(!resource||resource.current<action.resourceCost.amount) return unavailable("자원이 부족합니다.");
  }
  if(action.tableWeaponItemId&&actor.source.kind==="character") {
    const item=actor.source.sheet.items.find((entry)=>entry.id===action.tableWeaponItemId);
    if(!item) return unavailable("무기가 가방에 없습니다.");
    // 2024: a thrown weapon is drawn as part of the attack, so it only has to be in the bag.
    if(!item.wielded&&!action.tableThrow) return unavailable("무기를 들고 있지 않습니다. 먼저 꺼내세요.");
  }
  return {available:true};
}

/** Which actors an action may aim at, from the table's point of view (sides, life state, hidden). */
export function eligibleTargetIds(state:TableState,action:ActionVm):string[] {
  const actor=state.actors[action.actorId];
  if(!actor) return [];
  const candidates=Object.values(state.actors).filter((candidate)=>{
    const combatant=state.rules.combatants[candidate.id];
    if(!combatant) return false;
    if(candidate.hidden&&candidate.id!==actor.id) return false;
    return true;
  });
  switch(action.target) {
    case "self": return [actor.id];
    case "none": return [];
    case "ally": return candidates.filter((candidate)=>candidate.side===actor.side&&candidate.id!==actor.id&&!state.rules.combatants[candidate.id].life.dead).map((candidate)=>candidate.id);
    case "enemy":
    case "multi-enemy": return candidates.filter((candidate)=>candidate.side!==actor.side&&!state.rules.combatants[candidate.id].life.dead).map((candidate)=>candidate.id);
    // Attacks may aim at anyone on the table but the attacker (D7: allies included, no confirmation); never the dead.
    case "any": return action.resolutionKind==="attack"?candidates.filter((candidate)=>candidate.id!==actor.id&&!state.rules.combatants[candidate.id].life.dead).map((candidate)=>candidate.id):candidates.map((candidate)=>candidate.id);
  }
}

/** A target refusal in the rules' words, or null when the selection is fine. */
export function targetRefusalFor(state:TableState,action:ActionVm,targetIds:string[]):{code:string;message:string}|null {
  const unique=[...new Set(targetIds)];
  const limit=action.maxTargets??(action.target==="multi-enemy"?undefined:1);
  if(action.target==="none") return null;
  if(action.target==="self") return unique.length&&unique.some((id)=>id!==action.actorId)?{code:"target-ineligible",message:"자기 자신에게만 사용할 수 있습니다."}:null;
  if(!unique.length) return {code:"target-missing",message:"대상을 선택하세요."};
  if(limit!==undefined&&unique.length>limit) return {code:"too-many-targets",message:limit===1?"대상은 한 명입니다.":`대상은 ${limit}명까지입니다.`};
  const eligible=new Set(eligibleTargetIds(state,action));
  for(const id of unique) {
    if(!state.actors[id]) return {code:"target-unknown",message:"테이블에 없는 대상입니다."};
    if(id===action.actorId&&(action.target==="enemy"||action.target==="multi-enemy"||(action.target==="any"&&action.resolutionKind==="attack"))) return {code:"target-ineligible",message:"자기 자신을 대상으로 할 수 없습니다."};
    if(state.rules.combatants[id]?.life.dead) return {code:"target-ineligible",message:"죽은 대상입니다."};
    if(!eligible.has(id)) return {code:"target-ineligible",message:action.target==="ally"?"아군에게만 사용할 수 있습니다.":"그 대상에게는 사용할 수 없습니다."};
  }
  return null;
}
