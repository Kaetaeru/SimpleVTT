import {
  activeConditionIds,
  conditionImmunities,
  exhaustionIsFatal,
  SRD_521_CONDITIONS,
  type ConditionId,
} from "./conditions";
import { conditionEffectsFor, requireCombatant } from "./combatState";
import { createEffect, terminateEffectsForCreatureState, type EffectInstance } from "./effects";
import { endConcentration, startConcentration } from "./concentration";
import {
  concentrationStateChange,
  effectStateChange,
  lifeFlagStateChanges,
  type RuntimeStateChange,
} from "./runtimeStateChange";
import { DomainEvaluationError, type ProvenanceRecord } from "./profileEngine";
import type { OperationExecution, ResolutionExecutionContext } from "./resolutionContext";
import { makeEvent } from "./resolutionContext";
import type { ResolutionOperation } from "./resolutionTypes";

type ApplyEffectOp = Extract<ResolutionOperation, { kind:"apply-effect" }>;
type UpdateEffectOp = Extract<ResolutionOperation, { kind:"update-effect" }>;
type RemoveEffectOp = Extract<ResolutionOperation, { kind:"remove-effect" }>;
type StartConcentrationOp = Extract<ResolutionOperation, { kind:"start-concentration" }>;
type EndConcentrationOp = Extract<ResolutionOperation, { kind:"end-concentration" }>;

const CONDITION_IMMUNITY_TAG_PREFIX = "condition-immunity:";

function taggedConditionImmunities(effects:EffectInstance[],targetId:string):ConditionId[] {
  const immunities = new Set<ConditionId>();
  for (const effect of effects) {
    if (effect.targetId !== targetId) continue;
    for (const tag of effect.tags) {
      if (!tag.startsWith(CONDITION_IMMUNITY_TAG_PREFIX)) continue;
      const conditionId = tag.slice(CONDITION_IMMUNITY_TAG_PREFIX.length) as ConditionId;
      if (conditionId in SRD_521_CONDITIONS) immunities.add(conditionId);
    }
  }
  return [...immunities];
}

function endActorConcentration(ctx: ResolutionExecutionContext, actorId:string, reason:string) {
  const current = ctx.state.concentration[actorId];
  const ended = endConcentration(current, ctx.state.effects, reason);
  ctx.state.effects = ended.effects;
  ctx.state.concentration[actorId] = ended.next;
  return { current, ended };
}

export function executeApplyEffect(ctx:ResolutionExecutionContext, operation:ApplyEffectOp):OperationExecution {
  const target = requireCombatant(ctx.state, operation.effect.targetId);
  const effect = createEffect(operation.effect, ctx.state.clock);
  if (ctx.state.effects.some((existing) => existing.id === effect.id)) {
    throw new DomainEvaluationError(`duplicate effect id: ${effect.id}`);
  }

  if (effect.conditionId) {
    const immunities = new Set([
      ...conditionImmunities(conditionEffectsFor(ctx.state, target.id)),
      ...taggedConditionImmunities(ctx.state.effects,target.id),
      ...(target.conditionImmunities ?? []),
    ]);
    if (immunities.has(effect.conditionId)) {
      const result = { applied:false, immune:true, effect };
      const provenance:ProvenanceRecord[] = [{
        source:`condition-immunity:${effect.conditionId}`,
        status:"suppressed",
        reason:`${target.id} is immune to ${effect.conditionId}`,
      }];
      return {
        result,
        event:makeEvent(ctx.pending, operation, `${effect.conditionId} suppressed by immunity`, result, provenance, [], target.id),
      };
    }
  }

  const beforeLife = structuredClone(target.life);
  ctx.state.effects.push(effect);
  const provenance:ProvenanceRecord[] = [{
    source:effect.sourceId,
    status:"applied",
    reason:`effect ${effect.id} applied to ${effect.targetId}`,
  }];
  const changes:RuntimeStateChange[] = [effectStateChange(effect.targetId, effect.id, "added", provenance, undefined, effect)];
  const activeConditions = conditionEffectsFor(ctx.state, target.id);

  if (effect.conditionId === "exhaustion" && exhaustionIsFatal(activeConditions) && !target.life.dead) {
    target.life.dead = true;
    target.life.unconscious = false;
    target.life.stable = false;
    provenance.push({
      source:"condition:exhaustion:level-6",
      status:"applied",
      reason:"Exhaustion level 6 kills the creature",
    });
    changes.push(...lifeFlagStateChanges(target.id, beforeLife, target.life, provenance));
  }

  const concentration = ctx.state.concentration[target.id];
  const incapacitated = target.life.unconscious
    || target.life.dead
    || activeConditionIds(activeConditions).includes("incapacitated");
  if (concentration && incapacitated) {
    const previous = concentration.groupId;
    const reason = target.life.dead ? "creature died" : "Incapacitated condition applied";
    const { ended } = endActorConcentration(ctx, target.id, reason);
    provenance.push(...ended.provenance);
    changes.push(concentrationStateChange(target.id, previous, undefined, ended.provenance));
    ended.expiredEffects.forEach((expired) => {
      changes.push(effectStateChange(expired.targetId, expired.id, "removed", ended.provenance, expired, undefined));
    });
  }

  if (incapacitated || target.life.dead) {
    const terminated = terminateEffectsForCreatureState(ctx.state.effects, target.id, {
      incapacitated,
      dead:target.life.dead,
    });
    ctx.state.effects = terminated.active;
    provenance.push(...terminated.provenance);
    terminated.expired.forEach((expired) => {
      changes.push(effectStateChange(expired.targetId, expired.id, "removed", terminated.provenance, expired, undefined));
    });
  }

  const result = {
    applied:true,
    immune:false,
    fatalExhaustion:target.life.dead && !beforeLife.dead && effect.conditionId === "exhaustion",
    effect,
  };
  return {
    result,
    event:makeEvent(ctx.pending, operation, `effect ${effect.id} applied`, result, provenance, changes, effect.targetId),
  };
}

