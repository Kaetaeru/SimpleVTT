/**
 * V2 (D254): the character half of a table host's wiring — how the host asks a sheet for its combat numbers, attacks,
 * spells, reactions, triggers, rests and items. The app and the host-path tests use this one factory, so a test that
 * plays a round through `TableHost` runs exactly the rules the table does. `catalog` is read on every call, because
 * the app swaps catalogs when modules are installed.
 */
import type { ContentCatalog } from "../catalog/catalog";
import type { JournalCharacter } from "../campaign/journal";
import { deriveCharacter } from "../character/derive";
import { longRest, setItemQuantity, shortRest } from "../character/play";
import { restFeatures, spentSlots, useRestFeature } from "../character/rest";
import { pcStats } from "../rules/actions";
import { attackAftermath, emptyAftermath } from "../rules/attackAftermath";
import { derivedOf, hitOffers, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../rules/attackSpec";
import { pcGuards } from "../rules/contractReactions";
import { tableOutcome } from "../rules/contractTable";
import { payContract, pcRescues } from "../rules/contractUse";
import { itemUse } from "../rules/items";
import { castableSpells, cheapestCast, pcSpell } from "../rules/spellcast";
import type { TableHostOptions } from "./host";

/** Token bar links (D78): what a character attribute is worth right now. */
export function attributeOf(entry: JournalCharacter, link: string, catalog: ContentCatalog): { value?: number; max?: number } | undefined {
  const runtime = entry.runtime;
  if (link === "hp") { const derived = deriveCharacter(entry.source, catalog, { equipped: runtime.equipped, inventory: runtime.inventory, effects: runtime.effects }); return { value: runtime.hp.current, max: derived.hp.max }; }
  if (link === "temp") return { value: runtime.hp.temp };
  if (link === "ac") return { value: deriveCharacter(entry.source, catalog, { equipped: runtime.equipped, inventory: runtime.inventory, effects: runtime.effects }).ac.value };
  if (link === "exhaustion") return { value: runtime.exhaustion, max: 6 };
  return undefined;
}

export function pcHostOptions(catalog: () => ContentCatalog): Partial<TableHostOptions> {
  return {
    attributeOf: (entry, link) => attributeOf(entry, link, catalog()),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())),
    pcConcentrationKey,
    pcAttackSpec: (entry, attackId, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), attackId, riders, catalog()),
    // R54 (D189): the reactions this sheet's contracts open a window for.
    pcGuards: (entry, trigger) => pcGuards(entry, derivedOf(entry, catalog()), catalog(), trigger),
    // R63 (D198): what the attacker may add once a swing has landed.
    pcHitOffers: (entry, attackId, riders) => hitOffers(entry, derivedOf(entry, catalog()), attackId, riders, catalog()),
    pcAttackActionAttacks: (entry) => derivedOf(entry, catalog()).attackActionAttacks ?? 1,
    // R53 (D188): what the attacker's contracts do once the swing has landed.
    pcAftermath: (entry, attackId, outcomes) => { const derived = derivedOf(entry, catalog()); const attack = derived.attacks.find((item) => item.id === attackId); return attack ? attackAftermath(derived, catalog(), attack, outcomes) : emptyAftermath(); },
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())),
    pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalog()), catalog(), spellId, method),
    // R35 (D174): the contract rescues a sheet could pay for, and what paying one costs it.
    pcRescues: (entry, family, outcome) => pcRescues(entry, derivedOf(entry, catalog()), catalog(), family, outcome),
    // R42 (D182): the table-level half of a feature's contract.
    pcContractOutcome: (entry, ruleKey) => tableOutcome(derivedOf(entry, catalog()), catalog(), ruleKey),
    // R58 (D193): the host owns no catalog, so it asks for the name of an id a contract handed somebody.
    contentName: (contentId) => catalog().itemById(contentId)?.name ?? catalog().entry(contentId)?.name,
    pcPayContract: (entry, payments, outcome) => payContract(entry.runtime, derivedOf(entry, catalog()), payments, outcome),
    pcTriggers: (entry, event) => {
      const derived = derivedOf(entry, catalog());
      return restFeatures(derived, entry.runtime, catalog(), event).filter((feature) => !feature.unavailable).map((feature) => ({ featureId: feature.featureId, name: feature.name, ...(feature.note ? { note: feature.note } : {}), ...(feature.heal ? { heal: feature.heal } : {}), ...(feature.slotLevels ? { slotLevels: feature.slotLevels, spent: spentSlots(derived, entry.runtime) } : {}) }));
    },
    pcTriggerApply: (entry, event, choice, roll) => {
      const derived = derivedOf(entry, catalog());
      const feature = restFeatures(derived, entry.runtime, catalog(), event).find((item) => item.featureId === choice.featureId);
      return feature ? useRestFeature(entry.runtime, derived, feature, feature.slotLevels ? choice.slots : undefined, feature.heal ? roll(feature.heal) : undefined) : null;
    },
    pcRest: (entry, kind) => { const derived = derivedOf(entry, catalog()); return kind === "long" ? longRest(entry.runtime, derived) : shortRest(entry.runtime, derived); },
    pcReactionSpell: (entry, spellId) => { const derived = derivedOf(entry, catalog()); if (!castableSpells(derived).includes(spellId)) return null; const view = catalog().spellById(spellId); return view ? cheapestCast(derived, entry.runtime, view.level) : null; },
    pcItem: (entry, instanceId) => { const derived = derivedOf(entry, catalog()); const item = derived.inventory.find((candidate) => candidate.instanceId === instanceId); if (!item || item.quantity <= 0) return null; const use = itemUse(item, catalog()); return { name: item.name, heal: use.heal, text: use.text, consumes: use.consumes, consume: (runtime) => (use.consumes ? setItemQuantity(runtime, derived, instanceId, item.quantity - 1) : runtime) }; },
  };
}
