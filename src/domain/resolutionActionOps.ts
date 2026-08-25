import { resolveD20Test, type D20TestResult } from "./d20";
import { resolveDamageRoll } from "./damageRoll";
import {
  conditionActionAvailability,
  conditionD20Adjustments,
  conditionTargetingRestriction,
  frightenedMovementRestriction,
} from "./conditions";
import { effectStateChange } from "./runtimeStateChange";
import { conditionEffectsFor, requireCombatant, type RulesRuntimeState } from "./combatState";
import { selectEffectTurnActivity } from "./effects";
import { findResource, spendResource } from "./resources";
import { openReactorWindow, resolveReactionChoice } from "./reaction";
import { resolveTargeting } from "./targeting";
import { economyStateChanges } from "./stateChange";
import { resourceStateChange } from "./runtimeStateChange";
import { grantExtraAction, grantExtraAttacks, spendExtraAttack, spendTurnSlot, useMovement } from "./turnEconomy";
import { DomainEvaluationError, type ProvenanceRecord } from "./profileEngine";
import type { OperationExecution, ResolutionExecutionContext } from "./resolutionContext";
import { makeEvent, targetingResult } from "./resolutionContext";
import type { ResolutionOperation } from "./resolutionTypes";

type TargetingOp = Extract<ResolutionOperation, { kind:"targeting" }>;
type EconomyOp = Extract<ResolutionOperation, { kind:"use-economy" }>;
type ExtraActionOp = Extract<ResolutionOperation, { kind:"grant-extra-action" }>;
type TurnFeatureOp = Extract<ResolutionOperation, { kind:"use-turn-feature" }>;
type MoveOp = Extract<ResolutionOperation, { kind:"move" }>;
type ResourceOp = Extract<ResolutionOperation, { kind:"spend-resource" }>;
type D20Op = Extract<ResolutionOperation, { kind:"d20" }>;
type DamageRollOp = Extract<ResolutionOperation, { kind:"damage-roll" }>;
type ReactionOp = Extract<ResolutionOperation, { kind:"reaction" }>;

const TEMPORARILY_UNAVAILABLE_TARGET_TAG = "runtime:temporarily-unavailable-target";

function temporarilyUnavailable(state:RulesRuntimeState,actorId:string) {
  return state.effects.some((effect) => effect.targetId === actorId && effect.tags.includes(TEMPORARILY_UNAVAILABLE_TARGET_TAG));
}

function requireAvailableInScene(state:RulesRuntimeState,actorId:string,label:string) {
  if (temporarilyUnavailable(state,actorId)) {
    throw new DomainEvaluationError(`${label} is temporarily unavailable in the current scene: ${actorId}`);
  }
}

export function executeTargeting(ctx: ResolutionExecutionContext, operation: TargetingOp): OperationExecution {
  const sourceId = operation.sourceId ?? ctx.pending.actorId;
  requireAvailableInScene(ctx.state,sourceId,"targeting source");
  const unavailableTarget = operation.targets.find((target) => temporarilyUnavailable(ctx.state,target.id));
  if (unavailableTarget) throw new DomainEvaluationError(`target is temporarily unavailable in the current scene: ${unavailableTarget.id}`);
  const restriction = operation.harmful
    ? operation.targets
        .map((target) => conditionTargetingRestriction(conditionEffectsFor(ctx.state, sourceId), target.id, true))
        .find(Boolean)
    : undefined;
  if (restriction) throw new DomainEvaluationError(restriction);
  const result = resolveTargeting(sourceId, operation.rule, operation.targets);
  if (!result.valid) {
    const reason = result.rejected.flatMap((entry) => entry.reasons).join("; ") || "invalid target selection";
    throw new DomainEvaluationError(reason);
  }
  return {
    result,
    event:makeEvent(ctx.pending, operation, `validated ${result.targets.length} target(s)`, result, result.provenance, []),
  };
}

