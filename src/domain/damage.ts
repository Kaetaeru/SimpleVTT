import { DomainEvaluationError, type ProvenanceRecord } from "./profileEngine";

export type DamageDefenseKind = "resistance" | "vulnerability" | "immunity";
export type DamageAdjustmentOperation = "add" | "subtract" | "multiply";

export interface HpState {
  current: number;
  maximum: number;
  temporary: number;
}

export interface DamageAdjustment {
  source: string;
  operation: DamageAdjustmentOperation;
  value: number;
}

export interface DamageDefenseContribution {
  source: string;
  kind: DamageDefenseKind;
  damageType: string;
}

export interface DamageRequest {
  damageType: string;
  amount: number;
  hp: HpState;
  adjustments?: DamageAdjustment[];
  defenses?: DamageDefenseContribution[];
}

export interface DamageResolution {
  damageType: string;
  raw: number;
  adjusted: number;
  finalDamage: number;
  temporaryHpAbsorbed: number;
  hpDamage: number;
  nextHp: HpState;
  provenance: ProvenanceRecord[];
}

export interface HealingResolution {
  requested: number;
  restored: number;
  nextHp: HpState;
  provenance: ProvenanceRecord[];
}

function requireNonNegativeInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new DomainEvaluationError(`${label} must be a non-negative integer`);
  }
}

function validateHp(hp: HpState) {
  requireNonNegativeInteger(hp.current, "hp.current");
  requireNonNegativeInteger(hp.maximum, "hp.maximum");
  requireNonNegativeInteger(hp.temporary, "hp.temporary");
  if (hp.current > hp.maximum) throw new DomainEvaluationError("hp.current cannot exceed hp.maximum");
}

function appliesToType(contribution: DamageDefenseContribution, damageType: string) {
  return contribution.damageType === damageType || contribution.damageType === "*";
}

export function resolveDamage(request: DamageRequest): DamageResolution {
  validateHp(request.hp);
  requireNonNegativeInteger(request.amount, "damage amount");
  if (!request.damageType) throw new DomainEvaluationError("damage type is required");

  const provenance: ProvenanceRecord[] = [];
  let adjusted = request.amount;

  for (const adjustment of request.adjustments ?? []) {
    if (!Number.isFinite(adjustment.value)) {
      throw new DomainEvaluationError(`damage adjustment from ${adjustment.source} must be finite`);
    }
    const before = adjusted;
    if (adjustment.operation === "add") adjusted += adjustment.value;
    else if (adjustment.operation === "subtract") adjusted -= adjustment.value;
    else adjusted *= adjustment.value;
    adjusted = Math.max(0, adjusted);
    provenance.push({
      source: adjustment.source,
      status: "applied",
      reason: `${adjustment.operation} ${adjustment.value}: ${before} -> ${adjusted}`,
    });
  }

  const matching = (request.defenses ?? []).filter((entry) => appliesToType(entry, request.damageType));
  const resistance = matching.filter((entry) => entry.kind === "resistance");
  const vulnerability = matching.filter((entry) => entry.kind === "vulnerability");
  const immunity = matching.filter((entry) => entry.kind === "immunity");

  if (resistance.length > 0) {
    const before = adjusted;
    adjusted = Math.floor(adjusted / 2);
    resistance.forEach((entry, index) => provenance.push({
      source: entry.source,
      status: index === 0 ? "applied" : "suppressed",
      reason: index === 0
        ? `Resistance ${before} -> ${adjusted}`
        : "duplicate Resistance does not stack",
    }));
  }

  if (vulnerability.length > 0) {
    const before = adjusted;
    adjusted *= 2;
    vulnerability.forEach((entry, index) => provenance.push({
      source: entry.source,
      status: index === 0 ? "applied" : "suppressed",
      reason: index === 0
        ? `Vulnerability ${before} -> ${adjusted}`
        : "duplicate Vulnerability does not stack",
    }));
  }

  if (immunity.length > 0) {
    const before = adjusted;
    adjusted = 0;
    immunity.forEach((entry, index) => provenance.push({
      source: entry.source,
      status: index === 0 ? "applied" : "suppressed",
      reason: index === 0
        ? `Immunity ${before} -> 0`
        : "duplicate Immunity has no additional effect",
    }));
  }

  requireNonNegativeInteger(adjusted, "final damage");
  const temporaryHpAbsorbed = Math.min(request.hp.temporary, adjusted);
  const remaining = adjusted - temporaryHpAbsorbed;
  const hpDamage = Math.min(request.hp.current, remaining);
  const nextHp = {
    current: request.hp.current - hpDamage,
    maximum: request.hp.maximum,
    temporary: request.hp.temporary - temporaryHpAbsorbed,
  };

  if (temporaryHpAbsorbed > 0) {
    provenance.push({
      source: "profile:dnd.srd-5.2.1/temp-hp",
      status: "applied",
      reason: `Temporary HP absorbs ${temporaryHpAbsorbed} before HP`,
    });
  }
  if (hpDamage > 0) {
    provenance.push({
      source: "profile:dnd.srd-5.2.1/hp",
      status: "applied",
      reason: `HP ${request.hp.current} -> ${nextHp.current}`,
    });
  }

  return {
    damageType: request.damageType,
    raw: request.amount,
    adjusted,
    finalDamage: adjusted,
    temporaryHpAbsorbed,
    hpDamage,
    nextHp,
    provenance,
  };
}

export function resolveHealing(hp: HpState, amount: number): HealingResolution {
  validateHp(hp);
  requireNonNegativeInteger(amount, "healing amount");
  const restored = Math.min(amount, hp.maximum - hp.current);
  const nextHp = { ...hp, current: hp.current + restored };
  return {
    requested: amount,
    restored,
    nextHp,
    provenance: [{
      source: "profile:dnd.srd-5.2.1/healing",
      status: "applied",
      reason: `HP ${hp.current} -> ${nextHp.current}; excess healing discarded`,
    }],
  };
}
