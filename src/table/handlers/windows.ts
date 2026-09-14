import { conditionActionAvailability } from "../../domain/conditions";
import { conditionEffectsFor } from "../../domain/combatState";
import { actionsFor } from "../actors";
import { availabilityOf } from "../availability";
import type { TableCommand } from "../commands";
import { recordingDice, replayingDice } from "../dice";
import { applyEvent, type TableEvent } from "../events";
import { refused } from "../refusal";
import { cloneState, type AttackOverrides, type PendingResolution, type ReactionWindow, type ResolutionRecord, type ResolutionReplay, type TableQuestion, type TableState } from "../state";
import { actorName, logEntry, type EventDraft, type HandlerContext, type HandlerResult } from "./types";

/**
 * Reaction windows and the DM attack-intervention palette (RULES_RUNTIME_SPECS.md §2, D42).
 *
 * A handler is pure: running it yields events without applying them. So a resolution is "held" by running it once
 * with recording dice, keeping the command and the faces, and opening one question per window. Each answer replays
 * the command with the same faces over the state the reaction produced; when no window remains, that run's events
 * commit. The DM palette is the same replay with overrides — on the pending resolution, or after the fact on the
 * latest committed one (its replay is kept beside the state).
 */
export const WINDOW_SPELLS:Record<string,ReactionWindow>={
  "dnd.srd521.spell.shield":"hit-determined",
  "dnd.srd521.spell.hellish-rebuke":"damage-taken",
  "dnd.srd521.spell.counterspell":"spell-being-cast",
};
export const LEGENDARY_RESISTANCE_POOL="legendary-resistance";

type ActCommand=Extract<TableCommand,{type:"act"}>;
type Runner=(ctx:HandlerContext,command:ActCommand)=>HandlerResult;
let runner:Runner|null=null;
/** act.ts registers its inner handler here (the two modules need each other). */
export function setPendingRunner(run:Runner) { runner=run; }

function canReact(state:TableState,reactorId:string):boolean {
  const combatant=state.rules.combatants[reactorId];
  if(!combatant||combatant.life.dead||combatant.life.hp.current<=0) return false;
  if(!conditionActionAvailability(conditionEffectsFor(state.rules,reactorId)).reaction) return false;
  if(state.mode==="initiative"&&!combatant.economy.reaction) return false;
  return true;
}

/** What this creature could do in a window right now: reaction spells it has prepared with a slot, or a stat-block reaction (DM-handled). */
export function reactionOptionsFor(state:TableState,reactorId:string,window:ReactionWindow):Array<{id:string;label:string;cost?:string}> {
  const reactor=state.actors[reactorId];
  if(!reactor||!canReact(state,reactorId)) return [];
  const options:Array<{id:string;label:string;cost?:string}>=[];
  for(const action of actionsFor(reactor,state)) {
    if(!action.tableSpell||WINDOW_SPELLS[action.tableSpell.spellId]!==window) continue;
    if(!availabilityOf(state,action,{asReaction:true}).available) continue;
    options.push({id:action.id,label:action.name,cost:"반응"});
  }
  if(window==="hit-determined"&&reactor.source.kind==="monster") {
    (reactor.source.definition.runtimeMonster?.reactions??[]).forEach((reaction,index)=>options.push({id:`monster-reaction:${index}`,label:`${reaction.name} (DM 처리)`,cost:"반응"}));
  }
  return options;
}

function legendaryResistanceLeft(state:TableState,actorId:string):number {
  return state.rules.combatants[actorId]?.resources.find((pool)=>pool.id===LEGENDARY_RESISTANCE_POOL)?.current??0;
}

const windowKey=(window:ReactionWindow,reactorId:string)=>`${window}:${reactorId}`;

