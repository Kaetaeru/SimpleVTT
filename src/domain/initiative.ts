import { DomainEvaluationError } from "./profileEngine";

export type InitiativeController = "player" | "gm";

export interface InitiativeEntry {
  id: string;
  controller: InitiativeController;
  total: number;
}

export interface InitiativeGroup {
  total: number;
  participantIds: string[];
  tieBreak: "none" | "player-choice" | "gm-choice";
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
