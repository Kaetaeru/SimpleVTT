/**
 * R42 (D182): the half of a contract's outcome that belongs to the table rather than a sheet.
 *
 * `applyContractOutcome` (client/character) settles what a character sheet can answer on its own. What is left needs
 * the board: a condition put on somebody else, a creature summoned or sent away, movement, and the questions only the
 * DM can settle. The host owns no catalog, so it asks for this shape and applies it.
 */
import type { ContentCatalog } from "../catalog/catalog";
import type { DerivedCharacter } from "../character/types";
import { ATTACK_INVOCATIONS, characterScope, evaluate } from "./contract";
import { contractOutcome, featureContract } from "./contractActivation";

export interface TableOutcome {
  label: string;
  conditionsApplied: string[];
  conditionsRemoved: string[];
  /** V3d (D258): turn marks the use puts on its user (인내의 방어: 회피·이탈). */
  selfMarks: string[];
  deathSave: boolean;
  notes: string[];
  artifacts: Array<{ kind: string; monsterId?: string; count?: number }>;
  /**
   * R58 (D193): what the use does to the people it was aimed at. 고무적인 지도자 hands out temporary hit points,
   * 치유사 heals, 요리사 and 독 제조자 put an item in somebody's bag. `max` is how many may be chosen, when the rule
   * says so. Everything here needs a target, which is why it could not live on the sheet.
   */
  party: { tempHp?: string; heal?: string; grants: string[]; max?: number };
}

/** Whether an operation is aimed at somebody other than the user. */
const atOthers = (target: string) => target === "allies" || target === "party" || target === "target" || target === "targets";

/** What this feature's contract asks the table for, or null when it asks for nothing. */
export function tableOutcome(derived: DerivedCharacter, catalog: ContentCatalog, ruleKey: string): TableOutcome | null {
  const contract = featureContract(catalog, ruleKey);
  if (!contract) return null;
  const scope = characterScope(derived);
  const outcome = contractOutcome(contract, scope);
  const applied: string[] = [];
  const selfMarks: string[] = [];
  const removed: string[] = [];
  const party: TableOutcome["party"] = { grants: [] };
  const formula = (operation: { dice?: string; amount?: unknown }) => {
    const flat = operation.amount === undefined ? undefined : Number(evaluate(operation.amount as never, scope));
    const parts = [operation.dice, Number.isFinite(flat) && flat ? `${operation.dice ? (flat > 0 ? "+" : "-") : ""}${Math.abs(flat as number)}` : ""].filter(Boolean);
    return parts.join("") || undefined;
  };
  for (const entry of contract.entryPoints) {
    if (ATTACK_INVOCATIONS.has(entry.invocation)) continue;
    for (const operation of entry.operations) {
      if ("when" in operation && operation.when && evaluate(operation.when, scope) !== true) continue;
      if (operation.kind === "condition.apply" && operation.target !== "self") { applied.push(operation.condition); continue; }
      if (operation.kind === "condition.apply") { selfMarks.push(operation.condition); continue; }
      // V3f (D260): a condition the use takes off the people it is aimed at.
      if (operation.kind === "condition.remove" && operation.target !== "self") { removed.push(operation.condition); continue; }
      // R58 (D193): the half aimed at other people. The sheet cannot answer any of it — it does not know who.
      if (!("target" in operation) || !atOthers(operation.target)) continue;
      if (operation.kind === "temp-hp.grant") party.tempHp = formula(operation);
      else if (operation.kind === "healing.apply") party.heal = formula(operation);
      else if (operation.kind === "content.grant") party.grants.push(operation.contentId);
    }
  }
  const targets = contract.entryPoints.find((entry) => entry.targeting)?.targeting;
  if (targets?.max) party.max = targets.max;
  const table: TableOutcome = {
    label: derived.features.find((feature) => feature.id.endsWith(ruleKey))?.name ?? ruleKey,
    conditionsApplied: applied,
    conditionsRemoved: removed,
    selfMarks,
    deathSave: outcome.deathSave,
    notes: outcome.notes,
    artifacts: outcome.artifacts.map((item) => ({ kind: item.kind, monsterId: item.monsterId, count: item.count })),
    party,
  };
  const asks = table.conditionsApplied.length || table.conditionsRemoved.length || table.selfMarks.length || table.deathSave || table.notes.length || table.artifacts.length
    || party.tempHp || party.heal || party.grants.length;
  return asks ? table : null;
}