/** The windows a first (or replayed) run of a command would open, in the order they are asked. */
export function windowsFor(ctx:HandlerContext,card:ResolutionRecord|null|undefined,answered:string[]):Array<{window:ReactionWindow;reactorId:string}> {
  const state=ctx.state;
  if(!card) return [];
  const out:Array<{window:ReactionWindow;reactorId:string}>=[];
  const push=(window:ReactionWindow,reactorId:string)=>{ if(!answered.includes(windowKey(window,reactorId))) out.push({window,reactorId}); };
  const attack=card.rollKind==="attack";
  if(attack&&state.settings.holdAttacks&&ctx.origin.role!=="dm") {
    for(const targetId of card.targetIds) if(state.actors[targetId]&&!state.actors[targetId].controllerPeer) push("dm-intervention",targetId);
  }
  const action=state.actors[card.actorId]?actionsFor(state.actors[card.actorId],state).find((entry)=>entry.id===card.actionId):undefined;
  if(action?.tableSpell&&WINDOW_SPELLS[action.tableSpell.spellId]!=="spell-being-cast") {
    for(const id of Object.keys(state.actors)) if(id!==card.actorId&&state.actors[id].side!==state.actors[card.actorId]?.side&&reactionOptionsFor(state,id,"spell-being-cast").length) push("spell-being-cast",id);
  }
  for(const save of card.saveResults??[]) if(save.outcome==="실패"&&legendaryResistanceLeft(state,save.targetId)>0) push("save-failed",save.targetId);
  if(attack&&card.attackOutcome==="명중") for(const targetId of card.targetIds) if(reactionOptionsFor(state,targetId,"hit-determined").length) push("hit-determined",targetId);
  return out;
}

/** Windows that open after a commit and need no replay: the damaged creature may strike back. */
export function afterCommitWindows(ctx:HandlerContext,card:ResolutionRecord|null|undefined):TableQuestion[] {
  const state=ctx.state;
  if(!card||card.rollKind!=="attack"||card.attackOutcome!=="명중") return [];
  const questions:TableQuestion[]=[];
  let seq=ctx.nextSeq;
  for(const targetId of card.targetIds) {
    const options=reactionOptionsFor(state,targetId,"damage-taken");
    if(!options.length) continue;
    questions.push({id:`question.${seq}.window.${targetId}`,kind:"reaction-window",actorId:targetId,toPeer:state.actors[targetId]?.controllerPeer,prompt:`${actorName(state,card.actorId)}의 공격에 맞았습니다. ${actorName(state,targetId)}의 반응?`,options:[...options,{id:"decline",label:"넘김"}],context:{window:"damage-taken",attackerId:card.actorId},seq});
    seq+=1;
  }
  return questions;
}

function windowQuestion(state:TableState,pending:PendingResolution,window:ReactionWindow,reactorId:string,seq:number):TableQuestion {
  const reactor=state.actors[reactorId];
  const toPeer=window==="dm-intervention"||window==="save-failed"?undefined:reactor?.controllerPeer;
  const base={id:`question.${seq}.window.${reactorId}`,kind:"reaction-window" as const,actorId:reactorId,toPeer,context:{pendingId:pending.id,window,attackerId:pending.actorId},seq};
  switch(window) {
    case "dm-intervention": return {...base,prompt:`${pending.label} — DM 개입? (팔레트: override)`,options:[{id:"proceed",label:"그대로"}]};
    case "save-failed": return {...base,prompt:`${reactor?.name??reactorId}이(가) 내성에 실패했습니다. 전설 저항을 쓸까요? (남은 ${legendaryResistanceLeft(state,reactorId)})`,options:[{id:"use",label:"전설 저항 사용"},{id:"decline",label:"그대로 실패"}]};
    case "spell-being-cast": return {...base,prompt:`${actorName(state,pending.actorId)}이(가) 주문을 시전합니다. ${reactor?.name??reactorId}의 반응?`,options:[...reactionOptionsFor(state,reactorId,window),{id:"decline",label:"넘김"}]};
    default: return {...base,prompt:`${pending.label} — 명중. ${reactor?.name??reactorId}의 반응?`,options:[...reactionOptionsFor(state,reactorId,window),{id:"decline",label:"넘김"}]};
  }
}

function withoutPendingQuestions(state:TableState,pending:PendingResolution):TableQuestion[] {
  const ids=new Set(pending.windows.map((entry)=>entry.questionId));
  return state.questions.filter((question)=>!ids.has(question.id)&&!(question.kind==="reaction-window"&&question.context.pendingId===pending.id));
}

