import type { AbilityKey } from "../../domain/conditions";
import type { D20TestResult } from "../../domain/d20";
import { compileSpellCast, resolveCompiledSpellCast } from "../../domain/spellcasting";
import { normalizedSpellDefinitionById } from "../../domain/spellExecutionCatalog";
import type { ActionVm } from "../../app/contracts";
import { consumeCharacterSpellMaterials, prepareCharacterSpellComponents, spellPaymentRuntimeContext, stripSpellPaymentRuntimeResources } from "../../app/spellComponentInventoryRuntime";
import { actorSaveModifier } from "../actors";
import { engagementsAmongLiving, engagementsEqual } from "../engagement";
import { displayedAc } from "../project";
import { refused } from "../refusal";
import { lifeStateChanges, plainCard } from "../resolutionCard";
import { casterContext, spellDice, spellTargets, type SpellSheet } from "../spells";
import { freeHands } from "../hands";
import { cloneState, type Actor, type TableState } from "../state";
import { hiddenEndsFor, knockOutQuestionsFor } from "./act";
import { actorName, logEntry, type HandlerContext, type HandlerResult } from "./types";

/**
 * A spell cast (capability inventory §8) through the domain kernel: slots, upcasting, components (hands, focus,
 * materials), concentration, one slotted spell per turn, and the spell's own attack/save/healing/effect mechanics.
 * The table supplies the caster context from the sheet, the targets, and every die; the kernel decides.
 */
export function turnIdOf(state:TableState):string|undefined {
  return state.mode==="initiative"&&state.currentActorId?`round-${state.round}:${state.currentActorId}`:undefined;
}

