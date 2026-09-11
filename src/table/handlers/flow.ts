import { clearEngagementsOf } from "../../domain/engagement";
import type { ResolutionOperation } from "../../domain/resolutionTypes";
import { actionsFor } from "../actors";
import { availabilityOf, targetRefusalFor } from "../availability";
import type { TableCommand } from "../commands";
import { opportunityAttackQuestions, readyTriggerQuestion, withoutQuestion } from "../questions";
import { refused } from "../refusal";
import { cloneState, type TableQuestion, type TableState } from "../state";
import { act, attackAct } from "./act";
import { resolvePlayerRequest } from "./improvise";
import { actorName, commitOperations, logEntry, type EventDraft, type HandlerContext, type HandlerResult } from "./types";

/**
 * Table flow that is not a resolution by itself: movement declarations (§5), questions and their answers (§10),
 * the Ready action (§9). A withdrawal asks the engaged enemies; an answer fires the reaction through the same
 * attack path with the reaction slot; the DM may skip any question (D5).
 */

const MOVEMENT_LABEL={approach:"접근",withdraw:"물러남",stay:"그대로"} as const;

export function declare(ctx:HandlerContext,command:Extract<TableCommand,{type:"declare"}>):HandlerResult {
  const state=ctx.state;
  const actor=state.actors[command.actorId];
  const combatant=state.rules.combatants[command.actorId];
  if(!actor||!combatant) return refused("actor-unknown","테이블에 없는 액터입니다.",{actorId:command.actorId});
  if(combatant.life.dead||combatant.life.hp.current<=0) return refused("actor-down","쓰러진 상태에서는 이동할 수 없습니다.",{actorId:actor.id});
  if(state.mode==="initiative"&&state.currentActorId!==actor.id&&ctx.origin.role!=="dm") return refused("off-turn","현재 Actor의 턴이 아닙니다.",{actorId:actor.id});
  if(command.movement==="approach"&&(!command.targetId||!state.actors[command.targetId])) return refused("target-missing","접근할 대상을 선택하세요.",{actorId:actor.id});
  const declarations={...state.declarations,[actor.id]:{kind:command.movement,...(command.movement==="approach"?{targetId:command.targetId}:{}),round:state.round}};
  const label=MOVEMENT_LABEL[command.movement];
  if(command.movement!=="withdraw") {
    const summary=command.movement==="approach"?`${actor.name} → ${actorName(state,command.targetId!)}에게 접근`:`${actor.name} · 그대로`;
    return {status:"committed",events:[{payload:{type:"table-changed",declarations},log:[logEntry(ctx,{actor:actor.name,title:`이동 · ${label}`,summary,detail:[],stateChanges:[`이동 선언: ${label}`]})]}]};
  }
  // 물러남: the pair leaves reach — engagements end; each engaged enemy that can react gets one opportunity-attack card.
  const asked=opportunityAttackQuestions(state,actor.id,ctx.nextSeq);
  const engagements=clearEngagementsOf(state.engagements,actor.id);
  const questions=asked.length?[...state.questions,...asked]:undefined;
  const detail=asked.length?asked.map((question)=>`${actorName(state,question.actorId)} · 기회공격 여부 질문`):[state.engagements.length!==engagements.length?"교전 상대가 반응할 수 없거나 이탈 중이라 기회공격이 없습니다.":"교전 중인 상대가 없습니다."];
  return {status:"committed",events:[{
    payload:{type:"table-changed",declarations,...(engagements.length!==state.engagements.length?{engagements}:{}),...(questions?{questions}:{})},
    log:[logEntry(ctx,{actor:actor.name,title:"이동 · 물러남",summary:asked.length?`${asked.map((question)=>actorName(state,question.actorId)).join(", ")}의 기회공격 여부를 묻습니다`:`${actor.name} · 물러남`,detail,stateChanges:[...(engagements.length!==state.engagements.length?["교전 종료 (물러남)"]:[]),"이동 선언: 물러남"]})],
  }]};
}

function questionById(state:TableState,questionId:string):TableQuestion|undefined { return state.questions.find((question)=>question.id===questionId); }

