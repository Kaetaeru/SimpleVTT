import { clearEngagement, clearEngagementsOf } from "../../domain/engagement";
import type { AbilityKey } from "../../domain/conditions";
import type { D20TestResult } from "../../domain/d20";
import type { ResolutionEvent, ResolutionOperation } from "../../domain/resolutionTypes";
import type { RulesRuntimeState } from "../../domain/combatState";
import type { ActionVm } from "../../app/contracts";
import { abilityLabelKo, conditionLabelKo } from "../../app/srdMonsterCatalog";
import { actorAbilityModifier, actorSaveModifier, characterSkillBonus, damageFromDiceText } from "../actors";
import type { TableCommand } from "../commands";
import { engagementsAmongLiving, engagementsEqual } from "../engagement";
import type { SheetPatch } from "../events";
import { playerRequestQuestion, rulingRequestQuestion, withoutQuestion } from "../questions";
import { refused } from "../refusal";
import { lifeStateChanges, plainCard } from "../resolutionCard";
import { cloneState, type Actor, type FloorItem, type RulingOutcome, type TableQuestion, type TableState } from "../state";
import { NEXT_ROLL_TAG, STATUS_TAG, concentrationCheckFor } from "./act";
import { actorName, commitOperations, logEntry, type EventDraft, type HandlerContext, type HandlerResult } from "./types";

/**
 * Grade R and N of the capability inventory (§0, §12, §13): a declaration in the player's words is recorded at once;
 * anything the rules do not cover goes to the DM as one card; the DM's ruling rolls, costs and commits like any other
 * action — with the same undo, replay and replica parity. Nothing here invents a roll before the DM decides (D8).
 */
export const RULING_SOURCE="table:improvise";

export function improvise(ctx:HandlerContext,command:Extract<TableCommand,{type:"improvise"}>):HandlerResult {
  const state=ctx.state;
  const actor=state.actors[command.actorId];
  if(!actor||!state.rules.combatants[command.actorId]) return refused("actor-unknown","테이블에 없는 액터입니다.",{actorId:command.actorId});
  const text=command.text.trim();
  if(!text) return refused("text-missing","무엇을 하는지 한 줄로 적으세요.",{actorId:actor.id});
  const targetIds=[...new Set(command.targetIds??[])].filter((id)=>state.actors[id]);
  const question=rulingRequestQuestion(state,actor.id,text,targetIds,ctx.nextSeq,command.itemId);
  return {status:"committed",events:[{
    payload:{type:"table-changed",questions:[...state.questions,question]},
    log:[logEntry(ctx,{actor:actor.name,title:"즉흥 행동 선언",summary:text,detail:[targetIds.length?`대상: ${targetIds.map((id)=>actorName(state,id)).join(", ")}`:"대상 없음",`DM 판정 대기 · 제안: ${question.context.suggestionName}`],stateChanges:["질문: DM 판정"]})],
  }]};
}

export function narrate(ctx:HandlerContext,command:Extract<TableCommand,{type:"narrate"}>):HandlerResult {
  const state=ctx.state;
  const text=command.text.trim();
  if(!text) return refused("text-missing","내용을 적으세요.");
  const speaker=command.actorId?actorName(state,command.actorId):ctx.origin.role==="dm"?"DM":ctx.origin.peerId;
  return {status:"committed",events:[{payload:{type:"table-changed"},log:[logEntry(ctx,{actor:speaker,title:"서술",summary:text,detail:[],stateChanges:[]})]}]};
}

function checkModifier(actor:Actor,ability:AbilityKey,skill?:string):number {
  if(actor.source.kind==="character"&&skill) return characterSkillBonus(actor.source.sheet,skill,ability);
  return actorAbilityModifier(actor,ability);
}

const signed=(value:number)=>value>=0?`+${value}`:`${value}`;

