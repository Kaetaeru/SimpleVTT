/**
 * R41 (D181): the part of a contract's outcome that lands on a character sheet.
 *
 * `contractOutcome` works out what a use asks for; this applies the half of it a sheet can answer — conditions taken
 * off, a hit-point maximum moved, stabilising, standing up, an item granted. The other half (movement, artifacts on
 * the board, a question for the DM) belongs to the table and is carried as notes until the table-level entry point
 * exists; nothing is silently dropped, because the log keeps the line either way.
 */
import type { ContentCatalog } from "../catalog/catalog";
import type { DerivedCharacter } from "./types";
import type { ContractOutcome } from "../rules/contractActivation";
import { addItem, noteLog, toggleCondition } from "./play";
import type { CharacterRuntime } from "./runtime";
import { restoreSlots } from "./rest";

export function applyContractOutcome(runtime: CharacterRuntime, derived: DerivedCharacter, catalog: ContentCatalog, outcome: ContractOutcome, label: string): CharacterRuntime {
  let next = runtime;
  for (const condition of outcome.conditionsRemoved) if (next.conditions.includes(condition)) next = toggleCondition(next, condition);
  if (outcome.stand && next.conditions.includes("넘어짐")) next = toggleCondition(next, "넘어짐");
  if (outcome.stabilize) next = noteLog({ ...next, deathSaves: { success: 0, failure: 0 }, conditions: next.conditions.filter((item) => item !== "무의식") }, `${label}: 안정`);
  if (outcome.hpMaximumDelta) {
    const max = Math.max(1, next.hp.maxSeen + outcome.hpMaximumDelta);
    next = noteLog({ ...next, hp: { ...next.hp, maxSeen: max, current: Math.min(next.hp.current + Math.max(0, outcome.hpMaximumDelta), max) } }, `${label}: 최대 HP ${outcome.hpMaximumDelta > 0 ? "+" : ""}${outcome.hpMaximumDelta}`);
  }
  for (const id of outcome.grants) {
    const item = catalog.itemById(id);
    if (item) next = addItem(next, { itemId: item.id, name: item.name });
    else next = noteLog(next, `${label}: ${catalog.name(id)} 획득 (표에서 처리)`);
  }
  // R78 (D213): slots a use gives back (마법적 책략's Pact Magic slots).
  if (outcome.slotLevels || outcome.pactSlots) next = restoreSlots(next, derived, { levels: outcome.slotLevels, pact: outcome.pactSlots }, label) ?? next;
  for (const note of outcome.notes) next = noteLog(next, `${label}: ${note}`);
  return next;
}
