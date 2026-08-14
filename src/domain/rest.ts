import { resolveHealing, type HpState } from "./damage";
import { applyHealingToLife } from "./lifeTransitions";
import type { LifeState } from "./life";
import { DomainEvaluationError, type ProvenanceRecord } from "./profileEngine";
import { clearTemporaryHpOnLongRest } from "./temporaryHp";
import { expireEffectsForRest, type EffectInstance } from "./effects";
import { recoverResources, type ResourcePool } from "./resources";

export interface HitDiePool {
  id: string;
  sides: number;
  current: number;
  maximum: number;
}

export interface HitDieSpend {
  poolId: string;
  faces: number[];
  constitutionModifier: number;
}

export interface RestState {
  life: LifeState;
  resources: ResourcePool[];
  hitDice: HitDiePool[];
  effects: EffectInstance[];
}

export interface RestResolution {
  next: RestState;
  expiredEffects: EffectInstance[];
  provenance: ProvenanceRecord[];
}

function validateHitDie(pool: HitDiePool) {
  if (!pool.id || !Number.isInteger(pool.sides) || pool.sides < 2 || !Number.isInteger(pool.current) || !Number.isInteger(pool.maximum)
    || pool.current < 0 || pool.maximum < 0 || pool.current > pool.maximum) throw new DomainEvaluationError(`invalid Hit Die pool ${pool.id}`);
}

function removeOneExhaustion(effects: EffectInstance[], targetId: string) {
  const index = effects.findIndex((effect) => effect.targetId === targetId && effect.kind === "condition" && effect.conditionId === "exhaustion");
  if (index < 0) return { effects:[...effects], removed:undefined as EffectInstance | undefined };
  return { effects:effects.filter((_, current) => current !== index), removed:effects[index] };
}

export function resolveShortRest(
  targetId: string,
  state: RestState,
  spends: HitDieSpend[],
): RestResolution {
  if (state.life.dead || state.life.hp.current < 1) throw new DomainEvaluationError("Short Rest requires a living creature with at least 1 HP");
  let life: LifeState = structuredClone(state.life);
  const hitDice = state.hitDice.map((pool) => ({ ...pool }));
  const provenance: ProvenanceRecord[] = [];

  for (const spend of spends) {
    const index = hitDice.findIndex((pool) => pool.id === spend.poolId);
    if (index < 0) throw new DomainEvaluationError(`Hit Die pool not found: ${spend.poolId}`);
    const pool = hitDice[index];
    validateHitDie(pool);
    if (spend.faces.length > pool.current) throw new DomainEvaluationError(`${pool.id} has only ${pool.current} Hit Dice remaining`);
    for (const face of spend.faces) {
      if (!Number.isInteger(face) || face < 1 || face > pool.sides) throw new DomainEvaluationError(`invalid d${pool.sides} Hit Die face ${face}`);
      const amount = Math.max(1, face + spend.constitutionModifier);
      const healing = resolveHealing(life.hp, amount);
      const transition = applyHealingToLife(life, healing);
      life = transition.next;
      provenance.push(...transition.provenance, {
        source:`hit-die:${pool.id}`,
        status:"applied",
        reason:`d${pool.sides} ${face} + CON ${spend.constitutionModifier} => ${amount} healing`,
      });
      pool.current -= 1;
    }
  }

  const resources = recoverResources(state.resources, "shortRest");
  provenance.push(...resources.provenance);
  const expiry = expireEffectsForRest(state.effects, "short");
  provenance.push(...expiry.provenance);
  return {
    next:{ life, resources:resources.next, hitDice, effects:expiry.active },
    expiredEffects:expiry.expired,
    provenance,
  };
}

export function resolveLongRest(targetId: string, state: RestState): RestResolution {
  if (state.life.dead || state.life.hp.current < 1) throw new DomainEvaluationError("Long Rest requires a living creature with at least 1 HP");
  const provenance: ProvenanceRecord[] = [];
  const hp: HpState = clearTemporaryHpOnLongRest({ ...state.life.hp, current:state.life.hp.maximum });
  const life: LifeState = {
    ...structuredClone(state.life),
    hp,
    deathSaves:{ successes:0, failures:0 },
    stable:false,
    unconscious:false,
  };
  provenance.push({ source:"rest:long", status:"applied", reason:`HP restored to ${hp.maximum}; Temporary HP cleared; death saves reset` });

  const hitDice = state.hitDice.map((pool) => {
    validateHitDie(pool);
    if (pool.current !== pool.maximum) provenance.push({ source:`hit-die:${pool.id}`, status:"applied", reason:`Hit Dice ${pool.current} -> ${pool.maximum}` });
    return { ...pool, current:pool.maximum };
  });
  const resources = recoverResources(state.resources, "longRest");
  provenance.push(...resources.provenance);
  const expiry = expireEffectsForRest(state.effects, "long");
  provenance.push(...expiry.provenance);
  const exhaustion = removeOneExhaustion(expiry.active, targetId);
  if (exhaustion.removed) provenance.push({ source:exhaustion.removed.sourceId, status:"applied", reason:"Long Rest removes 1 Exhaustion level" });

  return {
    next:{ life, resources:resources.next, hitDice, effects:exhaustion.effects },
    expiredEffects:[...expiry.expired, ...(exhaustion.removed ? [exhaustion.removed] : [])],
    provenance,
  };
}
