import { selectD20, type DiceRecord, type FixedDiceInput, type ModifierContribution } from "./d20";
import {
  DomainEvaluationError,
  resolveRollState,
  type ProvenanceRecord,
  type RollState,
  type RollStateContribution,
  type RulesProfileLike,
} from "./profileEngine";

export type OpenD20Family = "ability-check" | "saving-throw" | "attack-roll";

export interface OpenD20RollRequest {
  family: OpenD20Family;
  modifierContributions: ModifierContribution[];
  rollStateContributions?: RollStateContribution[];
  dice: FixedDiceInput;
}

export interface OpenD20RollResult {
  family: OpenD20Family;
  rollState: RollState;
  dice: DiceRecord;
  natural: number;
  modifier: number;
  total: number;
  provenance: ProvenanceRecord[];
}

export function resolveOpenD20Roll(
  profile: RulesProfileLike,
  request: OpenD20RollRequest,
): OpenD20RollResult {
  for (const contribution of request.modifierContributions) {
    if (!Number.isFinite(contribution.value)) {
      throw new DomainEvaluationError(`d20 modifier must be finite: ${contribution.source}`);
    }
  }

  const rollStateResolution = resolveRollState(profile,request.rollStateContributions ?? []);
  const d20Policy = profile.d20Test?.advantageDisadvantage as
    | { sameSideStacks?:boolean; opposingCancel?:boolean; defaultDiceCount?:number }
    | undefined;
  const dice = selectD20(rollStateResolution.rollState,request.dice,d20Policy?.defaultDiceCount ?? 2);
  const modifier = request.modifierContributions.reduce((sum,entry) => sum + entry.value,0);
  const natural = dice.selectedFace;
  const total = natural + modifier;

  return {
    family:request.family,
    rollState:rollStateResolution.rollState,
    dice,
    natural,
    modifier,
    total,
    provenance:[
      ...rollStateResolution.provenance,
      {
        source:`dice:${dice.id}`,
        status:"applied",
        reason:`${rollStateResolution.rollState} selected d20 ${natural} from [${dice.faces.join(", ")}]`,
      },
      ...request.modifierContributions.map((entry) => ({
        source:entry.source,
        status:"applied" as const,
        reason:`${entry.value >= 0 ? "+" : ""}${entry.value} to d20 total`,
      })),
    ],
  };
}
