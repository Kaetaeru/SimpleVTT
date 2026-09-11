import { resolveAttack, type AttackRequest } from "../../domain/attack";
import type { CompoundDamageResolution } from "../../domain/damage";
import type { D20TestResult } from "../../domain/d20";
import type { DeathSaveResolution } from "../../domain/life";
import type { EffectApplyRequest, DurationSpec } from "../../domain/effects";
import type { RulesRuntimeState } from "../../domain/combatState";
import type { ResolutionOperation } from "../../domain/resolutionTypes";
import type { AbilityKey, ActionVm, SaveResultVm } from "../../app/contracts";
import { abilityLabelKo, conditionLabelKo } from "../../app/srdMonsterCatalog";
import type { ConditionId } from "../../domain/conditions";
import { ABILITY_KEYS, actionsFor, actorAbilityModifier, actorAc, actorSaveModifier, damageFromDiceText } from "../actors";
import { availabilityOf, targetRefusalFor } from "../availability";
import type { TableCommand } from "../commands";
import type { SheetPatch } from "../events";
import { parseDiceNotation } from "../dice";
import { clearEngagement, clearEngagementsOf, type EngagementRecord, engagedWith, isEngaged, recordMeleeAttack } from "../../domain/engagement";
import { ENGAGEMENT_RANGED_IN_MELEE_SOURCE, engagementsAmongLiving, engagementsEqual, hostileEngagedIds, isMeleeAttack, isRangedAttack } from "../engagement";
import { knockOutQuestion } from "../questions";
import { castAct } from "./spells";
import type { ConcentrationCheckRequest } from "../../domain/concentration";
import { freeHands } from "../hands";
import { actorProficiencyBonus, actorSizeRank } from "../actors";
import { kernelErrorKo, refused } from "../refusal";
import { attackCard, checkCard, lifeStateChanges, logFromCard, plainCard } from "../resolutionCard";
import { cloneState, engagementRound, type Actor, type FloorItem, type ResolutionRecord, type TableQuestion, type TableState } from "../state";
import { handsLabel } from "../hands";
import { actorName, commitOperations, type HandlerContext, type HandlerResult } from "./types";

export const NEXT_ROLL_TAG="table:next-roll";
export const STATUS_TAG="table:status";
export const HIDDEN_TAG="table:hidden";

/** Damage to a concentrating creature needs its concentration save rolled up front (the kernel refuses otherwise). */
export function concentrationCheckFor(ctx:HandlerContext,targetId:string,rules:RulesRuntimeState=ctx.state.rules):Omit<ConcentrationCheckRequest,"damage">|undefined {
  if(!rules.concentration[targetId]) return undefined;
  const target=ctx.state.actors[targetId];
  if(!target) return undefined;
  return {dice:{id:`concentration:${targetId}:${ctx.nextSeq}`,purpose:`${target.name} 집중 유지`,sides:20,faces:ctx.dice.faces(20,2,"집중 유지")},modifierContributions:[{source:"save:con",value:actorSaveModifier(target,"con")}]};
}

/** Hiding ends when the hidden creature attacks or casts with a verbal component: the effect ids to remove. */
export function hiddenEndsFor(rules:RulesRuntimeState,actorId:string):string[] {
  return rules.effects.filter((effect)=>effect.targetId===actorId&&effect.tags.includes(HIDDEN_TAG)).map((effect)=>effect.id);
}

/** D9: melee kills ask 죽임/기절; spells and ranged attacks do not. Returns the new question list, or undefined when nothing changed. */
export function knockOutQuestionsFor(state:TableState,after:RulesRuntimeState,attackerId:string,targetIds:string[],seq:number,melee:boolean):TableQuestion[]|undefined {
  if(!melee) return undefined;
  const killed=targetIds.filter((targetId)=>state.actors[targetId]?.kind==="npc"&&!state.rules.combatants[targetId]?.life.dead&&after.combatants[targetId]?.life.dead);
  return killed.length?[...state.questions,...killed.map((targetId)=>knockOutQuestion(state,attackerId,targetId,seq))]:undefined;
}

const economySlot=(action:ActionVm)=>action.economy==="행동"?"action" as const:action.economy==="추가 행동"?"bonus-action" as const:action.economy==="반응"?"reaction" as const:undefined;

function economyOperation(ctx:HandlerContext,resolutionId:string,action:ActionVm):ResolutionOperation|undefined {
  const slot=ctx.asReaction?"reaction" as const:economySlot(action);
  if(ctx.state.mode!=="initiative"||!slot) return undefined;
  return {id:`${resolutionId}:economy`,kind:"use-economy",actorId:action.actorId,slot,bonusActionGranted:slot==="bonus-action"?true:undefined,actionKind:action.resolutionKind==="attack"?"attack":"other",...(action.resolutionKind==="attack"&&action.attacksPerAction?{attacksPerAction:action.attacksPerAction}:{})};
}

function resourceOperation(resolutionId:string,action:ActionVm):ResolutionOperation|undefined {
  return action.resourceCost?{id:`${resolutionId}:resource`,kind:"spend-resource",actorId:action.actorId,resourceId:action.resourceCost.resourceId,amount:action.resourceCost.amount}:undefined;
}

/** Marker effects that grant the next roll of a family (도움, DM 유리/불리) are spent by the first matching roll. */
export function consumeNextRoll(rules:RulesRuntimeState,actorId:string,family:"attack-roll"|"ability-check"|"saving-throw"):string[] {
  const spent=rules.effects.filter((effect)=>effect.targetId===actorId&&effect.tags.includes(NEXT_ROLL_TAG)&&effect.metadata?.d20Family===family);
  if(!spent.length) return [];
  const grants=new Set(spent.map((effect)=>String(effect.metadata?.grantId??effect.id)));
  const removed=rules.effects.filter((effect)=>effect.targetId===actorId&&effect.tags.includes(NEXT_ROLL_TAG)&&grants.has(String(effect.metadata?.grantId??effect.id)));
  rules.effects=rules.effects.filter((effect)=>!removed.includes(effect));
  return [...new Set(removed.map((effect)=>String(effect.metadata?.publicLabel??effect.sourceId)))];
}

