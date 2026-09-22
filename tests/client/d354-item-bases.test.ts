/**
 * V0.9 D354 (MAGIC_ITEMS_PLAN.md MI-5): an item made from a weapon or armour the giver picks.
 *
 * Many magic items are "any melee weapon" or "light, medium or heavy armour". The definition says which kinds of base
 * it may be (`baseOptions`); the add-item window asks which, and the item is carried as that base under the name
 * "<item> (<base>)", so a flame tongue longsword attacks like a longsword. The item's text is its entry's.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { baseChoices, officialMagicItem } from "../../client/character/customItem";
import { addItem } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import type { CharacterRuntime } from "../../client/character/runtime";
import { derivedOf } from "../../client/rules/attackSpec";
import { sourceOf } from "./support";

const BLADE = "test.d354.magic.bright-edge";
const MAIL = "test.d354.magic.warded-mail";
const LONGSWORD = "dnd.srd521.item.weapon.longsword";

const entry = (id: string, name: string, definition: Record<string, unknown>) => ({
  id, category: "magic-item",
  presentation: { originalName: name, defaultLocale: "ko-KR", locales: { "ko-KR": { name, description: `${name}은 빛난다` } } },
  mechanics: [{ kind: "magic-item-definition", config: definition }],
});

const MODULE = { moduleId: "test.d354", moduleVersion: "1", content: [
  entry(BLADE, "빛의 칼날", { type: "weapon", rarity: "rare", baseOptions: { kind: "weapon", mode: "melee" }, bonus: { attack: 1, damage: 1, extraDamage: { dice: "1d6", type: "radiant" } } }),
  entry(MAIL, "수호 갑옷", { type: "armor", rarity: "rare", baseOptions: { kind: "armor", training: ["medium", "heavy"] }, bonus: { ac: 1 } }),
] } as unknown as RuleModuleJson;

test("D354: the kinds of base an item may be are the catalog's weapons or armour of that kind", () => {
  const cat = createCatalog([MODULE]);
  const blade = officialMagicItem("빛의 칼날", cat.itemById(BLADE)!.magic!, cat)!;
  const weapons = baseChoices(cat, blade.baseOptions!);
  assert.ok(weapons.some((item) => item.id === LONGSWORD));
  assert.ok(weapons.every((item) => item.weapon?.mode === "melee"), "melee only");
  const mail = officialMagicItem("수호 갑옷", cat.itemById(MAIL)!.magic!, cat)!;
  const armour = baseChoices(cat, mail.baseOptions!);
  assert.ok(armour.length > 0 && armour.every((item) => item.armor && item.armor.training !== "light"), JSON.stringify(armour.map((item) => item.id)));
  assert.equal(cat.itemById(BLADE)!.magic!.description, "빛의 칼날은 빛난다", "the entry's text is the item's");
});

test("D354: given as a longsword, it attacks as one, with its bonus and its radiant die", () => {
  const cat = createCatalog([MODULE]);
  const made = autofill(sourceOf({ name: "기사", classes: "fighter", level: 3, abilities: { str: 16 } }), cat);
  const derive = (runtime: CharacterRuntime) => derivedOf({ source: made.source, runtime } as never, cat);
  const runtime = addItem(initialRuntime(made.derived), { itemId: BLADE, name: "빛의 칼날 (장검)", base: LONGSWORD });
  const sheet = derive(runtime);
  const item = sheet.inventory.find((line) => line.officialId === BLADE)!;
  assert.equal(item.name, "빛의 칼날 (장검)");
  assert.equal(item.itemId, LONGSWORD);
  const row = sheet.attacks.find((attack) => attack.name === "빛의 칼날 (장검)");
  assert.ok(row, JSON.stringify(sheet.attacks.map((attack) => attack.name)));
  assert.equal(row!.damage.startsWith("1d8"), true, row!.damage);
  assert.deepEqual(row!.extraDamage?.map((part) => part.formula), ["1d6"]);
});
