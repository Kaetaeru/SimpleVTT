/**
 * R75 (ROLL20_TABLE_SPEC.md D210): a custom magic item pasted as JSON and given to a character.
 *
 * The catalog has no magic items. A pasted one carries its definition in the bag, gets its own attack row when it is
 * a weapon, and puts its numbers on the sheet while attuned (when it asks for that) and worn (when it is armour).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { CUSTOM_ITEM_EXAMPLE, customAttackId, parseCustomItem } from "../../client/character/customItem";
import { deriveCharacter } from "../../client/character/derive";
import { exportCharacterFile, parseCharacterFile } from "../../client/character/json";
import { addItem, toggleAttune, toggleEquip } from "../../client/character/play";
import { initialRuntime, type CharacterRuntime } from "../../client/character/runtime";
import { build, catalog } from "./support";

const derive = (source: Parameters<typeof deriveCharacter>[0], runtime: CharacterRuntime) => deriveCharacter(source, catalog(), { equipped: runtime.equipped, inventory: runtime.inventory, effects: runtime.effects });
const give = (runtime: CharacterRuntime, json: unknown) => {
  const parsed = parseCustomItem(JSON.stringify(json), catalog());
  assert.ok("item" in parsed, JSON.stringify(parsed));
  return addItem(runtime, { name: parsed.item.name, custom: parsed.item });
};

test("R75: the example parses, and a base is found by English name (D210)", () => {
  const parsed = parseCustomItem(JSON.stringify(CUSTOM_ITEM_EXAMPLE), catalog());
  assert.ok("item" in parsed);
  assert.deepEqual(parsed.warnings, []);
  assert.equal(parsed.item.base, "dnd.srd521.item.weapon.longsword");
  assert.deepEqual(parsed.item.resistances, ["냉기"]);
  assert.ok("error" in parseCustomItem("{}", catalog()));
  const odd = parseCustomItem(JSON.stringify({ name: "x", base: "lightsaber", bonus: { ac: "1", luck: 2 }, resistances: ["ice"] }), catalog());
  assert.ok("item" in odd);
  assert.equal(odd.warnings.length, 4, odd.warnings.join("\n"));
});

test("R75: a magic weapon is its own attack row, and its bonus waits for attunement (D210)", () => {
  const made = build({ name: "파이터", classes: "fighter", level: 3 });
  let runtime = give(initialRuntime(made.derived), CUSTOM_ITEM_EXAMPLE);
  let derived = derive(made.source, runtime);
  const item = derived.inventory.find((entry) => entry.magic)!;
  assert.equal(item.kind, "weapon");
  const row = () => derived.attacks.find((attack) => attack.id === customAttackId(item))!;
  assert.equal(row().name, "서리송곳 장검 +1");
  const plain = row().attackBonus;
  assert.ok(!derived.defenses.resistances.some((line) => line.startsWith("냉기")));

  runtime = toggleAttune(runtime, item.instanceId);
  derived = derive(made.source, runtime);
  assert.equal(row().attackBonus, plain + 1, "attuned: +1 to hit");
  assert.ok(row().attackTerms.some((term) => term.label === "서리송곳 장검 +1"), "and the hover says where it came from");
  assert.ok(derived.defenses.resistances.some((line) => line.startsWith("냉기")));
  const others = derived.attacks.filter((attack) => attack.id !== row().id);
  assert.ok(others.every((attack) => !attack.attackTerms.some((term) => term.label === "서리송곳 장검 +1")), "no other attack gets it");

  const file = parseCharacterFile(JSON.stringify(exportCharacterFile(made.source, runtime)));
  assert.deepEqual(file.errors, []);
  assert.equal(derive(made.source, file.runtime!).attacks.find((attack) => attack.id === customAttackId(item))?.attackBonus, plain + 1, "the item and its attunement survive a save");
});

test("R75: magic armour counts while worn, a ring while attuned, and a fourth attunement is refused (D210)", () => {
  const made = build({ name: "파이터", classes: "fighter", level: 3 });
  let runtime = give(initialRuntime(made.derived), { name: "사슬 갑옷 +1", type: "armor", base: "chain-mail", bonus: { ac: 1 } });
  runtime = give(runtime, { name: "보호의 반지", type: "ring", attunement: true, bonus: { ac: 1, saves: 1 } });
  let derived = derive(made.source, runtime);
  const armor = derived.inventory.find((entry) => entry.name === "사슬 갑옷 +1")!;
  const ring = derived.inventory.find((entry) => entry.name === "보호의 반지")!;
  assert.ok(!derived.ac.terms.some((term) => term.label === "사슬 갑옷 +1"), "carried, not worn");
  runtime = toggleEquip(runtime, derived, armor.instanceId);
  derived = derive(made.source, runtime);
  assert.equal(derived.ac.source, "사슬 갑옷");
  assert.ok(derived.ac.terms.some((term) => term.label === "사슬 갑옷 +1" && term.value === 1), JSON.stringify(derived.ac.terms));
  const [ac, save] = [derived.ac.value, derived.saves.wis.bonus];
  runtime = toggleAttune(runtime, ring.instanceId);
  derived = derive(made.source, runtime);
  assert.deepEqual([derived.ac.value, derived.saves.wis.bonus], [ac + 1, save + 1]);

  for (const name of ["a", "b", "c"]) runtime = give(runtime, { name, attunement: true });
  derived = derive(made.source, runtime);
  for (const name of ["a", "b", "c"]) runtime = toggleAttune(runtime, derived.inventory.find((entry) => entry.name === name)!.instanceId);
  assert.equal(runtime.inventory.extra.filter((entry) => entry.attuned).length, 3, "the ring, a, b — c is refused");
  assert.match(runtime.log.at(-1)!.text, /이미 3개/);
});
