import "./lifeRuntimeContracts";
import type { ActionVm, DamageComponentView, EconomyVm, SceneEntity } from "./contracts";
import type { RuntimeLifeVm } from "./lifeRuntimeContracts";
import type { Phase09AttackFact, Phase09TargetingFact } from "./phase09ReferenceRulesFacts";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { recordCommittedResolutionEvents } from "./resolutionEventCommitRegistry";
import { compileAttack, resolveAttack } from "../domain/attack";
import { cloneRuntimeState, type RulesRuntimeState } from "../domain/combatState";
import type { ConcentrationCheckRequest } from "../domain/concentration";
import type { D20TestResult } from "../domain/d20";
import type { CompoundDamageResolution, DamageDefenseContribution } from "../domain/damage";
import type { DamageRollResolution } from "../domain/damageRoll";
import { resolvePendingResolution } from "../domain/resolution";
import type { ResolutionEvent, ResolutionOperation } from "../domain/resolutionTypes";

export interface AtomicAttackPreviewExpectation {
  total:number;
  outcome:"명중"|"빗나감";
  critical:boolean;
}

export interface AtomicReactionAttackContext {
  trigger:string;
  optionId:string;
  source:string;
}

export interface AtomicAttackTransactionRequest {
  resolutionId:string;
  action:ActionVm;
  actor:SceneEntity;
  target:SceneEntity;
  actorEconomy:EconomyVm;
  targetEconomy:EconomyVm;
  initiativeMode:boolean;
  activeTurnActorId?:string;
  reaction?:AtomicReactionAttackContext;
  attackD20Face:number;
  effectiveTargetAc:number;
  attackFact:Phase09AttackFact;
  targetingFact:Phase09TargetingFact & { provenance?:string[] };
  expectedPreview?:AtomicAttackPreviewExpectation;
  runtimeState?:RulesRuntimeState;
  concentrationCheck?:Omit<ConcentrationCheckRequest,"damage">;
}

export type AtomicAttackTransactionResult =
  | {
      status:"committed";
      attack:D20TestResult;
      damage?:CompoundDamageResolution;
      damageFaces:number[];
      damageComponent?:DamageComponentView;
      actorEconomy:EconomyVm;
      targetHp:number;
      targetTempHp:number;
      targetLife:RuntimeLifeVm;
      stateChanges:string[];
      provenance:string[];
      events:ResolutionEvent[];
      eventCount:number;
      runtimeState?:RulesRuntimeState;
      runtimeInputRevision?:number;
    }
  | {
      status:"rejected";
      error:string;
    };

function defensesFor(target:SceneEntity):DamageDefenseContribution[] {
  return [
    ...target.resistances.map((damageType) => ({ source:`scene:${target.id}:resistance:${damageType}`, kind:"resistance" as const, damageType })),
    ...target.vulnerabilities.map((damageType) => ({ source:`scene:${target.id}:vulnerability:${damageType}`, kind:"vulnerability" as const, damageType })),
    ...target.immunities.map((damageType) => ({ source:`scene:${target.id}:immunity:${damageType}`, kind:"immunity" as const, damageType })),
  ];
}

function runtimeLife(entity:SceneEntity) {
  const life=entity.runtimeLife;
  return {
    hp:{ current:entity.hp, maximum:entity.maxHp, temporary:entity.tempHp },
    deathSaves:{ successes:life?.deathSaves.successes ?? 0, failures:life?.deathSaves.failures ?? 0 },
    stable:life?.stable ?? false,
    unconscious:life?.unconscious ?? false,
    dead:life?.dead ?? false,
  };
}

function runtimeCombatant(entity:SceneEntity,economy:EconomyVm) {
  return {
    id:entity.id,
    baseSpeed:economy.movementMax,
    life:runtimeLife(entity),
    economy:{
      action:economy.action,
      bonusAction:economy.bonusAction,
      reaction:economy.reaction,
      movement:economy.movement,
      movementMaximum:economy.movementMax,
      extraActions:structuredClone(economy.extraActions ?? []),
      extraAttacks:structuredClone(economy.extraAttacks ?? []),
    },
    resources:[],
    hitDice:[],
    damageDefenses:defensesFor(entity),
  };
}

function isolatedRuntimeState(request:AtomicAttackTransactionRequest):RulesRuntimeState {
  return {
    revision:0,
    clock:{
      round:1,
      elapsedSeconds:0,
      activeActorId:request.initiativeMode ? (request.activeTurnActorId ?? request.actor.id) : undefined,
    },
    combatants:{
      [request.actor.id]:runtimeCombatant(request.actor,request.actorEconomy),
      [request.target.id]:runtimeCombatant(request.target,request.targetEconomy),
    },
    effects:[],
    concentration:{},
    history:[],
  };
}

function transactionInput(request:AtomicAttackTransactionRequest) {
  if (!request.runtimeState) return isolatedRuntimeState(request);
  const input=cloneRuntimeState(request.runtimeState);
  if (!input.combatants[request.actor.id]) throw new Error(`runtime attack actor is missing from authoritative runtime: ${request.actor.id}`);
  if (!input.combatants[request.target.id]) throw new Error(`runtime attack target is missing from authoritative runtime: ${request.target.id}`);
  return input;
}

