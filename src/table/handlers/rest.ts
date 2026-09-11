import type { HitDieSpend } from "../../domain/rest";
import type { ResolutionOperation } from "../../domain/resolutionTypes";
import { actorAbilityModifier } from "../actors";
import type { TableCommand } from "../commands";
import { refused } from "../refusal";
import { lifeStateChanges } from "../resolutionCard";
import { actorName, commitOperations, logEntry, type HandlerContext, type HandlerResult } from "./types";

/**
 * Rest (capability inventory §17) through the domain `short-rest` / `long-rest` operations: hit dice spent with the
 * table's dice and the CON modifier, resources recovered by their own recovery rules, effects expired by the rest,
 * concentration ended. Never during Initiative.
 */
export function rest(ctx:HandlerContext,command:Extract<TableCommand,{type:"rest"}>):HandlerResult {
  const state=ctx.state;
  if(state.mode==="initiative") return refused("rest-in-combat","이니셔티브 중에는 쉴 수 없습니다. 먼저 이니셔티브를 종료하세요.");
  const actorIds=[...new Set(command.actorIds)].filter((id)=>state.actors[id]&&state.rules.combatants[id]);
  if(!actorIds.length) return refused("actor-unknown","쉴 액터를 선택하세요.");
  const operations:ResolutionOperation[]=[];
  const detail:string[]=[];
  for(const actorId of actorIds) {
    const combatant=state.rules.combatants[actorId];
    if(combatant.life.dead) return refused("actor-dead",`${actorName(state,actorId)}은(는) 죽어서 쉴 수 없습니다.`,{actorId});
    if(command.kind==="long") { operations.push({id:`rest.${ctx.nextSeq}.long.${actorId}`,kind:"long-rest",targetId:actorId}); continue; }
    if(combatant.life.hp.current<=0) return refused("actor-down",`${actorName(state,actorId)}은(는) 의식이 없어 짧은 휴식으로 회복할 수 없습니다.`,{actorId});
    const wanted=Math.max(0,Math.floor(command.hitDice?.[actorId]??0));
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
  const committed=commitOperations(ctx,{id:`rest.${ctx.nextSeq}`,actorId:actorIds[0],sourceId:"table:rest",operations,refusalCode:"rest-rejected"});
  if(committed.status==="refused") return committed;
  const rules=committed.commit.state;
  const title=command.kind==="short"?"짧은 휴식 (1시간)":"긴 휴식 (8시간)";
  const stateChanges=lifeStateChanges(state,state.rules,rules);
  return {status:"committed",events:[{
    payload:{type:"rules-committed",rules},
    log:[logEntry(ctx,{actor:"DM",title,summary:actorIds.map((id)=>actorName(state,id)).join(", "),detail,stateChanges})],
  }]};
}
