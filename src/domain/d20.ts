import {
  DomainEvaluationError,
  resolveRollState,
  type ProvenanceRecord,
  type RollState,
  type RollStateContribution,
  type RulesProfileLike,
} from "./profileEngine";

export type D20TestFamily = "ability-check" | "saving-throw" | "attack-roll";

export interface FixedDiceInput {
  id: string;
  purpose: string;
  sides: number;
  faces: number[];
}

export interface DiceRecord extends FixedDiceInput {
  selectedIndexes: number[];
  selectedFace: number;
}

export interface ModifierContribution {
  source: string;
  value: number;
}

export interface D20TestRequest {
  family: D20TestFamily;
  target: number;
  modifierContributions: ModifierContribution[];
  rollStateContributions?: RollStateContribution[];
  dice: FixedDiceInput;
  targetSource?: string;
  criticalThreshold?: number;
  criticalThresholdSource?: string;
}

export interface D20TestResult {
  family: D20TestFamily;
  rollState: RollState;
  dice: DiceRecord;
  natural: number;
  modifier: number;
  total: number;
  target: number;
  outcome: "success" | "failure";
  critical: boolean;
  provenance: ProvenanceRecord[];
}

function validateD20(dice: FixedDiceInput) {
  if (dice.sides !== 20) throw new DomainEvaluationError(`d20 test requires a d20, got d${dice.sides}`);
  if (dice.faces.length < 1) throw new DomainEvaluationError("d20 test requires at least one fixed face");
  for (const face of dice.faces) {
    if (!Number.isInteger(face) || face < 1 || face > 20) {
      throw new DomainEvaluationError(`invalid d20 face: ${face}`);
    }
  }
}

export function selectD20(
  rollState: RollState,
  dice: FixedDiceInput,
  defaultDiceCount = 2,
): DiceRecord {
  validateD20(dice);

  if (rollState === "normal") {
    return { ...dice, selectedIndexes: [0], selectedFace: dice.faces[0] };
  }

  if (dice.faces.length < defaultDiceCount) {
    throw new DomainEvaluationError(`${rollState} requires ${defaultDiceCount} d20 faces`);
  }

  const candidates = dice.faces.slice(0, defaultDiceCount);
  let selectedIndex = 0;
  for (let index = 1; index < candidates.length; index += 1) {
    const isBetter =
      rollState === "advantage"
        ? candidates[index] > candidates[selectedIndex]
        : candidates[index] < candidates[selectedIndex];
    if (isBetter) selectedIndex = index;
  }

  return { ...dice, selectedIndexes: [selectedIndex], selectedFace: candidates[selectedIndex] };
}

export function resolveD20Test(profile: RulesProfileLike, request: D20TestRequest): D20TestResult {
  if (!Number.isFinite(request.target)) throw new DomainEvaluationError("d20 target must be finite");
  if (request.criticalThreshold !== undefined) {
    if (request.family !== "attack-roll") {
      throw new DomainEvaluationError("critical thresholds apply only to attack rolls");
    }
    if (!Number.isInteger(request.criticalThreshold) || request.criticalThreshold < 2 || request.criticalThreshold > 20) {
      throw new DomainEvaluationError("attack critical threshold must be an integer from 2 to 20");
    }
  }

  const rollStateResolution = resolveRollState(profile, request.rollStateContributions ?? []);
  const d20Policy = profile.d20Test?.advantageDisadvantage as
    | { sameSideStacks?: boolean; opposingCancel?: boolean; defaultDiceCount?: number }
    | undefined;
  const defaultDiceCount = d20Policy?.defaultDiceCount ?? 2;
  const dice = selectD20(rollStateResolution.rollState, request.dice, defaultDiceCount);
  const modifier = request.modifierContributions.reduce((sum, entry) => sum + entry.value, 0);
  const natural = dice.selectedFace;
  const total = natural + modifier;

  let outcome: "success" | "failure" = total >= request.target ? "success" : "failure";
  let critical = false;

  if (request.family === "attack-roll") {
    const criticalThreshold = request.criticalThreshold ?? 20;
    if (natural === 1) {
      outcome = "failure";
    } else if (natural >= criticalThreshold) {
      outcome = "success";
      critical = true;
    }
  }

  const provenance: ProvenanceRecord[] = [
    ...rollStateResolution.provenance,
    {
      source: `dice:${dice.id}`,
      status: "applied",
      reason: `${rollStateResolution.rollState} selected d20 ${natural} from [${dice.faces.join(", ")}]`,
    },
    ...request.modifierContributions.map((entry) => ({
      source: entry.source,
      status: "applied" as const,
      reason: `${entry.value >= 0 ? "+" : ""}${entry.value} to d20 total`,
    })),
    {
      source: request.targetSource ?? (request.family === "attack-roll" ? "target:ac" : "target:dc"),
      status: "applied",
      reason: `${total} vs ${request.target} => ${outcome}`,
    },
  ];

  if (request.family === "attack-roll" && natural === 1) {
    provenance.push({
      source: "profile:dnd.srd-5.2.1/attack-natural-1",
      status: "applied",
      reason: "natural 1 automatically misses",
    });
  } else if (request.family === "attack-roll" && critical) {
    const threshold = request.criticalThreshold ?? 20;
    provenance.push({
      source: threshold === 20
        ? "profile:dnd.srd-5.2.1/attack-natural-20"
        : (request.criticalThresholdSource ?? "feature:expanded-critical-range"),
      status: "applied",
      reason: threshold === 20
        ? "natural 20 automatically hits and is critical"
        : `natural ${natural} meets critical threshold ${threshold}; attack automatically hits and is critical`,
    });
  }

  return {
    family: request.family,
    rollState: rollStateResolution.rollState,
    dice,
    natural,
    modifier,
    total,
    target: request.target,
    outcome,
    critical,
    provenance,
  };
}