/** "Until the start of your next turn" / "until the end of this turn" in table terms. */
export function turnBoundaryDuration(state:TableState,actorId:string,boundary:"start"|"end"):DurationSpec {
  if(state.mode!=="initiative") return {kind:"rounds",amount:1,anchorActorId:actorId,boundary};
  return {kind:"until-turn-boundary",actorId,round:boundary==="start"?state.round+1:state.round,boundary};
}

function statusEffects(ctx:HandlerContext,resolutionId:string,action:ActionVm,targetIds:string[]):EffectApplyRequest[] {
  const status=action.sessionStatusEffect;
  if(!status) return [];
  const actorId=action.actorId;
  const targetId=status.target==="first-target"?targetIds[0]:actorId;
  if(!targetId) return [];
  const duration=turnBoundaryDuration(ctx.state,actorId,status.expiresAtActorTurnBoundary??"start");
  const base={sourceId:action.id,sourceActorId:actorId,targetId,duration};
  switch(action.id) {
    case "action.standard.dodge": return [
      {...base,id:`${resolutionId}:dodge:attacks`,kind:"modifier",tags:[STATUS_TAG],metadata:{publicLabel:"회피",d20Family:"attack-roll",d20Scope:"target",d20RollState:"disadvantage"}},
      {...base,id:`${resolutionId}:dodge:dex-saves`,kind:"modifier",tags:[STATUS_TAG],metadata:{d20Family:"saving-throw",d20Ability:"dex",d20RollState:"advantage"}},
    ];
    case "action.standard.help": {
      const grantId=`${resolutionId}:help`;
      return [
        {...base,id:`${grantId}:attack`,kind:"modifier",tags:[NEXT_ROLL_TAG,STATUS_TAG],metadata:{publicLabel:"도움 받음",d20Family:"attack-roll",d20RollState:"advantage",grantId}},
        {...base,id:`${grantId}:check`,kind:"modifier",tags:[NEXT_ROLL_TAG],metadata:{d20Family:"ability-check",d20RollState:"advantage",grantId}},
      ];
    }
    default:
      return [{...base,id:`${resolutionId}:status`,kind:"marker",tags:[STATUS_TAG,...(status.runtimeTags??[])],metadata:{publicLabel:status.status}}];
  }
}

function d20Faces(ctx:HandlerContext,purpose:string) { return ctx.dice.faces(20,2,purpose); }

/**
 * A melee attack (hit or miss) engages attacker and target — the domain policy, stamped with the table's round.
 * Ranged attacks never engage; a self-target never engages.
 */
function engageByMelee(state:TableState,action:ActionVm,actorId:string,targetId:string):{engagements:EngagementRecord[];line:string}|null {
  if(!isMeleeAttack(action)||actorId===targetId||!state.actors[targetId]) return null;
  const already=isEngaged(state.engagements,actorId,targetId);
  const engagements=recordMeleeAttack(state.engagements,actorId,targetId,engagementRound(state));
  const label=`${actorName(state,actorId)} ↔ ${actorName(state,targetId)}`;
  return {engagements,line:already?`교전 유지: ${label}`:`교전 시작: ${label}`};
}

/** 이탈: every engagement of the actor ends (the Disengage action itself is the kernel's status effect). */
function disengage(state:TableState,action:ActionVm,actorId:string):{engagements:EngagementRecord[];line:string}|null {
  if(action.id!=="action.standard.disengage"&&action.sessionStatusEffect?.status!=="이탈") return null;
  const engaged=engagedWith(state.engagements,actorId);
  if(!engaged.length) return null;
  return {engagements:clearEngagementsOf(state.engagements,actorId),line:`교전 종료 (이탈): ${actorName(state,actorId)} ↔ ${engaged.map((id)=>actorName(state,id)).join(", ")}`};
}

/** A consumable leaves the bag (a potion drunk, a scroll read): the sheet patch for the owner's write-back. */
function takeItem(actor:Actor,itemId:string,quantity:number):{sheets:SheetPatch[];line:string}|null {
  if(actor.source.kind!=="character") return null;
  const sheet=cloneState(actor.source.sheet);
  const item=sheet.items.find((entry)=>entry.id===itemId);
  if(!item||item.quantity<quantity) return null;
  if(item.quantity>quantity) sheet.items=sheet.items.map((entry)=>entry.id===itemId?{...entry,quantity:entry.quantity-quantity}:entry);
  else sheet.items=sheet.items.filter((entry)=>entry.id!==itemId);
  return {sheets:[{actorId:actor.id,sheet}],line:`${item.name} ${item.quantity} → ${item.quantity-quantity}`};
}

/** A thrown weapon or object leaves the hand and lands on the floor, recoverable; a stack loses one. */
function throwFromHand(state:TableState,actor:Actor,itemId:string|undefined,seq:number):{sheets:SheetPatch[];floor:FloorItem[];lines:string[]}|null {
  if(!itemId||actor.source.kind!=="character") return null;
  const sheet=cloneState(actor.source.sheet);
  const item=sheet.items.find((entry)=>entry.id===itemId);
  if(!item) return null;
  const thrown={...cloneState(item),quantity:1,equipped:false,wielded:false};
  delete thrown.wieldSlot;
  if(item.quantity>1) sheet.items=sheet.items.map((entry)=>entry.id===itemId?{...entry,quantity:entry.quantity-1}:entry);
  else sheet.items=sheet.items.filter((entry)=>entry.id!==itemId);
  const floor=[...state.floor,{id:`floor.${seq}.${item.id}`,item:thrown,droppedBy:actor.id,recoverable:true}];
  return {sheets:[{actorId:actor.id,sheet}],floor,lines:[`${item.name} → 바닥 (회수 가능)`,`손: ${handsLabel(sheet)}`]};
}

