import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "../../src/app/phase09EffectAwareTurnAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";
import { createEffect } from "../../src/domain/effects";

function sceneOf(adapter:MockAdapter) {
  return (adapter as unknown as { scene:Awaited<ReturnType<MockAdapter["getSnapshot"]>>["scene"] }).scene;
}

function runtimeOf(adapter:MockAdapter) {
  const runtime=snapshotAdapterTurnRuntimeState(adapter,sceneOf(adapter));
  assert.ok(runtime,"active initiative must expose an authoritative turn runtime");
  return runtime!;
}

test("production main wires the effect-aware turn lifecycle overlay after the base turn adapter", () => {
  const main=readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf8");
  const base=main.indexOf('import "./app/phase09RealTurnRuntimeAdapter";');
  const overlay=main.indexOf('import "./app/phase09EffectAwareTurnAdapter";');
  assert.ok(base>=0,"base turn runtime adapter import is required");
  assert.ok(overlay>base,"effect-aware overlay must load after the base turn runtime adapter");
});

test("endTurn expires boundary effects before projecting next-turn condition economy and Activity", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  let snapshot=await adapter.getSnapshot();
  const order=[...snapshot.scene.entities]
    .sort((left,right)=>right.initiative-left.initiative)
    .map((entity)=>entity.id);
  const currentId=snapshot.scene.currentActorId;
  const currentIndex=order.indexOf(currentId);
  assert.ok(currentIndex>=0);
  const nextId=order[(currentIndex+1)%order.length];
  const runtime=runtimeOf(adapter);
  const round=runtime.clock.round;
  const nextBaseSpeed=runtime.combatants[nextId].baseSpeed;

  const seeded=structuredClone(runtime);
  seeded.effects.push(
    createEffect({
      id:"adapter-end-expiry",
      sourceId:"test:adapter-end",
      targetId:currentId,
      kind:"marker",
      duration:{ kind:"until-turn-boundary",actorId:currentId,round,boundary:"end" },
    },seeded.clock),
    createEffect({
      id:"adapter-start-grappled-expiry",
      sourceId:"test:adapter-start",
      targetId:nextId,
      kind:"condition",
      conditionId:"grappled",
      duration:{ kind:"until-turn-boundary",actorId:nextId,round:currentIndex+1>=order.length ? round+1 : round,boundary:"start" },
    },seeded.clock),
    createEffect({
      id:"adapter-persistent-incapacitated",
      sourceId:"test:adapter-incapacitated",
      targetId:nextId,
      kind:"condition",
      conditionId:"incapacitated",
      duration:{ kind:"permanent" },
    },seeded.clock),
  );
  seeded.revision=runtime.revision+1;
  assert.equal(commitAdapterTurnRuntimeState(adapter,sceneOf(adapter),runtime.revision,seeded),true);

  await adapter.endTurn();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.currentActorId,nextId);
  const after=runtimeOf(adapter);
  assert.equal(after.effects.some((effect)=>effect.id==="adapter-end-expiry"),false);
  assert.equal(after.effects.some((effect)=>effect.id==="adapter-start-grappled-expiry"),false);
  assert.equal(after.effects.some((effect)=>effect.id==="adapter-persistent-incapacitated"),true);
  assert.equal(snapshot.scene.economyByActor[nextId].movement,nextBaseSpeed);
  assert.equal(snapshot.scene.economyByActor[nextId].movementMax,nextBaseSpeed);
  assert.equal(snapshot.scene.economyByActor[nextId].action,false);
  assert.equal(snapshot.scene.economyByActor[nextId].bonusAction,false);
  assert.equal(snapshot.scene.economyByActor[nextId].reaction,false);

  const activity=snapshot.activity[0];
  assert.equal(activity.title,"턴 종료");
  assert.ok(activity.detail.some((line)=>/ResolutionEvent 1\/2 · end-turn/.test(line)));
  assert.ok(activity.detail.some((line)=>/ResolutionEvent 2\/2 · begin-turn/.test(line)));
  assert.ok(activity.stateChanges.some((line)=>line.includes("effect.adapter-end-expiry removed")));
  assert.ok(activity.stateChanges.some((line)=>line.includes("effect.adapter-start-grappled-expiry removed")));
});
