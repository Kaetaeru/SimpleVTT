import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealRuntimeAttackAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";

test("critical attack projects monster death life state and event-native Undo restores it", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  let snapshot=await adapter.getSnapshot();
  const wolfBefore=snapshot.scene.entities.find((entity)=>entity.id==="combatant.wolf");
  assert.equal(wolfBefore?.hp,8);
  assert.equal(wolfBefore?.runtimeLife?.dead,false);

  await adapter.setQueuedD20(20);
  await adapter.resolveAction("action.shortbow",["combatant.wolf"]);
  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"attack-result");
  assert.equal(snapshot.resolution?.critical,true);

  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"damage-animation");
  assert.deepEqual(snapshot.resolution?.authoritativeDice,[4,4]);

  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  const wolfAfter=snapshot.scene.entities.find((entity)=>entity.id==="combatant.wolf");
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(wolfAfter?.hp,0);
  assert.equal(wolfAfter?.runtimeLife?.dead,true);
  assert.equal(wolfAfter?.runtimeLife?.unconscious,false,"monster zero-HP path dies rather than entering character death saves");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  assert.ok(snapshot.activity[0]?.stateChanges.some((line)=>line.includes("combatant.wolf life.dead false → true")));

  (adapter as unknown as { lastBefore:unknown }).lastBefore=null;
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  const wolfUndone=snapshot.scene.entities.find((entity)=>entity.id==="combatant.wolf");
  assert.equal(wolfUndone?.hp,8);
  assert.equal(wolfUndone?.runtimeLife?.dead,false);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);
  assert.equal(snapshot.resolution,null);
  assert.ok(snapshot.activity[0]?.stateChanges.some((line)=>line.includes("combatant.wolf life.dead true → false")));
});