/** Fire an action as a reaction (opportunity attack, readied action) and drop the question from the queue. */
function reactWith(ctx:HandlerContext,question:TableQuestion,actorId:string,actionId:string,targetIds:string[],options:{noEngagement?:boolean}):HandlerResult {
  const state=ctx.state;
  const actor=state.actors[actorId];
  if(!actor) return refused("actor-unknown","테이블에 없는 액터입니다.",{actorId});
  const action=actionsFor(actor,state).find((entry)=>entry.id===actionId);
  if(!action) return refused("action-unknown","알 수 없는 행동입니다.",{actorId,actionId});
  const reactionCtx:HandlerContext={...ctx,asReaction:true};
  const availability=availabilityOf(state,action,{asReaction:true});
  if(!availability.available) return refused("action-unavailable",availability.reason??"지금은 사용할 수 없는 행동입니다.",{actorId,actionId});
  const targetRefusal=targetRefusalFor(state,action,targetIds);
  if(targetRefusal) return refused(targetRefusal.code,targetRefusal.message,{actorId,actionId});
  const result=action.resolutionKind==="attack"
    ?attackAct(reactionCtx,actor,action,targetIds,`res.${ctx.nextSeq}`,undefined,options)
    :act(reactionCtx,{type:"act",actorId,actionId,targetIds});
  if(result.status==="refused") return result;
  const remaining=withoutQuestion(state.questions,question.id);
  const first=result.events[0];
  if(first&&(first.payload.type==="rules-committed"||first.payload.type==="table-changed")) first.payload={...first.payload,questions:[...(first.payload.questions??remaining).filter((entry)=>entry.id!==question.id)]};
  else result.events.unshift({payload:{type:"table-changed",questions:remaining},log:[]});
  return result;
}

export function answerQuestion(ctx:HandlerContext,command:Extract<TableCommand,{type:"answer-question"}>):HandlerResult {
  const state=ctx.state;
  const question=questionById(state,command.questionId);
  if(!question) return refused("question-unknown","이미 처리된 질문입니다.");
  if(!question.options.some((option)=>option.id===command.optionId)) return refused("option-unknown","질문에 없는 선택지입니다.");
  const remaining=withoutQuestion(state.questions,question.id);
  const actor=state.actors[question.actorId];
  const name=actor?.name??question.actorId;
  const log=(title:string,summary:string,stateChanges:string[]=[])=>logEntry(ctx,{actor:name,title,summary,detail:[],stateChanges});
  switch(question.kind) {
    case "opportunity-attack": {
      const moverId=String(question.context.moverId);
      if(command.optionId==="decline") return {status:"committed",events:[{payload:{type:"table-changed",questions:remaining},log:[log("기회공격 넘김",`${name}이(가) ${actorName(state,moverId)}의 물러남에 반응하지 않습니다`)]}]};
      return reactWith(ctx,question,question.actorId,command.optionId,[moverId],{noEngagement:true});
    }
    case "knock-out": {
      const targetId=String(question.context.targetId);
      if(command.optionId==="kill") return {status:"committed",events:[{payload:{type:"table-changed",questions:remaining},log:[log("죽임",`${actorName(state,targetId)} 사망 확정`)]}]};
      const rules=cloneState(state.rules);
      const target=rules.combatants[targetId];
      if(!target) return refused("target-unknown","테이블에 없는 대상입니다.");
      target.life={...target.life,hp:{...target.life.hp,current:0},dead:false,unconscious:true,stable:true,deathSaves:{successes:0,failures:0}};
      rules.revision+=1;
      return {status:"committed",events:[{payload:{type:"rules-committed",rules,questions:remaining},log:[log("기절",`${actorName(state,targetId)} 의식불명 · 안정 (HP 0)`,[`${actorName(state,targetId)} 사망 → 의식불명 · 안정`])]}]};
    }
    case "ready-trigger": {
      const readied=state.readied[question.actorId];
      if(command.optionId==="hold"||!readied) return {status:"committed",events:[{payload:{type:"table-changed",questions:remaining},log:[log("준비 행동 보류",`${name}이(가) 발동하지 않습니다`)]}]};
      const result=reactWith(ctx,question,question.actorId,readied.actionId,readied.targetIds,{});
      if(result.status==="refused") return result;
      const readiedNext={...state.readied}; delete readiedNext[question.actorId];
      const first=result.events[0];
      if(first&&(first.payload.type==="rules-committed"||first.payload.type==="table-changed")) first.payload={...first.payload,readied:readiedNext};
      return result;
    }
    case "player-request":
      return resolvePlayerRequest(ctx,question,command.optionId);
    case "ruling-request":
      return refused("use-rule","즉흥 행동은 판정 카드(rule)로 답합니다. 넘기려면 skip-question을 쓰세요.");
    case "dm":
      return {status:"committed",events:[{payload:{type:"table-changed",questions:remaining},log:[log("질문 답변",`${question.prompt} → ${question.options.find((option)=>option.id===command.optionId)?.label??command.optionId}`)]}]};
  }
}

