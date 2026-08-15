import type { ActionVm, DamageComponentView, EconomyVm, SceneEntity } from "./contracts";
import type { Phase09AttackFact, Phase09TargetingFact } from "./phase09ReferenceRulesFacts";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { resolveAttack } from "../domain/attack";
import type { RulesRuntimeState } from "../domain/combatState";
import type { D20TestResult } from "../domain/d20";
import type { CompoundDamageResolution, DamageDefenseContribution } from "../domain/damage";
import type { DamageRollResolution } from "../domain/damageRoll";
import type { ResolutionEvent } from "../domain/resolutionTypes";

export interface AtomicAttackPreviewExpectation {
  total:number;
  outcome:"명중"|"빗나감";
  critical:boolean;
}

export interface AtomicAttackTransactionRequest {
  resolutionId:string;
  action:ActionVm;
  actor:SceneEntity;
  target:SceneEntity;
  actorEconomy:EconomyVm;
  targetEconomy:EconomyVm;
  initiativeMode:boolean;
  attackD20Face:number;
  effectiveTargetAc:number;
  attackFact:Phase09AttackFact;
  targetingFact:Phase09TargetingFact;
  expectedPreview?:AtomicAttackPreviewExpectation;
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
      stateChanges:string[];
      provenance:string[];
      events:ResolutionEvent[];
      eventCount:number;
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

function runtimeCombatant(entity:SceneEntity,economy:EconomyVm) {
  return {
    id:entity.id,
    baseSpeed:economy.movementMax,
    life:{
      hp:{ current:entity.hp, maximum:entity.maxHp, temporary:entity.tempHp },
      deathSaves:{ successes:0, failures:0 },
      stable:false,
      unconscious:false,
      dead:false,
    },
    economy:{
      action:economy.action,
      bonusAction:economy.bonusAction,
      reaction:economy.reaction,
      movement:economy.movement,
      movementMaximum:economy.movementMax,
      extraActions:[],
    },
    resources:[],
    hitDice:[],
    damageDefenses:defensesFor(entity),
  };
}

function runtimeState(request:AtomicAttackTransactionRequest):RulesRuntimeState {
  return {
    revision:0,
    clock:{ round:1, elapsedSeconds:0, activeActorId:request.initiativeMode ? request.actor.id : undefined },
    combatants:{
      [request.actor.id]:runtimeCombatant(request.actor,request.actorEconomy),
      [request.target.id]:runtimeCombatant(request.target,request.targetEconomy),
    },
    effects:[],
    concentration:{},
    history:[],
  };
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
  };
}

export function resolveAtomicAttackTransaction(request:AtomicAttackTransactionRequest):AtomicAttackTransactionResult {
  const damageSpec = request.action.damage?.[0];
  if (request.action.resolutionKind !== "attack" || !damageSpec) {
    return { status:"rejected", error:`atomic attack requires one attack damage component: ${request.action.id}` };
  }
  const input = runtimeState(request);
  const transaction = resolveAttack(SIMPLEVTT_APP_RULES_PROFILE,input,{
    id:request.resolutionId,
    actorId:request.actor.id,
    expectedRevision:input.revision,
    sourceId:request.action.id,
    sourceKind:request.attackFact.sourceKind,
    target:{
      id:request.target.id,
      kind:"creature",
      relation:attackRelation(request.actor,request.target),
      distanceFeet:request.targetingFact.distanceFeet,
      visible:request.targetingFact.visible,
      cover:request.targetingFact.cover,
      ac:request.effectiveTargetAc,
      creatureKind:request.target.kind === "character" ? "character" : "monster",
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
    economy:economyCost(request.action,request.initiativeMode),
  });
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
  const actorEconomy = projectEconomy(transaction.state,request.actor.id);
  const stateChanges:string[] = [];
  if (request.actorEconomy.action && !actorEconomy.action) stateChanges.push("행동 사용");
  if (request.actorEconomy.bonusAction && !actorEconomy.bonusAction) stateChanges.push("추가 행동 사용");
  if (request.actorEconomy.reaction && !actorEconomy.reaction) stateChanges.push("반응 사용");
  if (request.target.tempHp !== targetAfter.temporary) stateChanges.push(`${request.target.name} 임시 HP ${request.target.tempHp} → ${targetAfter.temporary}`);
  if (request.target.hp !== targetAfter.current) stateChanges.push(`${request.target.name} HP ${request.target.hp} → ${targetAfter.current}`);

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
  return {
    status:"committed",
    attack,
    damage,
    damageFaces:damageRoll?.dice.flatMap((entry) => entry.selectedFaces) ?? [],
    damageComponent,
    actorEconomy,
    targetHp:targetAfter.current,
    targetTempHp:targetAfter.temporary,
    stateChanges,
    provenance:events.flatMap((event) => event.provenance.map((entry) => `${entry.source} · ${entry.status} · ${entry.reason}`)),
    events,
    eventCount:events.length,
  };
}