/** One committed event: the kernel's state, the card, the engagement set pruned to who is still alive, and any sheet/floor change. */
export function commitEvents(ctx:HandlerContext,card:ResolutionRecord,rules:RulesRuntimeState,engagements?:EngagementRecord[],extra?:{sheets?:SheetPatch[];floor?:FloorItem[];questions?:TableQuestion[]}):HandlerResult {
  const state=ctx.state;
  const next=engagementsAmongLiving(state,engagements??state.engagements,rules);
  const changed=!engagementsEqual(next,state.engagements);
  return {status:"committed",resolution:card,events:[{payload:{type:"rules-committed",rules,resolution:card,...(changed?{engagements:next}:{}),...(extra?.sheets?.length?{sheets:extra.sheets}:{}),...(extra?.floor?{floor:extra.floor}:{}),...(extra?.questions?{questions:extra.questions}:{})},log:[logFromCard(card,actorName(ctx.state,card.actorId),ctx.now)]}]};
}

export function attackAct(ctx:HandlerContext,actor:Actor,action:ActionVm,targetIds:string[],resolutionId:string,itemId?:string,options:{noEngagement?:boolean}={}):HandlerResult {
  const state=ctx.state;
  const targetId=targetIds[0];
  const target=state.actors[targetId];
  const spec=action.damage?.[0];
  if(!target||!spec||!action.runtimeAttack) return refused("action-rejected","공격 정보가 없습니다.",{actorId:actor.id,actionId:action.id});
  const base=damageFromDiceText(spec.dice,spec.flat);
  const rangeFeet=action.runtimeAttack.rangeFeet;
  // Theater of the mind: an engaged archer shoots "in melee" — disadvantage, from the engagement records alone.
  const rangedInMelee=isRangedAttack(action)?hostileEngagedIds(state,actor.id):[];
  const attackDice={id:`${resolutionId}:d20`,purpose:`${action.name} 명중`,sides:20,faces:d20Faces(ctx,`${action.name} 명중`)};
  const damageFaces=base.count?ctx.dice.faces(base.sides,base.count*2,`${action.name} 피해`):[];
  const riders=(action.damage??[]).slice(1).map((extra,index)=>{
    const parsed=damageFromDiceText(extra.dice,extra.flat);
    return {sourceId:`${action.id}:extra:${index}`,damageType:extra.type,dice:parsed.count?[{source:`${action.id}:extra:${index}`,sides:parsed.sides,count:parsed.count,faces:ctx.dice.faces(parsed.sides,parsed.count*2,`${action.name} 추가 피해`)}]:[],flat:parsed.flat?[{source:`${action.id}:extra:${index}:flat`,value:parsed.flat}]:[]};
  });
  // Drawn after the attack and damage dice so the ledger order stays attack → damage → concentration.
  const concentrationCheck=concentrationCheckFor(ctx,targetId);
  const request:AttackRequest={
    id:resolutionId,actorId:actor.id,expectedRevision:state.rules.revision,sourceId:action.id,sourceKind:action.runtimeAttack.sourceKind,
    // Mapless table: a melee attack is adjacent by declaration (prone targets, reach); ranged distance stays unknown.
    target:{id:targetId,kind:"creature",relation:actor.side===target.side?"ally":"enemy",ac:actorAc(target),creatureKind:target.kind==="character"?"character":"monster",...(rangeFeet<=5?{spatialAuthority:"authoritative",distanceFeet:5,visible:true,cover:"none",targetCanSeeAttacker:true}:{spatialAuthority:"manual-unconstrained"})} as AttackRequest["target"],
    actorCreatureKind:actor.kind==="character"?"character":"monster",
    rangeFeet,attackDice,attackModifierContributions:[{source:`action:${action.id}:attack-bonus`,value:action.attackBonus??0}],requiresSight:rangeFeet<=5,
    ...(rangedInMelee.length?{rollStateContributions:[{source:`${ENGAGEMENT_RANGED_IN_MELEE_SOURCE}:${rangedInMelee.join(",")}`,state:"disadvantage" as const}]}:{}),
    ...(concentrationCheck?{concentrationCheck}:{}),
    baseDamage:{sourceId:action.id,damageType:spec.type,dice:base.count?[{source:action.id,sides:base.sides,count:base.count,faces:damageFaces}]:[],flat:base.flat?[{source:`${action.id}:flat`,value:base.flat}]:[]},
    riders,
    economy:state.mode==="initiative"&&(ctx.asReaction||economySlot(action))?(ctx.asReaction?{slot:"reaction",actionKind:"attack",attacksPerAction:1}:{slot:economySlot(action)!,bonusActionGranted:economySlot(action)==="bonus-action"?true:undefined,actionKind:"attack",attacksPerAction:action.attacksPerAction??1}):undefined,
  };
  let commit;
  try { commit=resolveAttack(ctx.profile,state.rules,request); }
  catch(error) { return refused("action-rejected",error instanceof Error?error.message:String(error),{actorId:actor.id,actionId:action.id}); }
  if(commit.status==="rejected") return refused("action-rejected",kernelErrorKo(commit.error),{actorId:actor.id,actionId:action.id});
  const attack=commit.results[`${resolutionId}:attack`] as D20TestResult;
  const damage=Object.entries(commit.results).find(([key,value])=>key.startsWith(resolutionId)&&Boolean(value)&&typeof value==="object"&&"components" in (value as object))?.[1] as CompoundDamageResolution|undefined;
  const rules=commit.state;
  const consumed=consumeNextRoll(rules,actor.id,"attack-roll");
  const unhidden=hiddenEndsFor(rules,actor.id);
  if(unhidden.length) rules.effects=rules.effects.filter((effect)=>!unhidden.includes(effect.id));
  const engaged=options.noEngagement?null:engageByMelee(state,action,actor.id,targetId);
  const thrown=action.tableThrow?throwFromHand(state,actor,action.tableThrow.itemId??itemId,ctx.nextSeq):null;
  // D9: a melee attack that drops a creature to 0 HP may knock it out instead — one question to the attacker.
  const killedNow=isMeleeAttack(action)&&target.kind==="npc"&&!state.rules.combatants[targetId]?.life.dead&&rules.combatants[targetId]?.life.dead;
  const questions=killedNow?[...state.questions,knockOutQuestion(state,actor.id,targetId,ctx.nextSeq)]:undefined;
  const stateChanges=[...lifeStateChanges(state,state.rules,rules),...consumed.map((label)=>`${actor.name} 상태 종료: ${label}`),...(unhidden.length?[`${actor.name} 숨음 해제 (공격)`]:[]),...(engaged?[engaged.line]:[]),...(thrown?.lines??[]),...(killedNow?[`질문: ${target.name} 죽임/기절`]:[])];
  const card=attackCard({id:resolutionId,seq:ctx.nextSeq,visibility:state.rollVisibility,action,actorId:actor.id,targetIds:[targetId],targetName:target.name,attack,damage,events:commit.events,stateChanges});
  if(engaged) card.provenance.push(`engagement:melee-attack:${actor.id}<->${targetId}:round:${engagementRound(state)}`);
  return commitEvents(ctx,card,rules,engaged?.engagements,{...(thrown??{}),...(questions?{questions}:{})});
}

