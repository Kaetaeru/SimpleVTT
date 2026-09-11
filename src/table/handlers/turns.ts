import { beginTurn } from "../../domain/turnEconomy";
import { pruneIdleEngagements } from "../../domain/engagement";
import { pairLabel } from "../engagement";
import type { ResolutionOperation } from "../../domain/resolutionTypes";
import type { TableCommand } from "../commands";
import { actorDexModifier } from "../actors";
import { refused } from "../refusal";
import { actorIds, cloneState, type TableState } from "../state";
import { rollInitiative } from "./actors";
import { actorName, commitOperations, logEntry, type HandlerContext, type HandlerResult } from "./types";

function livingOrder(state:TableState,order:string[]) {
  return order.filter((id)=>state.actors[id]&&state.rules.combatants[id]&&!state.rules.combatants[id].life.dead);
}

export function startInitiative(ctx:HandlerContext):HandlerResult {
  const state=ctx.state;
  if(state.mode==="initiative") return refused("mode-already","이미 이니셔티브 중입니다.");
  const ids=actorIds(state).filter((id)=>state.rules.combatants[id]);
  if(!ids.length) return refused("table-empty","테이블에 액터가 없습니다.");
  const rolls=ids.map((id)=>({id,actor:state.actors[id],roll:rollInitiative(ctx,state.actors[id])}));
  const order=[...rolls].sort((a,b)=>b.roll.total-a.roll.total||actorDexModifier(b.actor)-actorDexModifier(a.actor)||a.actor.name.localeCompare(b.actor.name,"ko-KR")).map((entry)=>entry.id);
  const first=livingOrder(state,order)[0];
  if(!first) return refused("table-dead","살아 있는 액터가 없습니다.");
  const rules=cloneState(state.rules);
  for(const combatant of Object.values(rules.combatants)) combatant.economy=beginTurn(combatant.baseSpeed);
  rules.clock={...rules.clock,round:1,activeActorId:undefined,phase:undefined,specialWindows:undefined};
  const committed=commitOperations(ctx,{id:`turn.${ctx.nextSeq}.start`,actorId:first,sourceId:"table:turn",rules,refusalCode:"turn-rejected",operations:[{id:`turn.${ctx.nextSeq}.begin`,kind:"begin-turn",actorId:first,round:1}]});
  if(committed.status==="refused") return committed;
  const initiativeEvents=rolls.map(({id,roll})=>({payload:{type:"actor-updated" as const,actorId:id,patch:{initiative:roll.total}},log:[]}));
  return {status:"committed",events:[
    ...initiativeEvents,
    {
      payload:{type:"mode-changed",mode:"initiative",order,round:1,currentActorId:first,rules:committed.commit.state},
      log:[logEntry(ctx,{actor:"DM",title:"이니셔티브 시작",summary:`1라운드 · ${actorName(state,first)}의 턴`,detail:rolls.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id)).map((entry)=>`${entry.actor.name} ${entry.roll.total} (d20 ${entry.roll.face})`),stateChanges:["SessionMode = initiative"]})],
    },
  ]};
}

export function endInitiative(ctx:HandlerContext):HandlerResult {
  const state=ctx.state;
  if(state.mode!=="initiative") return refused("mode-already","이니셔티브가 아닙니다.");
  const rules=cloneState(state.rules);
  for(const combatant of Object.values(rules.combatants)) combatant.economy=beginTurn(combatant.baseSpeed);
  rules.clock={...rules.clock,activeActorId:undefined,phase:undefined,specialWindows:undefined};
  rules.turnFeatureUsage=undefined;
  // Engagements outlive the fight (a relation play produced); freeform play counts every record as round 1.
  const engagements=state.engagements.map((record)=>({...record,sinceRound:1,lastMeleeRound:1}));
  return {status:"committed",events:[{
    payload:{type:"mode-changed",mode:"freeform",order:[],round:0,currentActorId:null,rules,...(engagements.length?{engagements}:{})},
    log:[logEntry(ctx,{actor:"DM",title:"이니셔티브 종료",summary:"자유 진행으로 전환",detail:[],stateChanges:["SessionMode = freeform"]})],
  }]};
}

function nextTurn(state:TableState):{actorId:string;round:number}|null {
  const order=state.order;
  if(!order.length) return null;
  const current=state.currentActorId?order.indexOf(state.currentActorId):-1;
  for(let step=1;step<=order.length;step+=1) {
    const index=(current+step)%order.length;
    const id=order[index];
    const combatant=state.rules.combatants[id];
    if(!state.actors[id]||!combatant||combatant.life.dead) continue;
    return {actorId:id,round:index<=current?state.round+1:state.round};
  }
  return null;
}

