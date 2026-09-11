import { proneStandingCost } from "../../domain/conditions";
import { conditionEffectsFor } from "../../domain/combatState";
import type { ResolutionOperation } from "../../domain/resolutionTypes";
import type { CharacterSheet, ItemInstanceVm } from "../../app/contracts";
import type { TableCommand } from "../commands";
import type { SheetPatch } from "../events";
import { defaultSlotFor, handsLabel, slotIsFree, type HandSlot } from "../hands";
import { refused } from "../refusal";
import { lifeStateChanges, plainCard } from "../resolutionCard";
import { cloneState, type Actor, type FloorItem, type TableState } from "../state";
import { actorName, commitOperations, logEntry, type EventDraft, type HandlerContext, type HandlerResult } from "./types";

export const POSTURE_SOURCE="table:posture";
export const OBJECT_SOURCE="table:object";

function proneEffects(state:TableState,actorId:string) {
  return state.rules.effects.filter((effect)=>effect.targetId===actorId&&effect.kind==="condition"&&effect.conditionId==="prone");
}

/**
 * 엎드리기 is free at any time (2024: "you can drop prone without using any of your speed"); 일어나기 costs half
 * your speed of movement in Initiative and is impossible at 0 movement. Both go through the kernel so the condition's
 * advantage/disadvantage mechanics, replay and undo come for free.
 */
export function posture(ctx:HandlerContext,command:Extract<TableCommand,{type:"posture"}>):HandlerResult {
  const state=ctx.state;
  const actor=state.actors[command.actorId];
  const combatant=state.rules.combatants[command.actorId];
  if(!actor||!combatant) return refused("actor-unknown","테이블에 없는 액터입니다.",{actorId:command.actorId});
  if(combatant.life.dead) return refused("actor-dead","죽은 액터입니다.",{actorId:actor.id});
  const prone=proneEffects(state,actor.id);
  const resolutionId=`res.${ctx.nextSeq}`;
  const operations:ResolutionOperation[]=[];
  let compact:string;
  if(command.posture==="prone") {
    if(prone.length) return refused("posture-same","이미 넘어져 있습니다.",{actorId:actor.id});
    operations.push({id:`${resolutionId}:prone`,kind:"apply-effect",effect:{id:`${resolutionId}:prone:effect`,sourceId:POSTURE_SOURCE,sourceActorId:actor.id,targetId:actor.id,kind:"condition",conditionId:"prone",tags:[POSTURE_SOURCE],duration:{kind:"permanent"},metadata:{publicLabel:"넘어짐"}}});
    compact="엎드리기";
  } else {
    if(!prone.length) return refused("posture-same","넘어져 있지 않습니다.",{actorId:actor.id});
    if(combatant.life.hp.current<=0) return refused("posture-unconscious","의식불명 상태에서는 일어날 수 없습니다.",{actorId:actor.id});
    const cost=proneStandingCost(combatant.baseSpeed,conditionEffectsFor(state.rules,actor.id));
    if(state.mode==="initiative") {
      if(combatant.economy.movement<cost) return refused("movement-short",`일어나려면 이동력 ${cost}피트가 필요합니다. 남은 이동력: ${combatant.economy.movement}피트.`,{actorId:actor.id});
      operations.push({id:`${resolutionId}:stand`,kind:"move",actorId:actor.id,distanceFeet:cost,movementActivity:"stand",doesNotProvokeOpportunityAttacks:true});
    }
    for(const effect of prone) operations.push({id:`${resolutionId}:remove:${effect.id}`,kind:"remove-effect",effectId:effect.id});
    compact=state.mode==="initiative"?`일어나기 · 이동력 ${cost}피트`:"일어나기";
  }
  const committed=commitOperations(ctx,{id:resolutionId,actorId:actor.id,sourceId:POSTURE_SOURCE,operations,refusalCode:"posture-rejected"});
  if(committed.status==="refused") return committed;
  const rules=committed.commit.state;
  const card=plainCard({id:resolutionId,seq:ctx.nextSeq,visibility:"public",action:{id:`action.posture.${command.posture}`,actorId:actor.id,name:compact,category:"basic",target:"self",economy:"없음",resolutionKind:"no-roll",summary:compact,available:true,eligibleTargetIds:[actor.id],details:[]},actorId:actor.id,targetIds:[actor.id],rollKind:"effect",compact,detail:[command.posture==="prone"?"비용 없음 · 자신을 향한 근접 공격에 유리, 원거리 공격에 불리, 자신의 공격에 불리":"넘어짐 해제"],events:committed.commit.events,stateChanges:lifeStateChanges(state,state.rules,rules)});
  return {status:"committed",resolution:card,events:[{payload:{type:"rules-committed",rules,resolution:card},log:[logEntry(ctx,{actor:actor.name,title:compact,summary:`${actor.name} · ${compact}`,detail:[],stateChanges:card.stateChanges})]}]};
}