/** Outcome operations, gated on a predicate when the ruling rolls. */
function outcomeOperations(ctx:HandlerContext,resolutionId:string,label:string,actor:Actor,targetIds:string[],outcome:RulingOutcome|undefined,when?:ResolutionOperation["when"]):ResolutionOperation[] {
  if(!outcome) return [];
  const state=ctx.state;
  const operations:ResolutionOperation[]=[];
  if(outcome.damage) {
    const parsed=damageFromDiceText(outcome.damage.dice??"0d4",outcome.damage.flat??0);
    const rollId=`${resolutionId}:${label}:damage-roll`;
    const targets=(outcome.damage.targetIds??targetIds).filter((id)=>state.rules.combatants[id]);
    if(targets.length) {
      operations.push({id:rollId,kind:"damage-roll",...(when?{when}:{}),request:{dice:parsed.count?[{source:RULING_SOURCE,sides:parsed.sides,count:parsed.count,faces:ctx.dice.faces(parsed.sides,parsed.count*2,`판정 피해`)}]:[],flat:parsed.flat?[{source:`${RULING_SOURCE}:flat`,value:parsed.flat}]:[]}});
      for(const targetId of targets) {
        const concentrationCheck=concentrationCheckFor(ctx,targetId);
        operations.push({id:`${resolutionId}:${label}:damage:${targetId}`,kind:"damage",...(when?{when}:{}),targetId,damageType:outcome.damage.type,amount:{operationId:rollId,field:"total"},creatureKind:state.actors[targetId]?.kind==="character"?"character":"monster",...(concentrationCheck?{concentrationCheck}:{})});
      }
    }
  }
  for(const [index,condition] of (outcome.conditions??[]).entries()) {
    for(const targetId of (condition.targetIds??targetIds).filter((id)=>state.rules.combatants[id])) {
      operations.push({id:`${resolutionId}:${label}:condition:${index}:${targetId}`,kind:"apply-effect",...(when?{when}:{}),effect:{id:`${resolutionId}:${label}:${condition.conditionId}:${targetId}`,sourceId:RULING_SOURCE,sourceActorId:actor.id,targetId,kind:"condition",conditionId:condition.conditionId,tags:[STATUS_TAG,"table:ruling"],duration:condition.duration??{kind:"permanent"},metadata:{publicLabel:conditionLabelKo(condition.conditionId)}}});
    }
  }
  if(outcome.nextRoll) {
    for(const targetId of outcome.nextRoll.targetIds.filter((id)=>state.rules.combatants[id])) {
      const grantId=`${resolutionId}:${label}:next-roll:${targetId}`;
      operations.push({id:grantId,kind:"apply-effect",...(when?{when}:{}),effect:{id:`${grantId}:effect`,sourceId:RULING_SOURCE,targetId,kind:"modifier",tags:[NEXT_ROLL_TAG,"table:ruling"],duration:{kind:"permanent"},metadata:{publicLabel:`다음 ${{"attack-roll":"공격 굴림","ability-check":"능력 판정","saving-throw":"내성 굴림"}[outcome.nextRoll.family]} ${outcome.nextRoll.state==="advantage"?"유리":"불리"}`,d20Family:outcome.nextRoll.family,d20RollState:outcome.nextRoll.state,grantId}}});
    }
  }
  return operations;
}

