/** Items from the turn panel (D98): healing potions by tier, consumables spent, gear only logged; toast lines (D99). */
import assert from "node:assert/strict";
import test from "node:test";
import { itemUse } from "../../client/rules/items";
import { toastText } from "../../client/screens/Notify";

test("itemUse: potion tiers heal, consumables are spent, gear is logged", () => {
  assert.deepEqual(itemUse({ name: "치유 물약", kind: "consumable" }), { consumes: true, heal: "2d4+2", text: "치유 물약 마심 (2d4+2 회복)" });
  assert.equal(itemUse({ name: "Potion of Greater Healing", kind: "consumable" }).heal, "4d4+4");
  assert.equal(itemUse({ name: "최상급 치유 물약", kind: "consumable" }).heal, "8d4+8");
  assert.equal(itemUse({ name: "Supreme Healing Potion", kind: "gear", itemId: "dnd.srd521.item.potion-of-supreme-healing" }).heal, "10d4+20");
  assert.deepEqual(itemUse({ name: "횃불", kind: "gear" }), { consumes: true, text: "횃불 사용" });
  assert.deepEqual(itemUse({ name: "밧줄", kind: "gear" }), { consumes: false, text: "밧줄 사용" });
});

test("toastText: system, rolls, acts and attacks become one line; plain chat does not", () => {
  const base = { id: "m", at: "", who: "지연", content: "" };
  assert.equal(toastText({ ...base, type: "general", content: "안녕" }), null);
  assert.equal(toastText({ ...base, type: "system", content: "라운드 2" })!.text, "라운드 2");
  assert.equal(toastText({ ...base, type: "rollresult", roll: { formula: "1d20+5", total: 17, dice: [{ sides: 20, value: 12 }], modifier: 5, label: "운동" } })!.text, "운동 = 17");
  const act = toastText({ ...base, type: "act", act: { kind: "hide", name: "은신", actor: { name: "앨" }, text: "", actorMarks: [], targetMarks: [], actorUnmarks: [], check: { label: "", d20: 3, bonus: 2, total: 5, dc: 15, success: false } } })!;
  assert.deepEqual([act.text, act.tone], ["앨: 은신 5 vs DC 15 실패", "bad"]);
});
