import type { DamageResolution, HpState } from "./damage";
import {
  resolveD20Test,
  type FixedDiceInput,
  type ModifierContribution,
} from "./d20";
import {
  DomainEvaluationError,
  type ProvenanceRecord,
  type RollStateContribution,
  type RulesProfileLike,
} from "./profileEngine";

export type CreatureLifeKind = "character" | "monster";

export interface DeathSaveState {
  successes: number;
  failures: number;
}

export interface LifeState {
  hp: HpState;
  deathSaves: DeathSaveState;
  stable: boolean;
  unconscious: boolean;
  dead: boolean;
}

export interface ZeroHpDamageRequest {
  creatureKind: CreatureLifeKind;
  before: LifeState;
  damage: DamageResolution;
  critical?: boolean;
  monsterUsesCharacterDeathRules?: boolean;
}

export interface LifeResolution {
  next: LifeState;
  massiveDamage: boolean;
  failuresAdded: number;
  provenance: ProvenanceRecord[];
}

export interface DeathSaveRequest {
  life: LifeState;
  dice: FixedDiceInput;
  rollStateContributions?: RollStateContribution[];
  modifierContributions?: ModifierContribution[];
}

export interface DeathSaveResolution {
  natural: number;
  total: number;
  outcome: "success" | "failure" | "stable" | "dead" | "revived";
  next: LifeState;
  provenance: ProvenanceRecord[];
}

function validateDeathSaves(state: DeathSaveState) {
  for (const [label, value] of Object.entries(state)) {
    if (!Number.isInteger(value) || value < 0 || value > 3) {
      throw new DomainEvaluationError(`death save ${label} must be an integer from 0 to 3`);
    }
  }
}

function cloneLife(state: LifeState): LifeState {
  validateDeathSaves(state.deathSaves);
  return {
    hp: { ...state.hp },
    deathSaves: { ...state.deathSaves },
    stable: state.stable,
    unconscious: state.unconscious,
    dead: state.dead,
  };
}

export function resolveZeroHpAfterDamage(request: ZeroHpDamageRequest): LifeResolution {
  const next = cloneLife(request.before);
  next.hp = { ...request.damage.nextHp };
  const provenance: ProvenanceRecord[] = [];

  if (request.before.dead || request.damage.finalDamage === 0 || next.hp.current > 0) {
    return { next, massiveDamage: false, failuresAdded: 0, provenance };
  }

  if (next.hp.maximum === 0) {
    next.dead = true;
    next.unconscious = false;
    provenance.push({
      source: "profile:dnd.srd-5.2.1/max-hp-zero",
      status: "applied",
      reason: "maximum HP is 0",
    });
    return { next, massiveDamage: false, failuresAdded: 0, provenance };
  }

  const useCharacterRules =
    request.creatureKind === "character" || request.monsterUsesCharacterDeathRules === true;
  if (!useCharacterRules) {
    next.dead = true;
    next.unconscious = false;
    provenance.push({
      source: "profile:dnd.srd-5.2.1/monster-zero-hp",
      status: "applied",
      reason: "monster at 0 HP dies unless the GM uses character death rules",
    });
    return { next, massiveDamage: false, failuresAdded: 0, provenance };
  }

  const damageAfterTemporaryHp = Math.max(
    0,
    request.damage.finalDamage - request.damage.temporaryHpAbsorbed,
  );
  const overflowDamage = Math.max(0, damageAfterTemporaryHp - request.damage.hpDamage);

  if (request.before.hp.current > 0) {
    const massiveDamage = overflowDamage >= next.hp.maximum;
    if (massiveDamage) {
      next.dead = true;
      next.unconscious = false;
      provenance.push({
        source: "profile:dnd.srd-5.2.1/massive-damage",
        status: "applied",
        reason: `${overflowDamage} overflow damage >= maximum HP ${next.hp.maximum}`,
      });
      return { next, massiveDamage: true, failuresAdded: 0, provenance };
    }

    next.stable = false;
    next.unconscious = true;
    provenance.push({
      source: "profile:dnd.srd-5.2.1/unconscious-at-zero",
      status: "applied",
      reason: "character reached 0 HP without instant death",
    });
    return { next, massiveDamage: false, failuresAdded: 0, provenance };
  }

  if (damageAfterTemporaryHp >= next.hp.maximum) {
    next.dead = true;
    next.unconscious = false;
    provenance.push({
      source: "profile:dnd.srd-5.2.1/zero-hp-massive-damage",
      status: "applied",
      reason: `${damageAfterTemporaryHp} damage at 0 HP >= maximum HP ${next.hp.maximum}`,
    });
    return { next, massiveDamage: true, failuresAdded: 0, provenance };
  }

  if (damageAfterTemporaryHp === 0) {
    return { next, massiveDamage: false, failuresAdded: 0, provenance };
  }

  const failuresAdded = request.critical === true ? 2 : 1;
  next.stable = false;
  next.unconscious = true;
  next.deathSaves.failures = Math.min(3, next.deathSaves.failures + failuresAdded);
  if (next.deathSaves.failures >= 3) {
    next.dead = true;
    next.unconscious = false;
  }
  provenance.push({
    source: "profile:dnd.srd-5.2.1/damage-at-zero",
    status: "applied",
    reason: `${request.critical === true ? "critical " : ""}damage at 0 HP adds ${failuresAdded} death save failure(s)`,
  });

  return { next, massiveDamage: false, failuresAdded, provenance };
}

