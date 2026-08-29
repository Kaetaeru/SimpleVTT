import { beginTurn } from "./turnEconomy";
import { conditionActionAvailability, effectiveSpeed } from "./conditions";
import { conditionEffectsFor, requireCombatant } from "./combatState";
import { effectIsActive, expireEffectsAtClock, resetEffectTurnActivity } from "./effects";
import { expireExtendableEffectsAtClock } from "./extendableEffectLifecycle";
import { recoverResources } from "./resources";
import { expireRuntimeArtifactsAtClock } from "./runtimeArtifact";
import { economyStateChanges } from "./stateChange";
import { artifactStateChange, combatantStateChange, effectStateChange, zoneMembershipStateChange, type RuntimeStateChange } from "./runtimeStateChange";
import { DomainEvaluationError, type ProvenanceRecord } from "./profileEngine";
import type { OperationExecution, ResolutionExecutionContext } from "./resolutionContext";
import { makeEvent } from "./resolutionContext";
import type { ResolutionOperation } from "./resolutionTypes";

type BeginTurnOp = Extract<ResolutionOperation, { kind:"begin-turn" }>;
type EndTurnOp = Extract<ResolutionOperation, { kind:"end-turn" }>;
type AdvanceTimeOp = Extract<ResolutionOperation, { kind:"advance-time" }>;

function expireRuntimeEffects(ctx:ResolutionExecutionContext) {
  const generic=expireEffectsAtClock(ctx.state.effects,ctx.state.clock);
  const extendable=expireExtendableEffectsAtClock(generic.active,ctx.state.clock);
  return {
    active:extendable.active,
    expired:[...generic.expired,...extendable.expired],
    provenance:[...generic.provenance,...extendable.provenance],
  };
}

export function executeBeginTurn(ctx:ResolutionExecutionContext, operation:BeginTurnOp):OperationExecution {
  const actor = requireCombatant(ctx.state, operation.actorId);
  ctx.state.clock = {
    ...ctx.state.clock,
    round:operation.round,
    activeActorId:operation.actorId,
    phase:"start",
  };
  ctx.state.turnFeatureUsage = { actorId:operation.actorId, featureIds:[] };
  const expiry = expireRuntimeEffects(ctx);
  ctx.state.effects = resetEffectTurnActivity(expiry.active, operation.actorId);

  const conditions = conditionEffectsFor(ctx.state, operation.actorId);
  const speedDelta=ctx.state.effects.reduce((sum,effect)=>effectIsActive(effect)&&effect.targetId===operation.actorId&&effect.kind==="modifier"&&typeof effect.metadata?.speedDelta==="number"?sum+effect.metadata.speedDelta:sum,0);
  const speed = Math.max(0,effectiveSpeed(actor.baseSpeed, conditions)+speedDelta);
  const availability = conditionActionAvailability(conditions);
  const before = actor.economy;
  const fresh = beginTurn(speed);
  actor.economy = {
    ...fresh,
    action:availability.action,
    bonusAction:availability.bonusAction,
    reaction:availability.reaction,
  };

  const recovered = recoverResources(actor.resources, "turnStart");
  actor.resources = recovered.next;
  const provenance:ProvenanceRecord[] = [
    ...expiry.provenance,
    ...recovered.provenance,
    { source:"turn:start", status:"applied", reason:`turn started for ${operation.actorId}` },
  ];
  const changes:RuntimeStateChange[] = economyStateChanges(operation.actorId, before, actor.economy, provenance);
  expiry.expired.forEach((effect) => {
    changes.push(effectStateChange(effect.targetId, effect.id, "removed", expiry.provenance, effect, undefined));
  });
  const result = {
    round:operation.round,
    actorId:operation.actorId,
    expiredEffectIds:expiry.expired.map((effect) => effect.id),
  };
  return {
    result,
    event:makeEvent(ctx.pending, operation, `turn ${operation.actorId} begins`, result, provenance, changes, operation.actorId),
  };
}

export function executeEndTurn(ctx:ResolutionExecutionContext, operation:EndTurnOp):OperationExecution {
  requireCombatant(ctx.state, operation.actorId);
  ctx.state.clock = {
    ...ctx.state.clock,
    round:operation.round,
    activeActorId:operation.actorId,
    phase:"end",
  };
  const expiry = expireRuntimeEffects(ctx);
  ctx.state.effects = expiry.active;
  const changes = expiry.expired.map((effect) =>
    effectStateChange(effect.targetId, effect.id, "removed", expiry.provenance, effect, undefined),
  );
  const result = {
    round:operation.round,
    actorId:operation.actorId,
    expiredEffectIds:expiry.expired.map((effect) => effect.id),
  };
  return {
    result,
    event:makeEvent(ctx.pending, operation, `turn ${operation.actorId} ends`, result, expiry.provenance, changes, operation.actorId),
  };
}

export function executeAdvanceTime(ctx:ResolutionExecutionContext, operation:AdvanceTimeOp):OperationExecution {
  if (!Number.isFinite(operation.elapsedSeconds) || operation.elapsedSeconds < ctx.state.clock.elapsedSeconds) {
    throw new DomainEvaluationError("elapsed time cannot move backwards");
  }
  ctx.state.clock = { ...ctx.state.clock, elapsedSeconds:operation.elapsedSeconds };
  const effectExpiry = expireRuntimeEffects(ctx);
  ctx.state.effects = effectExpiry.active;
  const artifactExpiry=expireRuntimeArtifactsAtClock(ctx.state.artifacts??[],ctx.state.clock);
  ctx.state.artifacts=artifactExpiry.active;
  const expiredArtifactIds=new Set(artifactExpiry.expired.map((artifact)=>artifact.id));
  const expiredMemberships=(ctx.state.zoneMemberships??[]).filter((membership)=>expiredArtifactIds.has(membership.artifactId));
  ctx.state.zoneMemberships=(ctx.state.zoneMemberships??[]).filter((membership)=>!expiredArtifactIds.has(membership.artifactId));
  const provenance=[...effectExpiry.provenance,...artifactExpiry.provenance];
  const changes:RuntimeStateChange[] = effectExpiry.expired.map((effect) =>
    effectStateChange(effect.targetId, effect.id, "removed", effectExpiry.provenance, effect, undefined),
  );
  artifactExpiry.expired.forEach((artifact)=>{
    changes.push(artifactStateChange(
      artifact.id,
      artifact.id,
      "removed",
      artifactExpiry.provenance,
      artifact,
      undefined,
    ));
    if(artifact.actor) {
      const combatant=ctx.state.combatants[artifact.actor.combatantId];
      if(combatant) {
        changes.push(combatantStateChange(combatant.id,"removed",artifactExpiry.provenance,combatant,undefined));
        delete ctx.state.combatants[combatant.id];
      }
    }
  });
  expiredMemberships.forEach((membership)=>{
    changes.push(zoneMembershipStateChange(
      membership.artifactId,
      "removed",
      artifactExpiry.provenance,
      membership,
      undefined,
    ));
  });
  const result = {
    elapsedSeconds:operation.elapsedSeconds,
    expiredEffectIds:effectExpiry.expired.map((effect) => effect.id),
    expiredArtifactIds:artifactExpiry.expired.map((artifact)=>artifact.id),
  };
  return {
    result,
    event:makeEvent(ctx.pending, operation, `time advanced to ${operation.elapsedSeconds}s`, result, provenance, changes),
  };
}
