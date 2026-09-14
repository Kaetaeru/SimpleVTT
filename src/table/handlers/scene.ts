import { clearEngagementsOf } from "../../domain/engagement";
import type { TableCommand } from "../commands";
import { weaponRuleById } from "../../domain/weaponRuleCatalog";
import { damageLabelKo } from "../../app/srdMonsterCatalog";
import { refused } from "../refusal";
import { cloneState, type Scene, type TableState } from "../state";
import { HIDDEN_TAG } from "./act";
import { actorName, logEntry, type EventDraft, type HandlerContext, type HandlerResult } from "./types";

/**
 * Scenes, the bench and awards (RULES_RUNTIME_SPECS.md §4). A scene change ends what belonged to the scene — hiding,
 * engagements, movement declarations, readied actions, a held resolution — and keeps every creature's effects and
 * conditions, which follow the creature (2024). Benched actors stay whole and out of the order.
 */
declare module "../../app/contracts" {
  interface CharacterSheet {
    /** Experience points (D34: milestone by default, XP as a campaign option). */
    xp?:number;
    /** Milestones reached since the last level-up. */
    milestones?:number;
  }
}

export function sceneSwitch(ctx:HandlerContext,command:Extract<TableCommand,{type:"scene"}>):HandlerResult {
  const state=ctx.state;
  if(state.mode==="initiative") return refused("scene-in-combat","이니셔티브 중에는 장면을 바꿀 수 없습니다. 먼저 이니셔티브를 종료하세요.");
  const name=command.name.trim();
  if(!name) return refused("scene-name","장면 이름을 적으세요.");
  const scene:Scene={id:`scene.${ctx.nextSeq}`,name,conditions:[...new Set((command.conditions??[]).map((entry)=>entry.trim()).filter(Boolean))],enteredAt:state.rules.clock.elapsedSeconds};
  const rules=cloneState(state.rules);
  const hidden=rules.effects.filter((effect)=>effect.tags.includes(HIDDEN_TAG));
  rules.effects=rules.effects.filter((effect)=>!effect.tags.includes(HIDDEN_TAG));
  rules.revision+=1;
  let engagements=state.engagements;
  for(const id of Object.keys(state.actors)) engagements=clearEngagementsOf(engagements,id);
  const ended=[...(state.engagements.length?[`교전 ${state.engagements.length}건 종료`]:[]),...hidden.map((effect)=>`${actorName(state,effect.targetId)} 숨음 해제`),...(state.pending?["대기 중이던 해결 무효"]:[])];
  const draft:EventDraft={
    payload:{type:"table-changed",scene,rules,engagements,declarations:{},readied:{},pending:null,questions:state.questions.filter((question)=>question.kind!=="reaction-window"&&question.kind!=="opportunity-attack"&&question.kind!=="ready-trigger")},
    log:[logEntry(ctx,{actor:"DM",title:`장면 · ${name}`,summary:scene.conditions.join(", "),detail:["크리처에 붙은 효과와 상태는 그대로 따라갑니다."],stateChanges:ended})],
  };
  return {status:"committed",events:[draft]};
}

export function sceneConditions(ctx:HandlerContext,command:Extract<TableCommand,{type:"scene-conditions"}>):HandlerResult {
  const state=ctx.state;
  const conditions=[...new Set(command.conditions.map((entry)=>entry.trim()).filter(Boolean))];
  const scene:Scene={...state.scene,conditions};
  return {status:"committed",events:[{payload:{type:"table-changed",scene},log:[logEntry(ctx,{actor:"DM",title:"장면 조건",summary:conditions.join(", ")||"없음",detail:["알림입니다. 굴림에 적용하는 것은 DM 공격 개입 팔레트(D42)입니다."],stateChanges:[]})]}]};
}

