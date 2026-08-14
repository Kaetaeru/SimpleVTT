import { resolveDamage, resolveHealing } from "./damage";
import { type D20TestResult } from "./d20";
import { resolveZeroHpAfterDamage } from "./life";
import { applyHealingToLife } from "./lifeTransitions";
import { conditionD20Adjustments, conditionDamageDefenses } from "./conditions";
import { conditionEffectsFor, requireCombatant } from "./combatState";
import { concentrationBreakReason, endConcentration, resolveConcentrationDamageCheck } from "./concentration";
import { resolveTemporaryHpGain } from "./temporaryHp";
import { hpStateChanges } from "./stateChange";
import {
  concentrationStateChange,
  effectStateChange,
  lifeFlagStateChanges,
  type RuntimeStateChange,
} from "./runtimeStateChange";
import { DomainEvaluationError } from "./profileEngine";
import type { OperationExecution, ResolutionExecutionContext } from "./resolutionContext";
import { makeEvent, valueFromResult } from "./resolutionContext";
import type { ResolutionOperation } from "./resolutionTypes";

type DamageOp = Extract<ResolutionOperation, { kind:"damage" }>;
type HealingOp = Extract<ResolutionOperation, { kind:"healing" }>;
type TemporaryHpOp = Extract<ResolutionOperation, { kind:"temporary-hp" }>;

function endActorConcentration(ctx: ResolutionExecutionContext, actorId: string, reason: string) {
  const current = ctx.state.concentration[actorId];
  const ended = endConcentration(current, ctx.state.effects, reason);
  ctx.state.effects = ended.effects;
  ctx.state.concentration[actorId] = ended.next;
  return { current, ended };
}

export function executeDamage(ctx: ResolutionExecutionContext, operation: DamageOp): OperationExecution {
  const target = requireCombatant(ctx.state, operation.targetId);
  const beforeLife = structuredClone(target.life);
  const beforeHp = { ...beforeLife.hp };
  const amount = valueFromResult(ctx.results, operation.amount);
  const defenses = [
    ...(target.damageDefenses ?? []),
    ...conditionDamageDefenses(conditionEffectsFor(ctx.state, operation.targetId)),
    ...(operation.defenses ?? []),
  ];
  const damage = resolveDamage({ damageType:operation.damageType, amount, hp:beforeHp, defenses });
  const critical = operation.criticalFrom
    ? Boolean((ctx.results.get(operation.criticalFrom) as D20TestResult | undefined)?.critical)
    : false;
  const life = resolveZeroHpAfterDamage({
    creatureKind:operation.creatureKind,
    before:target.life,
    damage,
    critical,
  });
  target.life = life.next;

  const provenance = [...damage.provenance, ...life.provenance];
  const changes: RuntimeStateChange[] = [
    ...hpStateChanges(operation.targetId, beforeHp, target.life.hp, provenance),
    ...lifeFlagStateChanges(operation.targetId, beforeLife, target.life, provenance),
  ];
  const currentConcentration = ctx.state.concentration[operation.targetId];

  if (currentConcentration) {
    const immediateBreak = concentrationBreakReason({
      incapacitated:target.life.unconscious,
      dead:target.life.dead,
    });
    if (immediateBreak) {
      const previous = currentConcentration.groupId;
      const { ended } = endActorConcentration(ctx, operation.targetId, immediateBreak);
      provenance.push(...ended.provenance);
      changes.push(concentrationStateChange(operation.targetId, previous, undefined, ended.provenance));
      ended.expiredEffects.forEach((effect) => {
        changes.push(effectStateChange(effect.targetId, effect.id, "removed", ended.provenance));
      });
    } else if (damage.finalDamage > 0) {
      if (!operation.concentrationCheck) {
        throw new DomainEvaluationError(
          "damage to a concentrating creature requires fixed concentration-check input",
        );
      }
      const conditionAdjustments = conditionD20Adjustments({
        actorId:operation.targetId,
        family:"saving-throw",
        ability:"con",
        actorConditions:conditionEffectsFor(ctx.state, operation.targetId),
      });
      const check = resolveConcentrationDamageCheck(ctx.profile, {
        ...operation.concentrationCheck,
        damage:damage.finalDamage,
        modifierContributions:[
          ...(operation.concentrationCheck.modifierContributions ?? []),
          ...conditionAdjustments.modifierContributions,
        ],
        rollStateContributions:[
          ...(operation.concentrationCheck.rollStateContributions ?? []),
          ...conditionAdjustments.rollStateContributions,
        ],
      });
      provenance.push(...check.provenance);
      if (!check.maintained) {
        const previous = currentConcentration.groupId;
        const { ended } = endActorConcentration(ctx, operation.targetId, "failed damage concentration save");
        provenance.push(...ended.provenance);
        changes.push(concentrationStateChange(operation.targetId, previous, undefined, ended.provenance));
        ended.expiredEffects.forEach((effect) => {
          changes.push(effectStateChange(effect.targetId, effect.id, "removed", ended.provenance));
        });
      }
    }
  }

  return {
    result:damage,
    event:makeEvent(
      ctx.pending,
      operation,
      `${operation.targetId} takes ${damage.finalDamage} ${operation.damageType} damage`,
      damage,
      provenance,
      changes,
      operation.targetId,
    ),
  };
}

export function executeHealing(ctx: ResolutionExecutionContext, operation: HealingOp): OperationExecution {
  const target = requireCombatant(ctx.state, operation.targetId);
  const beforeLife = structuredClone(target.life);
  const beforeHp = { ...beforeLife.hp };
  const healing = resolveHealing(beforeHp, valueFromResult(ctx.results, operation.amount));
  const transition = applyHealingToLife(target.life, healing);
  target.life = transition.next;
  const changes:RuntimeStateChange[] = [
    ...hpStateChanges(operation.targetId, beforeHp, target.life.hp, transition.provenance),
    ...lifeFlagStateChanges(operation.targetId, beforeLife, target.life, transition.provenance),
  ];
  return {
    result:healing,
    event:makeEvent(
      ctx.pending,
      operation,
      `${operation.targetId} regains ${healing.restored} HP`,
      healing,
      transition.provenance,
      changes,
      operation.targetId,
    ),
  };
}

export function executeTemporaryHp(ctx: ResolutionExecutionContext, operation: TemporaryHpOp): OperationExecution {
  const target = requireCombatant(ctx.state, operation.targetId);
  const beforeHp = { ...target.life.hp };
  const resolved = resolveTemporaryHpGain({
    hp:beforeHp,
    amount:operation.amount,
    source:operation.source,
    choice:operation.choice,
  });
  target.life.hp = resolved.nextHp;
  const changes = hpStateChanges(operation.targetId, beforeHp, target.life.hp, resolved.provenance);
  return {
    result:resolved,
    event:makeEvent(
      ctx.pending,
      operation,
      `${operation.targetId} Temporary HP ${resolved.nextHp.temporary}`,
      resolved,
      resolved.provenance,
      changes,
      operation.targetId,
    ),
  };
}