/** The parts of an outcome the kernel does not own: engagement and the floor. */
function outcomeTableEffects(state:TableState,actor:Actor,targetIds:string[],outcome:RulingOutcome|undefined,seq:number):{engagements?:ReturnType<typeof clearEngagementsOf>;sheets:SheetPatch[];floor?:FloorItem[];lines:string[]} {
  const lines:string[]=[];
  const sheets:SheetPatch[]=[];
  let engagements:ReturnType<typeof clearEngagementsOf>|undefined;
  let floor:FloorItem[]|undefined;
  if(!outcome) return {sheets,lines};
  if(outcome.clearEngagement) {
    engagements=targetIds.length?targetIds.reduce((records,targetId)=>clearEngagement(records,actor.id,targetId),state.engagements):clearEngagementsOf(state.engagements,actor.id);
    lines.push(`교전 종료: ${actor.name}${targetIds.length?` ↔ ${targetIds.map((id)=>actorName(state,id)).join(", ")}`:""}`);
  }
  for(const targetId of outcome.disarm??[]) {
    const target=state.actors[targetId];
    if(!target||target.source.kind!=="character") { lines.push(`${actorName(state,targetId)}의 무기: DM이 직접 처리`); continue; }
    const sheet=cloneState(target.source.sheet);
    const weapon=sheet.items.find((item)=>item.wielded&&(item.wieldSlot==="main-hand"||item.wieldSlot==="two-hand"))??sheet.items.find((item)=>item.wielded);
    if(!weapon) { lines.push(`${target.name}은(는) 든 무기가 없다`); continue; }
    const dropped={...cloneState(weapon),quantity:1,equipped:false,wielded:false}; delete dropped.wieldSlot;
    sheet.items=weapon.quantity>1?sheet.items.map((item)=>item.id===weapon.id?{...item,quantity:item.quantity-1}:item):sheet.items.filter((item)=>item.id!==weapon.id);
    sheets.push({actorId:targetId,sheet});
    floor=[...(floor??state.floor),{id:`floor.${seq}.${weapon.id}`,item:dropped,droppedBy:targetId,recoverable:true}];
    lines.push(`${target.name}의 ${weapon.name} → 바닥`);
  }
  return {engagements,sheets,floor,lines};
}