function checkAct(ctx:HandlerContext,actor:Actor,action:ActionVm,targetIds:string[],resolutionId:string):HandlerResult {
  const state=ctx.state;
  const dc=action.tableHide?15:action.tableStabilize?10:action.sessionStatusEffect?.minimumRoll??0;
  const d20Id=`${resolutionId}:check`;
  const operations:ResolutionOperation[]=[];
  if(action.tableStabilize) {
    const targetId=targetIds[0];
    const target=targetId?state.rules.combatants[targetId]:undefined;
    if(!target) return refused("target-missing","안정화할 대상을 선택하세요.",{actorId:actor.id,actionId:action.id});
    if(target.life.dead) return refused("target-ineligible","죽은 대상입니다.",{actorId:actor.id,actionId:action.id});
    if(target.life.hp.current>0||target.life.stable) return refused("target-ineligible","HP 0의 불안정한 대상만 안정화할 수 있습니다.",{actorId:actor.id,actionId:action.id});
  }
  if(action.tableHide&&hiddenEndsFor(state.rules,actor.id).length) return refused("already-hidden","이미 숨어 있습니다.",{actorId:actor.id,actionId:action.id});
  const economy=economyOperation(ctx,resolutionId,action); if(economy) operations.push(economy);
  const resource=resourceOperation(resolutionId,action); if(resource) operations.push(resource);
  operations.push({id:d20Id,kind:"d20",actorId:actor.id,request:{family:"ability-check",target:dc,modifierContributions:[{source:`action:${action.id}:check-bonus`,value:action.checkBonus??0}],dice:{id:`${resolutionId}:d20`,purpose:action.name,sides:20,faces:d20Faces(ctx,action.name)}}});
  for(const effect of statusEffects(ctx,resolutionId,action,targetIds)) operations.push({id:`${effect.id}:apply`,kind:"apply-effect",effect,when:{operationId:d20Id,field:"outcome",equals:"success"}});
  if(action.tableHide) operations.push({id:`${resolutionId}:hide`,kind:"apply-effect",when:{operationId:d20Id,field:"outcome",equals:"success"},effect:{id:`${resolutionId}:hidden`,sourceId:action.id,sourceActorId:actor.id,targetId:actor.id,kind:"condition",conditionId:"invisible",tags:[STATUS_TAG,HIDDEN_TAG],duration:{kind:"permanent"},metadata:{publicLabel:"숨음"}}});
  if(action.tableStabilize) operations.push({id:`${resolutionId}:stabilize`,kind:"stabilize",targetId:targetIds[0],when:{operationId:d20Id,field:"outcome",equals:"success"}});
  const committed=commitOperations(ctx,{id:resolutionId,actorId:actor.id,sourceId:action.id,operations,actionId:action.id});
  if(committed.status==="refused") return committed;
  const test=committed.commit.results[d20Id] as D20TestResult;
  const rules=committed.commit.state;
  const consumed=consumeNextRoll(rules,actor.id,"ability-check");
  const stateChanges=[...lifeStateChanges(state,state.rules,rules),...consumed.map((label)=>`${actor.name} 상태 종료: ${label}`)];
  const labels=action.sessionStatusEffect?{success:action.sessionStatusEffect.successOutcome,failure:action.sessionStatusEffect.failureOutcome??"실패"}
    :action.tableHide?{success:"숨음",failure:"들킴"}
    :action.tableStabilize?{success:`${actorName(state,targetIds[0])} 안정`,failure:"안정화 실패"}
    :action.tableOpenCheck?{success:`판정 ${test.total} (DM이 판단)`,failure:`판정 ${test.total} (DM이 판단)`}:undefined;
  const card=checkCard({id:resolutionId,seq:ctx.nextSeq,visibility:state.rollVisibility,action,actorId:actor.id,targetIds,label:action.name,test,events:committed.commit.events,stateChanges,rollKind:"check",outcomeLabels:labels});
  return commitEvents(ctx,card,rules);
}

function saveAbilityKey(action:ActionVm):AbilityKey|undefined {
  return ABILITY_KEYS.find((key)=>abilityLabelKo(key)===action.saveAbility);
}

