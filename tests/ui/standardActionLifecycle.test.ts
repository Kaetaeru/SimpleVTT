import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import type { SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";

type MutableAdapter={scene:SceneVm};

function mutableScene(adapter:MockAdapter) {
  return (adapter as unknown as MutableAdapter).scene;
}

function entity(adapter:MockAdapter,id:string) {
  const found=mutableScene(adapter).entities.find((entry)=>entry.id===id);
  assert.ok(found,`missing entity ${id}`);
  return found;
}

test("Help is consumed by the next ability check and resolves as authoritative advantage",async()=>{
  const adapter=new MockAdapter();
  const before=await adapter.getSnapshot();
  const actorId=before.activeCharacter.id;
  const actor=entity(adapter,actorId);
  actor.status.push("도움 받음");
  const action=before.scene.actionsByActor[actorId]?.find((entry)=>entry.resolutionKind==="ability-check");
  assert.ok(action,"active production character requires an ability check action");

  await adapter.setQueuedD20(5);
  const preview=await adapter.resolveAction(action.id,[]);
  assert.deepEqual(preview.resolution?.authoritativeDice,[5,12]);
  assert.equal(preview.resolution?.rollTotal,12+(action.checkBonus??0));
  assert.ok(preview.resolution?.provenance.some((entry)=>entry.startsWith("action:standard.help · applied")));
  assert.ok(preview.resolution?.stateChanges.some((entry)=>entry.includes("도움 받음")&&entry.includes("유리점")));
  assert.equal(preview.scene.entities.find((entry)=>entry.id===actorId)?.status.includes("도움 받음"),false);

  const completed=await adapter.advanceResolution();
  assert.equal(completed.resolution?.stage,"complete");
  assert.ok(completed.activity[0]?.stateChanges.some((entry)=>entry.includes("도움 받음")));
});

test("Hide records success and failure and attacking reveals the actor",async()=>{
  const adapter=new MockAdapter();
  await adapter.setSessionMode("freeform");
  let snapshot=await adapter.getSnapshot();
  const actorId=snapshot.activeCharacter.id;

  await adapter.setQueuedD20(20);
  await adapter.resolveAction("action.standard.hide.stealth",[]);
  snapshot=await adapter.advanceResolution();
  assert.match(snapshot.resolution?.finalOutcome??"",/숨기 성공/);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===actorId)?.status.includes("숨음"),true);

  const attack=snapshot.scene.actionsByActor[actorId]?.find((entry)=>entry.resolutionKind==="attack");
  assert.ok(attack,"active production character requires an attack action");
  const targetId=attack.eligibleTargetIds?.[0];
  assert.ok(targetId,"attack requires an eligible enemy target");
  await adapter.resolveAction(attack.id,[targetId]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===actorId)?.status.includes("숨음"),false);
  assert.ok(snapshot.resolution?.stateChanges.some((entry)=>entry.includes("숨음")&&entry.includes("공격 선언")));

  const failed=new MockAdapter();
  await failed.setSessionMode("freeform");
  entity(failed,actorId).status.push("숨음");
  await failed.setQueuedD20(1);
  await failed.resolveAction("action.standard.hide.stealth",[]);
  snapshot=await failed.advanceResolution();
  assert.match(snapshot.resolution?.finalOutcome??"",/숨기 실패/);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===actorId)?.status.includes("숨음"),false);
});

test("turn boundaries expire Disengage at turn end and Dodge or Ready at next turn start",async()=>{
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const actor=entity(adapter,"char.aelar");
  actor.status.push("이탈","회피","준비 행동");

  let snapshot=await adapter.endTurn();
  let projected=snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")!;
  assert.equal(projected.status.includes("이탈"),false);
  assert.equal(projected.status.includes("회피"),true);
  assert.equal(projected.status.includes("준비 행동"),true);
  assert.ok(snapshot.activity[0]?.stateChanges.some((entry)=>entry.includes("이탈")));

  for (let guard=0;snapshot.scene.currentActorId!=="char.aelar"&&guard<20;guard+=1) {
    snapshot=await adapter.endTurn();
  }
  assert.equal(snapshot.scene.currentActorId,"char.aelar");
  projected=snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")!;
  assert.equal(projected.status.includes("회피"),false);
  assert.equal(projected.status.includes("준비 행동"),false);
  assert.ok(snapshot.activity[0]?.stateChanges.some((entry)=>entry.includes("회피")));
  assert.ok(snapshot.activity[0]?.stateChanges.some((entry)=>entry.includes("준비 행동")));
});

test("ending initiative clears every remaining turn-bound standard-action status",async()=>{
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  entity(adapter,"char.aelar").status.push("이탈","회피","준비 행동");
  const snapshot=await adapter.endInitiative();
  const actor=snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")!;
  assert.equal(snapshot.sessionMode,"freeform");
  assert.equal(actor.status.includes("이탈"),false);
  assert.equal(actor.status.includes("회피"),false);
  assert.equal(actor.status.includes("준비 행동"),false);
  assert.ok(snapshot.activity[0]?.stateChanges.some((entry)=>entry.includes("준비 행동")));
});