function economyCost(action:ActionVm,initiativeMode:boolean) {
  if (!initiativeMode || action.economy === "없음") return undefined;
  return {
    slot:action.economy === "행동" ? "action" as const
      : action.economy === "추가 행동" ? "bonus-action" as const
        : "reaction" as const,
    bonusActionGranted:action.economy === "추가 행동" ? true : undefined,
  };
}

function attackRelation(actor:SceneEntity,target:SceneEntity) {
  return actor.side === target.side ? "ally" as const : "enemy" as const;
}

function componentAdjustment(target:SceneEntity,damageType:string,raw:number,finalDamage:number) {
  if (target.immunities.includes(damageType)) return `${damageType} 면역 ${raw} → ${finalDamage}`;
  const resistance = target.resistances.includes(damageType);
  const vulnerability = target.vulnerabilities.includes(damageType);
  if (resistance && vulnerability) return `${damageType} 저항/취약 ${raw} → ${finalDamage}`;
  if (resistance) return `${damageType} 저항 ${raw} → ${finalDamage}`;
  if (vulnerability) return `${damageType} 취약 ${raw} → ${finalDamage}`;
  if (raw!==finalDamage) return `런타임 효과 조정 ${raw} → ${finalDamage}`;
  return "조정 없음";
}

function projectEconomy(state:RulesRuntimeState,actorId:string):EconomyVm {
  const economy = state.combatants[actorId].economy;
  return {
    action:economy.action,
    bonusAction:economy.bonusAction,
    reaction:economy.reaction,
    movement:economy.movement,
    movementMax:economy.movementMaximum,
    ...(economy.extraActions?.length?{extraActions:structuredClone(economy.extraActions)}:{}),
    ...(economy.extraAttacks?.length?{extraAttacks:structuredClone(economy.extraAttacks)}:{}),
  };
}

function projectLife(state:RulesRuntimeState,targetId:string):RuntimeLifeVm {
  const life=state.combatants[targetId].life;
  return {
    deathSaves:{ ...life.deathSaves },
    stable:life.stable,
    unconscious:life.unconscious,
    dead:life.dead,
  };
}

function attackRequest(request:AtomicAttackTransactionRequest,input:RulesRuntimeState) {
  const damageSpec=request.action.damage![0];
  const cost=economyCost(request.action,request.initiativeMode);
  return {
    id:request.resolutionId,
    actorId:request.actor.id,
    expectedRevision:input.revision,
    sourceId:request.action.id,
    sourceKind:request.attackFact.sourceKind,
    target:{
      id:request.target.id,
      kind:"creature" as const,
      relation:attackRelation(request.actor,request.target),
      distanceFeet:request.targetingFact.distanceFeet,
      visible:request.targetingFact.visible,
      cover:request.targetingFact.cover,
      ac:request.effectiveTargetAc,
      creatureKind:request.target.kind === "character" ? "character" as const : "monster" as const,
      targetCanSeeAttacker:request.targetingFact.targetCanSeeAttacker,
    },
    rangeFeet:request.attackFact.rangeFeet,
    attackDice:{
      id:`${request.resolutionId}:attack-d20`,
      purpose:request.action.name,
      sides:20,
      faces:[request.attackD20Face],
    },
    attackModifierContributions:[{
      source:`action:${request.action.id}:attack-bonus`,
      value:request.action.attackBonus ?? 0,
    }],
    requiresSight:true,
    baseDamage:{
      sourceId:request.action.id,
      damageType:damageSpec.type,
      dice:request.attackFact.damageDice,
      flat:request.attackFact.flatDamage,
    },
    economy:request.reaction||!cost ? undefined : {
      ...cost,
      ...(request.action.economy==="행동"?{actionKind:"attack" as const,attacksPerAction:request.action.attacksPerAction??1}:{}),
    },
    concentrationCheck:request.concentrationCheck,
  };
}

function resolveAttackTransaction(request:AtomicAttackTransactionRequest,input:RulesRuntimeState) {
  const compiledRequest=attackRequest(request,input);
  if (!request.reaction) return resolveAttack(SIMPLEVTT_APP_RULES_PROFILE,input,compiledRequest);

  const compiled=compileAttack(compiledRequest);
  const [targeting,...rest]=compiled.operations;
  const reaction:ResolutionOperation={
    id:`${request.resolutionId}:reaction`,
    kind:"reaction",
    reactorId:request.actor.id,
    trigger:request.reaction.trigger,
    options:[{
      id:request.reaction.optionId,
      actorId:request.actor.id,
      trigger:request.reaction.trigger,
      source:request.reaction.source,
    }],
    optionId:request.reaction.optionId,
  };
  return resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,input,{
    ...compiled,
    operations:[targeting,reaction,...rest],
  });
}

function retainTargetingFactProvenance(events:ResolutionEvent[],request:AtomicAttackTransactionRequest) {
  const provenance=request.targetingFact.provenance ?? [];
  if (!provenance.length) return;
  const targeting=events.find((event)=>event.kind==="targeting");
  if (!targeting) return;
  targeting.provenance.push(...provenance.map((source)=>({
    source,
    status:"applied" as const,
    reason:"authoritative runtime targeting fact",
  })));
}

