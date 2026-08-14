import { DomainEvaluationError, type ProvenanceRecord } from "./profileEngine";
import type { ConditionId } from "./conditions";

export type TurnBoundary = "start" | "end";
export type RestKind = "short" | "long";

export interface RuntimeClock {
  round: number;
  elapsedSeconds: number;
  activeActorId?: string;
  phase?: TurnBoundary | "action";
}

export type DurationSpec =
  | { kind:"instant" }
  | { kind:"seconds"; amount:number }
  | { kind:"minutes"; amount:number }
  | { kind:"hours"; amount:number }
  | { kind:"rounds"; amount:number; anchorActorId:string; boundary:TurnBoundary }
  | { kind:"until-turn-boundary"; actorId:string; round:number; boundary:TurnBoundary }
  | { kind:"until-rest"; rest:"short" | "long" | "either" }
  | { kind:"concentration" }
  | { kind:"permanent" }
  | { kind:"special"; key:string };

export type EffectExpiry =
  | { kind:"instant" }
  | { kind:"time"; elapsedSeconds:number }
  | { kind:"turn-boundary"; actorId:string; round:number; boundary:TurnBoundary }
  | { kind:"rest"; rest:"short" | "long" | "either" }
  | { kind:"concentration" }
  | { kind:"permanent" }
  | { kind:"special"; key:string };

export type EffectKind = "condition" | "modifier" | "marker";

export interface EffectTermination {
  targetTakesDamage?: boolean;
  targetBecomesIncapacitated?: boolean;
  targetDies?: boolean;
  sourceBecomesIncapacitated?: boolean;
  sourceDies?: boolean;
}

