import type { RulesRuntimeState } from "../../domain/combatState";
import type { ResolutionOperation } from "../../domain/resolutionTypes";
import type { TableCommand } from "../commands";
import { refused } from "../refusal";
import type { RestingState, TableQuestion, TableState, TableTime, Timer } from "../state";
import { actorName, commitOperations, logEntry, type HandlerContext, type HandlerResult } from "./types";

/**
 * The clock (RULES_RUNTIME_SPECS.md §1): one `rules.clock.elapsedSeconds`, moved by rounds, rests and the DM. Every
 * move is one domain `advance-time` operation (effects and artifacts expire there), then the table fires its timers.
 */
export const ROUND_SECONDS=6;
export const DAWN_SECONDS=6*3600;
const DAY_SECONDS=24*3600;

export function timeLabel(seconds:number):string {
  if(seconds<60) return `${seconds}초`;
  const parts:string[]=[];
  const days=Math.floor(seconds/DAY_SECONDS), hours=Math.floor((seconds%DAY_SECONDS)/3600), minutes=Math.floor((seconds%3600)/60), rest=seconds%60;
  if(days) parts.push(`${days}일`);
  if(hours) parts.push(`${hours}시간`);
  if(minutes) parts.push(`${minutes}분`);
  if(rest) parts.push(`${rest}초`);
  return parts.join(" ");
}

/** Seconds since midnight for a clock reading. */
export function clockOfDay(state:TableState,elapsedSeconds=state.rules.clock.elapsedSeconds):number { return (state.time.dayStartSeconds+elapsedSeconds)%DAY_SECONDS; }

export function secondsToDawn(state:TableState):number {
  const now=clockOfDay(state);
  return now<DAWN_SECONDS?DAWN_SECONDS-now:DAY_SECONDS-now+DAWN_SECONDS;
}

export function presetSeconds(state:TableState,command:Extract<TableCommand,{type:"advance-time"}>):number|undefined {
  if(typeof command.seconds==="number") return Math.floor(command.seconds);
  switch(command.preset) {
    case "round": return ROUND_SECONDS;
    case "1min": return 60;
    case "10min": return 600;
    case "1h": return 3600;
    case "8h": return 8*3600;
    case "1d": return DAY_SECONDS;
    case "to-dawn": return secondsToDawn(state);
    default: return undefined;
  }
}

function effectLabel(rules:RulesRuntimeState,effectId:string):string {
  const effect=rules.effects.find((entry)=>entry.id===effectId);
  const label=effect?.metadata?.publicLabel;
  return typeof label==="string"?label:effectId;
}

/** Fire every timer due on the clock: reminders and affliction ticks become DM cards, a stable creature regains 1 HP. */
export function fireTimers(ctx:HandlerContext,rules:RulesRuntimeState,timers:Timer[]):{rules:RulesRuntimeState;timers:Timer[];fired:string[];questions:TableQuestion[];lines:string[]} {
  const state=ctx.state;
  const now=rules.clock.elapsedSeconds;
  const due=timers.filter((timer)=>timer.at<=now);
  if(!due.length) return {rules,timers,fired:[],questions:[],lines:[]};
  let next=rules;
  const kept=timers.filter((timer)=>timer.at>now);
  const questions:TableQuestion[]=[];
  const lines:string[]=[];
  let seq=ctx.nextSeq;
  for(const timer of due) {
    switch(timer.kind) {
      case "reminder":
        questions.push({id:`question.${seq}.timer.${timer.id}`,kind:"dm",actorId:timer.targetId??"dm",prompt:`알림: ${timer.label}`,options:[{id:"ok",label:"확인"}],context:{timerId:timer.id},seq});
        lines.push(`알림: ${timer.label}`);
        break;
      case "affliction-tick":
        questions.push({id:`question.${seq}.affliction.${timer.id}`,kind:"dm",actorId:timer.targetId??"dm",prompt:`${timer.targetId?actorName(state,timer.targetId)+" · ":""}${timer.label}: 내성 카드를 여세요`,options:[{id:"ok",label:"확인"}],context:{timerId:timer.id,...(timer.targetId?{targetId:timer.targetId}:{})},seq});
        lines.push(`${timer.label} (${timer.targetId?actorName(state,timer.targetId):""})`);
        break;
      case "dawn":
        lines.push("새벽");
        kept.push({...timer,at:timer.at+DAY_SECONDS});
        break;
      case "stable-recovery": {
        const targetId=timer.targetId??"";
        const combatant=next.combatants[targetId];
        if(combatant&&!combatant.life.dead&&combatant.life.hp.current<=0&&combatant.life.stable) {
          const committed=commitOperations(ctx,{id:`timer.${seq}.${timer.id}`,actorId:targetId,sourceId:"table:timer",rules:next,operations:[{id:`timer.${seq}.${timer.id}:healing`,kind:"healing",targetId,amount:1}]});
          if(committed.status==="committed") { next=committed.commit.state; lines.push(`${actorName(state,targetId)} 안정 후 회복: HP 1`); }
        }
        break;
      }
    }
    seq+=1;
  }
  return {rules:next,timers:kept,fired:due.map((timer)=>timer.id),questions,lines};
}

export interface ClockAdvance {
  rules:RulesRuntimeState;
  expired:string[];
  fired:string[];
  timers:Timer[];
  questions:TableQuestion[];
  lines:string[];
}

