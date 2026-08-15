import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import {
  applyAdapterRuntimeEffectApplication,
  resolveRuntimeEffectApplication,
} from "../../src/app/realRuntimeEffectApplicationService";
import {
  commitAdapterTurnRuntimeState,
  snapshotAdapterTurnRuntimeState,
} from "../../src/app/turnRuntimeSessionRegistry";
import { createEffect } from "../../src/domain/effects";

function sceneOf(adapter:MockAdapter) {
  return (adapter as unknown as { scene:Awaited<ReturnType<MockAdapter["getSnapshot"]>>["scene"] }).scene;
}

async function initiativeAdapter() {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  return adapter;
}

function runtimeOf(adapter:MockAdapter) {
  const runtime=snapshotAdapterTurnRuntimeState(adapter,sceneOf(adapter));
  assert.ok(runtime,"authoritative turn runtime must exist");
  return runtime!;
}

test("runtime effect apply is committed as raw events, projected to Activity, and undone without Scene effect fields", async () => {
  const adapter=await initiativeAdapter();
  const applied=await applyAdapterRuntimeEffectApplication(adapter,{
    resolutionId:"phase09.effect.apply",
    actorId:"char.aelar",
    sourceId:"feature:test-marker",
    title:"테스트 효과 적용",
    operations:[{
      id:"apply-marker",
      kind:"apply-effect",
      effect:{
        id:"test-marker",
        sourceId:"feature:test-marker",
        sourceActorId:"char.aelar",
        targetId:"combatant.goblin-a",
        kind:"marker",
        duration:{ kind:"permanent" },
        metadata:{ phase:"applied" },
      },
    }],
  });
  assert.equal(applied.status,"committed");
  if (applied.status!=="committed") return;
  assert.equal(applied.events.length,1);
  assert.ok(applied.events[0].stateChanges.some((change)=>change.kind==="effect"&&change.effectId==="test-marker"));
  assert.ok(applied.activity.stateChanges.some((label)=>label.includes("effect.test-marker added")));
  assert.ok(runtimeOf(adapter).effects.some((effect)=>effect.id==="test-marker"));

  const snapshot=await adapter.getSnapshot();
  assert.equal("effects" in snapshot.scene,false,"SceneVm remains a projection boundary, not the runtime effect store");
  assert.equal(snapshot.activity[0]?.id,"phase09.effect.apply");

  await adapter.undoLastResolution();
  assert.equal(runtimeOf(adapter).effects.some((effect)=>effect.id==="test-marker"),false);
  const undone=await adapter.getSnapshot();
  assert.equal(undone.activity.find((entry)=>entry.id==="phase09.effect.apply")?.reversed,true);
  assert.equal(undone.activity[0]?.undoOf,"phase09.effect.apply");
});

test("runtime effect update and remove Undo restore exact EffectInstance snapshots", async () => {
  const adapter=await initiativeAdapter();
  await applyAdapterRuntimeEffectApplication(adapter,{
    resolutionId:"phase09.effect.seed",
    actorId:"char.aelar",
    sourceId:"feature:test-update",
    operations:[{
      id:"seed-effect",
      kind:"apply-effect",
      effect:{
        id:"mutable-effect",
        sourceId:"feature:test-update",
        targetId:"combatant.goblin-a",
        kind:"modifier",
        tags:["test:modifier"],
        duration:{ kind:"permanent" },
        metadata:{ phase:"before" },
      },
    }],
  });

  const updated=await applyAdapterRuntimeEffectApplication(adapter,{
    resolutionId:"phase09.effect.update",
    actorId:"char.aelar",
    sourceId:"feature:test-update",
    operations:[{
      id:"update-effect",
      kind:"update-effect",
      effectId:"mutable-effect",
      metadataPatch:{ phase:"after",stack:2 },
    }],
  });
  assert.equal(updated.status,"committed");
  assert.deepEqual(runtimeOf(adapter).effects.find((effect)=>effect.id==="mutable-effect")?.metadata,{ phase:"after",stack:2 });
  await adapter.undoLastResolution();
  assert.deepEqual(runtimeOf(adapter).effects.find((effect)=>effect.id==="mutable-effect")?.metadata,{ phase:"before" });

  const removed=await applyAdapterRuntimeEffectApplication(adapter,{
    resolutionId:"phase09.effect.remove",
    actorId:"char.aelar",
    sourceId:"feature:test-update",
    operations:[{ id:"remove-effect",kind:"remove-effect",effectId:"mutable-effect" }],
  });
  assert.equal(removed.status,"committed");
  assert.equal(runtimeOf(adapter).effects.some((effect)=>effect.id==="mutable-effect"),false);
  await adapter.undoLastResolution();
  const restored=runtimeOf(adapter).effects.find((effect)=>effect.id==="mutable-effect");
  assert.deepEqual(restored?.metadata,{ phase:"before" });
  assert.deepEqual(restored?.tags,["test:modifier"]);
});

