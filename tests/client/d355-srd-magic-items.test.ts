/**
 * V0.9 D355 (MAGIC_ITEMS_PLAN.md MI-6): the SRD 5.2.1 magic items, built from the translation and the decisions in
 * content/srd-authoring/magic-items.json, carried by the built-in catalog.
 *
 * These are spot checks on real entries through the same paths play uses: a score-setting item, a wand's charges and
 * spell, charges that never come back, a crystal ball's spell cast for no charge, a potion that gives temporary hit
 * points and a spell, and an item that asks for its base. Every entry's definition is also read by the parser a
 * pasted item goes through, and nothing it says may be refused.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";
import { autofill } from "../../client/character/autofill";
import { baseChoices, officialMagicItem, parseCustomItem } from "../../client/character/customItem";
import { addItem, longRest, toggleAttune } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import type { CharacterRuntime } from "../../client/character/runtime";
import { derivedOf } from "../../client/rules/attackSpec";
import { itemUse } from "../../client/rules/items";
import { castableSpells, pcSpell } from "../../client/rules/spellcast";
import { sourceOf } from "./support";

const ID = (slug: string) => `dnd.srd521.magic-item.${slug}`;

function hero() {
  const cat = createCatalog([]);
  const made = autofill(sourceOf({ name: "모험가", classes: "fighter", level: 5, abilities: { str: 10 } }), cat);
  const derive = (runtime: CharacterRuntime) => derivedOf({ source: made.source, runtime } as never, cat);
  const carry = (runtime: CharacterRuntime, slug: string, attune = true) => {
    const view = cat.itemById(ID(slug))!;
    const next = addItem(runtime, { itemId: view.id, name: view.name });
    const item = derive(next).inventory.find((line) => line.officialId === view.id)!;
    return attune && item.magic?.attunement ? toggleAttune(next, item.instanceId, 3, item.magic) : next;
  };
  return { cat, made, derive, carry, start: initialRuntime(made.derived) };
}

test("D355: every SRD magic item is in the catalog and reads cleanly", () => {
  const cat = createCatalog([]);
  const magic = cat.items.filter((item) => item.kind === "magic");
  assert.ok(magic.length >= 317, `${magic.length}`);
  const problems = magic.flatMap((item) => {
    const read = parseCustomItem(JSON.stringify({ ...item.magic, name: item.name }), cat);
    return "error" in read ? [`${item.id}: ${read.error}`] : read.warnings.map((line) => `${item.id}: ${line}`);
  });
  assert.deepEqual(problems, []);
  assert.ok(magic.every((item) => typeof item.magic?.description === "string" && item.magic.description.length > 0), "every item carries its text");
});

test("D355: 오우거 힘의 건틀릿 sets Strength to 19 while attuned", () => {
  const { derive, carry, start } = hero();
  assert.equal(derive(carry(start, "gauntlets-of-ogre-power")).abilities.str.score, 19);
});

test("D355: 거미줄의 마법봉 casts web at DC 13 from its charges, and dawn rolls 1d6+1 back", () => {
  const { cat, derive, carry, start } = hero();
  const live = carry(start, "wand-of-web");
  const sheet = derive(live);
  const pool = sheet.resources.find((resource) => resource.id === `resource.${ID("wand-of-web")}`)!;
  assert.equal(pool.max, 7);
  assert.ok(castableSpells(sheet).includes("dnd.srd521.spell.web"));
  const cast = pcSpell({ runtime: live }, sheet, cat, "dnd.srd521.spell.web", { kind: "resource", id: pool.id })!;
  assert.equal(cast.casterStats.saveDc, 13);
  const spent = { ...live, resourcesUsed: { [pool.id]: 7 } };
  assert.equal(longRest(spent, derive(spent), () => 3).resourcesUsed[pool.id], 7 - (3 + 1));
});

test("D355: 세 가지 소원의 반지 — the rubies never come back", () => {
  const { derive, carry, start } = hero();
  const live = carry(start, "ring-of-three-wishes");
  const pool = `resource.${ID("ring-of-three-wishes")}`;
  const spent = { ...live, resourcesUsed: { [pool]: 1 } };
  assert.equal(longRest(spent, derive(spent), () => 6).resourcesUsed[pool], 1);
});

test("D355: 수정구 casts scrying for no charge, at the item's DC", () => {
  const { cat, derive, carry, start } = hero();
  const live = carry(start, "crystal-ball");
  const sheet = derive(live);
  assert.ok(castableSpells(sheet).includes("dnd.srd521.spell.scrying"));
  const pool = sheet.resources.find((resource) => resource.freeCastSpellIds?.includes("dnd.srd521.spell.scrying"))!;
  const cast = pcSpell({ runtime: live }, sheet, cat, "dnd.srd521.spell.scrying", { kind: "resource", id: pool.id })!;
  assert.equal(cast.casterStats.saveDc, 17);
  assert.ok(cast.spend(live), "nothing to pay");
});

test("D355: 영웅심의 물약 gives temporary hit points and bless", () => {
  const { cat } = hero();
  const view = cat.itemById(ID("potion-of-heroism"))!;
  const use = itemUse({ name: view.name, kind: "magic", itemId: view.id, magic: officialMagicItem(view.name, view.magic!, cat) }, cat);
  assert.equal(use.tempHp, "10");
  assert.equal(use.effect?.key, "spell:dnd.srd521.spell.bless");
  assert.equal(use.consumes, true);
});

test("D355: 불꽃 혀 asks for a melee weapon", () => {
  const { cat } = hero();
  const view = cat.itemById(ID("flame-tongue"))!;
  const definition = officialMagicItem(view.name, view.magic!, cat)!;
  const bases = baseChoices(cat, definition.baseOptions!);
  assert.ok(bases.some((item) => item.id === "dnd.srd521.item.weapon.longsword"));
  assert.ok(bases.every((item) => item.weapon?.mode === "melee"));
});