function retainStagedAtomicEvents(request:AtomicAttackTransactionRequest,events:ResolutionEvent[]) {
  const suffix=":atomic";
  if (!request.resolutionId.endsWith(suffix)) return;
  const parentResolutionId=request.resolutionId.slice(0,-suffix.length);
  if (!parentResolutionId) return;
  recordCommittedResolutionEvents(parentResolutionId,events);
}

export function resolveAtomicAttackTransaction(request:AtomicAttackTransactionRequest):AtomicAttackTransactionResult {
  const damageSpec = request.action.damage?.[0];
  if (request.action.resolutionKind !== "attack" || !damageSpec) {
    return { status:"rejected", error:`atomic attack requires one attack damage component: ${request.action.id}` };
  }
  let input:RulesRuntimeState;
  try {
    input=transactionInput(request);
  } catch(error) {
    return { status:"rejected",error:error instanceof Error ? error.message : String(error) };
  }
  const runtimeInputRevision=request.runtimeState ? input.revision : undefined;
  const transaction = resolveAttackTransaction(request,input);
  if (transaction.status === "rejected") return { status:"rejected", error:transaction.error };

  const attack = transaction.results[`${request.resolutionId}:attack`] as D20TestResult;
  const expected = request.expectedPreview;
  if (expected) {
    const outcome = attack.outcome === "success" ? "명중" : "빗나감";
    if (attack.total !== expected.total || outcome !== expected.outcome || attack.critical !== expected.critical) {
      return {
        status:"rejected",
        error:`attack preview drift: preview ${expected.total}/${expected.outcome}/${expected.critical} vs domain ${attack.total}/${outcome}/${attack.critical}`,
      };
    }
  }

  const damageResult = transaction.results[`${request.resolutionId}:damage`] as CompoundDamageResolution|{ skipped:true };
  const rollResult = transaction.results[`${request.resolutionId}:damage-roll:0`] as DamageRollResolution|{ skipped:true };
  const damage = "skipped" in damageResult ? undefined : damageResult;
  const damageRoll = "skipped" in rollResult ? undefined : rollResult;
  const targetAfter = transaction.state.combatants[request.target.id].life.hp;
  const targetLife=projectLife(transaction.state,request.target.id);
  const actorEconomy = projectEconomy(transaction.state,request.actor.id);
  const stateChanges:string[] = [];
  if (request.actorEconomy.action && !actorEconomy.action) stateChanges.push("행동 사용");
  if (request.actorEconomy.bonusAction && !actorEconomy.bonusAction) stateChanges.push("추가 행동 사용");
  if (request.actorEconomy.reaction && !actorEconomy.reaction) stateChanges.push("반응 사용");
  if (request.target.tempHp !== targetAfter.temporary) stateChanges.push(`${request.target.name} 임시 HP ${request.target.tempHp} → ${targetAfter.temporary}`);
  if (request.target.hp !== targetAfter.current) stateChanges.push(`${request.target.name} HP ${request.target.hp} → ${targetAfter.current}`);
  const beforeLife=request.target.runtimeLife;
  if ((beforeLife?.stable ?? false)!==targetLife.stable) stateChanges.push(`${request.target.name} stable ${beforeLife?.stable ?? false} → ${targetLife.stable}`);
  if ((beforeLife?.unconscious ?? false)!==targetLife.unconscious) stateChanges.push(`${request.target.name} unconscious ${beforeLife?.unconscious ?? false} → ${targetLife.unconscious}`);
  if ((beforeLife?.dead ?? false)!==targetLife.dead) stateChanges.push(`${request.target.name} dead ${beforeLife?.dead ?? false} → ${targetLife.dead}`);

  const component = damage?.components[0];
  const damageComponent = component ? {
    type:component.damageType,
    roll:damageRoll?.dice.flatMap((entry) => entry.selectedFaces).join(" + ") ?? String(component.raw),
    raw:component.raw,
    adjusted:component.finalDamage,
    adjustment:componentAdjustment(request.target,component.damageType,component.raw,component.finalDamage),
    source:"Rules Domain · atomic resolveAttack transaction",
  } satisfies DamageComponentView : undefined;

  const events = transaction.events.map((event) => structuredClone(event));
  retainTargetingFactProvenance(events,request);
  retainStagedAtomicEvents(request,events);
  return {
    status:"committed",
    attack,
    damage,
    damageFaces:damageRoll?.dice.flatMap((entry) => entry.selectedFaces) ?? [],
    damageComponent,
    actorEconomy,
    targetHp:targetAfter.current,
    targetTempHp:targetAfter.temporary,
    targetLife,
    stateChanges,
    provenance:events.flatMap((event) => event.provenance.map((entry) => `${entry.source} · ${entry.status} · ${entry.reason}`)),
    events,
    eventCount:events.length,
    runtimeState:request.runtimeState ? cloneRuntimeState(transaction.state) : undefined,
    runtimeInputRevision,
  };
}
