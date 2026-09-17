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
import { characterScope, evaluate, TURN_END_INVOCATION, TURN_START_INVOCATION } from "../rules/contract";
import { featureContract } from "../rules/contractActivation";
import { featureRuleKey } from "../rules/activation";
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
    pcRescues: (entry, family, outcome, d20) => pcRescues(entry, derivedOf(entry, catalog()), catalog(), family, outcome, d20),
    // R42 (D182): the table-level half of a feature's contract.
    pcContractOutcome: (entry, ruleKey) => tableOutcome(derivedOf(entry, catalog()), catalog(), ruleKey),
    // R58 (D193): the host owns no catalog, so it asks for the name of an id a contract handed somebody.
    contentName: (contentId) => catalog().itemById(contentId)?.name ?? catalog().entry(contentId)?.name,
    pcPayContract: (entry, payments, outcome) => payContract(entry.runtime, derivedOf(entry, catalog()), payments, outcome),
    pcTriggers: (entry, event, nearby) => {
      const derived = derivedOf(entry, catalog());
      return restFeatures(derived, entry.runtime, catalog(), event, { nearby }).filter((feature) => !feature.unavailable).map((feature) => ({ featureId: feature.featureId, name: feature.name, ...(feature.note ? { note: feature.note } : {}), ...(feature.heal ? { heal: feature.heal } : {}), ...(feature.slotLevels ? { slotLevels: feature.slotLevels, spent: spentSlots(derived, entry.runtime) } : {}) }));
    },
    pcTriggerApply: (entry, event, choice, roll) => {
      const derived = derivedOf(entry, catalog());
      const feature = restFeatures(derived, entry.runtime, catalog(), event).find((item) => item.featureId === choice.featureId);
      return feature ? useRestFeature(entry.runtime, derived, feature, feature.slotLevels ? choice.slots : undefined, feature.heal ? roll(feature.heal) : undefined) : null;
    },
    pcRest: (entry, kind) => { const derived = derivedOf(entry, catalog()); return kind === "long" ? longRest(entry.runtime, derived) : shortRest(entry.runtime, derived); },
    pcReactionSpell: (entry, spellId) => { const derived = derivedOf(entry, catalog()); if (!castableSpells(derived).includes(spellId)) return null; const view = catalog().spellById(spellId); return view ? cheapestCast(derived, entry.runtime, view.level) : null; },
    // V3c (D257): turn-start contracts — healing whose `when` holds against the sheet's hit points right now.
    pcTurnStart: (entry) => {
      const derived = derivedOf(entry, catalog());
      const scope = characterScope(derived, { "actor.hp.current": entry.runtime.hp.current, "actor.hp.max": derived.hp.max });
      return derived.features.flatMap((feature) => (featureContract(catalog(), featureRuleKey(feature.id))?.entryPoints ?? [])
        .filter((point) => point.invocation === TURN_START_INVOCATION)
        .flatMap((point) => point.operations)
        .flatMap((operation) => ("when" in operation && operation.when && evaluate(operation.when, scope) !== true ? [] : operation.kind === "healing.apply" ? [{ label: feature.name, amount: Number(evaluate(operation.amount, scope)) || 0, max: derived.hp.max }] : operation.kind === "property.modify" && operation.property === "heroic-inspiration.gain" ? [{ label: feature.name, amount: 0, max: derived.hp.max, inspiration: true }] : [])));
    },
    pcExtraTurns: (entry) => derivedOf(entry, catalog()).extraTurns ?? [],
    pcHitDefense: (entry) => derivedOf(entry, catalog()).hitDefense,
    pcAuras: (entry) => derivedOf(entry, catalog()).auras ?? [],
    // V4h (D270): the conditions a turn-end contract sheds, one of them per turn (자기 회복).
    pcTurnEnd: (entry) => {
      const derived = derivedOf(entry, catalog());
      return derived.features.flatMap((feature) => { const contract = featureContract(catalog(), featureRuleKey(feature.id)); const conditions = (contract?.entryPoints ?? []).filter((point) => point.invocation === TURN_END_INVOCATION).flatMap((point) => point.operations).flatMap((operation) => (operation.kind === "condition.remove" ? [operation.condition] : [])); return conditions.length ? [{ label: feature.name, conditions }] : []; });
    },
    pcZeroHolds: (entry) => {
      const derived = derivedOf(entry, catalog());
      const running = new Set((entry.runtime.effects ?? []).map((effect) => effect.name));
      const left = (id: string) => (derived.resources.find((resource) => resource.id === id)?.max ?? 0) - (entry.runtime.resourcesUsed[id] ?? 0);
      return (derived.zeroHolds ?? []).filter((hold) => (!hold.requiresEffect || running.has(hold.requiresEffect)) && (!hold.resourceId || left(hold.resourceId) > 0))
        .map((hold) => ({ ...hold, ...(hold.save ? { save: { ...hold.save, dc: hold.save.dc + hold.save.step * (hold.save.stepResourceId ? entry.runtime.resourcesUsed[hold.save.stepResourceId] ?? 0 : 0) } } : {}) }));
    },
    pcUpkeepEffects: (entry) => {
      const waived = derivedOf(entry, catalog()).upkeepWaived ?? [];
      return (entry.runtime.effects ?? []).filter((effect) => (catalog().contractFor(effect.key)?.entryPoints ?? []).some((point) => point.operations.some((operation) => operation.kind === "property.modify" && operation.property === "effect.upkeep"))).map((effect) => ({ key: effect.key, name: effect.name, waived: waived.includes(effect.key) }));
    },
    pcSlotHealSelf: (entry) => derivedOf(entry, catalog()).slotHealSelf,
    pcOncePerTurnRiders: (entry) => (derivedOf(entry, catalog()).attackRiders ?? []).filter((rider) => rider.oncePerTurn && rider.moment === "pre-roll").map((rider) => rider.key),
    pcRevealsDefenses: (entry, spellId) => (derivedOf(entry, catalog()).revealDefenses ?? []).includes(spellId),
    pcItem: (entry, instanceId) => { const derived = derivedOf(entry, catalog()); const item = derived.inventory.find((candidate) => candidate.instanceId === instanceId); if (!item || item.quantity <= 0) return null; const use = itemUse(item, catalog()); return { name: item.name, heal: use.heal, text: use.text, consumes: use.consumes, consume: (runtime) => (use.consumes ? setItemQuantity(runtime, derived, instanceId, item.quantity - 1) : runtime) }; },
  };
}