export function castAct(ctx:HandlerContext,actor:Actor,action:ActionVm,targetIds:string[],resolutionId:string,slotLevel?:number):HandlerResult {
  const state=ctx.state;
  if(actor.source.kind!=="character") return refused("action-rejected","몬스터 주문은 스탯 블록의 행동으로 처리합니다.",{actorId:actor.id,actionId:action.id});
  const sheet=actor.source.sheet as SpellSheet;
  const spell=action.tableSpell!;
  const definition=normalizedSpellDefinitionById(spell.spellId);
  if(!definition) return refused("spell-unknown","실행 정의가 없는 주문입니다.",{actorId:actor.id,actionId:action.id});
  const level=spell.baseLevel===0?undefined:slotLevel??spell.baseLevel;
  if(level!==undefined&&(level<spell.baseLevel||level>9)) return refused("slot-invalid",`${spell.baseLevel}레벨 이상 슬롯이 필요합니다.`,{actorId:actor.id,actionId:action.id});
  if(level!==undefined) {
    const pool=state.rules.combatants[actor.id]?.resources.find((entry)=>entry.id===`spell-slot-${level}`);
    if(!pool||pool.current<1) return refused("slot-empty",`${level}레벨 주문 슬롯이 남아 있지 않습니다.`,{actorId:actor.id,actionId:action.id});
  }
  const caster=casterContext(sheet);
  const source=caster.cantripSpellIds.includes(spell.spellId)||caster.preparedSpellIds.includes(spell.spellId)?"prepared" as const:"always-prepared" as const;
  const targets=spellTargets(state,actor,definition,targetIds,(target)=>displayedAc(state,target),(target,key:AbilityKey)=>actorSaveModifier(target,key));
  // Components: verbal (can speak), somatic (a free hand), material (focus, pouch, or the listed items). Refused in the rules' words.
  let componentContext;
  let consumed:Array<{materialId:string;quantity:number}>=[];
  if(definition.components) {
    let prepared;
    try { prepared=prepareCharacterSpellComponents({character:sheet,requirements:definition.components,status:[],targetCount:targetIds.length}); }
    catch(error) {
      const text=error instanceof Error?error.message:String(error);
      if(definition.components.somatic&&freeHands(sheet)<1) return refused("components-unavailable","동작 구성요소에 빈손이 필요합니다. 무기를 놓거나 집어넣으세요.",{actorId:actor.id,actionId:action.id});
      if(/material|focus|pouch|component/i.test(text)) return refused("components-unavailable","물질 구성요소가 없습니다. 주문 초점이나 구성요소 주머니, 또는 재료가 필요합니다.",{actorId:actor.id,actionId:action.id});
      if(/verbal|speak|silence/i.test(text)) return refused("components-unavailable","음성 구성요소를 낼 수 없습니다.",{actorId:actor.id,actionId:action.id});
      return refused("components-unavailable",koSpellError(text),{actorId:actor.id,actionId:action.id});
    }
    componentContext=prepared.context;
    consumed=prepared.resolution.consumed;
  }
  let payment;
  try { payment=spellPaymentRuntimeContext({state:state.rules,character:sheet,actorId:actor.id,consumed}); }
  catch(error) { return refused("components-unavailable",error instanceof Error?error.message:String(error),{actorId:actor.id,actionId:action.id}); }
  const request={
    id:resolutionId,actorId:actor.id,spellId:spell.spellId,source,expectedRevision:payment.state.revision,
    caster,targets,...(level!==undefined?{slotLevel:level}:{}),
    ...(componentContext?{componentContext}:{componentsSatisfied:true}),
    useActionEconomy:state.mode==="initiative"||ctx.asReaction===true,
    ...(state.mode==="initiative"?{turnId:turnIdOf(state)??`freeform:${actor.id}`}:{}),
    dice:spellDice(ctx.dice,definition,level,sheet.level,targetIds),
  };
  let compilation;
  try { compilation=compileSpellCast(definition,payment.state,request); }
  catch(error) { return refused("spell-rejected",koSpellError(error instanceof Error?error.message:String(error)),{actorId:actor.id,actionId:action.id}); }
  if(ctx.asReaction&&state.mode==="initiative") {
    // A readied or reactive spell spends the reaction, not the spell's own economy slot.
    compilation.pending.operations=compilation.pending.operations.map((operation)=>operation.kind==="use-economy"?{...operation,slot:"reaction",bonusActionGranted:undefined}:operation);
  }
  if(state.mode!=="initiative") compilation.pending.operations=compilation.pending.operations.filter((operation)=>operation.kind!=="use-economy");
  compilation.pending.operations=[...payment.operations,...compilation.pending.operations];
  const result=resolveCompiledSpellCast(ctx.profile,payment.state,request,compilation);
  if(result.status==="rejected") return refused("spell-rejected",koSpellError(result.error),{actorId:actor.id,actionId:action.id});
  const rules=result.state;
  stripSpellPaymentRuntimeResources(rules,actor.id,payment.resourceIds);
  // Consumed materials leave the sheet; hiding ends when a spell with a verbal component is cast.
  const sheets=[];
  if(consumed.length) {
    try { sheets.push({actorId:actor.id,sheet:consumeCharacterSpellMaterials(sheet,consumed).character}); }
    catch { /* the kernel already paid the synthetic pool; the sheet keeps its count and the log says so */ }
  }
  const hidden=definition.components?.verbal?hiddenEndsFor(rules,actor.id):[];
  const attack=Object.entries(result.results).find(([key])=>key.startsWith(`${resolutionId}:attack`))?.[1] as D20TestResult|undefined;
  const saves=targetIds.map((targetId)=>({targetId,test:result.results[`${resolutionId}:save:${targetId}`] as D20TestResult|undefined})).filter((entry)=>entry.test);
  const healing=Object.entries(result.results).find(([key,value])=>key.startsWith(resolutionId)&&/healing/.test(key)&&value&&typeof value==="object"&&"restored" in (value as object))?.[1] as {restored:number}|undefined;
  const damageTotal=(result.results[`${resolutionId}:damage-roll`] as {total:number}|undefined)?.total;
  const targetNames=targetIds.map((id)=>actorName(state,id)).join(", ");
  const parts:string[]=[];
  if(attack) parts.push(`주문 공격 ${attack.total} vs AC ${targets[0]?.ac??"?"} ${attack.outcome==="success"?"명중":"빗나감"}`);
  for(const entry of saves) parts.push(`${actorName(state,entry.targetId)} 내성 ${entry.test!.total} vs DC ${caster.spellSaveDc} ${entry.test!.outcome==="success"?"성공":"실패"}`);
  if(damageTotal!==undefined) parts.push(`피해 ${damageTotal}`);
  if(healing) parts.push(`${targetNames} ${healing.restored} HP 회복`);
  if(definition.concentration) parts.push("집중 시작");
  const compact=`${action.name}${level!==undefined&&level>spell.baseLevel?` (${level}레벨 슬롯)`:""} → ${targetNames||actor.name}${parts.length?` · ${parts.join(" · ")}`:""}`;
  const stateChanges=[...lifeStateChanges(state,state.rules,rules),...(level!==undefined?[`${actor.name} ${level}레벨 슬롯 사용`]:[]),...(hidden.length?[`${actor.name} 숨음 해제 (음성 구성요소)`]:[]),...(consumed.length?consumed.map((entry)=>`재료 소모: ${entry.materialId} ×${entry.quantity}`):[])];
  const card=plainCard({id:resolutionId,seq:ctx.nextSeq,visibility:state.rollVisibility,action,actorId:actor.id,targetIds,rollKind:attack?"attack":saves.length?"save":healing?"healing":"effect",compact,detail:[...parts,`주문 DC ${caster.spellSaveDc} · 주문 공격 ${caster.spellAttackModifier>=0?"+":""}${caster.spellAttackModifier}`],dice:[...(attack?[attack.natural]:[]),...saves.map((entry)=>entry.test!.natural)],rollTotal:damageTotal??healing?.restored,events:result.events,stateChanges});
  if(saves.length) card.saveResults=saves.map((entry)=>({targetId:entry.targetId,targetName:actorName(state,entry.targetId),d20:entry.test!.natural,total:entry.test!.total,dc:caster.spellSaveDc,outcome:entry.test!.outcome==="success"?"성공":"실패"}));
  if(attack) { card.naturalD20=attack.natural; card.attackTotal=attack.total; card.attackOutcome=attack.outcome==="success"?"명중":"빗나감"; }
  const finalRules=hidden.length?removeEffects(rules,hidden):rules;
  const questions=knockOutQuestionsFor(state,finalRules,actor.id,targetIds,ctx.nextSeq,false);
  const engagements=engagementsAmongLiving(state,state.engagements,finalRules);
  return {status:"committed",resolution:card,events:[{
    payload:{type:"rules-committed",rules:finalRules,resolution:card,...(sheets.length?{sheets}:{}),...(!engagementsEqual(engagements,state.engagements)?{engagements}:{}),...(questions?{questions}:{})},
    log:[logEntry(ctx,{actor:actor.name,title:card.finalOutcome,summary:card.compact,detail:card.detail,stateChanges:card.stateChanges,resolutionId:card.id})],
  }]};
}

