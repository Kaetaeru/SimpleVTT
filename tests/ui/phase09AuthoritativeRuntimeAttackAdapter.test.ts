import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealRuntimeAttackAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";
import { createEffect } from "../../src/domain/effects";

function internalScene(adapter:MockAdapter) {
  return (adapter as unknown as { scene:Awaited<ReturnType<MockAdapter["getSnapshot"]>>["scene"] }).scene;
}

async function startAelarInitiative(adapter:MockAdapter) {
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
}

function seedRuntime(adapter:MockAdapter,mutate:(state:NonNullable<ReturnType<typeof snapshotAdapterTurnRuntimeState>>)=>void) {
  const scene=internalScene(adapter);
  const before=snapshotAdapterTurnRuntimeState(adapter,scene);
  assert.ok(before,"initiative runtime must exist");
  const next=structuredClone(before!);
  mutate(next);
  next.revision=before!.revision+1;
  assert.equal(commitAdapterTurnRuntimeState(adapter,scene,before!.revision,next),true);
  return next;
}

async function stageShortbowHit(adapter:MockAdapter) {
  await adapter.setQueuedD20(11);
  await adapter.resolveAction("action.shortbow",["combatant.goblin-a"]);
  await adapter.advanceResolution();
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"attack-result");
  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  return snapshot;
}

test("initiative attack uses authoritative runtime effects and commits the staged runtime revision", async () => {
  const adapter=new MockAdapter();
  await startAelarInitiative(adapter);
  seedRuntime(adapter,(state)=>{
    state.effects.push(createEffect({
      id:"runtime-piercing-resistance",
      sourceId:"effect:test-resistance",
      targetId:"combatant.goblin-a",
      kind:"modifier",
      tags:["damage-resistance:관통"],
      duration:{ kind:"permanent" },
    },state.clock));
  });

  let snapshot=await stageShortbowHit(adapter);
  assert.equal(snapshot.resolution?.stage,"damage-animation");
  assert.deepEqual(snapshot.resolution?.authoritativeDice,[4]);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,12,"staged transaction is not committed before damage apply");

  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,9,"runtime-only resistance halves six damage");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  assert.equal(snapshot.resolution?.damageComponents[0]?.adjusted,3);
  const runtime=snapshotAdapterTurnRuntimeState(adapter,internalScene(adapter));
  assert.ok(runtime?.effects.some((effect)=>effect.id==="runtime-piercing-resistance"));
});

test("initiative attack explicitly rejects damage to a concentrator when no fixed concentration save input exists", async () => {
  const adapter=new MockAdapter();
  await startAelarInitiative(adapter);
  seedRuntime(adapter,(state)=>{
    state.concentration["combatant.goblin-a"]={
      actorId:"combatant.goblin-a",
      groupId:"goblin:focus",
      sourceId:"spell:focus",
    };
    state.effects.push(createEffect({
      id:"goblin-focus-effect",
      sourceId:"spell:focus",
      sourceActorId:"combatant.goblin-a",
      targetId:"char.aelar",
      kind:"marker",
      duration:{ kind:"concentration" },
      concentrationGroupId:"goblin:focus",
    },state.clock));
  });

  await adapter.setQueuedD20(11);
  await adapter.resolveAction("action.shortbow",["combatant.goblin-a"]);
  await adapter.advanceResolution();
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"attack-result");
  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.match(snapshot.resolution?.finalOutcome ?? "",/requires fixed concentration-check input/);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,12);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);
  const runtime=snapshotAdapterTurnRuntimeState(adapter,internalScene(adapter));
  assert.equal(runtime?.concentration["combatant.goblin-a"]?.groupId,"goblin:focus");
  assert.ok(runtime?.effects.some((effect)=>effect.id==="goblin-focus-effect"));
});

test("staged initiative attack rejects stale runtime revision without discarding the intervening runtime mutation", async () => {
  const adapter=new MockAdapter();
  await startAelarInitiative(adapter);
  let snapshot=await stageShortbowHit(adapter);
  assert.equal(snapshot.resolution?.stage,"damage-animation");

  seedRuntime(adapter,(state)=>{
    state.effects.push(createEffect({
      id:"intervening-runtime-effect",
      sourceId:"effect:external",
      targetId:"char.aelar",
      kind:"marker",
      duration:{ kind:"permanent" },
    },state.clock));
  });

  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.match(snapshot.resolution?.finalOutcome ?? "",/turn runtime revision changed before staged damage commit/);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,12);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);
  const runtime=snapshotAdapterTurnRuntimeState(adapter,internalScene(adapter));
  assert.ok(runtime?.effects.some((effect)=>effect.id==="intervening-runtime-effect"));
});

test("initiative event-native Undo restores Scene and authoritative runtime through the same revision-checked seam", async () => {
  const adapter=new MockAdapter();
  await startAelarInitiative(adapter);
  let snapshot=await stageShortbowHit(adapter);
  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,6);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  const afterAttack=snapshotAdapterTurnRuntimeState(adapter,internalScene(adapter));
  assert.ok(afterAttack);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,12);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);
  assert.equal(snapshot.resolution,null);
  const afterUndo=snapshotAdapterTurnRuntimeState(adapter,internalScene(adapter));
  assert.ok(afterUndo);
  assert.equal(afterUndo!.combatants["combatant.goblin-a"].life.hp.current,12);
  assert.equal(afterUndo!.combatants["char.aelar"].economy.action,true);
  assert.equal(afterUndo!.revision,afterAttack!.revision+1);
});
