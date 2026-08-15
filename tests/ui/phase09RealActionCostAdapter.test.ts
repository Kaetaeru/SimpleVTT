import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealResolutionAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";

test("Phase 09 migrated attack commit projects the domain economy cost transaction into scene state and activity", async () => {
  const adapter = new MockAdapter();
  await adapter.loadReferenceScenario("critical");
  let snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);

  await adapter.resolveAction("action.longsword",["combatant.goblin-a"]);
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();

  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  assert.ok(snapshot.resolution?.stateChanges.includes("행동 사용"));
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("action.longsword") && entry.includes("action spent")));
  assert.ok(snapshot.activity[0]?.stateChanges.includes("행동 사용"));
  assert.ok(snapshot.activity[0]?.detail.some((entry) => entry.includes("action.longsword") && entry.includes("action spent")));
});

test("Phase 09 freeform open checks do not spend turn economy", async () => {
  const adapter = new MockAdapter();
  await adapter.setSessionMode("freeform");
  const before = await adapter.getSnapshot();
  assert.equal(before.scene.economyByActor["char.aelar"]?.action,true);

  await adapter.resolveAction("action.athletics",[]);
  await adapter.advanceResolution();
  const after = await adapter.getSnapshot();

  assert.equal(after.resolution?.stage,"complete");
  assert.equal(after.scene.economyByActor["char.aelar"]?.action,true);
  assert.equal(after.resolution?.stateChanges.includes("행동 사용"),false);
});