function openWindow(ctx:HandlerContext,pending:PendingResolution,next:{window:ReactionWindow;reactorId:string}):HandlerResult {
  const state=ctx.state;
  const question=windowQuestion(state,pending,next.window,next.reactorId,ctx.nextSeq);
  const held:PendingResolution={...pending,windows:[{window:next.window,reactorId:next.reactorId,questionId:question.id}]};
  return {status:"committed",events:[{
    payload:{type:"table-changed",pending:held,questions:[...withoutPendingQuestions(state,pending),question]},
    log:[logEntry(ctx,{actor:actorName(state,pending.actorId),title:`대기 · ${pending.label}`,summary:question.prompt,detail:["결과는 반응 창이 닫히면 확정됩니다. 다른 액터의 행동은 막히지 않습니다."],stateChanges:[]})],
  }]};
}

function replayOf(pending:Pick<PendingResolution,"command"|"asReaction"|"diceRecord"|"answers">,state:TableState,card:ResolutionRecord):ResolutionReplay {
  return {resolutionId:card.id,command:pending.command,...(pending.asReaction?{asReaction:true}:{}),diceRecord:pending.diceRecord,rulesBefore:cloneState(state.rules),engagementsBefore:cloneState(state.engagements),questionsBefore:cloneState(state.questions),revisionAfter:-1,answers:[...pending.answers]};
}

function overrideLines(overrides:AttackOverrides):string[] {
  const lines:string[]=[];
  if(overrides.outcome) lines.push({hit:"명중 강제",miss:"빗나감 강제",crit:"치명타 강제"}[overrides.outcome]);
  if(overrides.cover&&overrides.cover!=="none") lines.push({half:"엄폐 절반 (+2)","three-quarters":"엄폐 ¾ (+5)",total:"완전 엄폐 (대상 불가)"}[overrides.cover]);
  if(overrides.rollState&&overrides.rollState!=="normal") lines.push(overrides.rollState==="advantage"?"유리":"불리");
  if(overrides.reach==="out") lines.push("닿지 않음 → 접근 후 공격 (D24)");
  if(overrides.range==="long") lines.push("긴 사거리 (불리)");
  if(overrides.range==="out") lines.push("사거리 밖 (공격 불가)");
  if(overrides.unseen?.target) lines.push("대상을 볼 수 없음 (불리)");
  if(overrides.unseen?.attacker) lines.push("공격자를 볼 수 없음 (유리)");
  if(overrides.damage) lines.push(overrides.damage.mode==="half"?"피해 절반":overrides.damage.mode==="zero"?"피해 없음":`피해 ${overrides.damage.value}`);
  if(overrides.autoSuccessSaves?.length) lines.push("전설 저항: 내성 성공");
  if(overrides.cancelled) lines.push("역마법: 주문 무산");
  return lines;
}

/** Final or preview run of a pending command over `ctx.state`; commits when no window remains, else opens the next one. */
export function continuePending(ctx:HandlerContext,pending:PendingResolution):HandlerResult {
  if(!runner) return refused("pending-runner","내부 오류: 대기 해결 실행기가 없습니다.");
  const run=runner;
  const state=ctx.state;
  const replayCtx:HandlerContext={...ctx,dice:replayingDice(pending.diceRecord,ctx.dice),overrides:pending.overrides,skipWindows:true,asReaction:pending.asReaction};
  const result=run(replayCtx,pending.command);
  if(result.status==="refused") {
    return {status:"committed",events:[{payload:{type:"table-changed",pending:null,questions:withoutPendingQuestions(state,pending)},log:[logEntry(ctx,{actor:actorName(state,pending.actorId),title:`무효 · ${pending.label}`,summary:result.refusal.message,detail:[],stateChanges:[]})]}]};
  }
  const remaining=windowsFor(replayCtx,result.resolution,pending.answers);
  if(remaining.length) return openWindow(ctx,pending,remaining[0]);
  return finalize(ctx,pending,result);
}