export function resolveDeathSavingThrow(
  profile: RulesProfileLike,
  request: DeathSaveRequest,
): DeathSaveResolution {
  const next = cloneLife(request.life);
  if (next.dead) throw new DomainEvaluationError("dead creatures do not make death saving throws");
  if (next.hp.current !== 0) throw new DomainEvaluationError("death saving throws require 0 HP");
  if (next.stable) throw new DomainEvaluationError("stable creatures do not make death saving throws");

  const d20 = resolveD20Test(profile, {
    family: "saving-throw",
    target: 10,
    modifierContributions: request.modifierContributions ?? [],
    rollStateContributions: request.rollStateContributions ?? [],
    dice: request.dice,
    targetSource: "profile:dnd.srd-5.2.1/death-save-dc",
  });
  const provenance = [...d20.provenance];

  if (d20.natural === 20) {
    next.hp.current = 1;
    next.deathSaves = { successes: 0, failures: 0 };
    next.stable = false;
    next.unconscious = false;
    provenance.push({
      source: "profile:dnd.srd-5.2.1/death-save-natural-20",
      status: "applied",
      reason: "natural 20 restores 1 HP and resets death saves",
    });
    return { natural: d20.natural, total: d20.total, outcome: "revived", next, provenance };
  }

  if (d20.natural === 1) {
    next.deathSaves.failures = Math.min(3, next.deathSaves.failures + 2);
    if (next.deathSaves.failures >= 3) {
      next.dead = true;
      next.unconscious = false;
    }
    provenance.push({
      source: "profile:dnd.srd-5.2.1/death-save-natural-1",
      status: "applied",
      reason: "natural 1 adds two death save failures",
    });
    return {
      natural: d20.natural,
      total: d20.total,
      outcome: next.dead ? "dead" : "failure",
      next,
      provenance,
    };
  }

  if (d20.outcome === "success") {
    next.deathSaves.successes = Math.min(3, next.deathSaves.successes + 1);
    if (next.deathSaves.successes >= 3) {
      next.deathSaves = { successes: 0, failures: 0 };
      next.stable = true;
      provenance.push({
        source: "profile:dnd.srd-5.2.1/stable",
        status: "applied",
        reason: "three successful death saves stabilize the creature and reset death saves",
      });
      return { natural: d20.natural, total: d20.total, outcome: "stable", next, provenance };
    }
    return { natural: d20.natural, total: d20.total, outcome: "success", next, provenance };
  }

  next.deathSaves.failures = Math.min(3, next.deathSaves.failures + 1);
  if (next.deathSaves.failures >= 3) {
    next.dead = true;
    next.unconscious = false;
  }
  return {
    natural: d20.natural,
    total: d20.total,
    outcome: next.dead ? "dead" : "failure",
    next,
    provenance,
  };
}
