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

export type D20RollModification =
  | { source:string; mode:"advantage"|"disadvantage" }
  | { source:string; mode:"add-flat"|"target-add"|"replace"|"minimum"; value:number }
  | { source:string; mode:"add-die"|"reroll"; dice:FixedDiceInput };

export interface D20TestRequest {
  family: D20TestFamily;
  target: number;
  modifierContributions: ModifierContribution[];
  rollStateContributions?: RollStateContribution[];
  rollModifications?: D20RollModification[];
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

  const modifications=request.rollModifications??[];
  for(const entry of request.modifierContributions) {
    if(!Number.isFinite(entry.value)) throw new DomainEvaluationError(`d20 modifier must be finite: ${entry.source}`);
  }
  for(const entry of modifications) {
    if("value" in entry&&!Number.isFinite(entry.value)) throw new DomainEvaluationError(`d20 roll modification must be finite: ${entry.source}`);
    if((entry.mode==="replace"||entry.mode==="minimum")&&(!Number.isInteger(entry.value)||entry.value<1||entry.value>20)) {
      throw new DomainEvaluationError(`${entry.mode} d20 value must be an integer from 1 to 20`);
    }
  }
  const rollStateResolution = resolveRollState(profile, [
    ...(request.rollStateContributions ?? []),
    ...modifications.flatMap((entry)=>entry.mode==="advantage"||entry.mode==="disadvantage"
      ? [{source:entry.source,state:entry.mode}]
      : []),
  ]);
  const d20Policy = profile.d20Test?.advantageDisadvantage as
    | { sameSideStacks?: boolean; opposingCancel?: boolean; defaultDiceCount?: number }
    | undefined;
  const defaultDiceCount = d20Policy?.defaultDiceCount ?? 2;
  const reroll=modifications.filter((entry):entry is D20RollModification&{mode:"reroll";dice:FixedDiceInput}=>entry.mode==="reroll").at(-1);
  const dice = selectD20(rollStateResolution.rollState, reroll?.dice??request.dice, defaultDiceCount);
  const additionalDice=modifications.filter((entry):entry is D20RollModification&{mode:"add-die";dice:FixedDiceInput}=>entry.mode==="add-die");
  for(const entry of additionalDice) {
    if(!Number.isInteger(entry.dice.sides)||entry.dice.sides<2) throw new DomainEvaluationError(`additional die must have at least 2 sides: ${entry.source}`);
    if(!entry.dice.faces.length||entry.dice.faces.some((face)=>!Number.isInteger(face)||face<1||face>entry.dice.sides)) {
      throw new DomainEvaluationError(`invalid additional die face: ${entry.source}`);
    }
  }
  const modifier = request.modifierContributions.reduce((sum, entry) => sum + entry.value, 0)
    + modifications.reduce((sum,entry)=>sum+(entry.mode==="add-flat"?entry.value:0),0)
    + additionalDice.reduce((sum,entry)=>sum+entry.dice.faces.reduce((subtotal,face)=>subtotal+face,0),0);
  let natural = dice.selectedFace;
  for(const entry of modifications) {
    if(entry.mode==="replace") natural=entry.value;
    else if(entry.mode==="minimum") natural=Math.max(natural,entry.value);
  }
  const target=request.target+modifications.reduce((sum,entry)=>sum+(entry.mode==="target-add"?entry.value:0),0);
  const total = natural + modifier;

  let outcome: "success" | "failure" = total >= target ? "success" : "failure";
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
    ...modifications.flatMap((entry):ProvenanceRecord[]=>{
      if(entry.mode==="advantage"||entry.mode==="disadvantage") return [];
      if(entry.mode==="reroll") return [{source:entry.source,status:"applied",reason:`rerolled d20 using [${entry.dice.faces.join(", ")}]`}];
      if(entry.mode==="add-die") return [{source:entry.source,status:"applied",reason:`added d${entry.dice.sides} roll [${entry.dice.faces.join(", ")}]`}];
      if(entry.mode==="add-flat") return [{source:entry.source,status:"applied",reason:`${entry.value>=0?"+":""}${entry.value} to d20 total`}];
      if(entry.mode==="target-add") return [{source:entry.source,status:"applied",reason:`${entry.value>=0?"+":""}${entry.value} to target`}];
      return [{source:entry.source,status:"applied",reason:`${entry.mode} d20 result with ${"value" in entry?entry.value:"<invalid>"}`}];
    }),
    {
      source: request.targetSource ?? (request.family === "attack-roll" ? "target:ac" : "target:dc"),
      status: "applied",
      reason: `${total} vs ${target} => ${outcome}`,
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
    target,
    outcome,
    critical,
    provenance,
  };
}