export function bench(ctx:HandlerContext,command:Extract<TableCommand,{type:"bench"}>):HandlerResult {
  const state=ctx.state;
  const actor=state.actors[command.actorId];
  if(!actor) return refused("actor-unknown","테이블에 없는 액터입니다.",{actorId:command.actorId});
  const present=actor.present!==false;
  if(present===command.present) return refused("bench-same",command.present?"이미 장면에 있습니다.":"이미 대기석에 있습니다.",{actorId:command.actorId});
  if(state.mode==="initiative"&&!command.present&&state.currentActorId===command.actorId&&state.order.length>1) return refused("actor-current","현재 턴인 액터는 대기석으로 보낼 수 없습니다. 턴을 넘긴 뒤 보내세요.",{actorId:command.actorId});
  const drafts:EventDraft[]=[{payload:{type:"actor-updated",actorId:command.actorId,patch:{present:command.present}},log:[logEntry(ctx,{actor:"DM",title:command.present?"장면 복귀":"대기석",summary:actor.name,detail:[command.present?"HP·상태·죽음 내성은 그대로입니다.":"삭제가 아닙니다. HP·상태·죽음 내성을 유지한 채 장면 밖으로 나갑니다."],stateChanges:[]})]}];
  if(state.mode==="initiative") {
    const order=command.present?(state.order.includes(command.actorId)?state.order:[...state.order,command.actorId]):state.order.filter((id)=>id!==command.actorId);
    let engagements=state.engagements;
    if(!command.present) engagements=clearEngagementsOf(engagements,command.actorId);
    drafts.push({payload:{type:"table-changed",order,...(engagements!==state.engagements?{engagements}:{}),declarations:Object.fromEntries(Object.entries(state.declarations).filter(([id])=>id!==command.actorId))},log:[]});
  } else if(!command.present&&state.engagements.some((record)=>record.a===command.actorId||record.b===command.actorId)) {
    drafts.push({payload:{type:"table-changed",engagements:clearEngagementsOf(state.engagements,command.actorId)},log:[]});
  }
  return {status:"committed",events:drafts};
}

/** DM item grant (DM_WORKSPACE.md §3 아이템 · 지급): into the character's bag; a weapon the rules know also becomes an attack tile. */
export function grantItem(ctx:HandlerContext,command:Extract<TableCommand,{type:"grant-item"}>):HandlerResult {
  const state=ctx.state;
  const actor=state.actors[command.actorId];
  if(!actor||actor.source.kind!=="character") return refused("actor-unknown","아이템은 캐릭터에게만 지급합니다.",{actorId:command.actorId});
  const spec=command.item;
  const quantity=Math.max(1,Math.floor(spec.quantity??1));
  if(!spec.definitionId||!spec.name.trim()) return refused("item-invalid","아이템에 정의 id와 이름이 필요합니다.");
  const sheet=cloneState(actor.source.sheet);
  const rule=weaponRuleById(spec.definitionId);
  const stackable=spec.kind!=="equipment"||!rule;
  const existing=stackable?sheet.items.find((item)=>item.definitionId===spec.definitionId&&!item.equipped):undefined;
  const lines:string[]=[];
  if(existing) { existing.quantity+=quantity; lines.push(`${actor.name} ${spec.name} ×${existing.quantity}`); }
  else {
    const itemId=`item.${spec.definitionId.split(".").pop()??"item"}.${ctx.nextSeq}`;
    const attackId=rule?`action.${itemId}`:undefined;
    sheet.items.push({id:itemId,definitionId:spec.definitionId,name:spec.name,...(spec.nameEn?{nameEn:spec.nameEn}:{}),kind:spec.kind,quantity,equipped:false,passiveEffects:[],grantedActionIds:attackId?[attackId]:[],provenance:[`dm-grant:${ctx.nextSeq}`]});
    if(rule&&attackId) {
      const finesse=rule.properties.includes("finesse");
      const ranged=rule.mode==="ranged";
      const dex=Math.floor((sheet.abilities.dex-10)/2),str=Math.floor((sheet.abilities.str-10)/2);
      const modifier=ranged||(finesse&&dex>str)?dex:str;
      const bonus=modifier+(sheet.proficiencyBonus??0);
      const dice=typeof rule.damage==="number"?`${rule.damage}`:rule.damage;
      sheet.attacks=[...sheet.attacks,{id:attackId,name:spec.name,bonus,damage:`${dice} ${modifier>=0?"+":"-"} ${Math.abs(modifier)} ${damageLabelKo(rule.damageType)}`}];
      lines.push(`${actor.name} 공격 추가: ${spec.name} (+${bonus})`);
    }
    lines.push(`${actor.name} ${spec.name}${quantity>1?` ×${quantity}`:""} 획득`);
  }
  return {status:"committed",events:[{payload:{type:"table-changed",sheets:[{actorId:actor.id,sheet}]},log:[logEntry(ctx,{actor:"DM",title:"지급",summary:`${actor.name} ← ${spec.name}${quantity>1?` ×${quantity}`:""}`,detail:command.note?[command.note]:[],stateChanges:lines})]}]};
}

