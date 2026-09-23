/**
 * V0.9 D366 (ITEM_GRAMMAR_V2_PLAN.md IG-10): the paste window says what an item will do before it is given.
 *
 * `itemPreview` sorts a parsed item into three lists — computed on its own, a button, the table's to settle — from
 * the fields the engine runs, so a DM sees whether the sheet would look finished when it is not. Every SRD item's
 * preview is checked to have nothing the contract executor cannot run.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";
import { itemPreview, officialMagicItem, parseCustomItem } from "../../client/character/customItem";

const ITEM = {
  name: "폭풍 반지", type: "ring", rarity: "rare", attunement: true, attunementRequires: { spellcaster: true },
  bonus: { ac: 1, extraDamage: [{ dice: "1d6", type: "lightning", when: { targetTypes: ["construct"] } }] },
  resistances: ["lightning"], charges: { max: 3, recharge: "1d3", note: "다 쓰면 d20 — 1이면 부서진다" },
  spells: [{ spellId: "dnd.srd521.spell.magic-missile", charges: 1, perLevel: 1, maxLevel: 3 }],
  contract: { entryPoints: [{ id: "zap", label: "번개 쏘기", invocation: "manual", operations: [{ kind: "adjudication.request", question: "주변 금속이 튀는지는 DM이 정한다" }] }] },
  notes: ["비 오는 날엔 번개가 두 배로 세다"],
};

test("D366: the preview sorts the item into what is computed, what is a button and what the table settles", () => {
  const cat = createCatalog([]);
  const read = parseCustomItem(JSON.stringify(ITEM), cat);
  if ("error" in read) throw new Error(read.error);
  const preview = itemPreview(read.item, cat);
  assert.ok(preview.automatic.includes("AC +1"));
  assert.ok(preview.automatic.some((line) => line.startsWith("추가 피해 1d6") && line.includes("construct")));
  assert.ok(preview.automatic.some((line) => line.includes("주문 시전자만")));
  assert.ok(preview.buttons.some((line) => line.startsWith("주문: 마법 화살") && line.includes("+1레벨")), JSON.stringify(preview.buttons));
  assert.ok(preview.buttons.includes("버튼: 번개 쏘기"));
  assert.deepEqual(preview.table.sort(), ["다 쓰면 d20 — 1이면 부서진다", "비 오는 날엔 번개가 두 배로 세다", "주변 금속이 튀는지는 DM이 정한다"].sort());
});

test("D366: no SRD item's preview names a part the executor cannot run", () => {
  const cat = createCatalog([]);
  const gaps = cat.items.filter((item) => item.magic).flatMap((item) => itemPreview(officialMagicItem(item.name, item.magic!, cat)!, cat).table.filter((line) => line.startsWith("계약에서 실행 못 하는")).map((line) => `${item.id}: ${line}`));
  assert.deepEqual(gaps, []);
});
