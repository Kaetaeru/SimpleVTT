import type { ResolutionOperation } from "../../domain/resolutionTypes";
import { conditionLabelKo } from "../../app/srdMonsterCatalog";
import type { Ruling, TableCommand } from "../commands";
import type { ActorPatch } from "../events";
import { refused } from "../refusal";
import { lifeStateChanges } from "../resolutionCard";
import { cloneState, type TableState } from "../state";
import { NEXT_ROLL_TAG } from "./act";
import { actorName, commitOperations, logEntry, type EventDraft, type HandlerContext, type HandlerResult } from "./types";

export const RULING_SOURCE="table:ruling";
export const INSPIRATION_TAG="heroic-inspiration";
const FAMILY_LABEL={"attack-roll":"공격 굴림","ability-check":"능력 판정","saving-throw":"내성 굴림"} as const;

export function rulingLabel(state:TableState,ruling:Ruling):string {
  switch(ruling.kind) {
    case "damage": return `피해 ${ruling.amount}${ruling.damageType?` ${ruling.damageType}`:""}`;
    case "heal": return `회복 ${ruling.amount}`;
    case "temp-hp": return `임시 HP ${ruling.amount}`;
    case "max-hp": return `최대 HP ${ruling.delta>0?"+":""}${ruling.delta}`;
    case "condition": return `${conditionLabelKo(ruling.conditionId)} ${ruling.on?"적용":"해제"}`;
    case "exhaustion": return `탈진 ${ruling.level}단계`;
    case "next-roll": return `다음 ${ruling.family==="any"?"굴림":FAMILY_LABEL[ruling.family]} ${ruling.state==="advantage"?"유리":"불리"}`;
    case "inspiration": return `영웅적 영감 ${ruling.on?"부여":"회수"}`;
    case "life": return {down:"쓰러짐",stable:"안정화",dead:"사망 처리",revive:"부활"}[ruling.state];
    case "resource": return `자원 ${ruling.resourceId} ${ruling.delta>0?"+":""}${ruling.delta}`;
    case "engage": return `교전 ${ruling.on?"시작":"해제"} · ${actorName(state,ruling.otherId)}`;
    case "badge": return `${{hidden:"숨음",'cover-half':"엄폐 절반",'cover-three-quarters':"엄폐 ¾"}[ruling.badge]} ${ruling.on?"표시":"해제"}`;
  }
}