/** Move the clock by `seconds` over `rules` (which may already carry this command's other operations) and fire the timers. */
export function advanceClock(ctx:HandlerContext,rules:RulesRuntimeState,seconds:number,extraOperations:ResolutionOperation[]=[]):ClockAdvance|ReturnType<typeof refused> {
  const state=ctx.state;
  const target=rules.clock.elapsedSeconds+seconds;
  const committed=commitOperations(ctx,{id:`time.${ctx.nextSeq}`,actorId:state.currentActorId??"table",sourceId:"table:time",rules,refusalCode:"time-rejected",operations:[...extraOperations,{id:`time.${ctx.nextSeq}.advance`,kind:"advance-time",elapsedSeconds:target}]});
  if(committed.status==="refused") return committed;
  const before=new Set(rules.effects.map((effect)=>effect.id));
  const after=committed.commit.state;
  const expired=[...before].filter((id)=>!after.effects.some((effect)=>effect.id===id));
  const fired=fireTimers(ctx,after,state.timers);
  const lines=[...expired.map((id)=>`종료: ${effectLabel(rules,id)}`),...fired.lines];
  return {rules:fired.rules,expired,fired:fired.fired,timers:fired.timers,questions:fired.questions,lines};
}

export function advanceTime(ctx:HandlerContext,command:Extract<TableCommand,{type:"advance-time"}>):HandlerResult {
  const state=ctx.state;
  const seconds=presetSeconds(state,command);
  if(seconds===undefined||!Number.isFinite(seconds)||seconds<=0) return refused("time-invalid","얼마나 지나는지 고르세요 (라운드·10분·1시간·8시간·1일·새벽까지).");
  if(state.mode==="initiative"&&command.preset!=="round") return refused("time-in-combat","이니셔티브 중에는 라운드 단위로만 시간이 흐릅니다. 먼저 이니셔티브를 종료하세요.");
  const advance=advanceClock(ctx,state.rules,seconds);
  if("status" in advance) return advance;
  const questions=advance.questions.length?[...state.questions,...advance.questions]:undefined;
  return {status:"committed",events:[{
    payload:{type:"time-advanced",seconds,rules:advance.rules,expired:advance.expired,fired:advance.fired,timers:advance.timers,...(questions?{questions}:{})},
    log:[logEntry(ctx,{actor:"DM",title:`시간 경과 · ${timeLabel(seconds)}`,summary:command.reason??"",detail:advance.lines,stateChanges:advance.expired.map((id)=>`효과 종료: ${effectLabel(state.rules,id)}`)})],
  }]};
}

export function setTimer(ctx:HandlerContext,command:Extract<TableCommand,{type:"set-timer"}>):HandlerResult {
  const state=ctx.state;
  if(!command.label.trim()) return refused("timer-invalid","알림 내용을 적으세요.");
  if(!Number.isFinite(command.inSeconds)||command.inSeconds<=0) return refused("timer-invalid","알림까지의 시간은 0보다 커야 합니다.");
  const timer:Timer={id:`timer.${ctx.nextSeq}`,at:state.rules.clock.elapsedSeconds+Math.floor(command.inSeconds),kind:"reminder",label:command.label.trim()};
  return {status:"committed",events:[{payload:{type:"table-changed",timers:[...state.timers,timer]},log:[logEntry(ctx,{actor:"DM",title:"알림 예약",summary:`${timeLabel(Math.floor(command.inSeconds))} 뒤 · ${timer.label}`,detail:[],stateChanges:[],visibility:"dm"})]}]};
}

export function clearTimer(ctx:HandlerContext,command:Extract<TableCommand,{type:"clear-timer"}>):HandlerResult {
  const state=ctx.state;
  const timer=state.timers.find((entry)=>entry.id===command.timerId);
  if(!timer) return refused("timer-unknown","없는 알림입니다.");
  return {status:"committed",events:[{payload:{type:"table-changed",timers:state.timers.filter((entry)=>entry.id!==timer.id)},log:[logEntry(ctx,{actor:"DM",title:"알림 취소",summary:timer.label,detail:[],stateChanges:[],visibility:"dm"})]}]};
}

/** A creature became stable at 0 HP: it regains 1 HP after 1d4 hours unless healed first (SRD 5.2.1 Stabilizing). */
export function stableRecoveryTimers(ctx:HandlerContext,before:RulesRuntimeState,after:RulesRuntimeState,timers:Timer[]):Timer[]|null {
  const added:Timer[]=[];
  for(const [id,combatant] of Object.entries(after.combatants)) {
    const was=before.combatants[id];
    const nowStable=!combatant.life.dead&&combatant.life.hp.current<=0&&combatant.life.stable;
    const wasStable=Boolean(was&&!was.life.dead&&was.life.hp.current<=0&&was.life.stable);
    if(nowStable&&!wasStable&&!timers.some((timer)=>timer.kind==="stable-recovery"&&timer.targetId===id)) {
      const hours=ctx.dice.faces(4,1,`${actorName(ctx.state,id)} 안정 후 회복까지 (1d4시간)`)[0];
      added.push({id:`timer.${ctx.nextSeq}.stable.${id}`,at:after.clock.elapsedSeconds+hours*3600,kind:"stable-recovery",label:`${actorName(ctx.state,id)} 1 HP 회복 (${hours}시간 뒤)`,targetId:id});
    }
  }
  const stale=timers.filter((timer)=>timer.kind==="stable-recovery"&&timer.targetId&&(!after.combatants[timer.targetId]||after.combatants[timer.targetId].life.hp.current>0||after.combatants[timer.targetId].life.dead));
  if(!added.length&&!stale.length) return null;
  return [...timers.filter((timer)=>!stale.includes(timer)),...added];
}

export function timeOf(state:TableState):TableTime { return state.time; }
export function restingOf(state:TableState):RestingState|null { return state.resting; }
