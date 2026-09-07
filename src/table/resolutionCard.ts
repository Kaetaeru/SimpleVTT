import type { CompoundDamageResolution, DamageAmountResolution } from "../domain/damage";
import type { D20TestResult } from "../domain/d20";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import type { RulesRuntimeState } from "../domain/combatState";
import type { ActionVm, DamageComponentView, ResolutionView } from "../app/contracts";
import type { LogEntry, ResolutionRecord, TableState, Visibility } from "./state";

const NOW="지금";

export function timeLabel(now:()=>string){ return now(); }

/** Korean state-change lines from the domain's before/after combatant states (HP, temp HP, life flags). */
export function lifeStateChanges(state:TableState,before:RulesRuntimeState,after:RulesRuntimeState):string[] {
  const lines:string[]=[];
  for(const [id,next] of Object.entries(after.combatants)) {
    const previous=before.combatants[id];
    const name=state.actors[id]?.name??id;
    if(!previous) continue;
    if(previous.life.hp.temporary!==next.life.hp.temporary) lines.push(`${name} 임시 HP ${previous.life.hp.temporary} → ${next.life.hp.temporary}`);
    if(previous.life.hp.current!==next.life.hp.current) lines.push(`${name} HP ${previous.life.hp.current} → ${next.life.hp.current}`);
    if(previous.life.hp.maximum!==next.life.hp.maximum) lines.push(`${name} 최대 HP ${previous.life.hp.maximum} → ${next.life.hp.maximum}`);
    if(!previous.life.dead&&next.life.dead) lines.push(`${name} 사망`);
    if(!previous.life.unconscious&&next.life.unconscious) lines.push(`${name} 의식불명`);
    if(previous.life.unconscious&&!next.life.unconscious&&!next.life.dead) lines.push(`${name} 의식 회복`);
    if(!previous.life.stable&&next.life.stable) lines.push(`${name} 안정`);
    if(previous.life.deathSaves.successes!==next.life.deathSaves.successes||previous.life.deathSaves.failures!==next.life.deathSaves.failures) lines.push(`${name} 죽음 내성 성공 ${next.life.deathSaves.successes} · 실패 ${next.life.deathSaves.failures}`);
    for(const resource of next.resources) {
      const was=previous.resources.find((entry)=>entry.id===resource.id);
      if(was&&was.current!==resource.current) lines.push(`${name} ${resource.label} ${was.current} → ${resource.current}`);
    }
    const economyBefore=previous.economy,economyAfter=next.economy;
    if(economyBefore.action&&!economyAfter.action) lines.push(`${name} 행동 사용`);
    if(economyBefore.bonusAction&&!economyAfter.bonusAction) lines.push(`${name} 추가 행동 사용`);
    if(economyBefore.reaction&&!economyAfter.reaction) lines.push(`${name} 반응 사용`);
  }
  const effectLabel=(effect:{conditionId?:string;metadata?:Record<string,unknown>;sourceId:string})=>typeof effect.metadata?.publicLabel==="string"?effect.metadata.publicLabel:effect.conditionId??effect.sourceId;
  for(const effect of after.effects) if(!before.effects.some((entry)=>entry.id===effect.id)) lines.push(`${state.actors[effect.targetId]?.name??effect.targetId} 상태 추가: ${effectLabel(effect)}`);
  for(const effect of before.effects) if(!after.effects.some((entry)=>entry.id===effect.id)) lines.push(`${state.actors[effect.targetId]?.name??effect.targetId} 상태 종료: ${effectLabel(effect)}`);
  return lines;
}

export function damageComponentViews(damage:CompoundDamageResolution|DamageAmountResolution|undefined):DamageComponentView[] {
  if(!damage) return [];
  const components="components" in damage?damage.components:[damage];
  return components.map((component)=>({
    type:component.damageType,
    roll:String(component.raw),
    raw:component.raw,
    adjusted:component.adjusted,
    adjustment:component.adjusted===component.raw?"조정 없음":component.provenance.map((entry)=>entry.reason).join(" · ")||"조정",
    source:"Typed Defense → Temp HP → HP",
  }));
}

export function provenanceLines(events:ResolutionEvent[]):string[] {
  return events.flatMap((event)=>event.provenance.map((entry)=>`${entry.source} · ${entry.status} · ${entry.reason}`));
}

export interface AttackCardInput {
  id:string;seq:number;visibility:Visibility;action:ActionVm;actorId:string;targetIds:string[];targetName:string;
  attack:D20TestResult;damage?:CompoundDamageResolution;events:ResolutionEvent[];stateChanges:string[];
}

