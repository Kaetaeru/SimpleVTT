import type { DamageDefenseContribution } from "./damage";
import type { LifeState } from "./life";
import type { TurnEconomyState } from "./turnEconomy";
import type { ResourcePool } from "./resources";
import type { HitDiePool } from "./rest";
import type { EffectInstance, RuntimeClock } from "./effects";
import type { ConcentrationState } from "./concentration";
import type { ConditionEffectRef, ConditionId } from "./conditions";
import type { RuntimeArtifactInstance, ZoneMembershipState } from "./runtimeArtifact";
import { DomainEvaluationError } from "./profileEngine";

export interface CombatantRuntimeState {
  id: string;
  baseSpeed: number;
  life: LifeState;
  economy: TurnEconomyState;
  resources: ResourcePool[];
  hitDice: HitDiePool[];
  damageDefenses?: DamageDefenseContribution[];
  conditionImmunities?: ConditionId[];
}

export interface RuntimeLogEntry {
  id:string;
  resolutionId:string;
  operationId:string;
  kind:string;
  actorId:string;
  targetId?:string;
  summary:string;
}

export interface TurnFeatureUsageState {
  actorId: string;
  featureIds: string[];
}

export interface RulesRuntimeState {
  revision: number;
  clock: RuntimeClock;
  combatants: Record<string, CombatantRuntimeState>;
  effects: EffectInstance[];
  artifacts?: RuntimeArtifactInstance[];
  zoneMemberships?: ZoneMembershipState[];
  concentration: Record<string, ConcentrationState | undefined>;
  history: RuntimeLogEntry[];
  turnFeatureUsage?: TurnFeatureUsageState;
}

export function cloneRuntimeState(state: RulesRuntimeState): RulesRuntimeState {
  return structuredClone(state);
}

export function requireCombatant(state: RulesRuntimeState, id: string) {
  const combatant = state.combatants[id];
  if (!combatant) throw new DomainEvaluationError(`combatant not found: ${id}`);
  return combatant;
}

export function conditionEffectsFor(state: RulesRuntimeState, targetId: string): ConditionEffectRef[] {
  const effects: ConditionEffectRef[] = state.effects
    .filter((effect) => effect.targetId === targetId && effect.kind === "condition" && effect.conditionId)
    .map((effect) => ({ id:effect.id, conditionId:effect.conditionId!, sourceActorId:effect.sourceActorId }));
  const combatant = requireCombatant(state, targetId);
  if (combatant.life.unconscious && !effects.some((effect) => effect.conditionId === "unconscious")) {
    effects.push({ id:`life:${targetId}:unconscious`, conditionId:"unconscious" });
  }
  return effects;
}