function saveAct(ctx:HandlerContext,actor:Actor,action:ActionVm,targetIds:string[],resolutionId:string):HandlerResult {
  const state=ctx.state;
  const key=saveAbilityKey(action);
  const dc=action.saveDc;
  if(!key||dc===undefined) return refused("action-rejected","내성 정보가 없습니다.",{actorId:actor.id,actionId:action.id});
  const operations:ResolutionOperation[]=[];
  const economy=economyOperation(ctx,resolutionId,action); if(economy) operations.push(economy);
  const resource=resourceOperation(resolutionId,action); if(resource) operations.push(resource);
  const damageRollId=`${resolutionId}:damage-roll`;
  const components=(action.damage??[]).map((entry,index)=>({index,type:entry.type,...damageFromDiceText(entry.dice,entry.flat)}));
  if(components.length) operations.push({id:damageRollId,kind:"damage-roll",request:{dice:components.filter((entry)=>entry.count>0).map((entry)=>({source:`${action.id}:${entry.index}`,sides:entry.sides,count:entry.count,faces:ctx.dice.faces(entry.sides,entry.count*2,`${action.name} 피해`)})),flat:components.filter((entry)=>entry.flat).map((entry)=>({source:`${action.id}:${entry.index}:flat`,value:entry.flat}))}});
  const saveIds:Record<string,string>={};
  const definition=actor.source.kind==="monster"?actor.source.definition.runtimeSaveActions?.find((spec)=>spec.id===action.id):undefined;
  for(const targetId of targetIds) {
    const target=state.actors[targetId];
    if(!target) continue;
    const saveId=`${resolutionId}:save:${targetId}`;
    saveIds[targetId]=saveId;
    operations.push({id:saveId,kind:"d20",actorId:targetId,request:{family:"saving-throw",target:dc,modifierContributions:[{source:`save:${key}`,value:actorSaveModifier(target,key)}],dice:{id:`${saveId}:d20`,purpose:`${target.name} ${abilityLabelKo(key)} 내성`,sides:20,faces:d20Faces(ctx,`${target.name} 내성`)}},condition:{ability:key}});
    if(components.length) {
      const creatureKind=target.kind==="character"?"character" as const:"monster" as const;
      const damageType=components[0].type;
      const concentrationCheck=concentrationCheckFor(ctx,targetId);
      operations.push({id:`${resolutionId}:damage:${targetId}:fail`,kind:"damage",targetId,damageType,amount:{operationId:damageRollId,field:"total"},creatureKind,when:{operationId:saveId,field:"outcome",equals:"failure"},...(concentrationCheck?{concentrationCheck}:{})});
      if(action.saveHalf) operations.push({id:`${resolutionId}:damage:${targetId}:half`,kind:"damage",targetId,damageType,amount:{operationId:damageRollId,field:"total",multiplier:0.5,rounding:"floor"},creatureKind,when:{operationId:saveId,field:"outcome",equals:"success"},...(concentrationCheck?{concentrationCheck}:{})});
    }
    for(const conditionId of definition?.failConditionIds??[]) {
      operations.push({id:`${resolutionId}:condition:${targetId}:${conditionId}`,kind:"apply-effect",when:{operationId:saveId,field:"outcome",equals:"failure"},effect:{id:`${resolutionId}:${conditionId}:${targetId}`,sourceId:action.id,sourceActorId:actor.id,targetId,kind:"condition",conditionId:conditionId as ConditionId,tags:[STATUS_TAG],duration:{kind:"minutes",amount:1},metadata:{publicLabel:conditionLabelKo(conditionId)}}});
    }
  }
  const committed=commitOperations(ctx,{id:resolutionId,actorId:actor.id,sourceId:action.id,operations,actionId:action.id});
  if(committed.status==="refused") return committed;
  const rules=committed.commit.state;
  const saveResults:SaveResultVm[]=targetIds.flatMap((targetId)=>{
    const test=committed.commit.results[saveIds[targetId]] as D20TestResult|undefined;
    if(!test) return [];
    const failDamage=committed.commit.results[`${resolutionId}:damage:${targetId}:fail`] as CompoundDamageResolution|{skipped:true}|undefined;
    const halfDamage=committed.commit.results[`${resolutionId}:damage:${targetId}:half`] as CompoundDamageResolution|{skipped:true}|undefined;
    const dealt=[failDamage,halfDamage].find((entry)=>entry&&!("skipped" in entry)) as {finalDamage:number}|undefined;
    consumeNextRoll(rules,targetId,"saving-throw");
    return [{targetId,targetName:actorName(state,targetId),d20:test.natural,total:test.total,dc,outcome:test.outcome==="success"?"성공":"실패",finalDamage:dealt?.finalDamage}];
  });
  const roll=committed.commit.results[damageRollId] as {total:number}|undefined;
  const stateChanges=lifeStateChanges(state,state.rules,rules);
  const compact=`${abilityLabelKo(key)} 내성 DC ${dc} · ${saveResults.map((entry)=>`${entry.targetName} ${entry.total} ${entry.outcome}${entry.finalDamage!==undefined?` · ${entry.finalDamage} 피해`:""}`).join(", ")}`;
  const card=plainCard({id:resolutionId,seq:ctx.nextSeq,visibility:state.rollVisibility,action,actorId:actor.id,targetIds,rollKind:"save",compact,detail:[...(roll?[`피해 굴림 ${roll.total}`]:[]),...saveResults.map((entry)=>`${entry.targetName}: d20 ${entry.d20} → ${entry.total} vs DC ${dc} ${entry.outcome}`)],dice:targetIds.map((id)=>(committed.commit.results[saveIds[id]] as D20TestResult|undefined)?.natural??0),rollTotal:roll?.total,events:committed.commit.events,stateChanges});
  card.saveResults=saveResults;
  return commitEvents(ctx,card,rules);
}

