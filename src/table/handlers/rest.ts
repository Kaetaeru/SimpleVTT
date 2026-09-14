import type { HitDieSpend } from "../../domain/rest";
import type { ResolutionOperation } from "../../domain/resolutionTypes";
import { actorAbilityModifier } from "../actors";
import type { TableCommand } from "../commands";
import { refused } from "../refusal";
import { lifeStateChanges } from "../resolutionCard";
import type { RestingState, TableQuestion } from "../state";
import { advanceClock, timeLabel } from "./time";
import { actorName, logEntry, type HandlerContext, type HandlerResult } from "./types";

const SHORT_REST_SECONDS=3600, LONG_REST_SECONDS=8*3600, LONG_REST_GAP_SECONDS=24*3600;

/**
 * Rests (capability inventory §17, D30, RULES_RUNTIME_SPECS.md §1): the DM proposes, each player answers how many hit
 * dice to spend, the DM completes. Completion runs the domain `short-rest` / `long-rest` operations and moves the clock.
 * Never during Initiative; a fight that starts during a rest cancels a short rest and interrupts a long one.
 */
export function rest(ctx:HandlerContext,command:Extract<TableCommand,{type:"rest"}>):HandlerResult {
  const state=ctx.state;
  if(state.mode==="initiative") return refused("rest-in-combat","이니셔티브 중에는 쉴 수 없습니다. 먼저 이니셔티브를 종료하세요.");
  const actorIds=[...new Set(command.actorIds)].filter((id)=>state.actors[id]&&state.rules.combatants[id]);
  if(!actorIds.length) return refused("actor-unknown","쉴 액터를 선택하세요.");
  for(const actorId of actorIds) {
    const combatant=state.rules.combatants[actorId];
    if(combatant.life.dead) return refused("actor-dead",`${actorName(state,actorId)}은(는) 죽어서 쉴 수 없습니다.`,{actorId});
    if(combatant.life.hp.current<=0) return refused("actor-down",`${actorName(state,actorId)}은(는) HP 0이라 휴식에 참여할 수 없습니다. 치유하거나 안정 후 1d4시간을 기다리세요.`,{actorId});
  }
  const answers:RestingState["answers"]={};
  for(const actorId of actorIds) if(command.kind==="short"&&typeof command.hitDice?.[actorId]==="number") answers[actorId]={hitDice:Math.max(0,Math.floor(command.hitDice[actorId]))};
  const resting:RestingState={kind:command.kind,actorIds,startedAt:state.rules.clock.elapsedSeconds,answers};
  const questions:TableQuestion[]=[];
  let seq=ctx.nextSeq;
  if(command.kind==="short") for(const actorId of actorIds) {
    const actor=state.actors[actorId];
    if(answers[actorId]||actor.kind!=="character"||!actor.controllerPeer) continue;
    const available=state.rules.combatants[actorId].hitDice.reduce((sum,pool)=>sum+pool.current,0);
    questions.push({id:`question.${seq}.rest.${actorId}`,kind:"rest",actorId,toPeer:actor.controllerPeer,prompt:`짧은 휴식 · ${actor.name}, 히트 다이스를 몇 개 쓸까요? (남은 ${available}개)`,options:Array.from({length:available+1},(_,count)=>({id:`hd:${count}`,label:`${count}개`})),context:{kind:"short"},seq});
    seq+=1;
  }
  const remaining=state.questions.filter((question)=>question.kind!=="rest");
  const title=command.kind==="short"?"짧은 휴식 제안 (1시간)":"긴 휴식 제안 (8시간)";
  return {status:"committed",events:[{
    payload:{type:"table-changed",resting,questions:[...remaining,...questions]},
    log:[logEntry(ctx,{actor:"DM",title,summary:actorIds.map((id)=>actorName(state,id)).join(", "),detail:questions.length?[`히트 다이스 질문 ${questions.length}건 · 답이 없으면 0개`]:[],stateChanges:[]})],
  }]};
}