function finalize(ctx:HandlerContext,pending:PendingResolution,result:Extract<HandlerResult,{status:"committed"}>):HandlerResult {
  const state=ctx.state;
  const card=result.resolution;
  const first=result.events.find((draft)=>draft.payload.type==="rules-committed");
  if(card) {
    const lines=[...pending.answers.map((answer)=>`반응 창: ${answer}`),...overrideLines(pending.overrides).map((line)=>`DM 개입: ${line}`)];
    card.provenance.push(...lines);
    if(lines.length) card.detail.push(...lines);
  }
  if(first&&first.payload.type==="rules-committed") {
    const questions=[...(first.payload.questions??state.questions).filter((question)=>!(question.kind==="reaction-window"&&question.context.pendingId===pending.id)),...afterCommitWindows(ctx,card)];
    const replay=card?replayOf(pending,state,card):undefined;
    if(replay) replay.revisionAfter=first.payload.rules.revision;
    first.payload={...first.payload,pending:null,questions,...(replay?{replay}:{})};
  } else {
    result.events.push({payload:{type:"table-changed",pending:null,questions:withoutPendingQuestions(state,pending)},log:[]});
  }
  return result;
}

/** Run a command with recording dice; hold it when a window opens, else commit it with its replay attached. */
export function holdOrCommit(ctx:HandlerContext,command:ActCommand,run:(ctx:HandlerContext)=>HandlerResult):HandlerResult {
  const recording=recordingDice(ctx.dice);
  const result=run({...ctx,dice:recording.dice});
  if(result.status==="refused"||ctx.skipWindows) return result;
  const state=ctx.state;
  const card=result.resolution;
  const windows=windowsFor(ctx,card,[]);
  const pending:PendingResolution={id:`pending.${ctx.nextSeq}`,actorId:command.actorId,targetIds:[...command.targetIds],command:{type:"act",actorId:command.actorId,actionId:command.actionId,targetIds:[...command.targetIds],...(command.itemId?{itemId:command.itemId}:{}),...(command.slotLevel!==undefined?{slotLevel:command.slotLevel}:{}),...(command.amount!==undefined?{amount:command.amount}:{})},...(ctx.asReaction?{asReaction:true}:{}),diceRecord:recording.record,windows:[],answers:[],overrides:ctx.overrides??{},label:card?`${card.actionName} → ${card.targetIds.map((id)=>actorName(state,id)).join(", ")||actorName(state,command.actorId)}`:command.actionId};
  if(windows.length) return openWindow(ctx,pending,windows[0]);
  return finalize(ctx,pending,result);
}

function applyDrafts(state:TableState,drafts:EventDraft[],fromSeq:number,at:string):TableState {
  let next=state;
  drafts.forEach((draft,index)=>{ next=applyEvent(next,{seq:fromSeq+index,at,commandType:"act",log:[],payload:draft.payload} as TableEvent); });
  return next;
}