function healAct(ctx:HandlerContext,actor:Actor,action:ActionVm,targetIds:string[],resolutionId:string):HandlerResult {
  const state=ctx.state;
  const targetId=action.target==="self"?actor.id:targetIds[0]??actor.id;
  const healing=action.healing;
  if(!healing) return refused("action-rejected","회복 정보가 없습니다.",{actorId:actor.id,actionId:action.id});
  const parsed=parseDiceNotation(healing.dice)??{count:0,sides:0,flat:0};
  const faces=parsed.count?ctx.dice.faces(parsed.sides,parsed.count,`${action.name} 회복`):[];
  const amount=faces.reduce((sum,face)=>sum+face,0)+parsed.flat+healing.flat;
  const operations:ResolutionOperation[]=[];
  const economy=economyOperation(ctx,resolutionId,action); if(economy) operations.push(economy);
  const resource=resourceOperation(resolutionId,action); if(resource) operations.push(resource);
  operations.push({id:`${resolutionId}:healing`,kind:"healing",targetId,amount});
  if(action.tablePotion) {
    const targetActor=state.actors[targetId];
    if(action.tablePotion.administer&&(targetId===actor.id||!targetActor)) return refused("target-missing","먹일 대상을 선택하세요 (자신은 마시기).",{actorId:actor.id,actionId:action.id});
    if(state.rules.combatants[targetId]?.life.dead) return refused("target-ineligible","죽은 대상입니다.",{actorId:actor.id,actionId:action.id});
  }
  const committed=commitOperations(ctx,{id:resolutionId,actorId:actor.id,sourceId:action.id,operations,actionId:action.id});
  if(committed.status==="refused") return committed;
  const rules=committed.commit.state;
  const restored=(committed.commit.results[`${resolutionId}:healing`] as {restored:number}).restored;
  const compact=`${healing.dice}${healing.flat?` + ${healing.flat}`:""} = ${amount} · ${actorName(state,targetId)} ${restored} HP 회복`;
  const used=action.itemCost&&actor.source.kind==="character"?takeItem(actor,action.itemCost.itemId,action.itemCost.quantity??1):null;
  if(action.itemCost&&!used) return refused("item-unknown","가방에 없는 물건입니다.",{actorId:actor.id,actionId:action.id});
  const card=plainCard({id:resolutionId,seq:ctx.nextSeq,visibility:state.rollVisibility,action,actorId:actor.id,targetIds:[targetId],rollKind:"healing",compact,detail:[`주사위 ${faces.join("+")||"—"} + ${parsed.flat+healing.flat} = ${amount}`],dice:faces,rollTotal:amount,events:committed.commit.events,stateChanges:[...lifeStateChanges(state,state.rules,rules),...(used?[used.line]:[])]});
  return commitEvents(ctx,card,rules,undefined,used?{sheets:used.sheets}:undefined);
}

function deathSaveAct(ctx:HandlerContext,actor:Actor,action:ActionVm,resolutionId:string):HandlerResult {
  const state=ctx.state;
  const rules=cloneState(state.rules);
  if(state.mode!=="initiative") rules.clock={...rules.clock,activeActorId:actor.id};
  const face=ctx.dice.faces(20,1,"죽음 내성")[0];
  const committed=commitOperations(ctx,{id:resolutionId,actorId:actor.id,sourceId:action.id,rules,actionId:action.id,operations:[{id:`${resolutionId}:death-save`,kind:"death-save",actorId:actor.id,dice:{id:`${resolutionId}:d20`,purpose:"death saving throw",sides:20,faces:[face]}}]});
  if(committed.status==="refused") return committed;
  const resolved=committed.commit.results[`${resolutionId}:death-save`] as DeathSaveResolution;
  const outcome={success:"성공",failure:"실패",stable:"안정",dead:"사망",revived:"의식 회복"}[resolved.outcome];
  const compact=`죽음 내성 d20 ${resolved.natural} · ${outcome}`;
  const card=plainCard({id:resolutionId,seq:ctx.nextSeq,visibility:state.rollVisibility,action,actorId:actor.id,targetIds:[],rollKind:"save",compact,detail:[`성공 ${resolved.next.deathSaves.successes} · 실패 ${resolved.next.deathSaves.failures}`],dice:[face],rollTotal:resolved.total,events:committed.commit.events,stateChanges:lifeStateChanges(state,state.rules,committed.commit.state)});
  return commitEvents(ctx,card,committed.commit.state);
}

function noRollAct(ctx:HandlerContext,actor:Actor,action:ActionVm,targetIds:string[],resolutionId:string):HandlerResult {
  const state=ctx.state;
  const operations:ResolutionOperation[]=[];
  const economy=economyOperation(ctx,resolutionId,action); if(economy) operations.push(economy);
  const resource=resourceOperation(resolutionId,action); if(resource) operations.push(resource);
  for(const effect of statusEffects(ctx,resolutionId,action,targetIds)) operations.push({id:`${effect.id}:apply`,kind:"apply-effect",effect});
  const committed=commitOperations(ctx,{id:resolutionId,actorId:actor.id,sourceId:action.id,operations,actionId:action.id});
  if(committed.status==="refused") return committed;
  const rules=committed.commit.state;
  const extraChanges:string[]=[];
  if(action.movementBudgetGainFeet) {
    const combatant=rules.combatants[actor.id];
    const before=combatant.economy.movement;
    combatant.economy={...combatant.economy,movement:before+action.movementBudgetGainFeet,movementMaximum:combatant.economy.movementMaximum+action.movementBudgetGainFeet};
    extraChanges.push(`${actor.name} 이동 ${before} → ${before+action.movementBudgetGainFeet}피트`);
  }
  const targetName=targetIds[0]?actorName(state,targetIds[0]):undefined;
  const compact=action.sessionStatusEffect?`${action.sessionStatusEffect.successOutcome}${targetName&&action.sessionStatusEffect.target==="first-target"?` → ${targetName}`:""}`:action.completionOutcome??action.name;
  const disengaged=disengage(state,action,actor.id);
  const card=plainCard({id:resolutionId,seq:ctx.nextSeq,visibility:state.rollVisibility,action,actorId:actor.id,targetIds,rollKind:"effect",compact,detail:[action.summary],events:committed.commit.events,stateChanges:[...lifeStateChanges(state,state.rules,rules),...extraChanges,...(disengaged?[disengaged.line]:[])]});
  return commitEvents(ctx,card,rules,disengaged?.engagements);
}

export const GRAPPLE_SOURCE="table:grapple";

function grappleEffectsOn(state:TableState,targetId:string,grapplerId?:string) {
  return state.rules.effects.filter((effect)=>effect.targetId===targetId&&effect.kind==="condition"&&effect.conditionId==="grappled"&&effect.sourceId===GRAPPLE_SOURCE&&(!grapplerId||effect.sourceActorId===grapplerId));
}

