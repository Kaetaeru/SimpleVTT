import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09ConcentrationSaveAdapter";
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

function mutateRuntime(
  adapter:MockAdapter,
  mutate:(state:NonNullable<ReturnType<typeof snapshotAdapterTurnRuntimeState>>)=>void,
) {
  const scene=internalScene(adapter);
  const before=snapshotAdapterTurnRuntimeState(adapter,scene);
  assert.ok(before,"initiative runtime must exist");
  const next=structuredClone(before!);
  mutate(next);
  next.revision=before!.revision+1;
  assert.equal(commitAdapterTurnRuntimeState(adapter,scene,before!.revision,next),true);
  return next;
}

function seedGoblinConcentration(adapter:MockAdapter) {
  mutateRuntime(adapter,(state)=>{
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
}

async function reachConcentrationPrompt(adapter:MockAdapter) {
  await adapter.setQueuedD20(11);
  await adapter.resolveAction("action.shortbow",["combatant.goblin-a"]);
  await adapter.advanceResolution();
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"attack-result");

  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"damage-animation");
  assert.deepEqual(snapshot.resolution?.authoritativeDice,[4]);

  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"save-animation");
  assert.deepEqual(snapshot.resolution?.authoritativeDice,[]);
  assert.equal(snapshot.resolution?.canAdvance,false);
  assert.equal(snapshot.resolution?.concentrationSave?.targetId,"combatant.goblin-a");
  assert.equal(snapshot.resolution?.concentrationSave?.ability,"con");
  assert.equal(snapshot.resolution?.concentrationSave?.modifier,0,"builtin Goblin CON 10 => +0");
  return snapshot;
}

test("concentration damage waits for explicit d20 input without partially committing damage", async () => {
  const adapter=new MockAdapter();
  await startAelarInitiative(adapter);
  seedGoblinConcentration(adapter);

  const snapshot=await reachConcentrationPrompt(adapter);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,12);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);
  const runtime=snapshotAdapterTurnRuntimeState(adapter,internalScene(adapter));
  assert.equal(runtime?.concentration["combatant.goblin-a"]?.groupId,"goblin:focus");
  assert.ok(runtime?.effects.some((effect)=>effect.id==="goblin-focus-effect"));
});

test("successful fixed concentration save commits damage and keeps concentration", async () => {
  const adapter=new MockAdapter();
  await startAelarInitiative(adapter);
  seedGoblinConcentration(adapter);
  await reachConcentrationPrompt(adapter);

  await adapter.submitConcentrationSaveD20(15);
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"save-animation");
  assert.deepEqual(snapshot.resolution?.authoritativeDice,[15]);

  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,6);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  assert.equal(snapshot.resolution?.concentrationSave?.natural,15);
  assert.equal(snapshot.resolution?.concentrationSave?.total,15);
  assert.equal(snapshot.resolution?.concentrationSave?.dc,10);
  assert.equal(snapshot.resolution?.concentrationSave?.outcome,"성공");
  const runtime=snapshotAdapterTurnRuntimeState(adapter,internalScene(adapter));
  assert.equal(runtime?.concentration["combatant.goblin-a"]?.groupId,"goblin:focus");
  assert.ok(runtime?.effects.some((effect)=>effect.id==="goblin-focus-effect"));
});

test("failed fixed concentration save removes concentration group, projects raw Activity, and event-native Undo restores all state", async () => {
  const adapter=new MockAdapter();
  await startAelarInitiative(adapter);
  seedGoblinConcentration(adapter);
  await reachConcentrationPrompt(adapter);

  await adapter.submitConcentrationSaveD20(1);
  await adapter.advanceResolution();
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,6);
  assert.equal(snapshot.resolution?.concentrationSave?.outcome,"실패");
  let runtime=snapshotAdapterTurnRuntimeState(adapter,internalScene(adapter));
  assert.equal(runtime?.concentration["combatant.goblin-a"],undefined);
  assert.equal(runtime?.effects.some((effect)=>effect.id==="goblin-focus-effect"),false);

  const activity=snapshot.activity[0];
  assert.equal(activity.id,snapshot.resolution?.id);
  assert.ok(activity.detail.some((line)=>line.includes("Concentration broken by damage")));
  assert.ok(activity.stateChanges.some((line)=>line.includes("combatant.goblin-a concentration goblin:focus (spell:focus) → —")));
  assert.ok(activity.stateChanges.some((line)=>line.includes("char.aelar effect.goblin-focus-effect removed")));

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,12);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);
  runtime=snapshotAdapterTurnRuntimeState(adapter,internalScene(adapter));
  assert.equal(runtime?.concentration["combatant.goblin-a"]?.groupId,"goblin:focus");
  assert.ok(runtime?.effects.some((effect)=>effect.id==="goblin-focus-effect"));
});

test("concentration save input rejects stale runtime revision without discarding the intervening mutation", async () => {
  const adapter=new MockAdapter();
  await startAelarInitiative(adapter);
  seedGoblinConcentration(adapter);
  await reachConcentrationPrompt(adapter);

  mutateRuntime(adapter,(state)=>{
    state.effects.push(createEffect({
      id:"intervening-after-concentration-prompt",
      sourceId:"effect:external",
      targetId:"char.aelar",
      kind:"marker",
      duration:{ kind:"permanent" },
    },state.clock));
  });

  await adapter.submitConcentrationSaveD20(15);
  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.match(snapshot.resolution?.finalOutcome ?? "",/revision changed while concentration save awaited input/);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,12);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);
  const runtime=snapshotAdapterTurnRuntimeState(adapter,internalScene(adapter));
  assert.equal(runtime?.concentration["combatant.goblin-a"]?.groupId,"goblin:focus");
  assert.ok(runtime?.effects.some((effect)=>effect.id==="intervening-after-concentration-prompt"));
});
