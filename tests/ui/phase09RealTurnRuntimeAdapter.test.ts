import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealTurnRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";

test("initiative start and turn advancement project domain turn runtime state into SceneVm", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.sessionMode,"initiative");
  assert.equal(snapshot.scene.round,1);
  assert.equal(snapshot.scene.currentActorId,"char.mira","highest initiative actor starts");
  for (const entity of snapshot.scene.entities) {
    assert.equal(snapshot.scene.economyByActor[entity.id]?.action,true);
    assert.equal(snapshot.scene.economyByActor[entity.id]?.bonusAction,true);
    assert.equal(snapshot.scene.economyByActor[entity.id]?.reaction,true);
    assert.equal(snapshot.scene.economyByActor[entity.id]?.movement,30);
  }

  await adapter.endTurn();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.currentActorId,"char.aelar");
  assert.equal(snapshot.scene.round,1);
  assert.ok(snapshot.activity[0]?.detail.some((entry)=>entry.includes("RulesRuntimeState revision")));
});

test("committed action economy is synchronized into turn runtime and survives manual actor changes", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  await adapter.setQueuedD20(15);
  await adapter.resolveAction("action.shortbow",["combatant.goblin-a"]);
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.currentActorId,"char.aelar");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);

  await adapter.setCurrentActor("combatant.goblin-a");
  await adapter.setCurrentActor("char.aelar");
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false,"manual actor selection must not start a new turn");
});

test("round wrap starts Aelar's next turn from base speed and refreshed economy", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  await adapter.setQueuedD20(15);
  await adapter.resolveAction("action.shortbow",["combatant.goblin-a"]);
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  const count=snapshot.scene.entities.length;
  for (let index=0;index<count;index+=1) await adapter.endTurn();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.currentActorId,"char.aelar");
  assert.equal(snapshot.scene.round,2);
  assert.deepEqual(snapshot.scene.economyByActor["char.aelar"],{
    action:true,
    bonusAction:true,
    reaction:true,
    movement:30,
    movementMax:30,
  });
});

test("ending initiative releases the runtime session and returns to freeform", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.endInitiative();
  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.sessionMode,"freeform");
  assert.equal(snapshot.activity[0]?.title,"이니셔티브 종료");
});