/** Unarmed Strike — Grapple / Shove (2024): the target makes a STR or DEX save (its better one) against 8 + PB + STR. */
function unarmedOptionAct(ctx:HandlerContext,actor:Actor,action:ActionVm,targetIds:string[],resolutionId:string):HandlerResult {
  const state=ctx.state;
  const targetId=targetIds[0];
  const target=state.actors[targetId];
  const kind=action.tableUnarmedOption!;
  if(!target||targetId===actor.id) return refused("target-ineligible","자기 자신을 대상으로 할 수 없습니다.",{actorId:actor.id,actionId:action.id});
  if(actorSizeRank(target)>actorSizeRank(actor)+1) return refused("target-too-large","나보다 두 단계 이상 큰 대상은 붙잡거나 밀 수 없습니다.",{actorId:actor.id,actionId:action.id});
  if(kind==="grapple"&&actor.source.kind==="character"&&freeHands(actor.source.sheet)<1) return refused("hands-full","붙잡으려면 빈손이 하나 필요합니다. 먼저 놓거나 집어넣으세요.",{actorId:actor.id,actionId:action.id});
  if(kind==="grapple"&&grappleEffectsOn(state,targetId,actor.id).length) return refused("already-grappled","이미 붙잡고 있는 대상입니다.",{actorId:actor.id,actionId:action.id});
  const dc=action.saveDc??8+actorProficiencyBonus(actor)+actorAbilityModifier(actor,"str");
  const key:AbilityKey=actorSaveModifier(target,"dex")>actorSaveModifier(target,"str")?"dex":"str";
  const saveId=`${resolutionId}:save`;
  const operations:ResolutionOperation[]=[];
  const economy=economyOperation(ctx,resolutionId,{...action,resolutionKind:"attack"}); if(economy) operations.push(economy);
  operations.push({id:saveId,kind:"d20",actorId:targetId,request:{family:"saving-throw",target:dc,modifierContributions:[{source:`save:${key}`,value:actorSaveModifier(target,key)}],dice:{id:`${saveId}:d20`,purpose:`${target.name} ${abilityLabelKo(key)} 내성`,faces:d20Faces(ctx,`${target.name} 내성`),sides:20}},condition:{ability:key}});
  if(kind==="grapple") operations.push({id:`${resolutionId}:grapple`,kind:"apply-effect",when:{operationId:saveId,field:"outcome",equals:"failure"},effect:{id:`${resolutionId}:grappled:${targetId}`,sourceId:GRAPPLE_SOURCE,sourceActorId:actor.id,targetId,kind:"condition",conditionId:"grappled",tags:[STATUS_TAG],duration:{kind:"special",key:`grapple:${actor.id}`},termination:{sourceBecomesIncapacitated:true,sourceDies:true,targetDies:true},metadata:{publicLabel:`붙잡힘 (${actor.name})`,escapeDc:dc,grapplerId:actor.id}}});
  if(kind==="shove-prone") operations.push({id:`${resolutionId}:prone`,kind:"apply-effect",when:{operationId:saveId,field:"outcome",equals:"failure"},effect:{id:`${resolutionId}:prone:${targetId}`,sourceId:"table:posture",sourceActorId:actor.id,targetId,kind:"condition",conditionId:"prone",tags:[STATUS_TAG],duration:{kind:"permanent"},metadata:{publicLabel:"넘어짐"}}});
  const committed=commitOperations(ctx,{id:resolutionId,actorId:actor.id,sourceId:action.id,operations,actionId:action.id});
  if(committed.status==="refused") return committed;
  const test=committed.commit.results[saveId] as D20TestResult;
  const rules=committed.commit.state;
  consumeNextRoll(rules,targetId,"saving-throw");
  const failed=test.outcome!=="success";
  const label={grapple:"붙잡기","shove-prone":"넘어뜨리기","shove-push":"밀어내기"}[kind];
  const outcome=failed?{grapple:`${target.name} 붙잡힘 (속도 0)`,"shove-prone":`${target.name} 넘어짐`,"shove-push":`${target.name} 5피트 밀려남 · 교전 해제`}[kind]:`${target.name} 내성 성공`;
  // Pushing the creature away breaks the pair's engagement (it left reach); it may also break a grapple the actor held.
  let engagements=state.engagements;
  if(kind==="shove-push"&&failed) engagements=clearEngagement(state.engagements,actor.id,targetId);
  const engagedLine=isMeleeAttack({resolutionKind:"attack",runtimeAttack:{sourceKind:"unarmed",rangeFeet:5,attackMode:"melee",diceSides:2,diceCount:0,damageSource:""}})&&!(kind==="shove-push"&&failed)?engageByMelee(state,{...action,resolutionKind:"attack",runtimeAttack:{sourceKind:"unarmed",rangeFeet:5,attackMode:"melee",diceSides:2,diceCount:0,damageSource:""}},actor.id,targetId):null;
  if(engagedLine) engagements=engagedLine.engagements;
  const compact=`${label} · ${target.name} ${abilityLabelKo(key)} 내성 ${test.total} vs DC ${dc} ${failed?"실패":"성공"} → ${outcome}`;
  const card=plainCard({id:resolutionId,seq:ctx.nextSeq,visibility:state.rollVisibility,action,actorId:actor.id,targetIds:[targetId],rollKind:"save",compact,detail:[`d20 ${test.natural} ${signedText(actorSaveModifier(target,key))} = ${test.total}`],dice:[test.natural],rollTotal:test.total,events:committed.commit.events,stateChanges:[...lifeStateChanges(state,state.rules,rules),...(engagedLine?[engagedLine.line]:[]),...(kind==="shove-push"&&failed?[`교전 종료 (밀려남): ${actor.name} ↔ ${target.name}`]:[])]});
  card.saveResults=[{targetId,targetName:target.name,d20:test.natural,total:test.total,dc,outcome:failed?"실패":"성공"}];
  return commitEvents(ctx,card,rules,engagements);
}

const signedText=(value:number)=>value>=0?`+${value}`:`${value}`;