function operationsFor(ctx:HandlerContext,seq:number,targetId:string,ruling:Ruling):ResolutionOperation[]|{error:string} {
  const state=ctx.state;
  const actor=state.actors[targetId];
  const combatant=state.rules.combatants[targetId];
  if(!actor||!combatant) return {error:"테이블에 없는 대상입니다."};
  const creatureKind=actor.kind==="character"?"character" as const:"monster" as const;
  const base=`ruling.${seq}.${targetId}`;
  switch(ruling.kind) {
    case "damage":
      if(!Number.isInteger(ruling.amount)||ruling.amount<=0) return {error:"피해는 1 이상의 정수여야 합니다."};
      return [{id:`${base}:damage`,kind:"damage",targetId,damageType:ruling.damageType??"재량",amount:ruling.amount,creatureKind}];
    case "heal":
      if(!Number.isInteger(ruling.amount)||ruling.amount<=0) return {error:"회복은 1 이상의 정수여야 합니다."};
      if(combatant.life.dead) return {error:"죽은 대상은 회복되지 않습니다. 부활을 사용하세요."};
      return [{id:`${base}:healing`,kind:"healing",targetId,amount:ruling.amount}];
    case "temp-hp":
      if(!Number.isInteger(ruling.amount)||ruling.amount<=0) return {error:"임시 HP는 1 이상의 정수여야 합니다."};
      return [{id:`${base}:temp-hp`,kind:"temporary-hp",targetId,amount:ruling.amount,source:RULING_SOURCE}];
    case "max-hp":
      if(!Number.isInteger(ruling.delta)||ruling.delta===0) return {error:"최대 HP 변화량은 0이 아닌 정수여야 합니다."};
      return [{id:`${base}:max-hp`,kind:"maximum-hp",targetId,amount:ruling.delta}];
    case "condition": {
      if(!ruling.on) {
        const existing=state.rules.effects.filter((effect)=>effect.targetId===targetId&&effect.kind==="condition"&&effect.conditionId===ruling.conditionId);
        if(!existing.length) return {error:`${actor.name}에게 ${conditionLabelKo(ruling.conditionId)} 상태가 없습니다.`};
        return existing.map((effect)=>({id:`${base}:remove:${effect.id}`,kind:"remove-effect" as const,effectId:effect.id}));
      }
      if(ruling.conditionId!=="exhaustion"&&state.rules.effects.some((effect)=>effect.targetId===targetId&&effect.kind==="condition"&&effect.conditionId===ruling.conditionId)) return {error:`${actor.name}은(는) 이미 ${conditionLabelKo(ruling.conditionId)} 상태입니다.`};
      return [{id:`${base}:condition`,kind:"apply-effect",effect:{id:`${base}:${ruling.conditionId}`,sourceId:RULING_SOURCE,targetId,kind:"condition",conditionId:ruling.conditionId,tags:["table:ruling"],duration:ruling.duration??{kind:"permanent"},metadata:{publicLabel:conditionLabelKo(ruling.conditionId)}}}];
    }
    case "exhaustion": {
      if(!Number.isInteger(ruling.level)||ruling.level<0||ruling.level>6) return {error:"탈진 단계는 0~6입니다."};
      const existing=state.rules.effects.filter((effect)=>effect.targetId===targetId&&effect.kind==="condition"&&effect.conditionId==="exhaustion");
      const delta=ruling.level-existing.length;
      if(delta===0) return {error:`${actor.name}은(는) 이미 탈진 ${ruling.level}단계입니다.`};
      if(delta<0) return existing.slice(delta).map((effect)=>({id:`${base}:remove:${effect.id}`,kind:"remove-effect" as const,effectId:effect.id}));
      return Array.from({length:delta},(_,index)=>({id:`${base}:exhaustion:${existing.length+index+1}`,kind:"apply-effect" as const,effect:{id:`${base}:exhaustion:${existing.length+index+1}:effect`,sourceId:RULING_SOURCE,targetId,kind:"condition" as const,conditionId:"exhaustion" as const,tags:["table:ruling"],duration:{kind:"permanent" as const},metadata:{publicLabel:`탈진 ${existing.length+index+1}`}}}));
    }
    case "next-roll": {
      const families=ruling.family==="any"?(["attack-roll","ability-check","saving-throw"] as const):[ruling.family];
      const grantId=`${base}:next-roll`;
      const label=rulingLabel(state,ruling);
      return families.map((family,index)=>({id:`${grantId}:${family}`,kind:"apply-effect" as const,effect:{id:`${grantId}:${family}:effect`,sourceId:RULING_SOURCE,targetId,kind:"modifier" as const,tags:[NEXT_ROLL_TAG,"table:ruling"],duration:{kind:"permanent" as const},metadata:{...(index===0?{publicLabel:label}:{}),d20Family:family,d20RollState:ruling.state,grantId}}}));
    }
    case "inspiration": {
      const existing=state.rules.effects.filter((effect)=>effect.targetId===targetId&&effect.tags.includes(INSPIRATION_TAG));
      if(ruling.on) {
        if(existing.length) return {error:`${actor.name}은(는) 이미 영웅적 영감을 갖고 있습니다.`};
        return [{id:`${base}:inspiration`,kind:"apply-effect",effect:{id:`${base}:inspiration:effect`,sourceId:RULING_SOURCE,targetId,kind:"marker",tags:[INSPIRATION_TAG,"table:ruling"],duration:{kind:"permanent"},metadata:{publicLabel:"영웅적 영감"}}}];
      }
      if(!existing.length) return {error:`${actor.name}에게 영웅적 영감이 없습니다.`};
      return existing.map((effect)=>({id:`${base}:remove:${effect.id}`,kind:"remove-effect" as const,effectId:effect.id}));
    }
    case "life":
      if(ruling.state==="stable") {
        if(combatant.life.hp.current>0) return {error:"HP가 0일 때만 안정화합니다."};
        if(combatant.life.dead) return {error:"죽은 대상입니다."};
        if(combatant.life.stable) return {error:"이미 안정된 상태입니다."};
        return [{id:`${base}:stabilize`,kind:"stabilize",targetId}];
      }
      if(ruling.state==="revive") {
        if(!combatant.life.dead) return {error:"죽지 않은 대상입니다. 회복을 사용하세요."};
        return [{id:`${base}:revive`,kind:"healing",targetId,amount:1,revive:true}];
      }
      return [];
    case "resource": {
      if(!Number.isInteger(ruling.delta)||ruling.delta===0) return {error:"자원 변화량은 0이 아닌 정수여야 합니다."};
      const resource=combatant.resources.find((entry)=>entry.id===ruling.resourceId);
      if(!resource) return {error:"그 자원이 없습니다."};
      if(ruling.delta<0) {
        if(resource.current+ruling.delta<0) return {error:`${resource.label}이(가) 부족합니다.`};
        return [{id:`${base}:spend`,kind:"spend-resource",actorId:targetId,resourceId:ruling.resourceId,amount:-ruling.delta}];
      }
      return [{id:`${base}:gain`,kind:"gain-resource",actorId:targetId,resourceId:ruling.resourceId,amount:ruling.delta}];
    }
    case "engage":
    case "badge":
      return [];
  }
}

