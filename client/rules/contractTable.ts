/**
 * R42 (D182): the half of a contract's outcome that belongs to the table rather than a sheet.
 *
 * `applyContractOutcome` (client/character) settles what a character sheet can answer on its own. What is left needs
 * the board: a condition put on somebody else, a creature summoned or sent away, movement, and the questions only the
 * DM can settle. The host owns no catalog, so it asks for this shape and applies it.
 */
import type { ContentCatalog } from "../catalog/catalog";
import type { DerivedCharacter } from "../character/types";
import { characterScope, evaluate } from "./contract";
import { contractOutcome, featureContract } from "./contractActivation";

export interface TableOutcome {
  label: string;
  conditionsApplied: string[];
  conditionsRemoved: string[];
  deathSave: boolean;
  notes: string[];
  artifacts: Array<{ kind: string; monsterId?: string; count?: number }>;
}

/** What this feature's contract asks the table for, or null when it asks for nothing. */
export function tableOutcome(derived: DerivedCharacter, catalog: ContentCatalog, ruleKey: string): TableOutcome | null {
  const contract = featureContract(catalog, ruleKey);
  if (!contract) return null;
  const scope = characterScope(derived);
  const outcome = contractOutcome(contract, scope);
  const applied: string[] = [];
  for (const entry of contract.entryPoints) {
    if (entry.invocation === "pre-roll-attack") continue;
    for (const operation of entry.operations) {
      if (operation.kind !== "condition.apply") continue;
      if (operation.when && evaluate(operation.when, scope) !== true) continue;
      if (operation.target !== "self") applied.push(operation.condition);
    }
  }
  const table: TableOutcome = {
    label: derived.features.find((feature) => feature.id.endsWith(ruleKey))?.name ?? ruleKey,
    conditionsApplied: applied,
    conditionsRemoved: [],
    deathSave: outcome.deathSave,
    notes: outcome.notes,
    artifacts: outcome.artifacts.map((item) => ({ kind: item.kind, monsterId: item.monsterId, count: item.count })),
  };
  const asks = table.conditionsApplied.length || table.deathSave || table.notes.length || table.artifacts.length;
  return asks ? table : null;
}
