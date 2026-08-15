import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealItemCostAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";

test("healing potion projects quantity and Action spend from one item-cost transaction", async () => {
  const adapter = new MockAdapter();
  await adapter.resolveAction("action.healing-potion",["char.aelar"]);
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  let snapshot = await adapter.getSnapshot();

  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.activeCharacter.hp,40);
  assert.equal(snapshot.activeCharacter.items.find((item) => item.id === "item.potion.aelar")?.quantity,1);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  assert.ok(snapshot.resolution?.stateChanges.includes("치유 물약 수량 2 → 1"));
  assert.ok(snapshot.resolution?.stateChanges.includes("행동 사용"));
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("치유 물약 수량 2 -> 1")));
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("action.healing-potion") && entry.includes("action spent")));

  await adapter.undoLastResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.hp,31);
  assert.equal(snapshot.activeCharacter.items.find((item) => item.id === "item.potion.aelar")?.quantity,2);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);
});

test("wand charge and Action spend use the item-cost transaction even while damage execution remains transitional", async () => {
  const adapter = new MockAdapter();
  await adapter.resolveAction("action.wand",["combatant.goblin-a"]);
  let snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"effect-preview");
  assert.equal(snapshot.activeCharacter.items.find((item) => item.id === "item.wand.aelar")?.charges?.current,7);

  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.activeCharacter.items.find((item) => item.id === "item.wand.aelar")?.charges?.current,6);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  assert.ok(snapshot.resolution?.stateChanges.includes("마법 미사일 완드 충전 7 → 6"));
  assert.ok(snapshot.resolution?.stateChanges.includes("행동 사용"));
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("마법 미사일 완드 충전 7 -> 6")));
});
