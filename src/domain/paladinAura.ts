import { DomainEvaluationError, type ProvenanceRecord } from "./profileEngine";

export const AURA_OF_PROTECTION_SOURCE_ID = "feature:paladin.aura-of-protection";
export const AURA_OF_COURAGE_SOURCE_ID = "feature:paladin.aura-of-courage";

export type AuraRelation = "self" | "ally" | "enemy" | "neutral";

export interface PaladinAuraFact {
  paladinId: string;
  paladinLevel: number;
  charismaModifier: number;
  incapacitated: boolean;
  distanceFeet: number;
  relation: AuraRelation;
}

export interface AuraOfProtectionContribution {
  paladinId: string;
  bonus: number;
  radiusFeet: 10 | 30;
  provenance: ProvenanceRecord[];
}

function validateFact(fact: PaladinAuraFact) {
  if (!fact.paladinId) throw new DomainEvaluationError("Paladin aura fact requires paladinId");
  if (!Number.isInteger(fact.paladinLevel) || fact.paladinLevel < 0 || fact.paladinLevel > 20) {
    throw new DomainEvaluationError("Paladin level must be an integer from 0 to 20");
  }
  if (!Number.isInteger(fact.charismaModifier)) throw new DomainEvaluationError("Paladin Charisma modifier must be an integer");
  if (!Number.isFinite(fact.distanceFeet) || fact.distanceFeet < 0) {
    throw new DomainEvaluationError("Paladin aura distance must be a non-negative finite number");
  }
}

export function paladinAuraRadiusFeet(paladinLevel: number): 0 | 10 | 30 {
  if (!Number.isInteger(paladinLevel) || paladinLevel < 0 || paladinLevel > 20) {
    throw new DomainEvaluationError("Paladin level must be an integer from 0 to 20");
  }
  if (paladinLevel < 6) return 0;
  return paladinLevel >= 18 ? 30 : 10;
}

export function auraOfProtectionContribution(fact: PaladinAuraFact): AuraOfProtectionContribution | undefined {
  validateFact(fact);
  const radiusFeet = paladinAuraRadiusFeet(fact.paladinLevel);
  if (!radiusFeet || fact.incapacitated || fact.distanceFeet > radiusFeet) return undefined;
  if (fact.relation !== "self" && fact.relation !== "ally") return undefined;
  const bonus = Math.max(1, fact.charismaModifier);
  return {
    paladinId:fact.paladinId,
    bonus,
    radiusFeet,
    provenance:[{
      source:AURA_OF_PROTECTION_SOURCE_ID,
      status:"applied",
      reason:`${fact.paladinId} Aura of Protection grants +${bonus} to saving throws within ${radiusFeet} ft`,
    }],
  };
}

export function auraOfProtectionOptions(facts: PaladinAuraFact[]) {
  return facts
    .map(auraOfProtectionContribution)
    .filter((entry): entry is AuraOfProtectionContribution => Boolean(entry));
}

export function chooseAuraOfProtection(
  facts: PaladinAuraFact[],
  selectedPaladinId: string,
): AuraOfProtectionContribution {
  const options = auraOfProtectionOptions(facts);
  const selected = options.find((entry) => entry.paladinId === selectedPaladinId);
  if (!selected) throw new DomainEvaluationError(`selected Aura of Protection is not available: ${selectedPaladinId}`);
  return selected;
}

export function auraOfCourageSuppressesFrightened(fact: PaladinAuraFact) {
  validateFact(fact);
  const radiusFeet = paladinAuraRadiusFeet(fact.paladinLevel);
  return fact.paladinLevel >= 10
    && radiusFeet > 0
    && !fact.incapacitated
    && fact.distanceFeet <= radiusFeet
    && (fact.relation === "self" || fact.relation === "ally");
}

export function auraOfCourageProvenance(fact: PaladinAuraFact): ProvenanceRecord[] {
  return auraOfCourageSuppressesFrightened(fact)
    ? [{
        source:AURA_OF_COURAGE_SOURCE_ID,
        status:"applied",
        reason:`${fact.paladinId} Aura of Courage suppresses Frightened within ${paladinAuraRadiusFeet(fact.paladinLevel)} ft`,
      }]
    : [];
}
