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

export interface DamageComponentRequest {
  damageType: string;
  amount: number;
  adjustments?: DamageAdjustment[];
  defenses?: DamageDefenseContribution[];
}

export interface DamageRequest extends DamageComponentRequest {
  hp: HpState;
}

export interface CompoundDamageRequest {
  hp: HpState;
  components: DamageComponentRequest[];
}

export interface DamageAmountResolution {
  damageType: string;
  raw: number;
  adjusted: number;
  finalDamage: number;
  provenance: ProvenanceRecord[];
}

export interface DamageResolution extends DamageAmountResolution {
  temporaryHpAbsorbed: number;
  hpDamage: number;
  nextHp: HpState;
}

export interface CompoundDamageResolution extends DamageResolution {
  damageType: "compound";
  components: DamageAmountResolution[];
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

export function resolveDamageAmount(request: DamageComponentRequest): DamageAmountResolution {
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
  return {
    damageType:request.damageType,
    raw:request.amount,
    adjusted,
    finalDamage:adjusted,
    provenance,
  };
}

function applyDamageToHp(
  hp: HpState,
  amount: number,
  provenance: ProvenanceRecord[],
) {
  validateHp(hp);
  requireNonNegativeInteger(amount, "final damage");
  const temporaryHpAbsorbed = Math.min(hp.temporary, amount);
  const remaining = amount - temporaryHpAbsorbed;
  const hpDamage = Math.min(hp.current, remaining);
  const nextHp = {
    current: hp.current - hpDamage,
    maximum: hp.maximum,
    temporary: hp.temporary - temporaryHpAbsorbed,
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
      reason: `HP ${hp.current} -> ${nextHp.current}`,
    });
  }
  return { temporaryHpAbsorbed, hpDamage, nextHp };
}

export function resolveDamage(request: DamageRequest): DamageResolution {
  validateHp(request.hp);
  const amount = resolveDamageAmount(request);
  const provenance = [...amount.provenance];
  const hp = applyDamageToHp(request.hp, amount.finalDamage, provenance);
  return {
    ...amount,
    ...hp,
    provenance,
  };
}

export function resolveCompoundDamage(request: CompoundDamageRequest): CompoundDamageResolution {
  validateHp(request.hp);
  if (request.components.length === 0) throw new DomainEvaluationError("compound damage requires at least one component");
  const components = request.components.map((component) => resolveDamageAmount(component));
  const raw = components.reduce((sum, component) => sum + component.raw, 0);
  const finalDamage = components.reduce((sum, component) => sum + component.finalDamage, 0);
  const provenance = components.flatMap((component) => component.provenance.map((entry) => ({
    ...entry,
    reason:`${component.damageType}: ${entry.reason}`,
  })));
  const hp = applyDamageToHp(request.hp, finalDamage, provenance);
  return {
    damageType:"compound",
    raw,
    adjusted:finalDamage,
    finalDamage,
    ...hp,
    components,
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