export function executeUpdateEffect(ctx:ResolutionExecutionContext, operation:UpdateEffectOp):OperationExecution {
  const index = ctx.state.effects.findIndex((entry) => entry.id === operation.effectId);
  if (index < 0) throw new DomainEvaluationError(`effect not found: ${operation.effectId}`);
  const before = ctx.state.effects[index];
  const after = {
    ...before,
    metadata:{ ...(before.metadata ?? {}), ...operation.metadataPatch },
  };
  ctx.state.effects[index] = after;
  const provenance:ProvenanceRecord[] = [{
    source:before.sourceId,
    status:"applied",
    reason:`effect ${before.id} metadata updated without changing duration`,
  }];
  const result = { updated:true, beforeMetadata:before.metadata ?? {}, effect:after };
  return {
    result,
    event:makeEvent(
      ctx.pending,
      operation,
      `effect ${before.id} updated`,
      result,
      provenance,
      [effectStateChange(before.targetId,before.id,"updated",provenance,before,after)],
      before.targetId,
    ),
  };
}

export function executeRemoveEffect(ctx:ResolutionExecutionContext, operation:RemoveEffectOp):OperationExecution {
  const effect = ctx.state.effects.find((entry) => entry.id === operation.effectId);
  if (!effect) throw new DomainEvaluationError(`effect not found: ${operation.effectId}`);
  ctx.state.effects = ctx.state.effects.filter((entry) => entry.id !== operation.effectId);
  const provenance:ProvenanceRecord[] = [{ source:effect.sourceId, status:"applied", reason:`effect ${effect.id} removed` }];
  const result = { removed:true, effect };
  return {
    result,
    event:makeEvent(
      ctx.pending,
      operation,
      `effect ${effect.id} removed`,
      result,
      provenance,
      [effectStateChange(effect.targetId, effect.id, "removed", provenance, effect, undefined)],
      effect.targetId,
    ),
  };
}

export function executeStartConcentration(ctx:ResolutionExecutionContext, operation:StartConcentrationOp):OperationExecution {
  const actorId = operation.actorId ?? ctx.pending.actorId;
  const actor = requireCombatant(ctx.state, actorId);
  if (actor.life.dead || actor.life.unconscious || activeConditionIds(conditionEffectsFor(ctx.state, actorId)).includes("incapacitated")) {
    throw new DomainEvaluationError("dead or Incapacitated creatures cannot start Concentration");
  }
  const before = ctx.state.concentration[actorId];
  const resolved = startConcentration(
    before,
    { actorId, groupId:operation.groupId, sourceId:operation.sourceId },
    ctx.state.effects,
  );
  ctx.state.effects = resolved.effects;
  ctx.state.concentration[actorId] = resolved.next;
  const changes:RuntimeStateChange[] = [
    concentrationStateChange(actorId, before?.groupId, operation.groupId, resolved.provenance),
  ];
  resolved.expiredEffects.forEach((expired) => {
    changes.push(effectStateChange(expired.targetId, expired.id, "removed", resolved.provenance, expired, undefined));
  });
  return {
    result:resolved,
    event:makeEvent(ctx.pending, operation, `${actorId} concentrates on ${operation.groupId}`, resolved, resolved.provenance, changes, actorId),
  };
}

export function executeEndConcentration(ctx:ResolutionExecutionContext, operation:EndConcentrationOp):OperationExecution {
  const actorId = operation.actorId ?? ctx.pending.actorId;
  requireCombatant(ctx.state, actorId);
  const { current, ended } = endActorConcentration(ctx, actorId, operation.reason);
  const changes:RuntimeStateChange[] = current
    ? [concentrationStateChange(actorId, current.groupId, undefined, ended.provenance)]
    : [];
  ended.expiredEffects.forEach((expired) => {
    changes.push(effectStateChange(expired.targetId, expired.id, "removed", ended.provenance, expired, undefined));
  });
  return {
    result:ended,
    event:makeEvent(ctx.pending, operation, `${actorId} concentration ended`, ended, ended.provenance, changes, actorId),
  };
}