/** An answer to a reaction-window question: fire the reaction, then continue the pending resolution over the new state. */
export function answerWindow(ctx:HandlerContext,question:TableQuestion,optionId:string):HandlerResult {
  if(!runner) return refused("pending-runner","내부 오류: 대기 해결 실행기가 없습니다.");
  const run=runner;
  const state=ctx.state;
  const window=String(question.context.window) as ReactionWindow;
  const reactorId=question.actorId;
  const name=actorName(state,reactorId);
  const remaining=state.questions.filter((entry)=>entry.id!==question.id);
  const pending=state.pending&&state.pending.id===question.context.pendingId?state.pending:null;
  // damage-taken and stale windows: no pending resolution to continue.
  if(!pending) {
    if(optionId==="decline"||window!=="damage-taken") return {status:"committed",events:[{payload:{type:"table-changed",questions:remaining},log:[logEntry(ctx,{actor:name,title:"반응 넘김",summary:question.prompt,detail:[],stateChanges:[]})]}]};
    const attackerId=String(question.context.attackerId);
    const reaction=run({...ctx,asReaction:true,skipWindows:true},{type:"act",actorId:reactorId,actionId:optionId,targetIds:[attackerId]});
    if(reaction.status==="refused") return reaction;
    const first=reaction.events[0];
    if(first&&(first.payload.type==="rules-committed"||first.payload.type==="table-changed")) first.payload={...first.payload,questions:(first.payload.questions??state.questions).filter((entry)=>entry.id!==question.id)};
    return reaction;
  }
  const events:EventDraft[]=[];
  let working=state;
  let seq=ctx.nextSeq;
  const overrides:AttackOverrides={...pending.overrides};
  let answer=`${name} 넘김`;
  if(optionId!=="decline"&&optionId!=="proceed") {
    if(optionId.startsWith("monster-reaction:")) {
      const reaction=state.actors[reactorId]?.source.kind==="monster"?state.actors[reactorId].source.definition.runtimeMonster?.reactions[Number(optionId.split(":")[1])]:undefined;
      const rules=cloneState(state.rules);
      if(state.mode==="initiative"&&rules.combatants[reactorId]) rules.combatants[reactorId].economy={...rules.combatants[reactorId].economy,reaction:false};
      rules.revision+=1;
      events.push({payload:{type:"rules-committed",rules},log:[logEntry(ctx,{actor:name,title:`반응 · ${reaction?.name??optionId}`,summary:reaction?.text??"",detail:["효과는 DM이 팔레트(override)나 재량으로 적용합니다."],stateChanges:[`${name} 반응 사용`]})]});
      answer=`${name} ${reaction?.name??"반응"} (DM 처리)`;
    } else if(window==="save-failed") {
      const rules=cloneState(state.rules);
      const pool=rules.combatants[reactorId]?.resources.find((entry)=>entry.id===LEGENDARY_RESISTANCE_POOL);
      if(!pool||pool.current<1) return refused("legendary-resistance-spent","전설 저항이 남아 있지 않습니다.",{actorId:reactorId});
      pool.current-=1;
      rules.revision+=1;
      overrides.autoSuccessSaves=[...(overrides.autoSuccessSaves??[]),reactorId];
      events.push({payload:{type:"rules-committed",rules},log:[logEntry(ctx,{actor:name,title:"전설 저항",summary:`실패한 내성을 성공으로 (남은 ${pool.current})`,detail:[],stateChanges:[`${name} 전설 저항 ${pool.current+1} → ${pool.current}`]})]});
      answer=`${name} 전설 저항 사용`;
    } else {
      const targetIds=window==="spell-being-cast"?[pending.actorId]:[reactorId];
      const reaction=run({...ctx,asReaction:true,skipWindows:true},{type:"act",actorId:reactorId,actionId:optionId,targetIds});
      if(reaction.status==="refused") return reaction;
      events.push(...reaction.events);
      const spell=reaction.resolution;
      if(window==="spell-being-cast"&&spell?.saveResults?.some((entry)=>entry.targetId===pending.actorId&&entry.outcome==="실패")) overrides.cancelled=true;
      answer=`${name} ${spell?.actionName??optionId}${overrides.cancelled?" (주문 무산)":""}`;
    }
    working=applyDrafts(state,events,seq,ctx.now());
    seq+=events.length;
  }
  const next:PendingResolution={...pending,answers:[...pending.answers,windowKey(window,reactorId)],overrides,windows:[]};
  // The answer's own events must not carry the pending's questions forward untouched: strip this window's question.
  for(const draft of events) if(draft.payload.type==="rules-committed"||draft.payload.type==="table-changed") draft.payload={...draft.payload,questions:(draft.payload.questions??working.questions).filter((entry)=>entry.id!==question.id)};
  working={...working,questions:working.questions.filter((entry)=>entry.id!==question.id)};
  const continued=continuePending({...ctx,state:working,nextSeq:seq},next);
  if(continued.status==="refused") return continued;
  const answered=logEntry(ctx,{actor:name,title:"반응 창",summary:answer,detail:[],stateChanges:[]});
  if(continued.events[0]) continued.events[0].log=[answered,...continued.events[0].log];
  return {status:"committed",events:[...events,...continued.events],resolution:continued.resolution??null};
}

