/**
 * V2 (D254): the character half of a table host's wiring — how the host asks a sheet for its combat numbers, attacks,
 * spells, reactions, triggers, rests and items. The app and the host-path tests use this one factory, so a test that
 * plays a round through `TableHost` runs exactly the rules the table does. `catalog` is read on every call, because
 * the app swaps catalogs when modules are installed.
 */
import type { ContentCatalog } from "../catalog/catalog";
import type { JournalCharacter } from "../campaign/journal";
import type { CharacterRuntime } from "../character/runtime";
import { deriveCharacter } from "../character/derive";
import { hitDiceAvailable, longRest, setItemQuantity, shortRest, spendHitDie, spendResource } from "../character/play";
import { restFeatures, spentSlots, useRestFeature } from "../character/rest";
import { pcStats } from "../rules/actions";
import { attackAftermath, emptyAftermath } from "../rules/attackAftermath";
import { derivedOf, hitOffers, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../rules/attackSpec";
import { pcGuards } from "../rules/contractReactions";
import { tableOutcome } from "../rules/contractTable";
import { payContract, pcRescues } from "../rules/contractUse";
import { itemUse } from "../rules/items";
import { castableSpells, cheapestCast, pcSpell } from "../rules/spellcast";
import { formula as contractFormula, metamagicOptions } from "../rules/contractActivation";
import { CAST_INVOCATION, characterScope, evaluate, TURN_END_INVOCATION, TURN_START_INVOCATION } from "../rules/contract";
import { featureContract } from "../rules/contractActivation";
import { featureRuleKey } from "../rules/activation";
import type { TableHostOptions } from "./host";
import type { ActiveEffect } from "../character/types";
import type { Scope } from "../rules/contract";

/**
 * D321: while a spell effect's own contract runs, the numbers belong to the cast that started it — the slot level,
 * the caster's save DC and their spellcasting modifier. Without this a save at the start of a turn used the bearer's
 * own DC (or none at all) and nothing could scale with the slot the spell was cast at.
 */
const castScope = (base: Scope, cast: ActiveEffect["cast"]): Scope => (cast
  ? (ref) => (ref === "spell.save-dc" ? cast.saveDc : ref === "spell.modifier" ? cast.modifier : ref === "spell.slot-level" ? cast.level : base(ref))
  : base);

/** An effect saved before D321 carries no cast: fall back to the sheet's own spellcasting, as the table did then. */
const ownCast = (derived: ReturnType<typeof derivedOf>): ActiveEffect["cast"] => {
  const entry = derived.spellcasting[0];
  return entry ? { level: 0, saveDc: entry.saveDc, modifier: derived.abilities[entry.ability].modifier } : undefined;
};

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
    // V4r (D280): the metamagics the caster chose — their points come off the sheet, and what they change rides along.
    pcMetamagic: (entry, keys) => {
      const derived = derivedOf(entry, catalog());
      const options = metamagicOptions(derived, catalog(), characterScope(derived)).filter((option) => keys.includes(option.key));
      if (!options.length) return null;
      return {
        labels: options.map((option) => option.name),
        notes: options.flatMap((option) => (option.note ? [`${option.name}: ${option.note}`] : [])),
        ...(options.some((option) => option.effect === "target-save-disadvantage") ? { saveDisadvantage: options.find((option) => option.effect === "target-save-disadvantage")!.name } : {}),
        ...(options.some((option) => option.effect === "bonus-action") ? { bonusAction: true } : {}),
        // V5h (D296): 비전의 신격 — the first metamagic on a cast is free while 선천 마법 runs.
        ...(derived.metamagicFree ? { freeFirst: true } : {}),
        spend: (runtime) => options.reduce<CharacterRuntime | null>((acc, option, index) => (acc && option.cost && !(derived.metamagicFree && index === 0) ? spendResource(acc, derived, option.resourceId, option.cost, option.name) : acc), runtime),
      };
    },
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
      const baseScope = characterScope(derived, { "actor.hp.current": entry.runtime.hp.current, "actor.hp.max": derived.hp.max });
      // V4t (D282): a spell's own contract may carry a turn-start rule too, for the effects this sheet is under.
      const sources: Array<{ label: string; contract: ReturnType<typeof featureContract>; cast?: ActiveEffect["cast"] }> = [
        ...derived.features.map((feature) => ({ label: feature.name, contract: featureContract(catalog(), featureRuleKey(feature.id)) })),
        ...(entry.runtime.effects ?? []).filter((effect) => effect.source === "spell").map((effect) => ({ label: effect.name, contract: catalog().contractFor(effect.key), cast: effect.cast })),
      ];
      return sources.flatMap(({ label, contract, cast }) => (contract?.entryPoints ?? [])
        .filter((point) => point.invocation === TURN_START_INVOCATION)
        .flatMap((point) => point.operations)
        .flatMap((operation) => {
          // D321: inside a spell effect, the numbers are the caster's — the slot it was cast at, their DC, their modifier.
          const scope = castScope(baseScope, cast ?? ownCast(derived));
          if ("when" in operation && operation.when && evaluate(operation.when, scope) !== true) return [];
          if (operation.kind === "healing.apply") return [{ label, amount: Number(evaluate(operation.amount, scope)) || 0, max: derived.hp.max }];
          if (operation.kind === "temp-hp.grant") return [{ label, amount: 0, max: derived.hp.max, tempHp: Number(evaluate(operation.amount, scope)) || 0 }];
          if (operation.kind === "damage.apply") { const rolled = contractFormula(operation.dice, operation.amount, scope, operation.diceCount, operation.diceSides); return rolled ? [{ label, amount: 0, max: derived.hp.max, damage: { formula: rolled, type: operation.damageType } }] : []; }
          if (operation.kind === "property.modify" && operation.property === "heroic-inspiration.gain") return [{ label, amount: 0, max: derived.hp.max, inspiration: true }];
          return [];
        }));
    },
    pcExtraTurns: (entry) => derivedOf(entry, catalog()).extraTurns ?? [],
    pcHitDefense: (entry) => derivedOf(entry, catalog()).hitDefense,
    pcAuras: (entry) => derivedOf(entry, catalog()).auras ?? [],
    // V4h (D270): the conditions a turn-end contract sheds, one of them per turn (자기 회복).
    pcTurnEnd: (entry) => {
      const derived = derivedOf(entry, catalog());
      // V5c (D291): the effects this sheet is under carry turn-end rules too, and one of them may be damage.
      const baseScope = characterScope(derived, { "actor.hp.current": entry.runtime.hp.current, "actor.hp.max": derived.hp.max });
      const sources = [
        ...derived.features.map((feature) => ({ label: feature.name, contract: featureContract(catalog(), featureRuleKey(feature.id)), cast: undefined as ActiveEffect["cast"] })),
        ...(entry.runtime.effects ?? []).filter((effect) => effect.source === "spell").map((effect) => ({ label: effect.name, contract: catalog().contractFor(effect.key), cast: effect.cast })),
      ];
      return sources.flatMap(({ label, contract, cast }) => {
        const scope = castScope(baseScope, cast ?? ownCast(derived));
        const operations = (contract?.entryPoints ?? []).filter((point) => point.invocation === TURN_END_INVOCATION).flatMap((point) => point.operations);
        const conditions = operations.flatMap((operation) => (operation.kind === "condition.remove" ? [operation.condition] : []));
        const hurt = operations.find((operation) => operation.kind === "damage.apply");
        if (hurt && hurt.kind === "damage.apply") {
          const rolled = contractFormula(hurt.dice, hurt.amount, scope, hurt.diceCount, hurt.diceSides);
          if (rolled) return [{ label, conditions: [], damage: { formula: rolled, type: hurt.damageType, ...(hurt.save ? { save: { ability: hurt.save.ability, dc: Number(evaluate(hurt.save.dc, scope)) || 10 } } : {}) } }];
        }
        return conditions.length ? [{ label, conditions }] : [];
      });
    },
    // D324: one Hit Point Die spent where a rule asks for it (생명 흡수자), the same arithmetic the sheet uses.
    pcSpendHitDie: (entry, random) => {
      const derived = derivedOf(entry, catalog());
      const left = hitDiceAvailable(entry.runtime, derived);
      const die = Object.keys(left).filter((size) => (left[size] ?? 0) > 0).sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)))[0];
      if (!die) return null;
      const rolled = 1 + Math.floor(random() * (Number(die.slice(1)) || 8));
      const before = entry.runtime.hp.current;
      const runtime = spendHitDie(entry.runtime, derived, die, rolled);
      return { runtime, die, rolled, healed: runtime.hp.current - before };
    },
    // D324: a die the sheet rolls as it casts (주문 회상의 은총: a d4 that keeps the slot when it matches its level).
    pcCastRolls: (entry, level, random) => {
      const derived = derivedOf(entry, catalog());
      const scope = characterScope(derived, { "spell.slot-level": level });
      const rolls: Array<{ label: string; die: string; rolled: number; keepsSlot: boolean; note: string; damage?: { formula: string; type: string } }> = [];
      // D326: an effect the sheet is under may also answer a cast (소원's price: damage every time you cast).
      const sources = [
        ...derived.features.map((feature) => ({ label: feature.name, contract: featureContract(catalog(), featureRuleKey(feature.id)), cast: undefined as ActiveEffect["cast"] })),
        ...(entry.runtime.effects ?? []).filter((effect) => effect.source === "spell").map((effect) => ({ label: effect.name, contract: catalog().contractFor(effect.key), cast: effect.cast })),
      ];
      for (const feature of sources) {
        const contract = feature.contract;
        const inner = castScope(scope, feature.cast);
        for (const point of (contract?.entryPoints ?? []).filter((item) => item.invocation === CAST_INVOCATION)) {
          for (const operation of point.operations) {
            if ("when" in operation && operation.when && evaluate(operation.when, inner) !== true) continue;
            if (operation.kind === "damage.apply") {
              const formula = contractFormula(operation.dice, operation.amount, inner, operation.diceCount, operation.diceSides);
              if (formula) rolls.push({ label: feature.label, die: formula, rolled: 0, keepsSlot: false, note: `${formula} ${operation.damageType}`, damage: { formula, type: operation.damageType } });
              continue;
            }
            if (operation.kind !== "resource.recharge") continue;
            const sides = Number(/d(\d+)/.exec(operation.die)?.[1] ?? 6);
            const rolled = 1 + Math.floor(random() * sides);
            const wanted = operation.succeedsOnValue !== undefined ? Number(evaluate(operation.succeedsOnValue, inner)) : undefined;
            const keepsSlot = wanted !== undefined ? rolled === wanted : operation.succeedsOn.includes(rolled);
            rolls.push({ label: feature.label, die: operation.die, rolled, keepsSlot, note: wanted !== undefined ? `${operation.die} = ${rolled} vs 슬롯 ${wanted}` : `${operation.die} = ${rolled}` });
          }
        }
      }
      return rolls;
    },
    // D321: a monster under a spell effect gets the same turn rules a character does; its numbers are the cast's.
    npcEffectTurn: (entry, boundary) => {
      const invocation = boundary === "start" ? TURN_START_INVOCATION : TURN_END_INVOCATION;
      return (entry.runtime.effects ?? []).filter((effect) => effect.source === "spell").flatMap((effect) => {
        const contract = catalog().contractFor(effect.key);
        const scope = castScope((ref) => (ref === "actor.hp.current" ? entry.runtime.hp.current : ref === "actor.hp.max" ? entry.runtime.hp.max : undefined), effect.cast);
        type EffectTurnRule = { label: string; tempHp?: number; conditions?: string[]; damage?: { formula: string; type: string; save?: { ability: string; dc: number } } };
        return (contract?.entryPoints ?? []).filter((point) => point.invocation === invocation).flatMap((point) => point.operations).flatMap((operation): EffectTurnRule[] => {
          if ("when" in operation && operation.when && evaluate(operation.when, scope) !== true) return [];
          if (operation.kind === "temp-hp.grant") return [{ label: effect.name, tempHp: Number(evaluate(operation.amount, scope)) || 0 }];
          if (operation.kind === "condition.remove") return [{ label: effect.name, conditions: [operation.condition] }];
          if (operation.kind === "damage.apply") {
            const rolled = contractFormula(operation.dice, operation.amount, scope, operation.diceCount, operation.diceSides);
            return rolled ? [{ label: effect.name, damage: { formula: rolled, type: operation.damageType, ...(operation.save ? { save: { ability: operation.save.ability, dc: Number(evaluate(operation.save.dc, scope)) || 10 } } : {}) } }] : [];
          }
          return [];
        });
      });
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
