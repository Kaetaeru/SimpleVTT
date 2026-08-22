import { requireCombatant } from "./combatState";
import { gainResource, spendResource, type ResourceRecoveryLockouts } from "./resources";
import { resolveLongRest, resolveShortRest } from "./rest";
import { hpStateChanges } from "./stateChange";
import {
  concentrationStateChange,
  effectStateChange,
  lifeFlagStateChanges,
  resourceStateChange,
  type RuntimeStateChange,
} from "./runtimeStateChange";
import type { OperationExecution, ResolutionExecutionContext } from "./resolutionContext";
import { makeEvent } from "./resolutionContext";
import type { ResolutionOperation } from "./resolutionTypes";

type ShortRestOp = Extract<ResolutionOperation, { kind:"short-rest" }>;
type LongRestOp = Extract<ResolutionOperation, { kind:"long-rest" }>;

function lockoutSnapshot(value:ResourceRecoveryLockouts|undefined):ResourceRecoveryLockouts|null {
  return value ? structuredClone(value) : null;
}

function sameLockouts(left:ResourceRecoveryLockouts|null,right:ResourceRecoveryLockouts|null) {
  return left?.shortRest===right?.shortRest&&left?.longRest===right?.longRest;
}

function executeRest(
  ctx:ResolutionExecutionContext,
  operation:ShortRestOp | LongRestOp,
):OperationExecution {
  const actor = requireCombatant(ctx.state, operation.targetId);
  const ownedEffects = ctx.state.effects.filter((effect) => effect.targetId === operation.targetId);
  const otherEffects = ctx.state.effects.filter((effect) => effect.targetId !== operation.targetId);
  const restState = {
    life:actor.life,
    resources:actor.resources,
    hitDice:actor.hitDice,
    effects:ownedEffects,
  };
  const resolved = operation.kind === "short-rest"
    ? resolveShortRest(operation.targetId, restState, operation.spends)
    : resolveLongRest(operation.targetId, restState);

  const beforeLife = structuredClone(actor.life);
  const beforeHp = { ...beforeLife.hp };
  const beforeResources = actor.resources.map((pool) => structuredClone(pool));
  actor.life = resolved.next.life;
  actor.resources = resolved.next.resources;
  actor.hitDice = resolved.next.hitDice;
  ctx.state.effects = [...otherEffects, ...resolved.next.effects];
  const provenance = [...resolved.provenance];
  let resourceRestoration: { resourceId:string; amount:number; usageResourceId:string } | undefined;
  let resourceRestorationBatch: { restorations:Array<{resourceId:string; amount:number}>; usageResourceId:string } | undefined;

  if (operation.kind === "short-rest") {
    if (operation.resourceRestoration && operation.resourceRestorationBatch) {
      throw new Error("short rest cannot use single and batch resource restoration in the same operation");
    }

    if (operation.resourceRestoration) {
      const restoration = operation.resourceRestoration;
      const usageIndex = actor.resources.findIndex((pool) => pool.id === restoration.usageResourceId);
      const resourceIndex = actor.resources.findIndex((pool) => pool.id === restoration.resourceId);
      if (usageIndex < 0) throw new Error(`resource not found: ${restoration.usageResourceId}`);
      if (resourceIndex < 0) throw new Error(`resource not found: ${restoration.resourceId}`);
      const usage = spendResource(actor.resources[usageIndex], 1, ctx.pending.sourceId);
      actor.resources[usageIndex] = usage.next;
      provenance.push(...usage.provenance);
      const gain = gainResource(actor.resources[resourceIndex], restoration.amount, ctx.pending.sourceId);
      actor.resources[resourceIndex] = gain.next;
      provenance.push(...gain.provenance);
      resourceRestoration = { ...restoration };
    }

    if (operation.resourceRestorationBatch) {
      const batch = operation.resourceRestorationBatch;
      if (!batch.restorations.length) throw new Error("batch resource restoration requires at least one resource");
      const ids = batch.restorations.map((entry) => entry.resourceId);
      if (new Set(ids).size !== ids.length) throw new Error("batch resource restoration resource IDs must be unique");
      for (const restoration of batch.restorations) {
        if (!Number.isInteger(restoration.amount) || restoration.amount < 1) {
          throw new Error("batch resource restoration amounts must be positive integers");
        }
      }
      const usageIndex = actor.resources.findIndex((pool) => pool.id === batch.usageResourceId);
      if (usageIndex < 0) throw new Error(`resource not found: ${batch.usageResourceId}`);
      const usage = spendResource(actor.resources[usageIndex], 1, ctx.pending.sourceId);
      actor.resources[usageIndex] = usage.next;
      provenance.push(...usage.provenance);

      for (const restoration of batch.restorations) {
        const resourceIndex = actor.resources.findIndex((pool) => pool.id === restoration.resourceId);
        if (resourceIndex < 0) throw new Error(`resource not found: ${restoration.resourceId}`);
        const gain = gainResource(actor.resources[resourceIndex], restoration.amount, ctx.pending.sourceId);
        actor.resources[resourceIndex] = gain.next;
        provenance.push(...gain.provenance);
      }
      resourceRestorationBatch = {
        usageResourceId:batch.usageResourceId,
        restorations:batch.restorations.map((entry) => ({ ...entry })),
      };
    }
  }

  const changes:RuntimeStateChange[] = [
    ...hpStateChanges(operation.targetId, beforeHp, actor.life.hp, provenance),
    ...lifeFlagStateChanges(operation.targetId, beforeLife, actor.life, provenance),
  ];
  for (const before of beforeResources) {
    const after = actor.resources.find((pool) => pool.id === before.id);
    if (!after) continue;
    const beforeLockouts=lockoutSnapshot(before.recoveryLockouts);
    const afterLockouts=lockoutSnapshot(after.recoveryLockouts);
    const lockoutsChanged=!sameLockouts(beforeLockouts,afterLockouts);
    if (after.current !== before.current || lockoutsChanged) {
      changes.push(
        resourceStateChange(
          operation.targetId,
          before.id,
          before.current,
          after.current,
          provenance,
          lockoutsChanged ? { before:beforeLockouts, after:afterLockouts } : undefined,
        ),
      );
    }
  }
  resolved.expiredEffects.forEach((effect) => {
    changes.push(effectStateChange(effect.targetId, effect.id, "removed", provenance, effect, undefined));
  });

  const concentration = ctx.state.concentration[operation.targetId];
  if (concentration && !ctx.state.effects.some((effect) => effect.concentrationGroupId === concentration.groupId)) {
    changes.push(
      concentrationStateChange(
        operation.targetId,
        concentration,
        undefined,
        provenance,
      ),
    );
    ctx.state.concentration[operation.targetId] = undefined;
  }

  const result = resourceRestorationBatch
    ? { ...resolved, resourceRestorationBatch }
    : resourceRestoration
      ? { ...resolved, resourceRestoration }
      : resolved;
  return {
    result,
    event:makeEvent(
      ctx.pending,
      operation,
      `${operation.targetId} completes ${operation.kind}`,
      result,
      provenance,
      changes,
      operation.targetId,
    ),
  };
}

export function executeShortRest(ctx:ResolutionExecutionContext, operation:ShortRestOp) {
  return executeRest(ctx, operation);
}

export function executeLongRest(ctx:ResolutionExecutionContext, operation:LongRestOp) {
  return executeRest(ctx, operation);
}
