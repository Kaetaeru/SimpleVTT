/**
 * The runtime that goes with a source when it is saved — shared by the library (context.saveCharacter) and the
 * campaign journal (a character edited at the table). Maxima the runtime is reconciled against are the base sheet
 * (worn items and bag, no effects), so `maxSeen` always means "base maximum last seen" and a level-up raises
 * current HP by the real gain; current HP never exceeds the maximum in force (Aid ended, an effect dropped).
 */
import type { ContentCatalog } from "../catalog/catalog";
import { deriveCharacter } from "./derive";
import { initialRuntime, reconcileRuntime, type CharacterRuntime } from "./runtime";
import type { CharacterSource } from "./types";

export type RuntimeInput = CharacterRuntime | ((current: CharacterRuntime) => CharacterRuntime) | undefined;

export function resolveRuntime(source: CharacterSource, catalog: ContentCatalog, stored: CharacterRuntime | undefined, runtime: RuntimeInput): CharacterRuntime {
  const baseFor = (rt: CharacterRuntime | undefined) => deriveCharacter(source, catalog, rt ? { equipped: rt.equipped, inventory: rt.inventory } : {});
  let next: CharacterRuntime;
  if (typeof runtime === "function") next = runtime(stored ?? initialRuntime(baseFor(undefined)));
  else if (runtime) next = runtime;
  else next = stored ? reconcileRuntime(stored, baseFor(stored)) : initialRuntime(baseFor(undefined));
  const live = next.effects?.length ? deriveCharacter(source, catalog, { equipped: next.equipped, inventory: next.inventory, effects: next.effects }) : baseFor(next);
  if (next.hp.current > live.hp.max) next = { ...next, hp: { ...next.hp, current: live.hp.max } };
  return { ...next, characterId: source.id };
}