export function skipQuestion(ctx:HandlerContext,command:Extract<TableCommand,{type:"skip-question"}>):HandlerResult {
  const state=ctx.state;
  const question=questionById(state,command.questionId);
  if(!question) return refused("question-unknown","이미 처리된 질문입니다.");
  return {status:"committed",events:[{payload:{type:"table-changed",questions:withoutQuestion(state.questions,question.id)},log:[logEntry(ctx,{actor:"DM",title:"질문 넘김",summary:question.prompt,detail:["DM이 이 질문을 넘겼습니다. 반응은 소비되지 않습니다."],stateChanges:[]})]}]};
}

/** Ready (2024): choose a trigger and an action; the action is spent now and fires later as a reaction. */
export function ready(ctx:HandlerContext,command:Extract<TableCommand,{type:"ready"}>):HandlerResult {
  const state=ctx.state;
  const actor=state.actors[command.actorId];
  const combatant=state.rules.combatants[command.actorId];
  if(!actor||!combatant) return refused("actor-unknown","테이블에 없는 액터입니다.",{actorId:command.actorId});
  if(!command.trigger.trim()) return refused("trigger-missing","발동 조건을 적으세요.",{actorId:actor.id});
  const action=actionsFor(actor,state).find((entry)=>entry.id===command.actionId);
  if(!action) return refused("action-unknown","알 수 없는 행동입니다.",{actorId:actor.id,actionId:command.actionId});
  if(action.economy!=="행동") return refused("ready-not-action","준비할 수 있는 것은 행동(Action)뿐입니다.",{actorId:actor.id,actionId:action.id});
  const availability=availabilityOf(state,{...action,economy:"행동"});
  if(!availability.available) return refused("action-unavailable",availability.reason??"지금은 사용할 수 없는 행동입니다.",{actorId:actor.id,actionId:action.id});
  const operations:ResolutionOperation[]=state.mode==="initiative"?[{id:`ready.${ctx.nextSeq}.action`,kind:"use-economy",actorId:actor.id,slot:"action",actionKind:"other"}]:[];
  let rules=state.rules;
  if(operations.length) {
    const committed=commitOperations(ctx,{id:`ready.${ctx.nextSeq}`,actorId:actor.id,sourceId:"table:ready",operations,refusalCode:"ready-rejected"});
    if(committed.status==="refused") return committed;
    rules=committed.commit.state;
  }
  const readied={...state.readied,[actor.id]:{actionId:action.id,trigger:command.trigger.trim(),targetIds:command.targetIds??[],round:state.round}};
  const events:EventDraft[]=[{payload:{type:"table-changed",readied,...(rules!==state.rules?{rules}:{})},log:[logEntry(ctx,{actor:actor.name,title:"준비 행동",summary:`"${command.trigger.trim()}" → ${action.name}`,detail:["조건이 발생하면 반응으로 발동합니다. 다음 턴 시작에 사라집니다."],stateChanges:[...(rules!==state.rules?[`${actor.name} 행동 사용`]:[]),`준비 행동: ${action.name}`]})]}];
  return {status:"committed",events};
}

export function triggerReady(ctx:HandlerContext,command:Extract<TableCommand,{type:"trigger-ready"}>):HandlerResult {
  const state=ctx.state;
  const readied=state.readied[command.actorId];
  if(!readied) return refused("not-readied","준비한 행동이 없습니다.",{actorId:command.actorId});
  if(state.questions.some((question)=>question.kind==="ready-trigger"&&question.actorId===command.actorId)) return refused("question-pending","이미 발동 여부를 묻는 중입니다.",{actorId:command.actorId});
  const question=readyTriggerQuestion(state,command.actorId,ctx.nextSeq);
  return {status:"committed",events:[{payload:{type:"table-changed",questions:[...state.questions,question]},log:[logEntry(ctx,{actor:"DM",title:"준비 조건 발생",summary:question.prompt,detail:[],stateChanges:[]})]}]};
}
