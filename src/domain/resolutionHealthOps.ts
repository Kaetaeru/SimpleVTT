import { resolveCompoundDamage, resolveDamage, resolveHealing, type DamageDefenseContribution, type DamageResolution } from "./damage";
import { type D20TestResult } from "./d20";
import { resolveZeroHpAfterDamage, type LifeState } from "./life";
import { applyHealingToLife } from "./lifeTransitions";
import { activeConditionIds, conditionD20Adjustments, conditionDamageDefenses } from "./conditions";
import { conditionEffectsFor, requireCombatant } from "./combatState";
import { concentrationBreakReason, endConcentration, resolveConcentrationDamageCheck } from "./concentration";
import { terminateEffectsForCreatureState, terminateEffectsForDamage } from "./effects";
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
type CompoundDamageOp = Extract<ResolutionOperation, { kind:"compound-damage" }>;
type HealingOp = Extract<ResolutionOperation, { kind:"healing" }>;
type TemporaryHpOp = Extract<ResolutionOperation, { kind:"temporary-hp" }>;
type DamageLifecycleOp = DamageOp | CompoundDamageOp;

function effectDamageDefenses(ctx:ResolutionExecutionContext,targetId:string):DamageDefenseContribution[] {
  const defenses:DamageDefenseContribution[] = [];
  for (const effect of ctx.state.effects.filter((entry) => entry.targetId === targetId)) {
    for (const tag of effect.tags) {
      const match = /^(damage-resistance|damage-vulnerability|damage-immunity):(.+)$/.exec(tag);
      if (!match) continue;
      const kind = match[1] === "damage-resistance"
        ? "resistance"
        : match[1] === "damage-vulnerability"
          ? "vulnerability"
          : "immunity";
      defenses.push({ source:effect.sourceId, kind, damageType:match[2] });
    }
  }
  return defenses;
}

function endActorConcentration(ctx: ResolutionExecutionContext, actorId: string, reason: string) {
  const current = ctx.state.concentration[actorId];
  const ended = endConcentration(current, ctx.state.effects, reason);
  ctx.state.effects = ended.effects;
  ctx.state.concentration[actorId] = ended.next;
  return { current, ended };
}

function appendExpiredEffects(
  changes: RuntimeStateChange[],
  expired: ReturnType<typeof terminateEffectsForDamage>,
) {
  for (const effect of expired.expired) {
    changes.push(effectStateChange(effect.targetId, effect.id, "removed", expired.provenance, effect, undefined));
  }
}

function finalizeDamage(
  ctx: ResolutionExecutionContext,
  operation: DamageLifecycleOp,
  beforeLife: LifeState,
  damage: DamageResolution,
  summary: string,
): OperationExecution {
  const target = requireCombatant(ctx.state, operation.targetId);
  const beforeHp = { ...beforeLife.hp };
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
        changes.push(effectStateChange(effect.targetId, effect.id, "removed", ended.provenance, effect, undefined));
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
          changes.push(effectStateChange(effect.targetId, effect.id, "removed", ended.provenance, effect, undefined));
        });
      }
    }
  }

  if (damage.finalDamage > 0) {
    const terminated = terminateEffectsForDamage(ctx.state.effects, operation.targetId);
    ctx.state.effects = terminated.active;
    provenance.push(...terminated.provenance);
    appendExpiredEffects(changes, terminated);
  }

  const incapacitated = target.life.unconscious
    || target.life.dead
    || activeConditionIds(conditionEffectsFor(ctx.state, operation.targetId)).includes("incapacitated");
  if (incapacitated || target.life.dead) {
    const terminated = terminateEffectsForCreatureState(ctx.state.effects, operation.targetId, {
      incapacitated,
      dead:target.life.dead,
    });
    ctx.state.effects = terminated.active;
    provenance.push(...terminated.provenance);
    appendExpiredEffects(changes, terminated);
  }

  return {
    result:damage,
    event:makeEvent(
      ctx.pending,
      operation,
      summary,
      damage,
      provenance,
      changes,
      operation.targetId,
    ),
  };
}

export function executeDamage(ctx: ResolutionExecutionContext, operation: DamageOp): OperationExecution {
  const target = requireCombatant(ctx.state, operation.targetId);
  const beforeLife = structuredClone(target.life);
  const beforeHp = { ...beforeLife.hp };
  const amount = valueFromResult(ctx.results, operation.amount);
  const defenses = [
    ...(target.damageDefenses ?? []),
    ...conditionDamageDefenses(conditionEffectsFor(ctx.state, operation.targetId)),
    ...effectDamageDefenses(ctx,operation.targetId),
    ...(operation.defenses ?? []),
  ];
  const damage = resolveDamage({ damageType:operation.damageType, amount, hp:beforeHp, defenses });
  return finalizeDamage(
    ctx,
    operation,
    beforeLife,
    damage,
    `${operation.targetId} takes ${damage.finalDamage} ${operation.damageType} damage`,
  );
}

export function executeCompoundDamage(ctx: ResolutionExecutionContext, operation: CompoundDamageOp): OperationExecution {
  const target = requireCombatant(ctx.state, operation.targetId);
  const beforeLife = structuredClone(target.life);
  const beforeHp = { ...beforeLife.hp };
  const commonDefenses = [
    ...(target.damageDefenses ?? []),
    ...conditionDamageDefenses(conditionEffectsFor(ctx.state, operation.targetId)),
    ...effectDamageDefenses(ctx,operation.targetId),
  ];
  const damage = resolveCompoundDamage({
    hp:beforeHp,
    components:operation.components.map((component) => ({
      damageType:component.damageType,
      amount:valueFromResult(ctx.results, component.amount),
      defenses:[...commonDefenses, ...(component.defenses ?? [])],
    })),
  });
  const detail = damage.components
    .map((component) => `${component.finalDamage} ${component.damageType}`)
    .join(" + ");
  return finalizeDamage(
    ctx,
    operation,
    beforeLife,
    damage,
    `${operation.targetId} takes ${damage.finalDamage} compound damage (${detail})`,
  );
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
