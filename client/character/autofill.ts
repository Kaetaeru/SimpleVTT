/**
 * Auto-answer every open choice with its first available options (the wizard's "빠르게 채우기" and the test harness).
 * Re-derives until no choice is unanswered or no progress can be made; returns the completed source and derivation.
 */
import type { ContentCatalog } from "../catalog/catalog";
import { deriveCharacter } from "./derive";
import type { CharacterSource, ChoiceRequest, DerivedCharacter } from "./types";

export interface AutofillOptions {
  /** Preferred answers by choice id; used before the default "first options" rule. */
  prefer?: Record<string, string[]>;
  /** Pick options by a predicate instead of the first ones (e.g. random). */
  pick?: (choice: ChoiceRequest) => string[];
  maxRounds?: number;
}

export function autofill(source: CharacterSource, catalog: ContentCatalog, options: AutofillOptions = {}): { source: CharacterSource; derived: DerivedCharacter; rounds: number } {
  let current: CharacterSource = { ...source, choices: { ...source.choices } };
  let derived = deriveCharacter(current, catalog);
  const maxRounds = options.maxRounds ?? 40;
  let rounds = 0;
  while (rounds < maxRounds) {
    rounds += 1;
    let changed = false;
    for (const choice of derived.choices) {
      if (choice.selected.length >= choice.count) continue;
      const available = choice.options.filter((option) => !option.disabledReason && !choice.selected.includes(option.id));
      if (available.length === 0) continue;
      const preferred = (options.prefer?.[choice.id] ?? []).filter((id) => available.some((option) => option.id === id));
      const picked = options.pick ? options.pick(choice) : [...preferred, ...available.map((option) => option.id).filter((id) => !preferred.includes(id))];
      const next = [...choice.selected, ...picked.filter((id) => !choice.selected.includes(id))].slice(0, choice.count);
      if (next.length === choice.selected.length) continue;
      current = { ...current, choices: { ...current.choices, [choice.id]: next } };
      changed = true;
    }
    if (!changed) break;
    derived = deriveCharacter(current, catalog);
  }
  return { source: current, derived, rounds };
}