function sheetOf(actor:Actor):CharacterSheet|null { return actor.source.kind==="character"?cloneState(actor.source.sheet):null; }

const stackable=(item:ItemInstanceVm)=>item.kind==="consumable";

function uniqueItemId(sheet:CharacterSheet,wanted:string):string {
  if(!sheet.items.some((item)=>item.id===wanted)) return wanted;
  let index=2;
  while(sheet.items.some((item)=>item.id===`${wanted}.${index}`)) index+=1;
  return `${wanted}.${index}`;
}

/** Take `quantity` of an item out of a sheet: the removed instance (quantity set) and the sheet after. */
function takeFromSheet(sheet:CharacterSheet,itemId:string,quantity:number|undefined):{taken:ItemInstanceVm;sheet:CharacterSheet}|{error:string} {
  const item=sheet.items.find((entry)=>entry.id===itemId);
  if(!item) return {error:"가방에 없는 물건입니다."};
  const amount=quantity??(stackable(item)?1:item.quantity);
  if(!Number.isInteger(amount)||amount<1||amount>item.quantity) return {error:`수량이 맞지 않습니다 (보유 ${item.quantity}).`};
  const taken:ItemInstanceVm={...cloneState(item),quantity:amount,equipped:false,wielded:false};
  delete taken.wieldSlot;
  const next=cloneState(sheet);
  if(amount===item.quantity) next.items=next.items.filter((entry)=>entry.id!==itemId);
  else next.items=next.items.map((entry)=>entry.id===itemId?{...entry,quantity:entry.quantity-amount}:entry);
  return {taken,sheet:next};
}

function addToSheet(sheet:CharacterSheet,item:ItemInstanceVm):CharacterSheet {
  const next=cloneState(sheet);
  const stack=stackable(item)?next.items.find((entry)=>entry.definitionId===item.definitionId&&!entry.charges):undefined;
  if(stack) stack.quantity+=item.quantity;
  else next.items.push({...cloneState(item),id:uniqueItemId(next,item.id),equipped:false,wielded:false});
  return next;
}

/**
 * The 2024 free object interaction: one per turn in Initiative (draw, stow, pick up, hand over); the second costs the
 * Utilize action. Dropping is always free. Freeform play has no turns, so nothing is counted.
 */