export function rule(ctx:HandlerContext,command:Extract<TableCommand,{type:"rule"}>):HandlerResult {
  const state=ctx.state;
  const actor=state.actors[command.actorId];
  const combatant=state.rules.combatants[command.actorId];
  if(!actor||!combatant) return refused("actor-unknown","테이블에 없는 액터입니다.",{actorId:command.actorId});
  const question=command.questionId?state.questions.find((entry)=>entry.id===command.questionId):undefined;
  if(command.questionId&&!question) return refused("question-unknown","이미 처리된 질문입니다.");
  const spec=command.spec;
  const text=command.text??(question?String(question.context.text):"DM 판정");
  const targetIds=[...new Set(command.targetIds??(question?String(question.context.targetIds??"").split(",").filter(Boolean):[]))].filter((id)=>state.actors[id]);
  const resolutionId=`res.${ctx.nextSeq}`;
  const operations:ResolutionOperation[]=[];
  const detail:string[]=[];
  // Cost. A waived cost is an explicit exception (D4): recorded on the card, never silent.
  const slot=spec.cost==="action"?"action":spec.cost==="bonus-action"?"bonus-action":spec.cost==="reaction"?"reaction":undefined;
  if(slot&&state.mode==="initiative") {
    const available=slot==="action"?combatant.economy.action:slot==="bonus-action"?combatant.economy.bonusAction:combatant.economy.reaction;
    const offTurn=slot!=="reaction"&&state.currentActorId!==actor.id;
    if((!available||offTurn)&&!spec.exception) return refused("cost-unavailable",offTurn?"현재 Actor의 턴이 아닙니다. 예외를 허용하려면 사유를 적으세요.":`${{action:"행동",'bonus-action':"추가 행동",reaction:"반응"}[slot]}을 이미 사용했습니다. 예외를 허용하려면 사유를 적으세요.`,{actorId:actor.id});
    if(available&&!offTurn) operations.push({id:`${resolutionId}:cost`,kind:"use-economy",actorId:actor.id,slot,actionKind:"other"});
    else detail.push(`DM 예외: ${spec.exception} (비용 면제)`);
  } else if(spec.exception) detail.push(`DM 예외: ${spec.exception}`);
  // Roll.
  let checkId:string|undefined;
  let contest:{actorId:string;opponentId:string;actorCheckId:string;opponentCheckId:string}|undefined;
  const saveIds:Record<string,string>={};
  if(!spec.verdict&&spec.check) {
    if(spec.check.kind==="check") {
      checkId=`${resolutionId}:check`;
      const modifier=checkModifier(actor,spec.check.ability,spec.check.skill);
      operations.push({id:checkId,kind:"d20",actorId:actor.id,request:{family:"ability-check",target:spec.check.dc,modifierContributions:[{source:`${RULING_SOURCE}:${spec.check.skill??spec.check.ability}`,value:modifier}],dice:{id:`${checkId}:d20`,purpose:`${actor.name} ${spec.check.skill??abilityLabelKo(spec.check.ability)} 판정`,sides:20,faces:ctx.dice.faces(20,2,"판정")}}});
    } else if(spec.check.kind==="save") {
      for(const targetId of targetIds) {
        const target=state.actors[targetId];
        const saveId=`${resolutionId}:save:${targetId}`;
        saveIds[targetId]=saveId;
        operations.push({id:saveId,kind:"d20",actorId:targetId,request:{family:"saving-throw",target:spec.check.dc,modifierContributions:[{source:`save:${spec.check.ability}`,value:actorSaveModifier(target,spec.check.ability)}],dice:{id:`${saveId}:d20`,purpose:`${target.name} ${abilityLabelKo(spec.check.ability)} 내성`,sides:20,faces:ctx.dice.faces(20,2,"내성")}},condition:{ability:spec.check.ability}});
      }
      if(!targetIds.length) return refused("target-missing","내성을 굴릴 대상을 선택하세요.",{actorId:actor.id});
    } else {
      const opponent=state.actors[spec.check.opponentId];
      if(!opponent) return refused("target-missing","대립 판정의 상대를 선택하세요.",{actorId:actor.id});
      contest={actorId:actor.id,opponentId:opponent.id,actorCheckId:`${resolutionId}:contest:actor`,opponentCheckId:`${resolutionId}:contest:opponent`};
      operations.push({id:contest.actorCheckId,kind:"d20",actorId:actor.id,request:{family:"ability-check",target:0,modifierContributions:[{source:`${RULING_SOURCE}:${spec.check.skill??spec.check.ability}`,value:checkModifier(actor,spec.check.ability,spec.check.skill)}],dice:{id:`${contest.actorCheckId}:d20`,purpose:`${actor.name} 대립 판정`,sides:20,faces:ctx.dice.faces(20,2,"대립")}}});
      operations.push({id:contest.opponentCheckId,kind:"d20",actorId:opponent.id,request:{family:"ability-check",target:0,modifierContributions:[{source:`${RULING_SOURCE}:${spec.check.opponentSkill??spec.check.opponentAbility}`,value:checkModifier(opponent,spec.check.opponentAbility,spec.check.opponentSkill)}],dice:{id:`${contest.opponentCheckId}:d20`,purpose:`${opponent.name} 대립 판정`,sides:20,faces:ctx.dice.faces(20,2,"대립")}}});
    }
  }
  // Outcomes gated on the roll (check / save); verdicts and contests decide before the second commit.
  const verdict=spec.verdict??(spec.check?undefined:"narration");
  if(checkId) {
    operations.push(...outcomeOperations(ctx,resolutionId,"success",actor,targetIds,spec.success,{operationId:checkId,field:"outcome",equals:"success"}));
    operations.push(...outcomeOperations(ctx,resolutionId,"failure",actor,targetIds,spec.failure,{operationId:checkId,field:"outcome",equals:"failure"}));
  } else if(Object.keys(saveIds).length) {
    for(const targetId of targetIds) {
      operations.push(...outcomeOperations(ctx,resolutionId,`success-${targetId}`,actor,[targetId],spec.success?{...spec.success,damage:spec.success.damage?{...spec.success.damage,targetIds:[targetId]}:undefined,conditions:spec.success.conditions?.map((entry)=>({...entry,targetIds:[targetId]}))}:undefined,{operationId:saveIds[targetId],field:"outcome",equals:"success"}));
      operations.push(...outcomeOperations(ctx,resolutionId,`failure-${targetId}`,actor,[targetId],spec.failure?{...spec.failure,damage:spec.failure.damage?{...spec.failure.damage,targetIds:[targetId]}:undefined,conditions:spec.failure.conditions?.map((entry)=>({...entry,targetIds:[targetId]}))}:undefined,{operationId:saveIds[targetId],field:"outcome",equals:"failure"}));
    }
  } else if(verdict==="success") operations.push(...outcomeOperations(ctx,resolutionId,"success",actor,targetIds,spec.success));
  else if(verdict==="failure") operations.push(...outcomeOperations(ctx,resolutionId,"failure",actor,targetIds,spec.failure));
  let rules:RulesRuntimeState=state.rules;
  let events:ResolutionEvent[]=[];
  if(operations.length) {
    const committed=commitOperations(ctx,{id:resolutionId,actorId:actor.id,sourceId:RULING_SOURCE,operations,refusalCode:"ruling-rejected"});
    if(committed.status==="refused") return committed;
    rules=committed.commit.state;
    events=committed.commit.events;
  }
  // Decide.
  let succeeded:boolean|undefined;
  let rollLine:string|undefined;
  const results:Record<string,unknown>=operations.length?Object.fromEntries(events.map((event)=>[event.operationId,event.result])):{};
  if(checkId) {
    const test=results[checkId] as D20TestResult|undefined;
    if(test) { succeeded=test.outcome==="success"; rollLine=`${actor.name} d20 ${test.natural} ${signed(test.total-test.natural)} = ${test.total} vs DC ${(spec.check as {dc:number}).dc} ${succeeded?"성공":"실패"}`; }
  } else if(contest) {
    const mine=results[contest.actorCheckId] as D20TestResult|undefined;
    const theirs=results[contest.opponentCheckId] as D20TestResult|undefined;
    if(mine&&theirs) {
      succeeded=mine.total>theirs.total; // 2024: a tie leaves things as they were
      rollLine=`${actor.name} ${mine.total} vs ${actorName(state,contest.opponentId)} ${theirs.total} → ${succeeded?"성공":"실패"}`;
      const second=commitOperations({...ctx,state:{...state,rules}},{id:`${resolutionId}:outcome`,actorId:actor.id,sourceId:RULING_SOURCE,rules,operations:outcomeOperations(ctx,`${resolutionId}:outcome`,succeeded?"success":"failure",actor,targetIds,succeeded?spec.success:spec.failure),refusalCode:"ruling-rejected"});
      if(second.status==="committed") { rules=second.commit.state; events=[...events,...second.commit.events]; }
      else if(outcomeOperations(ctx,`${resolutionId}:outcome`,succeeded?"success":"failure",actor,targetIds,succeeded?spec.success:spec.failure).length) return second;
    }
  } else if(Object.keys(saveIds).length) {
    const lines=targetIds.map((targetId)=>{ const test=results[saveIds[targetId]] as D20TestResult|undefined; return test?`${actorName(state,targetId)} ${test.total} vs DC ${(spec.check as {dc:number}).dc} ${test.outcome==="success"?"성공":"실패"}`:""; }).filter(Boolean);
    rollLine=lines.join(", ");
    succeeded=targetIds.some((targetId)=>(results[saveIds[targetId]] as D20TestResult|undefined)?.outcome!=="success");
  } else succeeded=verdict==="success"?true:verdict==="failure"?false:undefined;
  const outcome=succeeded===undefined?undefined:succeeded?spec.success:spec.failure;
  const tableEffects=outcomeTableEffects(state,actor,targetIds,outcome,ctx.nextSeq);
  const outcomeText=outcome?.text??(verdict==="narration"?"서술":succeeded===undefined?"":succeeded?"성공":"실패");
  const compact=`${text} → ${outcomeText}`;
  const action:ActionVm={id:"action.improvised",actorId:actor.id,name:"즉흥 행동",category:"basic",target:targetIds.length?"any":"none",economy:spec.cost==="action"?"행동":spec.cost==="bonus-action"?"추가 행동":spec.cost==="reaction"?"반응":"없음",resolutionKind:checkId||contest?"ability-check":Object.keys(saveIds).length?"saving-throw":"no-roll",summary:text,available:true,eligibleTargetIds:targetIds,details:[]};
  const card=plainCard({id:resolutionId,seq:ctx.nextSeq,visibility:state.rollVisibility,action,actorId:actor.id,targetIds,rollKind:checkId||contest?"check":Object.keys(saveIds).length?"save":"effect",compact,detail:[...(rollLine?[rollLine]:[]),...detail,...(command.note?[command.note]:[]),`DM 판정 · ${spec.verdict?"굴림 없음":spec.check?.kind==="check"?`${spec.check.skill??abilityLabelKo(spec.check.ability)} DC ${spec.check.dc}`:spec.check?.kind==="save"?`${abilityLabelKo(spec.check.ability)} 내성 DC ${spec.check.dc}`:"대립 판정"}`],events,stateChanges:[...lifeStateChanges(state,state.rules,rules),...tableEffects.lines]});
  card.provenance.push("ruling:dm");
  const engagements=engagementsAmongLiving(state,tableEffects.engagements??state.engagements,rules);
  const questions=question?withoutQuestion(state.questions,question.id):undefined;
  const drafts:EventDraft[]=[{
    payload:{type:"rules-committed",rules,resolution:card,...(!engagementsEqual(engagements,state.engagements)?{engagements}:{}),...(tableEffects.sheets.length?{sheets:tableEffects.sheets}:{}),...(tableEffects.floor?{floor:tableEffects.floor}:{}),...(questions?{questions}:{})},
    log:[logEntry(ctx,{actor:actor.name,title:`즉흥 행동 · ${outcomeText}`,summary:compact,detail:card.detail,stateChanges:card.stateChanges,ruling:"DM 판정"})],
  }];
  return {status:"committed",resolution:card,events:drafts};
}