export interface EffectInstance {
  id: string;
  sourceId: string;
  sourceActorId?: string;
  targetId: string;
  kind: EffectKind;
  conditionId?: ConditionId;
  tags: string[];
  expiry: EffectExpiry;
  termination?: EffectTermination;
  concentrationGroupId?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface EffectApplyRequest {
  id: string;
  sourceId: string;
  sourceActorId?: string;
  targetId: string;
  kind: EffectKind;
  conditionId?: ConditionId;
  tags?: string[];
  duration: DurationSpec;
  termination?: EffectTermination;
  concentrationGroupId?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface EffectExpiryResolution {
  active: EffectInstance[];
  expired: EffectInstance[];
  provenance: ProvenanceRecord[];
}

function requirePositiveFinite(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) throw new DomainEvaluationError(`${label} must be positive`);
}

export function materializeDuration(duration: DurationSpec, clock: RuntimeClock): EffectExpiry {
  if (!Number.isInteger(clock.round) || clock.round < 0) throw new DomainEvaluationError("clock round must be a non-negative integer");
  if (!Number.isFinite(clock.elapsedSeconds) || clock.elapsedSeconds < 0) throw new DomainEvaluationError("clock elapsedSeconds must be non-negative");
  switch (duration.kind) {
    case "instant": return { kind:"instant" };
    case "seconds": requirePositiveFinite(duration.amount, "seconds duration"); return { kind:"time", elapsedSeconds:clock.elapsedSeconds + duration.amount };
    case "minutes": requirePositiveFinite(duration.amount, "minutes duration"); return { kind:"time", elapsedSeconds:clock.elapsedSeconds + duration.amount * 60 };
    case "hours": requirePositiveFinite(duration.amount, "hours duration"); return { kind:"time", elapsedSeconds:clock.elapsedSeconds + duration.amount * 3600 };
    case "rounds":
      if (!Number.isInteger(duration.amount) || duration.amount <= 0) throw new DomainEvaluationError("round duration must be a positive integer");
      if (!duration.anchorActorId) throw new DomainEvaluationError("round duration requires an anchor actor");
      return { kind:"turn-boundary", actorId:duration.anchorActorId, round:clock.round + duration.amount, boundary:duration.boundary };
    case "until-turn-boundary": return { kind:"turn-boundary", actorId:duration.actorId, round:duration.round, boundary:duration.boundary };
    case "until-rest": return { kind:"rest", rest:duration.rest };
    case "concentration": return { kind:"concentration" };
    case "permanent": return { kind:"permanent" };
    case "special":
      if (!duration.key) throw new DomainEvaluationError("special duration requires a key");
      return { kind:"special", key:duration.key };
  }
}

export function createEffect(request: EffectApplyRequest, clock: RuntimeClock): EffectInstance {
  if (!request.id || !request.sourceId || !request.targetId) throw new DomainEvaluationError("effect id, sourceId, and targetId are required");
  if (request.kind === "condition" && !request.conditionId) throw new DomainEvaluationError("condition effect requires conditionId");
  if (request.duration.kind === "concentration" && !request.concentrationGroupId) throw new DomainEvaluationError("concentration effect requires concentrationGroupId");
  return {
    id:request.id,
    sourceId:request.sourceId,
    sourceActorId:request.sourceActorId,
    targetId:request.targetId,
    kind:request.kind,
    conditionId:request.conditionId,
    tags:[...(request.tags ?? [])],
    expiry:materializeDuration(request.duration, clock),
    termination:request.termination ? { ...request.termination } : undefined,
    concentrationGroupId:request.concentrationGroupId,
    metadata:request.metadata ? { ...request.metadata } : undefined,
  };
}

function boundaryReached(expiry: Extract<EffectExpiry,{kind:"turn-boundary"}>, clock: RuntimeClock) {
  if (clock.round > expiry.round) return true;
  if (clock.round < expiry.round) return false;
  return clock.activeActorId === expiry.actorId && clock.phase === expiry.boundary;
}

function terminateEffects(
  effects: EffectInstance[],
  predicate: (effect:EffectInstance) => boolean,
  reason: (effect:EffectInstance) => string,
): EffectExpiryResolution {
  const expired: EffectInstance[] = [];
  const active: EffectInstance[] = [];
  for (const effect of effects) (predicate(effect) ? expired : active).push(effect);
  return {
    active,
    expired,
    provenance:expired.map((effect) => ({
      source:effect.sourceId,
      status:"applied",
      reason:reason(effect),
    })),
  };
}

export function terminateEffectsForDamage(effects: EffectInstance[], targetId: string): EffectExpiryResolution {
  return terminateEffects(
    effects,
    (effect) => effect.targetId === targetId && effect.termination?.targetTakesDamage === true,
    (effect) => `effect ${effect.id} ended because ${targetId} took damage`,
  );
}

export function terminateEffectsForCreatureState(
  effects: EffectInstance[],
  actorId: string,
  state: { incapacitated:boolean; dead:boolean },
): EffectExpiryResolution {
  return terminateEffects(
    effects,
    (effect) => {
      const targetEnds = effect.targetId === actorId
        && ((state.incapacitated && effect.termination?.targetBecomesIncapacitated === true)
          || (state.dead && effect.termination?.targetDies === true));
      const sourceEnds = effect.sourceActorId === actorId
        && ((state.incapacitated && effect.termination?.sourceBecomesIncapacitated === true)
          || (state.dead && effect.termination?.sourceDies === true));
      return targetEnds || sourceEnds;
    },
    (effect) => {
      const role = effect.targetId === actorId ? "target" : "source";
      const stateName = state.dead ? "died" : "became Incapacitated";
      return `effect ${effect.id} ended because its ${role} ${actorId} ${stateName}`;
    },
  );
}

export function expireEffectsAtClock(effects: EffectInstance[], clock: RuntimeClock): EffectExpiryResolution {
  const expired: EffectInstance[] = [];
  const active: EffectInstance[] = [];
  for (const effect of effects) {
    const shouldExpire = effect.expiry.kind === "instant"
      || (effect.expiry.kind === "time" && clock.elapsedSeconds >= effect.expiry.elapsedSeconds)
      || (effect.expiry.kind === "turn-boundary" && boundaryReached(effect.expiry, clock));
    (shouldExpire ? expired : active).push(effect);
  }
  return {
    active,
    expired,
    provenance:expired.map((effect) => ({ source:effect.sourceId, status:"applied", reason:`effect ${effect.id} expired by duration` })),
  };
}

export function expireEffectsForRest(effects: EffectInstance[], rest: RestKind): EffectExpiryResolution {
  const expired: EffectInstance[] = [];
  const active: EffectInstance[] = [];
  for (const effect of effects) {
    const shouldExpire = effect.expiry.kind === "rest"
      && (effect.expiry.rest === "either" || effect.expiry.rest === rest || (rest === "long" && effect.expiry.rest === "short"));
    (shouldExpire ? expired : active).push(effect);
  }
  return {
    active,
    expired,
    provenance:expired.map((effect) => ({ source:effect.sourceId, status:"applied", reason:`effect ${effect.id} expired on ${rest} rest` })),
  };
}

export function removeEffectGroup(effects: EffectInstance[], groupId: string): EffectExpiryResolution {
  const expired = effects.filter((effect) => effect.concentrationGroupId === groupId);
  const active = effects.filter((effect) => effect.concentrationGroupId !== groupId);
  return {
    active,
    expired,
    provenance:expired.map((effect) => ({ source:effect.sourceId, status:"applied", reason:`effect ${effect.id} ended with concentration group ${groupId}` })),
  };
}
