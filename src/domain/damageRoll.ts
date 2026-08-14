import { DomainEvaluationError, type ProvenanceRecord } from "./profileEngine";

export interface FixedDamageDice {
  source: string;
  sides: number;
  count: number;
  faces: number[];
}

export interface FlatDamageContribution {
  source: string;
  value: number;
}

export interface DamageRollRequest {
  dice: FixedDamageDice[];
  flat?: FlatDamageContribution[];
  critical?: boolean;
}

export interface DamageDiceRecord {
  source: string;
  sides: number;
  baseCount: number;
  rolledCount: number;
  selectedFaces: number[];
  subtotal: number;
}

export interface DamageRollResolution {
  critical: boolean;
  diceTotal: number;
  flatTotal: number;
  total: number;
  dice: DamageDiceRecord[];
  provenance: ProvenanceRecord[];
}

function validateDice(component: FixedDamageDice, rolledCount: number) {
  if (!Number.isInteger(component.sides) || component.sides < 2) {
    throw new DomainEvaluationError(`damage dice from ${component.source} must have at least 2 sides`);
  }
  if (!Number.isInteger(component.count) || component.count < 0) {
    throw new DomainEvaluationError(`damage dice count from ${component.source} must be a non-negative integer`);
  }
  if (component.faces.length < rolledCount) {
    throw new DomainEvaluationError(`damage dice from ${component.source} require ${rolledCount} fixed faces`);
  }
  for (const face of component.faces.slice(0, rolledCount)) {
    if (!Number.isInteger(face) || face < 1 || face > component.sides) {
      throw new DomainEvaluationError(`invalid d${component.sides} damage face ${face} from ${component.source}`);
    }
  }
}

export function resolveDamageRoll(request: DamageRollRequest): DamageRollResolution {
  const critical = request.critical === true;
  const provenance: ProvenanceRecord[] = [];
  const dice = request.dice.map((component) => {
    const rolledCount = critical ? component.count * 2 : component.count;
    validateDice(component, rolledCount);
    const selectedFaces = component.faces.slice(0, rolledCount);
    const subtotal = selectedFaces.reduce((sum, face) => sum + face, 0);
    provenance.push({
      source: component.source,
      status: "applied",
      reason: critical
        ? `critical doubles damage dice ${component.count} -> ${rolledCount}; subtotal ${subtotal}`
        : `${rolledCount} damage dice; subtotal ${subtotal}`,
    });
    return {
      source: component.source,
      sides: component.sides,
      baseCount: component.count,
      rolledCount,
      selectedFaces,
      subtotal,
    };
  });

  const flat = request.flat ?? [];
  for (const contribution of flat) {
    if (!Number.isFinite(contribution.value)) {
      throw new DomainEvaluationError(`flat damage from ${contribution.source} must be finite`);
    }
    provenance.push({
      source: contribution.source,
      status: "applied",
      reason: `${contribution.value >= 0 ? "+" : ""}${contribution.value} flat damage; not doubled by critical`,
    });
  }

  const diceTotal = dice.reduce((sum, record) => sum + record.subtotal, 0);
  const flatTotal = flat.reduce((sum, contribution) => sum + contribution.value, 0);
  const total = Math.max(0, diceTotal + flatTotal);

  return { critical, diceTotal, flatTotal, total, dice, provenance };
}
