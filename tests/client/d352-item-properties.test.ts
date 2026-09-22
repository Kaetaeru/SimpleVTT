/**
 * V0.9 D352 (MAGIC_ITEMS_PLAN.md MI-3): what a working magic item gives besides bonuses, and items with contracts.
 *
 * A magic item may set an ability score (the score becomes N unless already higher), make its bearer immune to a
 * damage type or a condition, give a speed or darkvision, and add damage of its own type to its weapon's hits. An
 * official item whose entry carries a `common-play` contract is, while it works, a feature of its bearer: its
 * standing properties land on the sheet and its labelled uses are buttons, spending the item's own charges.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { activateFeature, usableFeatures } from "../../client/character/activate";
import { autofill } from "../../client/character/autofill";
import { addItem, toggleAttune } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import type { CharacterRuntime } from "../../client/character/runtime";
import { derivedOf } from "../../client/rules/attackSpec";
import { sourceOf } from "./support";

const GAUNTLETS = "test.d352.magic.ogre-gauntlets";
const AMULET = "test.d352.magic.wind-amulet";
const BLADE = "test.d352.magic.ember-blade";
const BOOTS = "test.d352.magic.quick-boots";

const entry = (id: string, name: string, definition: Record<string, unknown>, contract?: Record<string, unknown>) => ({
  id, category: "magic-item",
  presentation: { originalName: name, defaultLocale: "ko-KR", locales: { "ko-KR": { name, description: `${name} 설명` } } },
  mechanics: [{ kind: "magic-item-definition", config: definition }, ...(contract ? [{ kind: "common-play", config: contract }] : [])],
});

const MODULE = { moduleId: "test.d352", moduleVersion: "1", content: [
  entry(GAUNTLETS, "거인 장갑", { type: "wondrous", rarity: "uncommon", attunement: true, abilities: { str: 19 } }),
  entry(AMULET, "바람 부적", { type: "wondrous", rarity: "rare", immunities: ["poison"], conditionImmunities: ["poisoned"], speeds: { fly: "walk" }, darkvision: 60 }),
  entry(BLADE, "불씨 검", { type: "weapon", rarity: "rare", base: "longsword", bonus: { extraDamage: { dice: "2d6", type: "fire" } } }),
  entry(BOOTS, "재빠른 장화", { type: "wondrous", rarity: "rare", attunement: true, charges: { max: 3 } }, { id: BOOTS, entryPoints: [
    { id: "passive", invocation: "manual", operations: [{ kind: "property.modify", property: "ability-check.advantage", operation: "add", abilities: ["dex"], note: "민첩 판정 유리" }] },
    { id: "dash", label: "뒤꿈치 부딪치기", invocation: "manual", payments: [{ kind: "economy", bucket: "bonus-action", amount: { value: 1 }, consumeAt: "commit" }], operations: [
      { kind: "resource.change", resource: `resource:${BOOTS}`, amount: -1, target: "self" },
      { kind: "effect.apply", template: { name: "빠른 걸음", duration: "10분", rounds: 100 } },
    ] },
  ] }),
] } as unknown as RuleModuleJson;

function bearer(str = 10) {
  const cat = createCatalog([MODULE]);
  const made = autofill(sourceOf({ name: "모험가", classes: "fighter", level: 3, abilities: { str } }), cat);
  const derive = (runtime: CharacterRuntime) => derivedOf({ source: made.source, runtime } as never, cat);
  const carry = (runtime: CharacterRuntime, id: string, name: string, attune = false) => {
    const next = addItem(runtime, { itemId: id, name });
    if (!attune) return next;
    const item = derive(next).inventory.find((line) => line.name === name)!;
    return toggleAttune(next, item.instanceId, 3, item.magic);
  };
  return { cat, made, derive, carry, start: initialRuntime(made.derived) };
}

test("D352: an item that sets a score raises it while attuned, and a higher score stays", () => {
  const weak = bearer(10);
  const plain = weak.derive(weak.start).abilities.str.score;
  const worn = weak.derive(weak.carry(weak.start, GAUNTLETS, "거인 장갑"));
  assert.equal(worn.abilities.str.score, plain, "not attuned yet");
  const attuned = weak.derive(weak.carry(weak.start, GAUNTLETS, "거인 장갑", true));
  assert.equal(attuned.abilities.str.score, 19);
  assert.equal(attuned.abilities.str.modifier, 4);
  assert.equal(attuned.saves.str.bonus, weak.derive(weak.start).saves.str.bonus + 4 - weak.derive(weak.start).abilities.str.modifier, "the save reads the raised score");
  const strong = bearer(20);
  assert.equal(strong.derive(strong.carry(strong.start, GAUNTLETS, "거인 장갑", true)).abilities.str.score, 20, "already higher: no change");
});

test("D352: immunities, a flying speed equal to walking, and darkvision", () => {
  const { derive, carry, start } = bearer();
  const sheet = derive(carry(start, AMULET, "바람 부적"));
  assert.ok(sheet.defenses.immunities.some((line) => line.includes("독")), JSON.stringify(sheet.defenses));
  assert.ok(sheet.defenses.conditionImmunities.includes("중독"), JSON.stringify(sheet.defenses));
  assert.equal(sheet.speed.fly, sheet.speed.walk);
  assert.equal(sheet.senses.darkvision, 60);
});

test("D352: a weapon's damage of its own type rides on its own attack row", () => {
  const { derive, carry, start } = bearer(16);
  const sheet = derive(carry(start, BLADE, "불씨 검"));
  const row = sheet.attacks.find((attack) => attack.name === "불씨 검")!;
  assert.deepEqual(row.extraDamage?.map((part) => [part.formula, part.type]), [["2d6", "화염"]]);
  assert.ok(!sheet.attacks.filter((attack) => attack.name !== "불씨 검").some((attack) => attack.extraDamage?.length), "only that weapon");
});

test("D352: an item's contract is its bearer's feature while it works — a standing property and a button", () => {
  const { cat, derive, carry, start } = bearer();
  const unattuned = carry(start, BOOTS, "재빠른 장화");
  assert.equal(usableFeatures(derive(unattuned), unattuned, cat).some((use) => use.feature.name === "뒤꿈치 부딪치기"), false, "not attuned: no button");
  const live = carry(start, BOOTS, "재빠른 장화", true);
  const sheet = derive(live);
  assert.ok(sheet.features.some((feature) => feature.source === "item" && feature.name === "재빠른 장화"));
  assert.ok(JSON.stringify(sheet.rollAdvantage ?? []).includes("dex"), JSON.stringify(sheet.rollAdvantage));
  const button = usableFeatures(sheet, live, cat).find((use) => use.feature.name === "뒤꿈치 부딪치기");
  assert.ok(button, JSON.stringify(usableFeatures(sheet, live, cat).map((use) => use.feature.name)));
  assert.equal(button!.bonus, true);
  assert.equal(button!.pool?.id, `resource.${BOOTS}`, "it spends the item's charges");
});

test("D352: pressing the item's use spends a charge and starts its effect", async () => {
  const { cat, made, derive, carry, start } = bearer();
  let saved = carry(start, BOOTS, "재빠른 장화", true);
  const sheet = derive(saved);
  const button = usableFeatures(sheet, saved, cat).find((use) => use.feature.name === "뒤꿈치 부딪치기")!;
  const outcome = await activateFeature(button.feature, {
    source: made.source, catalog: cat, derived: sheet, runtime: saved,
    rollDice: async (spec) => ({ ...spec, id: "r", dice: [], modifier: 0, total: 1, at: "" }),
    save: (updater) => { saved = updater(saved); },
  });
  assert.equal(outcome, "done");
  assert.equal(saved.resourcesUsed[`resource.${BOOTS}`], 1, "one charge");
  assert.ok((saved.effects ?? []).some((effect) => effect.key === `feature:${BOOTS}#dash` && effect.rounds === 100), JSON.stringify(saved.effects));
});