export function attackCard(input:AttackCardInput):ResolutionRecord {
  const {attack,damage}=input;
  const hit=attack.outcome==="success";
  const outcome=hit?"명중":"빗나감";
  const total=damage?.finalDamage??0;
  const compact=`${attack.total} vs AC ${attack.target} — ${outcome}${hit?` · ${total} ${damage?.components.map((entry)=>entry.damageType).join("+")??""} 피해`:""}${attack.critical?" · 치명타":""}`;
  return {
    id:input.id,seq:input.seq,visibility:input.visibility,actorId:input.actorId,targetIds:input.targetIds,actionId:input.action.id,actionName:input.action.name,
    rollKind:"attack",stage:"complete",authoritativeDice:[...attack.dice.faces],naturalD20:attack.natural,
    rollModifierContributions:attack.provenance.filter((entry)=>entry.status==="applied"&&/[+-]\d/.test(entry.reason)).map((entry)=>({source:entry.source,value:Number(/([+-]\d+)/.exec(entry.reason)?.[1]??0)})),
    rollTotal:attack.total,attackTotal:attack.total,targetAc:attack.target,attackOutcome:outcome,critical:attack.critical,
    saveResults:[],damageComponents:damageComponentViews(damage),
    compact,
    detail:[`d20 ${attack.natural}${attack.rollState!=="normal"?` (${attack.rollState==="advantage"?"유리":"불리"} · ${attack.dice.faces.join("/")})`:""} ${attack.modifier>=0?"+":"-"} ${Math.abs(attack.modifier)} = ${attack.total}`,`대상 AC ${attack.target}`,...(damage?[`피해 ${damage.components.map((entry)=>`${entry.adjusted} ${entry.damageType}`).join(" + ")} = ${damage.finalDamage}`]:[])],
    provenance:provenanceLines(input.events),
    calculatedOutcome:compact,finalOutcome:`${input.action.name} → ${input.targetName} · ${outcome}`,
    stateChanges:input.stateChanges,adjudicated:false,canAdvance:false,
  };
}

export interface CheckCardInput {
  id:string;seq:number;visibility:Visibility;action:ActionVm;actorId:string;targetIds:string[];label:string;
  test:D20TestResult;events:ResolutionEvent[];stateChanges:string[];rollKind:"check"|"save";outcomeLabels?:{success:string;failure:string};
}

export function checkCard(input:CheckCardInput):ResolutionRecord {
  const {test}=input;
  const success=test.outcome==="success";
  const labels=input.outcomeLabels??{success:"성공",failure:"실패"};
  const compact=`${input.label} ${test.total}${test.target>0?` vs DC ${test.target} — ${success?labels.success:labels.failure}`:""}`;
  return {
    id:input.id,seq:input.seq,visibility:input.visibility,actorId:input.actorId,targetIds:input.targetIds,actionId:input.action.id,actionName:input.action.name,
    rollKind:input.rollKind,stage:"complete",authoritativeDice:[...test.dice.faces],naturalD20:test.natural,
    rollTotal:test.total,checkTarget:test.target>0?test.target:undefined,checkOutcome:test.target>0?(success?"성공":"실패"):undefined,
    saveResults:[],damageComponents:[],compact,
    detail:[`d20 ${test.natural}${test.rollState!=="normal"?` (${test.rollState==="advantage"?"유리":"불리"} · ${test.dice.faces.join("/")})`:""} ${test.modifier>=0?"+":"-"} ${Math.abs(test.modifier)} = ${test.total}`],
    provenance:provenanceLines(input.events),calculatedOutcome:compact,finalOutcome:compact,stateChanges:input.stateChanges,adjudicated:false,canAdvance:false,
  };
}

export interface PlainCardInput {
  id:string;seq:number;visibility:Visibility;action:ActionVm;actorId:string;targetIds:string[];rollKind:ResolutionView["rollKind"];
  compact:string;detail:string[];dice?:number[];rollTotal?:number;events:ResolutionEvent[];stateChanges:string[];
}

export function plainCard(input:PlainCardInput):ResolutionRecord {
  return {
    id:input.id,seq:input.seq,visibility:input.visibility,actorId:input.actorId,targetIds:input.targetIds,actionId:input.action.id,actionName:input.action.name,
    rollKind:input.rollKind,stage:"complete",authoritativeDice:input.dice??[],rollTotal:input.rollTotal,saveResults:[],damageComponents:[],
    compact:input.compact,detail:input.detail,provenance:provenanceLines(input.events),calculatedOutcome:input.compact,finalOutcome:input.compact,
    stateChanges:input.stateChanges,adjudicated:false,canAdvance:false,
  };
}

export function logFromCard(card:ResolutionRecord,actorName:string,now:()=>string):LogEntry {
  return {id:card.id,seq:card.seq,time:now()||NOW,actor:actorName,title:card.finalOutcome,summary:card.compact,detail:card.detail,stateChanges:card.stateChanges,visibility:card.visibility,resolutionId:card.id};
}
