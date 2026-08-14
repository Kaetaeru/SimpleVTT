import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/mockAdapterCompletion";
import "../../src/app/spellcastingRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";

function slotCurrent(snapshot: Awaited<ReturnType<MockAdapter["getSnapshot"]>>, actorId: string, level: number) {
  return snapshot.scene.spellcastingByActor?.[actorId]?.slots.find((slot) => slot.level === level)?.current;
}

test("reference combat adapter casts Healing Word through Phase 06, spends the selected slot, and exposes explicit partial spells", async () => {
  const adapter = new MockAdapter();
  await adapter.setReferenceRole("dm");
  await adapter.selectDmActor("char.mira");

  const before = await adapter.getSnapshot();
  assert.equal(slotCurrent(before, "char.mira", 1), 4);
  const vicious = before.scene.actionsByActor["char.mira"].find((action) => action.id === "action.vicious-mockery");
  const thunderwave = before.scene.actionsByActor["char.mira"].find((action) => action.id === "action.thunderwave");
  assert.equal(vicious?.available, false);
  assert.match(vicious?.disabledReason ?? "", /consumable modifier/);
  assert.equal(thunderwave?.available, false);
  assert.match(thunderwave?.disabledReason ?? "", /authoritative geometry/);

  const cast = await adapter.resolveAction("action.healing-word", ["char.aelar"]);
  assert.equal(slotCurrent(cast, "char.mira", 1), 3);
  assert.equal(cast.scene.entities.find((entity) => entity.id === "char.aelar")?.hp, 42);
  assert.match(cast.resolution?.compact ?? "", /치유의 단어/);
  assert.match(cast.resolution?.provenance.join(" ") ?? "", /dnd\.srd521\.spell\.healing-word/);
});

test("two-step safe undo restores Phase 06 runtime spell slots as well as scene HP", async () => {
  const adapter = new MockAdapter();
  await adapter.setReferenceRole("dm");
  await adapter.selectDmActor("char.mira");
  const before = await adapter.getSnapshot();
  const beforeHp = before.scene.entities.find((entity) => entity.id === "char.aelar")?.hp;
  const beforeSlot = slotCurrent(before, "char.mira", 1);

  const cast = await adapter.resolveAction("action.healing-word", ["char.aelar"]);
  assert.equal(slotCurrent(cast, "char.mira", 1), (beforeSlot ?? 0) - 1);
  assert.notEqual(cast.scene.entities.find((entity) => entity.id === "char.aelar")?.hp, beforeHp);

  const preview = await adapter.undoLastResolution();
  assert.match(preview.resolution?.actionName ?? "", /되돌리기 Preview/);
  assert.equal(slotCurrent(preview, "char.mira", 1), (beforeSlot ?? 0) - 1, "preview must not mutate the slot");

  const restored = await adapter.undoLastResolution();
  assert.equal(restored.scene.entities.find((entity) => entity.id === "char.aelar")?.hp, beforeHp);
  assert.equal(slotCurrent(restored, "char.mira", 1), beforeSlot);
  assert.equal(restored.resolution, null);
});
