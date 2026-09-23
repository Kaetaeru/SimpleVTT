/**
 * V0.9 D364 (ITEM_GRAMMAR_V2_PLAN.md IG-8): an item given unidentified.
 *
 * The DM may give a campaign item unidentified: the bag shows "미식별 <kind>", with no description, no pools and no
 * effect. Identifying it (the bag row's button — the table's call: identify, a short rest with it) or attuning to it
 * reveals the name and turns its properties on.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";
import { autofill } from "../../client/character/autofill";
import { campaignItemsModule } from "../../client/character/customItem";
import { addItem, identifyItem, toggleAttune } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import type { CharacterRuntime } from "../../client/character/runtime";
import { derivedOf } from "../../client/rules/attackSpec";
import { sourceOf } from "./support";

const WAND = { id: "campaign.item.spark-wand", definition: { name: "불꽃 마법봉", type: "wand", rarity: "uncommon", description: "불꽃이 튄다", charges: { max: 3 }, spells: [{ spellId: "dnd.srd521.spell.burning-hands", charges: 1 }] } };
const CLOAK = { id: "campaign.item.shade-cloak", definition: { name: "그림자 망토", type: "wondrous", rarity: "rare", attunement: true, bonus: { ac: 1 } } };

function setup() {
  const cat = createCatalog([campaignItemsModule("c1", [WAND, CLOAK])]);
  const made = autofill(sourceOf({ name: "모험가", classes: "wizard", level: 3 }), cat);
  const derive = (runtime: CharacterRuntime) => derivedOf({ source: made.source, runtime } as never, cat);
  return { derive, start: initialRuntime(made.derived) };
}

test("D364: an unidentified wand is an unknown thing with no pool until it is identified", () => {
  const { derive, start } = setup();
  let runtime = addItem(start, { itemId: WAND.id, name: WAND.definition.name, unidentified: true });
  let sheet = derive(runtime);
  const wand = sheet.inventory.find((item) => item.officialId === WAND.id)!;
  assert.equal(wand.name, "미식별 마법봉");
  assert.equal(wand.magic?.description, undefined, "no text");
  assert.ok(!sheet.resources.some((resource) => resource.itemInstanceId === wand.instanceId), "no pool to give it away");
  runtime = identifyItem(runtime, wand.instanceId);
  sheet = derive(runtime);
  assert.equal(sheet.inventory.find((item) => item.instanceId === wand.instanceId)!.name, "불꽃 마법봉");
  assert.equal(sheet.resources.find((resource) => resource.itemInstanceId === wand.instanceId)?.max, 3);
});

test("D364: attuning to an unidentified cloak identifies it and turns its bonus on", () => {
  const { derive, start } = setup();
  let runtime = addItem(start, { itemId: CLOAK.id, name: CLOAK.definition.name, unidentified: true });
  const cloak = derive(runtime).inventory.find((item) => item.officialId === CLOAK.id)!;
  assert.equal(cloak.name, "미식별 물건");
  runtime = toggleAttune(runtime, cloak.instanceId, 3, cloak.magic);
  const sheet = derive(runtime);
  assert.equal(sheet.inventory.find((item) => item.instanceId === cloak.instanceId)!.name, "그림자 망토");
  assert.equal(sheet.ac.value, derive(start).ac.value + 1);
});
