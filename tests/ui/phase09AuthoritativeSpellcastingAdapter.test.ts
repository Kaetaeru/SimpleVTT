import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09SpellcastingRuntimeRouter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

function sceneOf(adapter:MockAdapter) {
  return (adapter as unknown as { scene:Awaited<ReturnType<MockAdapter["getSnapshot"]>>["scene"] }).scene;
}

function runtimeOf(adapter:MockAdapter) {
  const runtime=snapshotAdapterTurnRuntimeState(adapter,sceneOf(adapter));
  assert.ok(runtime,"authoritative turn runtime must exist");
  return runtime!;
}

function spellSlotCurrent(adapter:MockAdapter,level:number) {
  return runtimeOf(adapter).combatants["char.mira"].resources.find((resource)=>resource.id===`spell-slot-${level}`)?.current;
}

async function miraInitiative(adapter:MockAdapter) {
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.mira");
  return adapter.getSnapshot();
}

test("initiative Healing Word uses authoritative turn runtime for slot, Bonus Action, HP, turn marker, Activity, and Undo", async () => {
  const adapter=new MockAdapter();
  let snapshot=await miraInitiative(adapter);
  assert.deepEqual(snapshot.scene.spellcastingByActor?.["char.mira"]?.slots,[
    { level:1,current:4,max:4 },
    { level:2,current:3,max:3 },
  ]);
  assert.equal(spellSlotCurrent(adapter,1),4);
  assert.equal(runtimeOf(adapter).spellcastingTurn,undefined);

  await adapter.resolveAction("action.healing-word",["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.match(snapshot.resolution?.compact ?? "",/치유의 단어/);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")?.hp,42);
  assert.equal(snapshot.scene.economyByActor["char.mira"]?.bonusAction,false);
  assert.equal(spellSlotCurrent(adapter,1),3);
  assert.deepEqual(runtimeOf(adapter).spellcastingTurn,{
    turnId:"1:char.mira",
    slottedCasterIds:["char.mira"],
  });
  assert.equal(snapshot.scene.spellcastingByActor?.["char.mira"]?.slottedSpellCastThisTurn,true);
  assert.equal(snapshot.scene.spellcastingByActor?.["char.mira"]?.slots.find((slot)=>slot.level===1)?.current,3);
  const activity=snapshot.activity.find((entry)=>entry.id===snapshot.resolution?.id);
  assert.ok(activity);
  assert.ok(activity?.stateChanges.some((label)=>label.includes("resource.spell-slot-1 4 → 3")));
  assert.ok(activity?.stateChanges.some((label)=>label.includes("economy.bonusAction true → false")));
  assert.ok(activity?.stateChanges.some((label)=>label.includes("spellcasting-turn — → 1:char.mira [char.mira]")));

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution,null);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")?.hp,31);
  assert.equal(snapshot.scene.economyByActor["char.mira"]?.bonusAction,true);
  assert.equal(spellSlotCurrent(adapter,1),4);
  assert.equal(runtimeOf(adapter).spellcastingTurn,undefined);
  assert.equal(snapshot.scene.spellcastingByActor?.["char.mira"]?.slottedSpellCastThisTurn,false);
  assert.equal(snapshot.scene.spellcastingByActor?.["char.mira"]?.slots.find((slot)=>slot.level===1)?.current,4);
  assert.equal(snapshot.activity.find((entry)=>entry.id===activity?.id)?.reversed,true);
  assert.equal(snapshot.activity[0]?.undoOf,activity?.id);

  await adapter.resolveAction("action.healing-word",["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")?.hp,42,"Undo restores the turn marker so the same slotted spell can be cast again");
});

test("second slotted spell cast in the same authoritative turn rejects without spending another slot", async () => {
  const adapter=new MockAdapter();
  await miraInitiative(adapter);
  await adapter.resolveAction("action.healing-word",["char.aelar"]);
  assert.equal(spellSlotCurrent(adapter,1),3);

  await adapter.resolveAction("action.healing-word",["char.aelar"]);
  const snapshot=await adapter.getSnapshot();
  assert.match(snapshot.resolution?.finalOutcome ?? "",/시전 거부/);
  assert.ok(snapshot.resolution?.detail.some((line)=>/already expended a spell slot/.test(line)));
  assert.equal(spellSlotCurrent(adapter,1),3);
  assert.equal(snapshot.scene.economyByActor["char.mira"]?.bonusAction,false);
});

test("authoritative HUD never re-seeds a depleted slot from the legacy bridge", async () => {
  const adapter=new MockAdapter();
  await miraInitiative(adapter);
  await adapter.resolveAction("action.healing-word",["char.aelar"]);
  assert.equal(spellSlotCurrent(adapter,1),3);

  for (let index=0;index<4;index+=1) await adapter.getSnapshot();
  assert.equal(spellSlotCurrent(adapter,1),3,"legacy HUD is materialization input only; it cannot overwrite authoritative slot state");
});

test("no-session Healing Word preserves the existing legacy spell bridge fallback", async () => {
  const adapter=new MockAdapter();
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.spellcastingByActor?.["char.mira"]?.slots.find((slot)=>slot.level===1)?.current,4);

  await adapter.resolveAction("action.healing-word",["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")?.hp,42);
  assert.equal(snapshot.scene.spellcastingByActor?.["char.mira"]?.slots.find((slot)=>slot.level===1)?.current,3);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="char.aelar")?.hp,31);
  assert.equal(snapshot.scene.spellcastingByActor?.["char.mira"]?.slots.find((slot)=>slot.level===1)?.current,4);
});