test("concentration start/end applications project group and source IDs and Undo restores the group effect", async () => {
  const adapter=await initiativeAdapter();
  const groupId="char.aelar:test-focus";
  const started=await applyAdapterRuntimeEffectApplication(adapter,{
    resolutionId:"phase09.concentration.start",
    actorId:"char.aelar",
    sourceId:"spell:test-focus",
    title:"집중 시작",
    operations:[
      { id:"start-focus",kind:"start-concentration",groupId,sourceId:"spell:test-focus" },
      {
        id:"apply-focus-effect",
        kind:"apply-effect",
        effect:{
          id:"focus-effect",
          sourceId:"spell:test-focus",
          sourceActorId:"char.aelar",
          targetId:"combatant.goblin-a",
          kind:"marker",
          duration:{ kind:"concentration" },
          concentrationGroupId:groupId,
        },
      },
    ],
  });
  assert.equal(started.status,"committed");
  if (started.status!=="committed") return;
  assert.ok(started.activity.stateChanges.some((label)=>label.includes(`concentration — → ${groupId} (spell:test-focus)`)));
  assert.equal(started.activity.stateChanges.some((label)=>label.includes("[object Object]")),false);
  assert.equal(runtimeOf(adapter).concentration["char.aelar"]?.sourceId,"spell:test-focus");
  assert.ok(runtimeOf(adapter).effects.some((effect)=>effect.id==="focus-effect"));

  const ended=await applyAdapterRuntimeEffectApplication(adapter,{
    resolutionId:"phase09.concentration.end",
    actorId:"char.aelar",
    sourceId:"spell:test-focus",
    title:"집중 종료",
    operations:[{ id:"end-focus",kind:"end-concentration",reason:"test end" }],
  });
  assert.equal(ended.status,"committed");
  if (ended.status!=="committed") return;
  assert.ok(ended.activity.stateChanges.some((label)=>label.includes(`${groupId} (spell:test-focus) → —`)));
  assert.equal(runtimeOf(adapter).concentration["char.aelar"],undefined);
  assert.equal(runtimeOf(adapter).effects.some((effect)=>effect.id==="focus-effect"),false);

  await adapter.undoLastResolution();
  const restored=runtimeOf(adapter);
  assert.deepEqual(restored.concentration["char.aelar"],{
    actorId:"char.aelar",
    groupId,
    sourceId:"spell:test-focus",
  });
  assert.ok(restored.effects.some((effect)=>effect.id==="focus-effect"));
});

test("prepared runtime effect application cannot overwrite a newer turn-runtime revision", async () => {
  const adapter=await initiativeAdapter();
  const input=runtimeOf(adapter);
  const prepared=resolveRuntimeEffectApplication(input,{
    resolutionId:"phase09.effect.stale",
    actorId:"char.aelar",
    sourceId:"feature:stale",
    operations:[{
      id:"prepared-effect",
      kind:"apply-effect",
      effect:{
        id:"prepared-effect",
        sourceId:"feature:stale",
        targetId:"combatant.goblin-a",
        kind:"marker",
        duration:{ kind:"permanent" },
      },
    }],
  });
  assert.equal(prepared.status,"committed");
  if (prepared.status!=="committed") return;

  const intervening=structuredClone(input);
  intervening.effects.push(createEffect({
    id:"intervening-effect",
    sourceId:"feature:external",
    targetId:"char.aelar",
    kind:"marker",
    duration:{ kind:"permanent" },
  },intervening.clock));
  intervening.revision=input.revision+1;
  assert.equal(commitAdapterTurnRuntimeState(adapter,sceneOf(adapter),input.revision,intervening),true);
  assert.equal(commitAdapterTurnRuntimeState(adapter,sceneOf(adapter),prepared.inputRevision,prepared.state),false);
  const current=runtimeOf(adapter);
  assert.ok(current.effects.some((effect)=>effect.id==="intervening-effect"));
  assert.equal(current.effects.some((effect)=>effect.id==="prepared-effect"),false);
});

test("runtime effect application rejects explicitly when no authoritative turn runtime exists", async () => {
  const adapter=new MockAdapter();
  const result=await applyAdapterRuntimeEffectApplication(adapter,{
    resolutionId:"phase09.effect.no-session",
    actorId:"char.aelar",
    sourceId:"feature:no-session",
    operations:[{
      id:"effect",
      kind:"apply-effect",
      effect:{
        id:"no-session-effect",
        sourceId:"feature:no-session",
        targetId:"combatant.goblin-a",
        kind:"marker",
        duration:{ kind:"permanent" },
      },
    }],
  });
  assert.equal(result.status,"rejected");
  if (result.status==="rejected") assert.match(result.error,/active turn runtime session/);
});
