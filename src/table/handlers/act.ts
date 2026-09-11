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
import { ABILITY_KEYS, actionsFor, actorAc, actorSaveModifier, damageFromDiceText } from "../actors";
import { availabilityOf, targetRefusalFor } from "../availability";
import type { TableCommand } from "../commands";
import type { SheetPatch } from "../events";
import { parseDiceNotation } from "../dice";
import { clearEngagementsOf, type EngagementRecord, engagedWith, isEngaged, recordMeleeAttack } from "../../domain/engagement";
import { ENGAGEMENT_RANGED_IN_MELEE_SOURCE, engagementsAmongLiving, engagementsEqual, hostileEngagedIds, isMeleeAttack, isRangedAttack } from "../engagement";
import { kernelErrorKo, refused } from "../refusal";
import { attackCard, checkCard, lifeStateChanges, logFromCard, plainCard } from "../resolutionCard";
import { cloneState, engagementRound, type Actor, type FloorItem, type ResolutionRecord, type TableState } from "../state";
import { handsLabel } from "../hands";
import { actorName, commitOperations, type HandlerContext, type HandlerResult } from "./types";

export const NEXT_ROLL_TAG="table:next-roll";
export const STATUS_TAG="table:status";

const economySlot=(action:ActionVm)=>action.economy==="행동"?"action" as const:action.economy==="추가 행동"?"bonus-action" as const:action.economy==="반응"?"reaction" as const:undefined;

