import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/mockAdapterCompletion";
import "../../src/app/spellcastingRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";

function slotCurrent(snapshot: Awaited<ReturnType<MockAdapter["getSnapshot"]>>, actorId: string, level: number) {
  return snapshot.scene.spellcastingByActor?.[actorId]?.slots.find((slot) => slot.level === level)?.current;
}

test("reference combat adapter exposes Vicious Mockery and casts Healing Word through Phase 06", async () => {
  const adapter = new MockAdapter();
  await adapter.setReferenceRole("dm");
  await adapter.selectDmActor("char.mira");

  const before = await adapter.getSnapshot();
  assert.equal(slotCurrent(before, "char.mira", 1), 4);
  const vicious = before.scene.actionsByActor["char.mira"].find((action) => action.id === "action.vicious-mockery");
  const thunderwave = before.scene.actionsByActor["char.mira"].find((action) => action.id === "action.thunderwave");
  assert.equal(vicious?.available, true);
  assert.equal(vicious?.spellCast?.runtimeSupport,"combat-executable");
  assert.equal(thunderwave?.available, true);

  const cast = await adapter.resolveAction("action.healing-word", ["char.aelar"]);
  assert.equal(slotCurrent(cast, "char.mira", 1), 3);
  assert.equal(cast.scene.entities.find((entity) => entity.id === "char.aelar")?.hp, 42);
  assert.match(cast.resolution?.compact ?? "", /치유의 단어/);
  assert.match(cast.resolution?.provenance.join(" ") ?? "", /dnd\.srd521\.spell\.healing-word/);
});

test("Thunderwave can select and damage every enemy when no spatial module is installed",async()=>{
  const adapter=new MockAdapter();
  await adapter.setReferenceRole("dm");
  await adapter.selectDmActor("char.mira");
  const before=await adapter.getSnapshot();
  const targets=before.scene.entities.filter((entity)=>entity.side==="enemy");
  const hp=new Map(targets.map((target)=>[target.id,target.hp+target.tempHp]));
  const cast=await adapter.resolveAction("action.thunderwave",targets.map((target)=>target.id));
  assert.equal(cast.resolution?.stage,"complete");
  assert.deepEqual(cast.resolution?.targetIds,targets.map((target)=>target.id));
  assert.ok(targets.every((target)=>{const entity=cast.scene.entities.find((entry)=>entry.id===target.id);return Boolean(entity&&entity.hp+entity.tempHp<(hp.get(target.id)??0));}));
  assert.equal(slotCurrent(cast,"char.mira",1),3);
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