/** Rulings the kernel has no operation for: life flags set directly, presentation patches on the actor. */
function directRuling(ctx:HandlerContext,targetId:string,ruling:Ruling):{rules?:TableState["rules"];patches:Array<{actorId:string;patch:ActorPatch}>}|{error:string} {
  const state=ctx.state;
  const actor=state.actors[targetId];
  if(!actor) return {error:"테이블에 없는 대상입니다."};
  if(ruling.kind==="engage") {
    const other=state.actors[ruling.otherId];
    if(!other||ruling.otherId===targetId) return {error:"교전 상대가 없습니다."};
    const has=actor.engagement.includes(ruling.otherId);
    if(ruling.on===has) return {error:ruling.on?"이미 교전 중입니다.":"교전 중이 아닙니다."};
    const toggle=(list:string[],id:string)=>ruling.on?[...list,id]:list.filter((entry)=>entry!==id);
    return {patches:[{actorId:targetId,patch:{engagement:toggle(actor.engagement,ruling.otherId)}},{actorId:ruling.otherId,patch:{engagement:toggle(other.engagement,targetId)}}]};
  }
  if(ruling.kind==="badge") {
    const has=actor.badges.includes(ruling.badge);
    if(ruling.on===has) return {error:ruling.on?"이미 표시된 배지입니다.":"표시된 배지가 아닙니다."};
    return {patches:[{actorId:targetId,patch:{badges:ruling.on?[...actor.badges,ruling.badge]:actor.badges.filter((entry)=>entry!==ruling.badge)}}]};
  }
  if(ruling.kind==="life"&&(ruling.state==="down"||ruling.state==="dead")) {
    const rules=cloneState(state.rules);
    const combatant=rules.combatants[targetId];
    if(!combatant) return {error:"테이블에 없는 대상입니다."};
    if(combatant.life.dead) return {error:"이미 죽은 대상입니다."};
    if(ruling.state==="down"&&combatant.life.hp.current<=0) return {error:"이미 쓰러진 대상입니다."};
    combatant.life={hp:{...combatant.life.hp,current:0,temporary:0},deathSaves:{successes:0,failures:0},stable:false,unconscious:ruling.state==="down"&&actor.kind==="character",dead:ruling.state==="dead"||actor.kind!=="character"};
    rules.effects=rules.effects.filter((effect)=>!(effect.targetId===targetId&&effect.termination?.targetBecomesIncapacitated));
    delete rules.concentration[targetId];
    rules.revision+=1;
    const patches:Array<{actorId:string;patch:ActorPatch}>=[];
    if(combatant.life.dead) for(const other of Object.values(state.actors)) if(other.engagement.includes(targetId)) patches.push({actorId:other.id,patch:{engagement:other.engagement.filter((id)=>id!==targetId)}});
    if(combatant.life.dead&&actor.engagement.length) patches.push({actorId:targetId,patch:{engagement:[]}});
    return {rules,patches};
  }
  return {patches:[]};
}