/** DM palette: on the pending resolution, or after the fact on the latest committed one. */
export function overrideResolution(ctx:HandlerContext,command:Extract<TableCommand,{type:"override"}>):HandlerResult {
  if(!runner) return refused("pending-runner","내부 오류: 대기 해결 실행기가 없습니다.");
  const run=runner;
  const state=ctx.state;
  const pending=state.pending;
  if(pending&&pending.id===command.resolutionId) {
    const dm=pending.windows.find((entry)=>entry.window==="dm-intervention");
    const next:PendingResolution={...pending,overrides:{...pending.overrides,...command.changes},answers:[...pending.answers,...(dm?[windowKey("dm-intervention",dm.reactorId)]:[])],windows:[]};
    const continued=continuePending({...ctx,state:{...state,questions:withoutPendingQuestions(state,pending)}},next);
    if(continued.status==="refused") return continued;
    if(continued.events[0]) continued.events[0].log=[logEntry(ctx,{actor:"DM",title:"DM 개입",summary:overrideLines(command.changes).join(", ")||"그대로",detail:command.note?[command.note]:[],stateChanges:[]}),...continued.events[0].log];
    return continued;
  }
  const replay=state.replays.find((entry)=>entry.resolutionId===command.resolutionId);
  if(!replay) return refused("resolution-unknown","다시 판정할 수 있는 해결이 아닙니다 (최근 해결만 가능).");
  if(replay.revisionAfter!==state.rules.revision) return refused("resolution-stale","그 뒤에 다른 행동이 있었습니다. 되돌리기로 처리하세요.");
  if(pending) return refused("pending-resolution","대기 중인 해결이 있습니다. 먼저 그것을 끝내세요.");
  const overrides:AttackOverrides={...command.changes};
  const before:TableState={...state,rules:cloneState(replay.rulesBefore),engagements:cloneState(replay.engagementsBefore),questions:cloneState(replay.questionsBefore)};
  const result=run({...ctx,state:before,dice:replayingDice(replay.diceRecord,ctx.dice),overrides,skipWindows:true,asReaction:replay.asReaction},replay.command);
  if(result.status==="refused") return refused("override-rejected",`재판정 불가: ${result.refusal.message}`);
  const card=result.resolution;
  const first=result.events.find((draft)=>draft.payload.type==="rules-committed");
  if(!first||first.payload.type!=="rules-committed"||!card) return refused("override-rejected","재판정 결과가 없습니다.");
  const lines=overrideLines(overrides);
  card.provenance.push(...lines.map((line)=>`DM 개입(사후): ${line}`),...replay.answers.map((answer)=>`반응 창: ${answer}`));
  card.detail.push(...lines.map((line)=>`DM 개입(사후): ${line}`));
  card.adjudicated=true;
  const nextReplay:ResolutionReplay={...replay,revisionAfter:first.payload.rules.revision};
  first.payload={...first.payload,engagements:first.payload.engagements??cloneState(replay.engagementsBefore),questions:first.payload.questions??cloneState(replay.questionsBefore),replay:nextReplay,pending:null};
  first.log=[logEntry(ctx,{actor:"DM",title:`DM 개입 · 재판정 (${card.actionName})`,summary:lines.join(", ")||"변경 없음",detail:command.note?[command.note]:[],stateChanges:[]}),...first.log];
  return result;
}

export function setSetting(ctx:HandlerContext,command:Extract<TableCommand,{type:"set-setting"}>):HandlerResult {
  const settings={...ctx.state.settings,...command.settings};
  return {status:"committed",events:[{payload:{type:"table-changed",settings},log:[logEntry(ctx,{actor:"DM",title:"세션 설정",summary:`공격 보류 ${settings.holdAttacks?"켬":"끔"}`,detail:[],stateChanges:[],visibility:"dm"})]}]};
}

/** Commands that depend on a pending resolution wait for it; everything else proceeds (RULES_RUNTIME_SPECS.md §2). */
export function pendingGuard(state:TableState,command:TableCommand):{code:string;message:string}|null {
  const pending=state.pending;
  if(!pending) return null;
  const message=`확인 대기 중: ${pending.label}. 반응 창이 닫히면 진행됩니다.`;
  switch(command.type) {
    case "act": return command.actorId===pending.actorId||pending.targetIds.includes(command.actorId)?{code:"pending-resolution",message}:null;
    case "declare": case "posture": case "object": case "ready": case "improvise": return command.actorId===pending.actorId?{code:"pending-resolution",message}:null;
    case "end-turn": return state.currentActorId===pending.actorId?{code:"pending-resolution",message}:null;
    case "start-initiative": case "end-initiative": return {code:"pending-resolution",message};
    default: return null;
  }
}
