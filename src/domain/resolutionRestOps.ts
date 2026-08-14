import { requireCombatant } from "./combatState";
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
  const beforeResources = actor.resources.map((pool) => ({ ...pool }));
  actor.life = resolved.next.life;
  actor.resources = resolved.next.resources;
  actor.hitDice = resolved.next.hitDice;
  ctx.state.effects = [...otherEffects, ...resolved.next.effects];

  const changes:RuntimeStateChange[] = [
    ...hpStateChanges(operation.targetId, beforeHp, actor.life.hp, resolved.provenance),
    ...lifeFlagStateChanges(operation.targetId, beforeLife, actor.life, resolved.provenance),
  ];
  for (const before of beforeResources) {
    const after = actor.resources.find((pool) => pool.id === before.id);
    if (after && after.current !== before.current) {
      changes.push(
        resourceStateChange(
          operation.targetId,
          before.id,
          before.current,
          after.current,
          resolved.provenance,
        ),
      );
    }
  }
  resolved.expiredEffects.forEach((effect) => {
    changes.push(effectStateChange(effect.targetId, effect.id, "removed", resolved.provenance));
  });

  const concentration = ctx.state.concentration[operation.targetId];
  if (concentration && !ctx.state.effects.some((effect) => effect.concentrationGroupId === concentration.groupId)) {
    changes.push(
      concentrationStateChange(
        operation.targetId,
        concentration.groupId,
        undefined,
        resolved.provenance,
      ),
    );
    ctx.state.concentration[operation.targetId] = undefined;
  }

  return {
    result:resolved,
    event:makeEvent(
      ctx.pending,
      operation,
      `${operation.targetId} completes ${operation.kind}`,
      resolved,
      resolved.provenance,
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
