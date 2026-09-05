import type { HealingResolution } from "./damage";
import type { LifeState } from "./life";
import { DomainEvaluationError, type ProvenanceRecord } from "./profileEngine";

export interface LifeTransitionResolution {
  next: LifeState;
  provenance: ProvenanceRecord[];
}

function cloneLife(state: LifeState): LifeState {
  return {
    hp: { ...state.hp },
    deathSaves: { ...state.deathSaves },
    stable: state.stable,
    unconscious: state.unconscious,
    dead: state.dead,
  };
}

export function stabilizeAtZero(
  state: LifeState,
  source = "profile:dnd.srd-5.2.1/stabilization",
): LifeTransitionResolution {
  if (state.dead) throw new DomainEvaluationError("dead creatures cannot be stabilized");
  if (state.hp.current !== 0) throw new DomainEvaluationError("stabilization requires 0 HP");
  const next = cloneLife(state);
  next.deathSaves = { successes: 0, failures: 0 };
  next.stable = true;
  next.unconscious = true;
  return {
    next,
    provenance: [{
      source,
      status: "applied",
      reason: "stabilized at 0 HP; death save successes and failures reset",
    }],
  };
}

export function applyHealingToLife(
  state: LifeState,
  healing: HealingResolution,
  revive = false,
): LifeTransitionResolution {
  if (state.dead && healing.restored > 0 && !revive) {
    throw new DomainEvaluationError("ordinary healing cannot restore a dead creature");
  }

  const next = cloneLife(state);
  next.hp = { ...healing.nextHp };
  const provenance = [...healing.provenance];
  if (revive && state.dead) {
    next.dead = false;
    provenance.push({
      source: "profile:dnd.srd-5.2.1/revive",
      status: "applied",
      reason: "the spell returns the dead creature to life",
    });
  }

  if (state.hp.current === 0 && next.hp.current > 0) {
    next.deathSaves = { successes: 0, failures: 0 };
    next.stable = false;
    next.unconscious = false;
    provenance.push({
      source: "profile:dnd.srd-5.2.1/healing-from-zero",
      status: "applied",
      reason: "restoring HP above 0 ends unconscious/stable state and resets death saves",
    });
  }

  return { next, provenance };
}