function payInteraction(ctx:HandlerContext,actorId:string):{status:"paid";interactions:Record<string,number>;rules?:TableState["rules"];note?:string}|ReturnType<typeof refused> {
  const state=ctx.state;
  if(state.mode!=="initiative") return {status:"paid",interactions:state.interactions};
  const used=state.interactions[actorId]??0;
  const interactions={...state.interactions,[actorId]:used+1};
  if(used===0) return {status:"paid",interactions,note:"자유 상호작용 (턴당 1회)"};
  if(state.currentActorId!==actorId) return refused("interaction-off-turn","자기 턴에만 물건을 다룰 수 있습니다 (턴당 자유 상호작용 1회).",{actorId});
  const committed=commitOperations(ctx,{id:`object.${ctx.nextSeq}.utilize`,actorId,sourceId:OBJECT_SOURCE,refusalCode:"interaction-spent",operations:[{id:`object.${ctx.nextSeq}.action`,kind:"use-economy",actorId,slot:"action",actionKind:"other"}]});
  if(committed.status==="refused") return refused("interaction-spent","이번 턴의 자유 상호작용을 이미 사용했고, 두 번째 상호작용에 필요한 행동도 남아 있지 않습니다.",{actorId});
  return {status:"paid",interactions,rules:committed.commit.state,note:"두 번째 상호작용 · 사용(Utilize) 행동 소비"};
}