export function executeEconomy(ctx: ResolutionExecutionContext, operation: EconomyOp): OperationExecution {
  const actorId = operation.actorId ?? ctx.pending.actorId;
  requireAvailableInScene(ctx.state,actorId,"economy actor");
  const actor = requireCombatant(ctx.state, actorId);
  const before = actor.economy;
  const availability = conditionActionAvailability(conditionEffectsFor(ctx.state, actorId));
  if (operation.slot === "action" && !availability.action) throw new DomainEvaluationError("action blocked by condition");
  if (operation.slot === "bonus-action" && !availability.bonusAction) throw new DomainEvaluationError("bonus action blocked by condition");
  if (operation.slot === "reaction" && !availability.reaction) throw new DomainEvaluationError("reaction blocked by condition");

  let restrictionProvenance: ProvenanceRecord[] = [];
  if (ctx.state.clock.activeActorId === actorId && (operation.slot === "action" || operation.slot === "bonus-action")) {
    const selected = selectEffectTurnActivity(
      ctx.state.effects,
      actorId,
      operation.slot === "action" ? "action" : "bonus-action",
    );
    ctx.state.effects = selected.effects;
    restrictionProvenance = selected.provenance;
  }

  const actionKind = operation.actionKind
    ?? (ctx.pending.sourceId.startsWith("dnd.srd521.spell.") ? "magic" : "other");
  if (operation.attacksPerAction!==undefined&&(!Number.isInteger(operation.attacksPerAction)||operation.attacksPerAction<1)) throw new DomainEvaluationError("attacksPerAction must be a positive integer");
  const extraAttack=operation.slot==="action"&&actionKind==="attack" ? spendExtraAttack(before) : undefined;
  const spent=extraAttack ?? spendTurnSlot(before,operation.slot,operation.bonusActionGranted===true,actionKind);
  actor.economy=spent.next;
  if (!extraAttack&&actionKind==="attack"&&(operation.attacksPerAction??1)>1) {
    actor.economy=grantExtraAttacks(actor.economy,Array.from({length:operation.attacksPerAction!-1},(_,index)=>({
      id:`${ctx.pending.id}:extra-attack:${index+1}`,
      source:ctx.pending.sourceId,
    })));
  }
  const provenance: ProvenanceRecord[] = [
    ...restrictionProvenance,
    {
      source:ctx.pending.sourceId,
      status:"applied",
      reason:spent.spentFrom === "standard"
        ? `${operation.slot} spent`
        : `${operation.slot} spent from grant ${spent.spentFrom}`,
    },
  ];
  const changes = economyStateChanges(actorId, before, actor.economy, provenance);
  const result = { slot:operation.slot, spent:true, spentFrom:spent.spentFrom, actionKind };
  return {
    result,
    event:makeEvent(ctx.pending, operation, `${actorId} spends ${operation.slot}`, result, provenance, changes, actorId),
  };
}

export function executeGrantExtraAction(ctx: ResolutionExecutionContext, operation: ExtraActionOp): OperationExecution {
  const actorId = operation.actorId ?? ctx.pending.actorId;
  requireAvailableInScene(ctx.state,actorId,"extra-action actor");
  const actor = requireCombatant(ctx.state, actorId);
  const before = actor.economy;
  actor.economy = grantExtraAction(before, {
    id:operation.grantId,
    source:ctx.pending.sourceId,
    allowsMagicAction:operation.allowsMagicAction,
  });
  const provenance: ProvenanceRecord[] = [{
    source:ctx.pending.sourceId,
    status:"applied",
    reason:operation.allowsMagicAction
      ? `extra action granted: ${operation.grantId}`
      : `extra action granted without Magic Action permission: ${operation.grantId}`,
  }];
  const changes = economyStateChanges(actorId, before, actor.economy, provenance);
  const result = { grantId:operation.grantId, allowsMagicAction:operation.allowsMagicAction };
  return {
    result,
    event:makeEvent(ctx.pending, operation, `${actorId} gains an extra action`, result, provenance, changes, actorId),
  };
}

export function executeTurnFeature(ctx: ResolutionExecutionContext, operation: TurnFeatureOp): OperationExecution {
  const actorId = operation.actorId ?? ctx.pending.actorId;
  requireAvailableInScene(ctx.state,actorId,"turn-feature actor");
  requireCombatant(ctx.state, actorId);
  if (ctx.state.clock.activeActorId !== actorId) {
    throw new DomainEvaluationError("once-per-turn feature requires the actor's own active turn");
  }
  const usage = ctx.state.turnFeatureUsage;
  if (!usage || usage.actorId !== actorId) {
    throw new DomainEvaluationError("turn feature usage is not initialized for the active actor");
  }
  if (usage.featureIds.includes(operation.featureId)) {
    throw new DomainEvaluationError(`turn feature already used: ${operation.featureId}`);
  }
  usage.featureIds = [...usage.featureIds, operation.featureId];
  const provenance: ProvenanceRecord[] = [{
    source:operation.featureId,
    status:"applied",
    reason:`once-per-turn feature used by ${actorId}`,
  }];
  const result = { actorId, featureId:operation.featureId, used:true };
  return {
    result,
    event:makeEvent(ctx.pending, operation, `${actorId} uses ${operation.featureId} for this turn`, result, provenance, [], actorId),
  };
}