export function request(ctx:HandlerContext,command:Extract<TableCommand,{type:"request"}>):HandlerResult {
  const state=ctx.state;
  const actor=state.actors[command.actorId];
  if(!actor) return refused("actor-unknown","테이블에 없는 액터입니다.",{actorId:command.actorId});
  const text=command.text.trim();
  if(!text) return refused("text-missing","요청 내용을 적으세요.",{actorId:actor.id});
  if(command.kind==="item-fix") {
    if(actor.source.kind!=="character") return refused("actor-no-inventory","이 액터에게는 가방이 없습니다.",{actorId:actor.id});
    const item=command.payload?.itemId?actor.source.sheet.items.find((entry)=>entry.id===command.payload!.itemId):undefined;
    const resource=command.payload?.resourceId?state.rules.combatants[actor.id]?.resources.find((entry)=>entry.id===command.payload!.resourceId):undefined;
    if(!item&&!resource) return refused("item-unknown","정정할 아이템 또는 자원을 지정하세요.",{actorId:actor.id});
  }
  const payload:Record<string,string|number|boolean>={};
  for(const [key,value] of Object.entries(command.payload??{})) if(value!==undefined) payload[key]=value;
  const question=playerRequestQuestion(state,actor.id,command.kind,text,payload,ctx.nextSeq);
  return {status:"committed",events:[{payload:{type:"table-changed",questions:[...state.questions,question]},log:[logEntry(ctx,{actor:actor.name,title:question.prompt.split(" · ")[1]?.split(":")[0]??"요청",summary:text,detail:["DM 승인 대기"],stateChanges:[]})]}]};
}