export function restComplete(ctx:HandlerContext,command:Extract<TableCommand,{type:"rest-complete"}>):HandlerResult {
  const state=ctx.state;
  const resting=state.resting;
  if(!resting) return refused("rest-none","제안된 휴식이 없습니다. 먼저 휴식을 제안하세요.");
  if(state.mode==="initiative") return refused("rest-in-combat","이니셔티브 중에는 휴식을 끝낼 수 없습니다.");
  if(resting.interruptedAt!==undefined&&!command.force) return refused("rest-interrupted","긴 휴식이 이니셔티브로 중단되었습니다. 휴식을 다시 제안하거나 DM 예외(force)로 완료하세요.");
  const actorIds=resting.actorIds.filter((id)=>state.actors[id]&&state.rules.combatants[id]&&!state.rules.combatants[id].life.dead);
  if(!actorIds.length) return refused("actor-unknown","쉴 액터가 남아 있지 않습니다.");
  const operations:ResolutionOperation[]=[];
  const detail:string[]=[];
  for(const actorId of actorIds) {
    const combatant=state.rules.combatants[actorId];
    if(combatant.life.hp.current<=0) { detail.push(`${actorName(state,actorId)}: HP 0 · 휴식 이득 없음`); continue; }
    if(resting.kind==="long") {
      const last=state.time.lastLongRest[actorId];
      if(last!==undefined&&state.rules.clock.elapsedSeconds-last<LONG_REST_GAP_SECONDS) detail.push(`경고: ${actorName(state,actorId)}의 긴 휴식이 24시간 안에 두 번째입니다 (DM 예외로 기록)`);
      operations.push({id:`rest.${ctx.nextSeq}.long.${actorId}`,kind:"long-rest",targetId:actorId});
      continue;
    }
    const wanted=resting.answers[actorId]?.hitDice??0;
    const spends:HitDieSpend[]=[];
    let remaining=wanted;
    for(const pool of combatant.hitDice) {
      const take=Math.min(pool.current,remaining);
      for(let index=0;index<take;index+=1) spends.push({poolId:pool.id,faces:ctx.dice.faces(pool.sides,1,`${actorName(state,actorId)} 히트 다이스`),constitutionModifier:actorAbilityModifier(state.actors[actorId],"con")});
      remaining-=take;
      if(!remaining) break;
    }
    if(remaining>0) return refused("hit-dice-short",`${actorName(state,actorId)}의 히트 다이스가 ${wanted}개 남아 있지 않습니다.`,{actorId});
    if(spends.length) detail.push(`${actorName(state,actorId)} 히트 다이스 ${spends.length}개: ${spends.map((spend)=>spend.faces[0]).join("+")} + 건강 ${spends.length}×${spends[0].constitutionModifier}`);
    operations.push({id:`rest.${ctx.nextSeq}.short.${actorId}`,kind:"short-rest",targetId:actorId,spends});
  }
  const seconds=resting.kind==="short"?SHORT_REST_SECONDS:LONG_REST_SECONDS;
  const advance=advanceClock(ctx,state.rules,seconds,operations);
  if("status" in advance) return advance;
  const time=resting.kind==="long"?{...state.time,lastLongRest:{...state.time.lastLongRest,...Object.fromEntries(actorIds.map((id)=>[id,advance.rules.clock.elapsedSeconds]))}}:state.time;
  const questions=[...state.questions.filter((question)=>question.kind!=="rest"),...advance.questions];
  const title=resting.kind==="short"?"짧은 휴식 (1시간)":"긴 휴식 (8시간)";
  return {status:"committed",events:[{
    payload:{type:"time-advanced",seconds,rules:advance.rules,expired:advance.expired,fired:advance.fired,timers:advance.timers,questions,resting:null,time},
    log:[logEntry(ctx,{actor:"DM",title,summary:`${actorIds.map((id)=>actorName(state,id)).join(", ")} · ${timeLabel(seconds)} 경과`,detail:[...detail,...advance.lines],stateChanges:lifeStateChanges(state,state.rules,advance.rules)})],
  }]};
}