export function executeMove(ctx:ResolutionExecutionContext, operation:MoveOp):OperationExecution {
  const actorId = operation.actorId ?? ctx.pending.actorId;
  requireAvailableInScene(ctx.state,actorId,"movement actor");
  const actor = requireCombatant(ctx.state, actorId);
  const restriction = frightenedMovementRestriction(
    conditionEffectsFor(ctx.state, actorId),
    operation.destinationMovesCloserToVisibleFrighteningSource === true,
    operation.visibleSourceIds ?? [],
  );
  if (restriction) throw new DomainEvaluationError(restriction);

  let restrictionProvenance: ProvenanceRecord[] = [];
  if (ctx.state.clock.activeActorId === actorId) {
    const selected = selectEffectTurnActivity(ctx.state.effects, actorId, "movement");
    ctx.state.effects = selected.effects;
    restrictionProvenance = selected.provenance;
  }

  const before = actor.economy;
  actor.economy = useMovement(before, operation.distanceFeet);
  const provenance:ProvenanceRecord[] = [
    ...restrictionProvenance,
    {
      source:ctx.pending.sourceId,
      status:"applied",
      reason:`${actorId} moves ${operation.distanceFeet} ft`,
    },
  ];
  const changes = economyStateChanges(actorId, before, actor.economy, provenance);
  const result = { distanceFeet:operation.distanceFeet, remaining:actor.economy.movement };
  return {
    result,
    event:makeEvent(ctx.pending, operation, `${actorId} moves ${operation.distanceFeet} ft`, result, provenance, changes, actorId),
  };
}

export function executeResource(ctx: ResolutionExecutionContext, operation: ResourceOp): OperationExecution {
  const actorId = operation.actorId ?? ctx.pending.actorId;
  const actor = requireCombatant(ctx.state, actorId);
  const found = findResource(actor.resources, operation.resourceId);
  const resolved = spendResource(found.pool, operation.amount, ctx.pending.sourceId);
  actor.resources[found.index] = resolved.next;
  const changes = [resourceStateChange(actorId, operation.resourceId, found.pool.current, resolved.next.current, resolved.provenance)];
  return {
    result:resolved,
    event:makeEvent(ctx.pending, operation, `${operation.resourceId} spent`, resolved, resolved.provenance, changes, actorId),
  };
}