/** DM approval of a player request (D10): an item/resource fix becomes a ruling event; undo runs as the DM's undo. */
export function resolvePlayerRequest(ctx:HandlerContext,question:TableQuestion,optionId:string):HandlerResult {
  const state=ctx.state;
  const remaining=withoutQuestion(state.questions,question.id);
  const kind=String(question.context.requestKind);
  const name=actorName(state,question.actorId);
  if(optionId==="deny") return {status:"committed",events:[{payload:{type:"table-changed",questions:remaining},log:[logEntry(ctx,{actor:"DM",title:"요청 거절",summary:`${name}: ${question.context.text}`,detail:[],stateChanges:[]})]}]};
  if(kind==="item-fix") {
    const actor=state.actors[question.actorId];
    const sheets:SheetPatch[]=[];
    let rules:RulesRuntimeState|undefined;
    const lines:string[]=[];
    if(actor?.source.kind==="character"&&question.context.itemId!==undefined) {
      const sheet=cloneState(actor.source.sheet);
      const item=sheet.items.find((entry)=>entry.id===String(question.context.itemId));
      const quantity=Number(question.context.quantity);
      if(item&&Number.isInteger(quantity)&&quantity>=0) {
        lines.push(`${item.name} 수량 ${item.quantity} → ${quantity}`);
        if(quantity===0) sheet.items=sheet.items.filter((entry)=>entry.id!==item.id); else item.quantity=quantity;
        sheets.push({actorId:actor.id,sheet});
      }
    }
    if(question.context.resourceId!==undefined) {
      rules=cloneState(state.rules);
      const resource=rules.combatants[question.actorId]?.resources.find((entry)=>entry.id===String(question.context.resourceId));
      const current=Number(question.context.current);
      if(resource&&Number.isInteger(current)&&current>=0&&current<=resource.maximum) { lines.push(`${resource.label} ${resource.current} → ${current}`); resource.current=current; rules.revision+=1; }
      else rules=undefined;
    }
    if(!lines.length) return refused("request-invalid","정정할 내용이 유효하지 않습니다.",{actorId:question.actorId});
    return {status:"committed",events:[{payload:{type:"table-changed",questions:remaining,...(sheets.length?{sheets}:{}),...(rules?{rules}:{})},log:[logEntry(ctx,{actor:"DM",title:"DM 재량 · 아이템·자원 정정",summary:`${name}: ${lines.join(", ")}`,detail:[String(question.context.text)],stateChanges:lines,ruling:"정정 승인"})]}]};
  }
  const result:HandlerResult={status:"committed",events:[{payload:{type:"table-changed",questions:remaining},log:[logEntry(ctx,{actor:"DM",title:"요청 승인",summary:`${name}: ${question.context.text}`,detail:kind==="undo"?["마지막 행동을 되돌립니다."]:[],stateChanges:[]})]}]};
  if(kind==="undo") result.followUp={type:"undo"};
  return result;
}