function economyOperation(ctx:HandlerContext,resolutionId:string,action:ActionVm):ResolutionOperation|undefined {
  const slot=economySlot(action);
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
function commitEvents(ctx:HandlerContext,card:ResolutionRecord,rules:RulesRuntimeState,engagements?:EngagementRecord[],extra?:{sheets?:SheetPatch[];floor?:FloorItem[]}):HandlerResult {
  const state=ctx.state;
  const next=engagementsAmongLiving(state,engagements??state.engagements,rules);
  const changed=!engagementsEqual(next,state.engagements);
  return {status:"committed",resolution:card,events:[{payload:{type:"rules-committed",rules,resolution:card,...(changed?{engagements:next}:{}),...(extra?.sheets?.length?{sheets:extra.sheets}:{}),...(extra?.floor?{floor:extra.floor}:{})},log:[logFromCard(card,actorName(ctx.state,card.actorId),ctx.now)]}]};
}

function attackAct(ctx:HandlerContext,actor:Actor,action:ActionVm,targetIds:string[],resolutionId:string,itemId?:string):HandlerResult {
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
  const request:AttackRequest={
    id:resolutionId,actorId:actor.id,expectedRevision:state.rules.revision,sourceId:action.id,sourceKind:action.runtimeAttack.sourceKind,
    // Mapless table: a melee attack is adjacent by declaration (prone targets, reach); ranged distance stays unknown.
    target:{id:targetId,kind:"creature",relation:actor.side===target.side?"ally":"enemy",ac:actorAc(target),creatureKind:target.kind==="character"?"character":"monster",...(rangeFeet<=5?{spatialAuthority:"authoritative",distanceFeet:5,visible:true,cover:"none",targetCanSeeAttacker:true}:{spatialAuthority:"manual-unconstrained"})} as AttackRequest["target"],
    actorCreatureKind:actor.kind==="character"?"character":"monster",
    rangeFeet,attackDice,attackModifierContributions:[{source:`action:${action.id}:attack-bonus`,value:action.attackBonus??0}],requiresSight:rangeFeet<=5,
    ...(rangedInMelee.length?{rollStateContributions:[{source:`${ENGAGEMENT_RANGED_IN_MELEE_SOURCE}:${rangedInMelee.join(",")}`,state:"disadvantage" as const}]}:{}),
    baseDamage:{sourceId:action.id,damageType:spec.type,dice:base.count?[{source:action.id,sides:base.sides,count:base.count,faces:damageFaces}]:[],flat:base.flat?[{source:`${action.id}:flat`,value:base.flat}]:[]},
    riders,
    economy:state.mode==="initiative"&&economySlot(action)?{slot:economySlot(action)!,bonusActionGranted:economySlot(action)==="bonus-action"?true:undefined,actionKind:"attack",attacksPerAction:action.attacksPerAction??1}:undefined,
  };
  let commit;
  try { commit=resolveAttack(ctx.profile,state.rules,request); }
  catch(error) { return refused("action-rejected",error instanceof Error?error.message:String(error),{actorId:actor.id,actionId:action.id}); }
  if(commit.status==="rejected") return refused("action-rejected",kernelErrorKo(commit.error),{actorId:actor.id,actionId:action.id});
  const attack=commit.results[`${resolutionId}:attack`] as D20TestResult;
  const damage=Object.entries(commit.results).find(([key,value])=>key.startsWith(resolutionId)&&Boolean(value)&&typeof value==="object"&&"components" in (value as object))?.[1] as CompoundDamageResolution|undefined;
  const rules=commit.state;
  const consumed=consumeNextRoll(rules,actor.id,"attack-roll");
  const engaged=engageByMelee(state,action,actor.id,targetId);
  const thrown=action.tableThrow?throwFromHand(state,actor,action.tableThrow.itemId??itemId,ctx.nextSeq):null;
  const stateChanges=[...lifeStateChanges(state,state.rules,rules),...consumed.map((label)=>`${actor.name} 상태 종료: ${label}`),...(engaged?[engaged.line]:[]),...(thrown?.lines??[])];
  const card=attackCard({id:resolutionId,seq:ctx.nextSeq,visibility:state.rollVisibility,action,actorId:actor.id,targetIds:[targetId],targetName:target.name,attack,damage,events:commit.events,stateChanges});
  if(engaged) card.provenance.push(`engagement:melee-attack:${actor.id}<->${targetId}:round:${engagementRound(state)}`);
  return commitEvents(ctx,card,rules,engaged?.engagements,thrown??undefined);
}

function checkAct(ctx:HandlerContext,actor:Actor,action:ActionVm,targetIds:string[],resolutionId:string):HandlerResult {
  const state=ctx.state;
  const dc=action.sessionStatusEffect?.minimumRoll??0;
  const d20Id=`${resolutionId}:check`;
  const operations:ResolutionOperation[]=[];
  const economy=economyOperation(ctx,resolutionId,action); if(economy) operations.push(economy);
  const resource=resourceOperation(resolutionId,action); if(resource) operations.push(resource);
  operations.push({id:d20Id,kind:"d20",actorId:actor.id,request:{family:"ability-check",target:dc,modifierContributions:[{source:`action:${action.id}:check-bonus`,value:action.checkBonus??0}],dice:{id:`${resolutionId}:d20`,purpose:action.name,sides:20,faces:d20Faces(ctx,action.name)}}});
  for(const effect of statusEffects(ctx,resolutionId,action,targetIds)) operations.push({id:`${effect.id}:apply`,kind:"apply-effect",effect,when:{operationId:d20Id,field:"outcome",equals:"success"}});
  const committed=commitOperations(ctx,{id:resolutionId,actorId:actor.id,sourceId:action.id,operations,actionId:action.id});
  if(committed.status==="refused") return committed;
  const test=committed.commit.results[d20Id] as D20TestResult;
  const rules=committed.commit.state;
  const consumed=consumeNextRoll(rules,actor.id,"ability-check");
  const stateChanges=[...lifeStateChanges(state,state.rules,rules),...consumed.map((label)=>`${actor.name} 상태 종료: ${label}`)];
  const labels=action.sessionStatusEffect?{success:action.sessionStatusEffect.successOutcome,failure:action.sessionStatusEffect.failureOutcome??"실패"}:undefined;
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
      operations.push({id:`${resolutionId}:damage:${targetId}:fail`,kind:"damage",targetId,damageType,amount:{operationId:damageRollId,field:"total"},creatureKind,when:{operationId:saveId,field:"outcome",equals:"failure"}});
      if(action.saveHalf) operations.push({id:`${resolutionId}:damage:${targetId}:half`,kind:"damage",targetId,damageType,amount:{operationId:damageRollId,field:"total",multiplier:0.5,rounding:"floor"},creatureKind,when:{operationId:saveId,field:"outcome",equals:"success"}});
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
  const committed=commitOperations(ctx,{id:resolutionId,actorId:actor.id,sourceId:action.id,operations,actionId:action.id});
  if(committed.status==="refused") return committed;
  const rules=committed.commit.state;
  const restored=(committed.commit.results[`${resolutionId}:healing`] as {restored:number}).restored;
  const compact=`${healing.dice}${healing.flat?` + ${healing.flat}`:""} = ${amount} · ${actorName(state,targetId)} ${restored} HP 회복`;
  const card=plainCard({id:resolutionId,seq:ctx.nextSeq,visibility:state.rollVisibility,action,actorId:actor.id,targetIds:[targetId],rollKind:"healing",compact,detail:[`주사위 ${faces.join("+")||"—"} + ${parsed.flat+healing.flat} = ${amount}`],dice:faces,rollTotal:amount,events:committed.commit.events,stateChanges:lifeStateChanges(state,state.rules,rules)});
  return commitEvents(ctx,card,rules);
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

export function act(ctx:HandlerContext,command:Extract<TableCommand,{type:"act"}>):HandlerResult {
  const state=ctx.state;
  const actor=state.actors[command.actorId];
  if(!actor||!state.rules.combatants[command.actorId]) return refused("actor-unknown","테이블에 없는 액터입니다.",{actorId:command.actorId});
  const action=actionsFor(actor,state).find((entry)=>entry.id===command.actionId);
  if(!action) return refused("action-unknown","알 수 없는 행동입니다.",{actorId:actor.id,actionId:command.actionId});
  const availability=availabilityOf(state,action);
  if(!availability.available) return refused("action-unavailable",availability.reason??"지금은 사용할 수 없는 행동입니다.",{actorId:actor.id,actionId:action.id});
  const targetIds=[...new Set(command.targetIds)];
  const targetRefusal=targetRefusalFor(state,action,targetIds);
  if(targetRefusal) return refused(targetRefusal.code,targetRefusal.message,{actorId:actor.id,actionId:action.id});
  const resolutionId=`res.${ctx.nextSeq}`;
  if(action.id==="action.death-save") return deathSaveAct(ctx,actor,action,resolutionId);
  switch(action.resolutionKind) {
    case "attack": return attackAct(ctx,actor,action,targetIds,resolutionId,command.itemId);
    case "ability-check": return checkAct(ctx,actor,action,targetIds,resolutionId);
    case "saving-throw": return saveAct(ctx,actor,action,targetIds,resolutionId);
    case "healing": return healAct(ctx,actor,action,targetIds,resolutionId);
    case "no-roll":
    case "no-roll-damage": return noRollAct(ctx,actor,action,targetIds,resolutionId);
  }
}
