import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealResolutionAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { resolveSceneHealing } from "../../src/app/realHealthService";

test("Phase 09 healing projection caps at maximum HP and reports authoritative restored HP", () => {
  const result = resolveSceneHealing({ id:"hero", name:"Hero", hp:18, maxHp:20, tempHp:3 },10);
  assert.equal(result.requested,10);
  assert.equal(result.restored,2);
  assert.equal(result.nextHp,20);
  assert.deepEqual(result.stateChanges,["Hero HP 18 → 20"]);
  assert.ok(result.provenance.some((entry) => entry.includes("profile:dnd.srd-5.2.1/healing")));
});

test("Second Wind applies healing, Bonus Action, and class resource through Phase 09 real services", async () => {
  const adapter = new MockAdapter();
  let snapshot = await adapter.getSnapshot();
  const secondWindBefore = snapshot.activeCharacter.resources.find((resource) => resource.id === "resource.second-wind");
  assert.equal(snapshot.activeCharacter.hp,31);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.bonusAction,true);
  assert.equal(secondWindBefore?.current,1);

  await adapter.resolveAction("action.second-wind",["char.aelar"]);
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"roll-animation");
  assert.equal(snapshot.resolution?.rollTotal,10);

  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"effect-preview");

  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();
  const secondWindAfter = snapshot.activeCharacter.resources.find((resource) => resource.id === "resource.second-wind");
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.activeCharacter.hp,41);
  assert.equal(snapshot.activeCharacter.tempHp,5,"healing must not consume Temporary HP");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.bonusAction,false);
  assert.equal(secondWindAfter?.current,0);
  assert.ok(snapshot.resolution?.stateChanges.includes("Aelar HP 31 → 41"));
  assert.ok(snapshot.resolution?.stateChanges.includes("추가 행동 사용"));
  assert.ok(snapshot.resolution?.stateChanges.includes("세컨드 윈드 1 → 0"));
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("profile:dnd.srd-5.2.1/healing")));
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("action.second-wind") && entry.includes("bonus-action spent")));
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("세컨드 윈드 1 -> 0")));
});

test("Undo still restores the before snapshot after a Phase 09 healing and cost commit", async () => {
  const adapter = new MockAdapter();
  await adapter.resolveAction("action.second-wind",["char.aelar"]);
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  let snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.hp,41);
  assert.equal(snapshot.activeCharacter.resources.find((resource) => resource.id === "resource.second-wind")?.current,0);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.bonusAction,false);

  await adapter.undoLastResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.hp,31);
  assert.equal(snapshot.activeCharacter.resources.find((resource) => resource.id === "resource.second-wind")?.current,1);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.bonusAction,true);
  assert.equal(snapshot.resolution,null);
  assert.equal(snapshot.activity[0]?.title,"Resolution 되돌림");
});