function removeEffects(rules:TableState["rules"],effectIds:string[]) {
  const next=cloneState(rules);
  next.effects=next.effects.filter((effect)=>!effectIds.includes(effect.id));
  return next;
}

/** The kernel's spell rejections in the rules' words. */
export function koSpellError(text:string):string {
  if(/[가-힣]/.test(text)) return text;
  if(/already expended a spell slot/i.test(text)) return "이번 턴에 이미 슬롯 주문을 시전했습니다.";
  if(/not prepared|unknown spell|not among/i.test(text)) return "준비하지 않은 주문입니다.";
  if(/no .*slot|slot .*exhausted|insufficient/i.test(text)) return "주문 슬롯이 남아 있지 않습니다.";
  if(/concentrat/i.test(text)) return "집중 관련 규칙 거부: "+text;
  if(/bonus[- ]action/i.test(text)) return "추가 행동을 이미 사용했습니다.";
  if(/action is not available|action slot/i.test(text)) return "행동을 이미 사용했습니다.";
  if(/reaction/i.test(text)) return "반응을 이미 사용했습니다.";
  if(/requires .* target|targets/i.test(text)) return "대상 수가 맞지 않습니다.";
  if(/component/i.test(text)) return "구성요소가 부족합니다.";
  return `규칙 거부 · ${text}`;
}