export function rememberRuling(ctx:HandlerContext,command:Extract<TableCommand,{type:"remember-ruling"}>):HandlerResult {
  const state=ctx.state;
  const name=command.name.trim(),keyword=command.keyword.trim();
  if(!name||!keyword) return refused("rule-invalid","규칙 이름과 키워드를 적으세요.");
  const id=`house.${ctx.nextSeq}`;
  const houseRules={...state.houseRules,[id]:{id,name,keyword,spec:cloneState(command.spec)}};
  return {status:"committed",events:[{payload:{type:"table-changed",houseRules},log:[logEntry(ctx,{actor:"DM",title:"즉석 규칙 저장",summary:`${name} (키워드: ${keyword})`,detail:[],stateChanges:[]})]}]};
}

export function forgetRuling(ctx:HandlerContext,command:Extract<TableCommand,{type:"forget-ruling"}>):HandlerResult {
  const state=ctx.state;
  const rule=state.houseRules[command.ruleId];
  if(!rule) return refused("rule-unknown","없는 규칙입니다.");
  const houseRules={...state.houseRules}; delete houseRules[command.ruleId];
  return {status:"committed",events:[{payload:{type:"table-changed",houseRules},log:[logEntry(ctx,{actor:"DM",title:"즉석 규칙 삭제",summary:rule.name,detail:[],stateChanges:[]})]}]};
}