export function executeD20(ctx: ResolutionExecutionContext, operation: D20Op): OperationExecution {
  const actorId = operation.actorId ?? ctx.pending.actorId;
  requireAvailableInScene(ctx.state,actorId,"d20 actor");
  const adjustments = conditionD20Adjustments({
    actorId,
    targetId:operation.targetId,
    family:operation.request.family,
    ability:operation.condition?.ability,
    requiresSight:operation.condition?.requiresSight,
    requiresHearing:operation.condition?.requiresHearing,
    socialInteraction:operation.condition?.socialInteraction,
    distanceToTargetFeet:operation.condition?.distanceToTargetFeet,
    actorCanSeeTarget:operation.condition?.actorCanSeeTarget,
    targetCanSeeActor:operation.condition?.targetCanSeeActor,
    visibleSourceIds:operation.condition?.visibleSourceIds,
    actorConditions:conditionEffectsFor(ctx.state, actorId),
    targetConditions:operation.targetId ? conditionEffectsFor(ctx.state, operation.targetId) : [],
  });
  const spellModifiers=ctx.state.effects.filter((effect)=>{
    if (effect.kind!=="modifier"||effect.metadata?.d20Family!==operation.request.family) return false;
    if (typeof effect.metadata.d20Ability === "string" && effect.metadata.d20Ability !== operation.condition?.ability) return false;
    const scope=effect.metadata.d20Scope;
    return scope==="target"?Boolean(operation.targetId&&effect.targetId===operation.targetId):effect.targetId===actorId;
  });
  const spellRollStates=spellModifiers.flatMap((effect)=>effect.metadata?.d20RollState==="advantage"||effect.metadata?.d20RollState==="disadvantage"
    ? [{source:effect.sourceId,state:effect.metadata.d20RollState as "advantage"|"disadvantage"}]
    : []);
  const rageRollStates = (operation.condition?.ability === "str"
    && (operation.request.family === "ability-check" || operation.request.family === "saving-throw")
    && ctx.state.effects.some((effect) => effect.targetId === actorId && effect.tags.includes("barbarian:rage")))
    ? [{ source:"dnd.srd521.feature.barbarian.rage", state:"advantage" as const }]
    : [];
  let target = operation.request.target;
  const modifiers = [...operation.request.modifierContributions, ...adjustments.modifierContributions];
  if (operation.cover) {
    const targetEntry = targetingResult(ctx.results, operation.cover.targetingOperationId).targets
      .find((entry) => entry.targetId === operation.cover!.targetId);
    if (!targetEntry) throw new DomainEvaluationError(`cover target not found: ${operation.cover.targetId}`);
    if (operation.cover.appliesTo === "ac") target += targetEntry.acBonus;
    else modifiers.push({ source:`cover:${targetEntry.cover}`, value:targetEntry.dexteritySaveBonus });
  }
  let resolved:D20TestResult = resolveD20Test(ctx.profile, {
    ...operation.request,
    target,
    modifierContributions:modifiers,
    rollStateContributions:[
      ...(operation.request.rollStateContributions ?? []),
      ...adjustments.rollStateContributions,
      ...spellRollStates,
      ...rageRollStates,
    ],
  });
  if (adjustments.autoFailure) {
    resolved = {
      ...resolved,
      outcome:"failure",
      critical:false,
      provenance:[...resolved.provenance, { source:"condition:auto-failure", status:"applied", reason:"condition causes automatic failure" }],
    };
  }
  if (resolved.family === "attack-roll" && resolved.outcome === "success" && adjustments.criticalOnHit && !resolved.critical) {
    resolved = {
      ...resolved,
      critical:true,
      provenance:[...resolved.provenance, { source:"condition:auto-critical", status:"applied", reason:"condition makes a hit within 5 feet a Critical Hit" }],
    };
  }
  const consumed=spellModifiers.filter((effect)=>effect.metadata?.consumeOnUse===true);
  const consumedProvenance=consumed.map((effect)=>({source:effect.sourceId,status:"applied" as const,reason:`effect ${effect.id} consumed by ${operation.request.family}`}));
  if (consumed.length) ctx.state.effects=ctx.state.effects.filter((effect)=>!consumed.some((entry)=>entry.id===effect.id));
  if (consumedProvenance.length) resolved={...resolved,provenance:[...resolved.provenance,...consumedProvenance]};
  return {
    result:resolved,
    event:makeEvent(
      ctx.pending,
      operation,
      `${resolved.family} ${resolved.outcome} (${resolved.total} vs ${resolved.target})`,
      resolved,
      resolved.provenance,
      consumed.map((effect)=>effectStateChange(effect.targetId,effect.id,"removed",consumedProvenance,effect,undefined)),
      operation.targetId,
    ),
  };
}

export function executeDamageRoll(ctx: ResolutionExecutionContext, operation: DamageRollOp): OperationExecution {
  const critical = operation.criticalFrom
    ? Boolean((ctx.results.get(operation.criticalFrom) as D20TestResult | undefined)?.critical)
    : operation.request.critical;
  const resolved = resolveDamageRoll({ ...operation.request, critical });
  return {
    result:resolved,
    event:makeEvent(ctx.pending, operation, `damage roll ${resolved.total}`, resolved, resolved.provenance, []),
  };
}

export function executeReaction(ctx: ResolutionExecutionContext, operation: ReactionOp): OperationExecution {
  requireAvailableInScene(ctx.state,operation.reactorId,"reaction actor");
  const reactor = requireCombatant(ctx.state, operation.reactorId);
  const window = openReactorWindow(operation.reactorId, reactor.economy, operation.trigger, operation.options);
  const resolved = resolveReactionChoice(operation.reactorId, reactor.economy, window, operation.optionId);
  reactor.economy = resolved.nextEconomy;
  return {
    result:resolved,
    event:makeEvent(
      ctx.pending,
      operation,
      `${operation.reactorId} uses reaction ${operation.optionId}`,
      resolved,
      resolved.provenance,
      resolved.stateChanges,
      operation.reactorId,
    ),
  };
}