/** DM handout (DM_WORKSPACE.md §3 자료): an image for everyone or for one peer; no image takes the current one down. */
export function handout(ctx:HandlerContext,command:Extract<TableCommand,{type:"handout"}>):HandlerResult {
  const state=ctx.state;
  if(!command.image) {
    if(!state.handout) return refused("handout-none","공개 중인 자료가 없습니다.");
    return {status:"committed",events:[{payload:{type:"table-changed",handout:null},log:[logEntry(ctx,{actor:"DM",title:"자료 공개 해제",summary:state.handout.name,detail:[],stateChanges:[],visibility:state.handout.toPeer?`peer:${state.handout.toPeer}`:"public"})]}]};
  }
  if(!command.image.name.trim()||!/^data:image\/(png|jpeg|webp);base64,/.test(command.image.dataUrl)) return refused("handout-invalid","이미지 이름과 PNG·JPEG·WebP 데이터가 필요합니다.");
  const toName=command.toPeer?Object.values(state.actors).find((actor)=>actor.controllerPeer===command.toPeer)?.name??command.toPeer:undefined;
  const next={id:`handout.${ctx.nextSeq}`,name:command.image.name.trim(),dataUrl:command.image.dataUrl,...(command.toPeer?{toPeer:command.toPeer}:{}),at:ctx.now()};
  return {status:"committed",events:[{payload:{type:"table-changed",handout:next},log:[logEntry(ctx,{actor:"DM",title:command.toPeer?`자료 → ${toName}`:"자료 공개",summary:next.name,detail:[],stateChanges:[],visibility:command.toPeer?`peer:${command.toPeer}`:"public"})]}]};
}

export function award(ctx:HandlerContext,command:Extract<TableCommand,{type:"award"}>):HandlerResult {
  const state=ctx.state;
  const targets=[...new Set(command.actorIds)].filter((id)=>state.actors[id]?.source.kind==="character");
  if(!targets.length) return refused("actor-unknown","보상을 받을 캐릭터를 고르세요.");
  if(!command.xp&&!command.milestone) return refused("award-empty","XP나 마일스톤 중 하나는 있어야 합니다.");
  const sheets=targets.map((id)=>{
    const actor=state.actors[id];
    if(actor.source.kind!=="character") throw new Error("unreachable");
    const sheet=cloneState(actor.source.sheet);
    if(command.xp) sheet.xp=(sheet.xp??0)+Math.floor(command.xp);
    if(command.milestone) sheet.milestones=(sheet.milestones??0)+1;
    return {actorId:id,sheet};
  });
  const summary=[command.xp?`XP +${Math.floor(command.xp)}`:"",command.milestone?"마일스톤 +1":""].filter(Boolean).join(" · ");
  return {status:"committed",events:[{payload:{type:"table-changed",sheets},log:[logEntry(ctx,{actor:"DM",title:"보상",summary:`${targets.map((id)=>actorName(state,id)).join(", ")} · ${summary}`,detail:command.note?[command.note]:["레벨업은 세션 밖 시트에서 합니다 (D34)."],stateChanges:targets.map((id)=>`${actorName(state,id)} ${summary}`)})]}]};
}

/** Summons whose reason to exist ended: the owner's concentration, a named effect, a clock time, or the owner itself. */
export function expiredSummonIds(state:TableState):string[] {
  return Object.values(state.actors).filter((actor)=>{
    if(actor.kind!=="summon") return false;
    const owner=actor.ownerId?state.actors[actor.ownerId]:undefined;
    const ownerCombatant=actor.ownerId?state.rules.combatants[actor.ownerId]:undefined;
    if(!owner||!ownerCombatant||ownerCombatant.life.dead) return true;
    const rule=actor.expiresWith;
    if(!rule) return false;
    if(rule.concentration&&!state.rules.concentration[actor.ownerId!]) return true;
    if(rule.effectId&&!state.rules.effects.some((effect)=>effect.id===rule.effectId)) return true;
    if(rule.at!==undefined&&state.rules.clock.elapsedSeconds>=rule.at) return true;
    return false;
  }).map((actor)=>actor.id);
}
