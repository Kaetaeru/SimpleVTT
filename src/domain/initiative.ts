import { selectD20, type FixedDiceInput, type ModifierContribution } from "./d20";
import {
  DomainEvaluationError,
  resolveRollState,
  type ProvenanceRecord,
  type RollState,
  type RollStateContribution,
  type RulesProfileLike,
} from "./profileEngine";

export type InitiativeController = "player" | "gm";

export interface InitiativeEntry {
  id: string;
  controller: InitiativeController;
  total: number;
}

export interface InitiativeRollRequest {
  id:string;
  controller:InitiativeController;
  dice:FixedDiceInput;
  modifierContributions:ModifierContribution[];
  rollStateContributions?:RollStateContribution[];
}

export interface InitiativeRollResult {
  entry:InitiativeEntry;
  rollState:RollState;
  natural:number;
  modifier:number;
  provenance:ProvenanceRecord[];
}

export interface InitiativeGroup {
  total: number;
  participantIds: string[];
  tieBreak: "none" | "player-choice" | "gm-choice";
}

export function resolveInitiativeRoll(profile:RulesProfileLike,request:InitiativeRollRequest):InitiativeRollResult {
  if (!request.id) throw new DomainEvaluationError("initiative participant id is required");
  const resolvedRollState = resolveRollState(profile,request.rollStateContributions ?? []);
  const diceCount = (profile.d20Test?.advantageDisadvantage as { defaultDiceCount?:number }|undefined)?.defaultDiceCount ?? 2;
  const dice = selectD20(resolvedRollState.rollState,request.dice,diceCount);
  const modifier = request.modifierContributions.reduce((sum,entry) => sum + entry.value,0);
  const total = dice.selectedFace + modifier;
  if (!Number.isFinite(total)) throw new DomainEvaluationError("initiative total must be finite");
  const provenance:ProvenanceRecord[] = [
    ...resolvedRollState.provenance,
    { source:`dice:${dice.id}`, status:"applied", reason:`${resolvedRollState.rollState} selected initiative d20 ${dice.selectedFace} from [${dice.faces.join(", ")}]` },
    ...request.modifierContributions.map((entry) => ({
      source:entry.source,
      status:"applied" as const,
      reason:`${entry.value >= 0 ? "+" : ""}${entry.value} to Initiative`,
    })),
  ];
  return {
    entry:{ id:request.id, controller:request.controller, total },
    rollState:resolvedRollState.rollState,
    natural:dice.selectedFace,
    modifier,
    provenance,
  };
}

export function orderInitiative(entries: InitiativeEntry[]): InitiativeGroup[] {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry.id) throw new DomainEvaluationError("initiative participant id is required");
    if (ids.has(entry.id)) throw new DomainEvaluationError(`duplicate initiative participant: ${entry.id}`);
    if (!Number.isFinite(entry.total)) throw new DomainEvaluationError("initiative total must be finite");
    ids.add(entry.id);
  }

  const totals = new Map<number, InitiativeEntry[]>();
  for (const entry of entries) {
    const group = totals.get(entry.total) ?? [];
    group.push(entry);
    totals.set(entry.total, group);
  }

  return [...totals.entries()]
    .sort(([left], [right]) => right - left)
    .map(([total, tied]) => ({
      total,
      participantIds: tied.map((entry) => entry.id),
      tieBreak: tied.length === 1
        ? "none"
        : tied.every((entry) => entry.controller === "player")
          ? "player-choice"
          : "gm-choice",
    }));
}
