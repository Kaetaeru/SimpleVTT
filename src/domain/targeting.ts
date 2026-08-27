import { DomainEvaluationError, type ProvenanceRecord } from "./profileEngine";

export type CoverDegree = "none" | "half" | "three-quarters" | "total";
export type TargetRelation = "self" | "ally" | "enemy" | "neutral";
export type TargetKind = "creature" | "object" | "point";

export interface CoverPolicy {
  halfBonus: number;
  threeQuartersBonus: number;
  totalPreventsDirectTarget: boolean;
}

export const SRD_521_COVER_POLICY: CoverPolicy = {
  halfBonus: 2,
  threeQuartersBonus: 5,
  totalPreventsDirectTarget: true,
};

export interface TargetFacts {
  id: string;
  kind: TargetKind;
  relation: TargetRelation;
  distanceFeet?: number;
  visible?: boolean;
  cover?: CoverDegree;
}

export interface TargetingRule {
  kind: TargetKind | "any";
  minimumRangeFeet?: number;
  rangeFeet?: number;
  minTargets: number;
  maxTargets: number;
  allowedRelations?: TargetRelation[];
  requiresSight?: boolean;
  directTarget?: boolean;
}

export interface TargetResolutionEntry {
  targetId: string;
  cover?: CoverDegree;
  acBonus: number;
  dexteritySaveBonus: number;
  provenance: ProvenanceRecord[];
}

export interface TargetRejection {
  targetId: string;
  reasons: string[];
}

export interface TargetingResolution {
  valid: boolean;
  targets: TargetResolutionEntry[];
  rejected: TargetRejection[];
  provenance: ProvenanceRecord[];
}

function validateRule(rule: TargetingRule) {
  if (!Number.isInteger(rule.minTargets) || rule.minTargets < 0) {
    throw new DomainEvaluationError("targeting minTargets must be a non-negative integer");
  }
  if (!Number.isInteger(rule.maxTargets) || rule.maxTargets < rule.minTargets) {
    throw new DomainEvaluationError("targeting maxTargets must be an integer >= minTargets");
  }
  for (const [label, value] of [["minimumRangeFeet", rule.minimumRangeFeet], ["rangeFeet", rule.rangeFeet]] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new DomainEvaluationError(`${label} must be a non-negative finite number`);
    }
  }
  if (rule.minimumRangeFeet !== undefined && rule.rangeFeet !== undefined && rule.minimumRangeFeet > rule.rangeFeet) {
    throw new DomainEvaluationError("minimum range cannot exceed maximum range");
  }
}

export function coverBonus(policy: CoverPolicy, cover: CoverDegree) {
  if (cover === "half") return policy.halfBonus;
  if (cover === "three-quarters") return policy.threeQuartersBonus;
  return 0;
}

export function coverTargetBonus(
  policy: CoverPolicy,
  cover: CoverDegree,
  target: "ac" | "dexterity-save",
) {
  const bonus = coverBonus(policy, cover);
  return { target, bonus };
}

export function resolveTargeting(
  sourceId: string,
  rule: TargetingRule,
  selected: TargetFacts[],
  policy: CoverPolicy = SRD_521_COVER_POLICY,
): TargetingResolution {
  validateRule(rule);
  const provenance: ProvenanceRecord[] = [];
  const rejected: TargetRejection[] = [];
  const targets: TargetResolutionEntry[] = [];
  const seen = new Set<string>();
  const requiresDistance = rule.minimumRangeFeet !== undefined || rule.rangeFeet !== undefined;
  const requiresCover = rule.directTarget !== false;

  if (selected.length < rule.minTargets || selected.length > rule.maxTargets) {
    provenance.push({
      source: "targeting:count",
      status: "failed",
      reason: `selected ${selected.length}; requires ${rule.minTargets}-${rule.maxTargets}`,
    });
  }

  for (const target of selected) {
    const reasons: string[] = [];
    if (!target.id) reasons.push("target id is required");
    if (seen.has(target.id)) reasons.push("duplicate target");
    seen.add(target.id);

    if (requiresDistance) {
      if (target.distanceFeet === undefined) reasons.push("authoritative distance is required");
      else if (!Number.isFinite(target.distanceFeet) || target.distanceFeet < 0) reasons.push("invalid authoritative distance");
    } else if (target.distanceFeet !== undefined && (!Number.isFinite(target.distanceFeet) || target.distanceFeet < 0)) {
      reasons.push("invalid authoritative distance");
    }

    if (rule.kind !== "any" && target.kind !== rule.kind) reasons.push(`requires ${rule.kind} target`);
    if (rule.allowedRelations && !rule.allowedRelations.includes(target.relation)) reasons.push(`relation ${target.relation} is not allowed`);
    if (rule.minimumRangeFeet !== undefined && target.distanceFeet !== undefined && target.distanceFeet < rule.minimumRangeFeet) reasons.push(`inside minimum range ${rule.minimumRangeFeet} ft`);
    if (rule.rangeFeet !== undefined && target.distanceFeet !== undefined && target.distanceFeet > rule.rangeFeet) reasons.push(`beyond range ${rule.rangeFeet} ft`);

    if (rule.requiresSight) {
      if (target.visible === undefined) reasons.push("authoritative visibility is required");
      else if (!target.visible) reasons.push("target is not visible");
    }

    if (requiresCover) {
      if (target.cover === undefined) reasons.push("authoritative cover is required");
      else if (policy.totalPreventsDirectTarget && target.cover === "total") reasons.push("total cover prevents direct targeting");
    }
    if (target.relation === "self" && target.id !== sourceId) reasons.push("self relation must refer to the source actor");

    if (reasons.length) {
      rejected.push({ targetId: target.id, reasons });
      provenance.push({ source:`target:${target.id}`, status:"failed", reason:reasons.join("; ") });
      continue;
    }

    const bonus = target.cover === undefined ? 0 : coverBonus(policy, target.cover);
    targets.push({
      targetId: target.id,
      cover: target.cover,
      acBonus: bonus,
      dexteritySaveBonus: bonus,
      provenance: bonus > 0 && target.cover !== undefined ? [{
        source:`cover:${target.cover}`,
        status:"applied",
        reason:`${target.cover} cover grants +${bonus} AC and Dexterity saving throws`,
      }] : [],
    });
  }

  const countValid = selected.length >= rule.minTargets && selected.length <= rule.maxTargets;
  return { valid: countValid && rejected.length === 0, targets, rejected, provenance };
}