/** Escape a grapple (action): STR (Athletics) or DEX (Acrobatics) against the grappler's DC; success ends every grapple on the actor. */
function escapeAct(ctx:HandlerContext,actor:Actor,action:ActionVm,resolutionId:string):HandlerResult {
  const state=ctx.state;
  const holds=grappleEffectsOn(state,actor.id);
  if(!holds.length) return refused("not-grappled","붙잡힌 상태가 아닙니다.",{actorId:actor.id,actionId:action.id});
  const dc=Math.max(...holds.map((effect)=>Number(effect.metadata?.escapeDc??10)));
  const checkId=`${resolutionId}:escape`;
  const operations:ResolutionOperation[]=[];
  const economy=economyOperation(ctx,resolutionId,action); if(economy) operations.push(economy);
  operations.push({id:checkId,kind:"d20",actorId:actor.id,request:{family:"ability-check",target:dc,modifierContributions:[{source:`action:${action.id}:check-bonus`,value:action.checkBonus??0}],dice:{id:`${resolutionId}:d20`,purpose:"붙잡힘 탈출",sides:20,faces:d20Faces(ctx,"붙잡힘 탈출")}}});
  for(const effect of holds) operations.push({id:`${resolutionId}:free:${effect.id}`,kind:"remove-effect",effectId:effect.id,when:{operationId:checkId,field:"outcome",equals:"success"}});
  const committed=commitOperations(ctx,{id:resolutionId,actorId:actor.id,sourceId:action.id,operations,actionId:action.id});
  if(committed.status==="refused") return committed;
  const test=committed.commit.results[checkId] as D20TestResult;
  const rules=committed.commit.state;
  consumeNextRoll(rules,actor.id,"ability-check");
  const grapplers=holds.map((effect)=>actorName(state,String(effect.metadata?.grapplerId??effect.sourceActorId??""))).join(", ");
  const compact=`붙잡힘 탈출 · ${test.total} vs DC ${dc} ${test.outcome==="success"?`성공 → ${grapplers}에게서 풀려남`:"실패"}`;
  const card=plainCard({id:resolutionId,seq:ctx.nextSeq,visibility:state.rollVisibility,action,actorId:actor.id,targetIds:[],rollKind:"check",compact,detail:[`d20 ${test.natural} ${signedText(action.checkBonus??0)} = ${test.total}`],dice:[test.natural],rollTotal:test.total,events:committed.commit.events,stateChanges:lifeStateChanges(state,state.rules,rules)});
  return commitEvents(ctx,card,rules);
}

/** Let a grappled creature go: free, ends the grapples this actor holds. */
function releaseAct(ctx:HandlerContext,actor:Actor,action:ActionVm,resolutionId:string):HandlerResult {
  const state=ctx.state;
  const held=state.rules.effects.filter((effect)=>effect.kind==="condition"&&effect.conditionId==="grappled"&&effect.sourceId===GRAPPLE_SOURCE&&effect.sourceActorId===actor.id);
  if(!held.length) return refused("not-grappling","붙잡고 있는 대상이 없습니다.",{actorId:actor.id,actionId:action.id});
  const committed=commitOperations(ctx,{id:resolutionId,actorId:actor.id,sourceId:action.id,operations:held.map((effect)=>({id:`${resolutionId}:release:${effect.id}`,kind:"remove-effect" as const,effectId:effect.id})),actionId:action.id});
  if(committed.status==="refused") return committed;
  const names=held.map((effect)=>actorName(state,effect.targetId)).join(", ");
  const card=plainCard({id:resolutionId,seq:ctx.nextSeq,visibility:state.rollVisibility,action,actorId:actor.id,targetIds:held.map((effect)=>effect.targetId),rollKind:"effect",compact:`놓아주기 · ${names}`,detail:["비용 없음"],events:committed.commit.events,stateChanges:lifeStateChanges(state,state.rules,committed.commit.state)});
  return commitEvents(ctx,card,committed.commit.state);
}

export function act(ctx:HandlerContext,command:Extract<TableCommand,{type:"act"}>):HandlerResult {
  const state=ctx.state;
  const actor=state.actors[command.actorId];
  if(!actor||!state.rules.combatants[command.actorId]) return refused("actor-unknown","테이블에 없는 액터입니다.",{actorId:command.actorId});
  const action=actionsFor(actor,state).find((entry)=>entry.id===command.actionId);
  if(!action) return refused("action-unknown","알 수 없는 행동입니다.",{actorId:actor.id,actionId:command.actionId});
  const availability=availabilityOf(state,action,{asReaction:ctx.asReaction});
  if(!availability.available) return refused("action-unavailable",availability.reason??"지금은 사용할 수 없는 행동입니다.",{actorId:actor.id,actionId:action.id});
  const targetIds=[...new Set(command.targetIds)];
  const targetRefusal=targetRefusalFor(state,action,targetIds);
  if(targetRefusal) return refused(targetRefusal.code,targetRefusal.message,{actorId:actor.id,actionId:action.id});
  const resolutionId=`res.${ctx.nextSeq}`;
  if(action.id==="action.death-save") return deathSaveAct(ctx,actor,action,resolutionId);
  if(action.tableSpell) return castAct(ctx,actor,action,targetIds,resolutionId,command.slotLevel);
  if(action.tableUnarmedOption) return unarmedOptionAct(ctx,actor,action,targetIds,resolutionId);
  if(action.tableEscape) return escapeAct(ctx,actor,action,resolutionId);
  if(action.tableRelease) return releaseAct(ctx,actor,action,resolutionId);
  switch(action.resolutionKind) {
    case "attack": return attackAct(ctx,actor,action,targetIds,resolutionId,command.itemId);
    case "ability-check": return checkAct(ctx,actor,action,targetIds,resolutionId);
    case "saving-throw": return saveAct(ctx,actor,action,targetIds,resolutionId);
    case "healing": return healAct(ctx,actor,action,targetIds,resolutionId);
    case "no-roll":
    case "no-roll-damage": return noRollAct(ctx,actor,action,targetIds,resolutionId);
  }
}