export function ruling(ctx:HandlerContext,command:Extract<TableCommand,{type:"ruling"}>):HandlerResult {
  const state=ctx.state;
  const targetIds=[...new Set(command.targetIds)];
  if(!targetIds.length) return refused("target-missing","대상을 선택하세요.");
  for(const id of targetIds) if(!state.actors[id]||!state.rules.combatants[id]) return refused("target-unknown","테이블에 없는 대상입니다.",{actorId:id});
  const label=rulingLabel(state,command.ruling);
  const direct=command.ruling.kind==="engage"||command.ruling.kind==="badge"||(command.ruling.kind==="life"&&(command.ruling.state==="down"||command.ruling.state==="dead"));
  let rules=state.rules;
  let patches:Array<{actorId:string;patch:ActorPatch}>=[];
  const events:EventDraft[]=[];
  if(direct) {
    for(const targetId of targetIds) {
      const result=directRuling({...ctx,state:{...state,rules}},targetId,command.ruling);
      if("error" in result) return refused("ruling-rejected",result.error,{actorId:targetId});
      if(result.rules) rules=result.rules;
      for(const patch of result.patches) {
        const index=patches.findIndex((entry)=>entry.actorId===patch.actorId);
        if(index>=0) patches[index]={actorId:patch.actorId,patch:{...patches[index].patch,...patch.patch}}; else patches.push(patch);
      }
    }
  } else {
    const operations:ResolutionOperation[]=[];
    for(const targetId of targetIds) {
      const built=operationsFor(ctx,ctx.nextSeq,targetId,command.ruling);
      if("error" in built) return refused("ruling-rejected",built.error,{actorId:targetId});
      operations.push(...built);
    }
    if(!operations.length) return refused("ruling-empty","적용할 내용이 없습니다.");
    const committed=commitOperations(ctx,{id:`ruling.${ctx.nextSeq}`,actorId:targetIds[0],sourceId:RULING_SOURCE,operations,refusalCode:"ruling-rejected"});
    if(committed.status==="refused") return committed;
    rules=committed.commit.state;
    const immune=committed.commit.events.filter((event)=>event.kind==="apply-effect"&&(event.result as {immune?:boolean})?.immune);
    if(immune.length&&immune.length===committed.commit.events.filter((event)=>event.kind==="apply-effect").length) return refused("ruling-immune",`${actorName(state,immune[0].targetId??targetIds[0])}은(는) 면역입니다.`,{actorId:immune[0].targetId});
  }
  const stateChanges=[...lifeStateChanges(state,state.rules,rules),...patches.map((entry)=>`${actorName(state,entry.actorId)} ${Object.keys(entry.patch).join(", ")} 변경`)];
  const summary=`${label} → ${targetIds.map((id)=>actorName(state,id)).join(", ")}`;
  events.push({
    payload:{type:"rules-committed",rules,...(patches.length?{actorPatches:patches}:{})},
    log:[logEntry(ctx,{actor:"DM",title:`DM 재량 · ${label}`,summary,detail:command.note?[command.note]:[],stateChanges,ruling:label})],
  });
  return {status:"committed",events};
}