export function object(ctx:HandlerContext,command:Extract<TableCommand,{type:"object"}>):HandlerResult {
  const state=ctx.state;
  const actor=state.actors[command.actorId];
  const combatant=state.rules.combatants[command.actorId];
  if(!actor||!combatant) return refused("actor-unknown","테이블에 없는 액터입니다.",{actorId:command.actorId});
  if(combatant.life.dead) return refused("actor-dead","죽은 액터입니다.",{actorId:actor.id});
  if(combatant.life.hp.current<=0) return refused("actor-down","의식불명 상태에서는 물건을 다룰 수 없습니다.",{actorId:actor.id});
  const sheet=sheetOf(actor);
  if(!sheet) return refused("actor-no-inventory","이 액터에게는 가방이 없습니다. DM 재량으로 처리하세요.",{actorId:actor.id});
  const sheets:SheetPatch[]=[];
  let floor=state.floor;
  let title="";
  let summary="";
  const stateChanges:string[]=[];
  let paid:ReturnType<typeof payInteraction>|null=null;
  switch(command.op) {
    case "draw": {
      const item=sheet.items.find((entry)=>entry.id===command.itemId);
      if(!item) return refused("item-unknown","가방에 없는 물건입니다.",{actorId:actor.id});
      if(item.wielded) return refused("item-already-held","이미 들고 있는 물건입니다.",{actorId:actor.id});
      const slot:HandSlot|null=command.slot??defaultSlotFor(sheet,item);
      if(!slot||!slotIsFree(sheet,slot)) return refused("hands-full",`손이 비어 있지 않습니다 (${handsLabel(sheet)}). 먼저 놓거나 집어넣으세요.`,{actorId:actor.id});
      paid=payInteraction(ctx,actor.id); if(paid.status==="refused") return paid;
      const next=cloneState(sheet);
      next.items=next.items.map((entry)=>entry.id===item.id?{...entry,equipped:true,wielded:true,wieldSlot:slot}:entry);
      sheets.push({actorId:actor.id,sheet:next});
      title="꺼내기"; summary=`${item.name} → ${slot==="two-hand"?"양손":slot==="main-hand"?"주손":"보조손"}`;
      stateChanges.push(`손: ${handsLabel(next)}`);
      break;
    }
    case "stow": {
      const item=sheet.items.find((entry)=>entry.id===command.itemId);
      if(!item) return refused("item-unknown","가방에 없는 물건입니다.",{actorId:actor.id});
      if(!item.wielded) return refused("item-not-held","들고 있지 않은 물건입니다.",{actorId:actor.id});
      paid=payInteraction(ctx,actor.id); if(paid.status==="refused") return paid;
      const next=cloneState(sheet);
      next.items=next.items.map((entry)=>{ if(entry.id!==item.id) return entry; const stowed={...entry,wielded:false}; delete stowed.wieldSlot; return stowed; });
      sheets.push({actorId:actor.id,sheet:next});
      title="집어넣기"; summary=`${item.name} → 가방`;
      stateChanges.push(`손: ${handsLabel(next)}`);
      break;
    }
    case "drop": {
      const taken=takeFromSheet(sheet,command.itemId,command.quantity);
      if("error" in taken) return refused("item-unknown",taken.error,{actorId:actor.id});
      const entry:FloorItem={id:`floor.${ctx.nextSeq}.${taken.taken.id}`,item:taken.taken,droppedBy:actor.id,recoverable:true};
      floor=[...state.floor,entry];
      sheets.push({actorId:actor.id,sheet:taken.sheet});
      title="놓기"; summary=`${taken.taken.name}${taken.taken.quantity>1?` ×${taken.taken.quantity}`:""} → 바닥`;
      stateChanges.push(`바닥: ${taken.taken.name} (${actor.name}이(가) 놓음)`,`손: ${handsLabel(taken.sheet)}`);
      break;
    }
    case "pick-up": {
      const entry=state.floor.find((item)=>item.id===command.itemId);
      if(!entry) return refused("floor-item-unknown","바닥에 없는 물건입니다.",{actorId:actor.id});
      paid=payInteraction(ctx,actor.id); if(paid.status==="refused") return paid;
      floor=state.floor.filter((item)=>item.id!==entry.id);
      sheets.push({actorId:actor.id,sheet:addToSheet(sheet,entry.item)});
      title="줍기"; summary=`${entry.item.name}${entry.item.quantity>1?` ×${entry.item.quantity}`:""} → 가방`;
      stateChanges.push(`바닥에서 회수: ${entry.item.name}`);
      break;
    }
    case "give":
    case "throw-to": {
      const targetId=command.targetId;
      const target=targetId?state.actors[targetId]:undefined;
      const targetCombatant=targetId?state.rules.combatants[targetId]:undefined;
      if(!target||!targetCombatant||targetId===actor.id) return refused("target-missing","건넬 대상을 선택하세요.",{actorId:actor.id});
      if(target.source.kind!=="character") return refused("target-no-inventory","캐릭터에게만 건넬 수 있습니다. 몬스터·물체는 DM 재량으로 처리하세요.",{actorId:actor.id});
      if(target.side!==actor.side) return refused("target-hostile","상대편에게는 건넬 수 없습니다. DM 판정으로 처리하세요.",{actorId:actor.id});
      if(targetCombatant.life.dead) return refused("target-dead","죽은 대상입니다.",{actorId:actor.id});
      const taken=takeFromSheet(sheet,command.itemId,command.quantity);
      if("error" in taken) return refused("item-unknown",taken.error,{actorId:actor.id});
      paid=payInteraction(ctx,actor.id); if(paid.status==="refused") return paid;
      const receiver=cloneState(target.source.sheet);
      sheets.push({actorId:actor.id,sheet:taken.sheet},{actorId:target.id,sheet:addToSheet(receiver,taken.taken)});
      title=command.op==="give"?"건네기":"던져서 건네기"; summary=`${taken.taken.name}${taken.taken.quantity>1?` ×${taken.taken.quantity}`:""} → ${target.name}`;
      stateChanges.push(`${target.name} 가방에 ${taken.taken.name} 추가`,`손: ${handsLabel(taken.sheet)}`);
      break;
    }
  }
  const interactions=paid&&paid.status==="paid"?paid.interactions:state.interactions;
  const rules=paid&&paid.status==="paid"?paid.rules:undefined;
  if(rules) stateChanges.push(`${actor.name} 행동 사용`);
  const detail=paid&&paid.status==="paid"&&paid.note?[paid.note]:[];
  const events:EventDraft[]=[{
    payload:{type:"table-changed",sheets,...(floor!==state.floor?{floor}:{}),...(interactions!==state.interactions?{interactions}:{}),...(rules?{rules}:{})},
    log:[logEntry(ctx,{actor:actor.name,title,summary:`${actorName(state,actor.id)} · ${summary}`,detail,stateChanges})],
  }];
  return {status:"committed",events};
}
