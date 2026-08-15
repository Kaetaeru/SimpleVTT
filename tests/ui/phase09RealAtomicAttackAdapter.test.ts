import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealResolutionAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";

async function hitShortbow(d20:number) {
  const adapter = new MockAdapter();
  await adapter.setQueuedD20(d20);
  await adapter.resolveAction("action.shortbow",["combatant.goblin-a"]);
  return adapter;
}

test("shortbow staged UI previews then applies one atomic domain attack transaction", async () => {
  const adapter = await hitShortbow(15);
  let snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"roll-animation");
  assert.equal(snapshot.resolution?.attackTotal,20);
  assert.equal(snapshot.scene.entities.find((entity) => entity.id === "combatant.goblin-a")?.hp,12);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);

  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"attack-result");

  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"damage-animation");
  assert.deepEqual(snapshot.resolution?.authoritativeDice,[4]);
  assert.equal(snapshot.scene.entities.find((entity) => entity.id === "combatant.goblin-a")?.hp,12,"staged transaction must not project damage before apply");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true,"staged transaction must not project economy before apply");

  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();
  const goblin = snapshot.scene.entities.find((entity) => entity.id === "combatant.goblin-a");
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(goblin?.hp,6);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  assert.equal(snapshot.resolution?.damageComponents[0]?.raw,6);
  assert.equal(snapshot.resolution?.damageComponents[0]?.adjusted,6);
  assert.match(snapshot.resolution?.damageComponents[0]?.source ?? "",/atomic resolveAttack transaction/);
  assert.ok(snapshot.resolution?.stateChanges.includes("고블린 A HP 12 → 6"));
  assert.ok(snapshot.resolution?.stateChanges.includes("행동 사용"));
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("phase09:reference-attack:action.shortbow:d6")));
  assert.ok(snapshot.activity[0]?.detail.some((entry) => entry.includes("atomic") || entry.includes("damage dice")));
});

test("shortbow critical doubles only the damage die inside the atomic attack transaction", async () => {
  const adapter = await hitShortbow(20);
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  let snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.critical,true);
  assert.deepEqual(snapshot.resolution?.authoritativeDice,[4,4]);

  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.damageComponents[0]?.raw,10);
  assert.equal(snapshot.scene.entities.find((entity) => entity.id === "combatant.goblin-a")?.hp,2);
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("critical doubles damage dice 1 -> 2")));
});

test("shortbow miss still spends the Action atomically but does not damage the target", async () => {
  const adapter = await hitShortbow(1);
  await adapter.advanceResolution();
  let snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"attack-result");
  assert.equal(snapshot.resolution?.attackOutcome,"빗나감");

  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.entities.find((entity) => entity.id === "combatant.goblin-a")?.hp,12);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  assert.deepEqual(snapshot.resolution?.damageComponents,[]);
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("attack-natural-1")));
  assert.ok(snapshot.resolution?.stateChanges.includes("행동 사용"));
});

test("Undo restores the pre-transaction state after an atomic shortbow attack", async () => {
  const adapter = await hitShortbow(15);
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  let snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entity) => entity.id === "combatant.goblin-a")?.hp,6);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);

  await adapter.undoLastResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entity) => entity.id === "combatant.goblin-a")?.hp,12);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);
  assert.equal(snapshot.resolution,null);
});
