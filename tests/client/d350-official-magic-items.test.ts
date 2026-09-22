/**
 * V0.9 D350 (MAGIC_ITEMS_PLAN.md MI-1): official magic items in the catalog.
 *
 * The catalog had no magic items; a player could only paste one (R75/D210). An official item is now content that
 * writes the same fields a player would paste, under a `magic-item-definition` mechanic of a `magic-item` entry.
 * Put in the bag it is read by the same parser and carried exactly like a pasted item: a +1 weapon gets its own
 * attack row, a ring that needs attunement adds nothing until the character attunes to it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { addItem, toggleAttune } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import type { CharacterRuntime } from "../../client/character/runtime";
import { derivedOf } from "../../client/rules/attackSpec";
import { sourceOf } from "./support";

const SWORD = "test.d350.magic.keen-sword";
const RING = "test.d350.magic.warding-ring";

const entry = (id: string, name: string, definition: Record<string, unknown>) => ({
  id, category: "magic-item",
  presentation: { originalName: name, defaultLocale: "ko-KR", locales: { "ko-KR": { name, description: `${name} 설명` } } },
  mechanics: [{ kind: "magic-item-definition", config: definition }],
});

const MODULE = { moduleId: "test.d350", moduleVersion: "1", content: [
  entry(SWORD, "날 선 장검 +1", { type: "weapon", rarity: "uncommon", base: "dnd.srd521.item.weapon.longsword", bonus: { attack: 1, damage: 1 } }),
  entry(RING, "수호의 반지", { type: "ring", rarity: "rare", attunement: true, bonus: { ac: 1, saves: 1 } }),
] } as unknown as RuleModuleJson;

function fighter() {
  const cat = createCatalog([MODULE]);
  const made = autofill(sourceOf({ name: "기사", classes: "fighter", level: 3, abilities: { str: 16 } }), cat);
  const derive = (runtime: CharacterRuntime) => derivedOf({ source: made.source, runtime } as never, cat);
  return { cat, made, derive };
}

test("D350: a magic item is an item the catalog lists and a sheet can pick", () => {
  const { cat } = fighter();
  const sword = cat.itemById(SWORD);
  assert.equal(sword?.kind, "magic");
  assert.equal(sword?.name, "날 선 장검 +1");
  assert.ok(cat.items.some((item) => item.id === RING), "the add-item search lists it");
});

test("D350: a +1 weapon gets its own attack row with the bonus", () => {
  const { made, derive } = fighter();
  const before = derive(initialRuntime(made.derived));
  const runtime = addItem(initialRuntime(made.derived), { itemId: SWORD, name: "날 선 장검 +1" });
  const after = derive(runtime);
  const row = after.attacks.find((attack) => attack.name === "날 선 장검 +1");
  assert.ok(row, JSON.stringify(after.attacks.map((attack) => attack.name)));
  const plain = before.attacks.find((attack) => attack.name.includes("장검")) ?? { attackBonus: row!.attackBonus - 1 };
  assert.equal(row!.attackBonus, plain.attackBonus + 1, "one better than the plain sword");
  const item = after.inventory.find((entry) => entry.name === "날 선 장검 +1")!;
  assert.equal(item.officialId, SWORD, "it remembers which official item it is");
});

test("D350: an item that needs attunement does nothing until it is attuned", () => {
  const { made, derive } = fighter();
  let runtime = addItem(initialRuntime(made.derived), { itemId: RING, name: "수호의 반지" });
  const worn = derive(runtime);
  const ring = worn.inventory.find((item) => item.name === "수호의 반지")!;
  const baseAc = derive(initialRuntime(made.derived)).ac.value;
  assert.equal(worn.ac.value, baseAc, "not attuned: no bonus");
  runtime = toggleAttune(runtime, ring.instanceId, 3, ring.magic);
  const attuned = derive(runtime);
  assert.equal(attuned.ac.value, baseAc + 1, "attuned: +1 AC");
  assert.equal(attuned.saves.wis.bonus, worn.saves.wis.bonus + 1, "and +1 to saves");
});