export function endTurn(ctx:HandlerContext):HandlerResult {
  const state=ctx.state;
  if(state.mode!=="initiative") return refused("mode-freeform","이니셔티브가 아닙니다. 자유 진행에는 턴이 없습니다.");
  const current=state.currentActorId;
  if(!current||!state.rules.combatants[current]) return refused("turn-missing","현재 턴인 액터가 없습니다.");
  const next=nextTurn(state);
  if(!next) return refused("table-dead","살아 있는 액터가 없습니다.");
  const committed=commitOperations(ctx,{id:`turn.${ctx.nextSeq}.end`,actorId:current,sourceId:"table:turn",refusalCode:"turn-rejected",operations:[
    {id:`turn.${ctx.nextSeq}.end-turn`,kind:"end-turn",actorId:current,round:state.round},
    {id:`turn.${ctx.nextSeq}.begin-turn`,kind:"begin-turn",actorId:next.actorId,round:next.round},
  ]});
  if(committed.status==="refused") return committed;
  const turnLog=logEntry(ctx,{actor:"시스템",title:"턴 종료",summary:`${actorName(state,current)} → ${actorName(state,next.actorId)}${next.round!==state.round?` · ${next.round}라운드`:""}`,detail:[],stateChanges:[]});
  if(next.round===state.round) return {status:"committed",events:[{payload:{type:"turn-changed",currentActorId:next.actorId,round:next.round,rules:committed.commit.state},log:[turnLog]}]};
  const kept=pruneIdleEngagements(state.engagements,next.round);
  const dropped=state.engagements.filter((record)=>!kept.includes(record));
  const log=[turnLog];
  if(dropped.length) log.push(logEntry(ctx,{index:1,actor:"시스템",title:"교전 종료 · 한 라운드 동안 근접 공격 없음",summary:dropped.map((record)=>pairLabel(state,record)).join(", "),detail:[`${next.round}라운드 시작 · 직전 라운드에 근접 공격이 없던 교전이 끝납니다.`],stateChanges:dropped.map((record)=>`교전 종료: ${pairLabel(state,record)}`)}));
  return {status:"committed",events:[{
    payload:{type:"turn-changed",currentActorId:next.actorId,round:next.round,rules:committed.commit.state,...(dropped.length?{engagements:kept}:{})},
    log,
  }]};
}

export function setCurrentActor(ctx:HandlerContext,command:Extract<TableCommand,{type:"set-current-actor"}>):HandlerResult {
  const state=ctx.state;
  if(state.mode!=="initiative") return refused("mode-freeform","이니셔티브가 아닙니다.");
  if(!state.actors[command.actorId]||!state.rules.combatants[command.actorId]) return refused("actor-unknown","테이블에 없는 액터입니다.",{actorId:command.actorId});
  if(state.currentActorId===command.actorId) return refused("turn-same","이미 그 액터의 턴입니다.",{actorId:command.actorId});
  const operations:ResolutionOperation[]=[];
  if(state.currentActorId&&state.rules.combatants[state.currentActorId]) operations.push({id:`turn.${ctx.nextSeq}.end-turn`,kind:"end-turn",actorId:state.currentActorId,round:state.round});
  operations.push({id:`turn.${ctx.nextSeq}.begin-turn`,kind:"begin-turn",actorId:command.actorId,round:state.round});
  const committed=commitOperations(ctx,{id:`turn.${ctx.nextSeq}.jump`,actorId:command.actorId,sourceId:"table:turn",refusalCode:"turn-rejected",operations});
  if(committed.status==="refused") return committed;
  return {status:"committed",events:[{
    payload:{type:"turn-changed",currentActorId:command.actorId,round:state.round,rules:committed.commit.state},
    log:[logEntry(ctx,{actor:"DM",title:"턴 이동",summary:`${actorName(state,command.actorId)}의 턴`,detail:[],stateChanges:[]})],
  }]};
}

export function setOrder(ctx:HandlerContext,command:Extract<TableCommand,{type:"set-order"}>):HandlerResult {
  const state=ctx.state;
  if(state.mode!=="initiative") return refused("mode-freeform","이니셔티브가 아닙니다.");
  const wanted=[...command.order];
  if(wanted.length!==state.order.length||new Set(wanted).size!==wanted.length||wanted.some((id)=>!state.order.includes(id))) return refused("order-invalid","순서에는 현재 이니셔티브의 액터가 모두 한 번씩 있어야 합니다.");
  return {status:"committed",events:[{
    payload:{type:"turn-changed",currentActorId:state.currentActorId,round:state.round,order:wanted,rules:state.rules},
    log:[logEntry(ctx,{actor:"DM",title:"순서 변경",summary:wanted.map((id)=>actorName(state,id)).join(" → "),detail:[],stateChanges:[]})],
  }]};
}
