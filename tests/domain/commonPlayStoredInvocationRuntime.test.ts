import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveCommonPlayStoredInvocationCancel,
  resolveCommonPlayStoredInvocationCapture,
  resolveCommonPlayStoredInvocationTrigger,
} from "../../src/domain/commonPlayStoredInvocationRuntime";
import type { PendingResolution } from "../../src/domain/resolutionTypes";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const trigger={op:"eq" as const,left:{ref:"event.kind"},right:{value:"enemy.moves"}};

function capture() {
  return resolveCommonPlayStoredInvocationCapture(TEST_PROFILE,runtimeState(),{
    resolutionId:"ready-unknown",actorId:"hero",definitionId:"external.unknown.ready-payload",entryPointId:"release",
    definitionRevision:"sha256:one",binding:"snapshot",trigger,
    captureOperations:[{id:"ready-action-payment",kind:"use-economy",actorId:"hero",slot:"action"}],
  });
}

function invocation(revision:number):PendingResolution {
  return {
    id:"compiled-payload",actorId:"hero",sourceId:"external.unknown.ready-payload",expectedRevision:revision,
    operations:[{id:"payload-damage",kind:"damage",targetId:"goblin",damageType:"force",amount:4,creatureKind:"monster"}],
  };
}

test("stored invocation captures now and atomically pays Reaction, executes, and consumes later",()=>{
  const captured=capture();
  assert.equal(captured.status,"committed");
  if(captured.status!=="committed") return;
  const artifact=captured.state.artifacts?.[0];
  assert.equal(artifact?.artifactKind,"stored-invocation");
  assert.equal(captured.state.combatants.hero.economy.action,false);
  assert.deepEqual(artifact?.expiry,{kind:"turn-boundary",actorId:"hero",round:2,boundary:"start"});

  const triggered=resolveCommonPlayStoredInvocationTrigger(TEST_PROFILE,captured.state,{
    resolutionId:"ready-trigger",artifactId:artifact!.id,expectedRevision:1,definitionRevision:"sha256:one",
    eventFacts:{"event.kind":"enemy.moves"},invocation:invocation(1),
  });
  assert.equal(triggered.status,"committed");
  if(triggered.status!=="committed") return;
  assert.equal(triggered.state.combatants.hero.economy.reaction,false);
  assert.equal(triggered.state.combatants.goblin.life.hp.current,11);
  assert.equal(triggered.state.artifacts?.length,0);
  assert.ok(triggered.events.some((event)=>event.stateChanges.some((change)=>change.kind==="artifact"&&change.operation==="removed")));

  const replay=resolveCommonPlayStoredInvocationTrigger(TEST_PROFILE,triggered.state,{
    resolutionId:"ready-trigger",artifactId:artifact!.id,expectedRevision:2,definitionRevision:"sha256:one",
    eventFacts:{"event.kind":"enemy.moves"},invocation:invocation(2),
  });
  assert.equal(replay.status,"no-match");
  assert.equal(replay.state.combatants.goblin.life.hp.current,11);
});

test("ignored, stale, and mismatched stored invocation triggers never mutate authority",()=>{
  const captured=capture();
  assert.equal(captured.status,"committed");
  if(captured.status!=="committed") return;
  const artifact=captured.state.artifacts![0];
  const ignored=resolveCommonPlayStoredInvocationTrigger(TEST_PROFILE,captured.state,{
    resolutionId:"ignored",artifactId:artifact.id,expectedRevision:1,definitionRevision:"sha256:one",
    eventFacts:{"event.kind":"ally.moves"},invocation:invocation(1),
  });
  assert.equal(ignored.status,"no-match");
  assert.equal(ignored.state,captured.state);

  const stale=resolveCommonPlayStoredInvocationTrigger(TEST_PROFILE,captured.state,{
    resolutionId:"stale",artifactId:artifact.id,expectedRevision:0,definitionRevision:"sha256:one",
    eventFacts:{"event.kind":"enemy.moves"},invocation:invocation(0),
  });
  assert.equal(stale.status,"rejected");
  assert.equal(stale.state,captured.state);

  const mismatch=resolveCommonPlayStoredInvocationTrigger(TEST_PROFILE,captured.state,{
    resolutionId:"mismatch",artifactId:artifact.id,expectedRevision:1,definitionRevision:"sha256:other",
    eventFacts:{"event.kind":"enemy.moves"},invocation:invocation(1),
  });
  assert.equal(mismatch.status,"rejected");
  assert.equal(captured.state.combatants.hero.economy.reaction,true);
  assert.equal(captured.state.artifacts?.length,1);
});

test("stored invocation cancellation is an authoritative artifact removal",()=>{
  const captured=capture();
  assert.equal(captured.status,"committed");
  if(captured.status!=="committed") return;
  const cancelled=resolveCommonPlayStoredInvocationCancel(TEST_PROFILE,captured.state,{
    resolutionId:"ready-cancel",artifactId:captured.state.artifacts![0].id,expectedRevision:1,
  });
  assert.equal(cancelled.status,"committed");
  if(cancelled.status==="committed") assert.equal(cancelled.state.artifacts?.length,0);
});

test("stored invocation mechanics are independent of definition and entry-point names",()=>{
  const first=resolveCommonPlayStoredInvocationCapture(TEST_PROFILE,runtimeState(),{
    resolutionId:"r1",actorId:"hero",definitionId:"unknown.a",entryPointId:"one",definitionRevision:"1",binding:"live",trigger,
  });
  const second=resolveCommonPlayStoredInvocationCapture(TEST_PROFILE,runtimeState(),{
    resolutionId:"r2",actorId:"hero",definitionId:"unknown.b",entryPointId:"two",definitionRevision:"1",binding:"live",trigger,
  });
  assert.equal(first.status,"committed");
  assert.equal(second.status,"committed");
  if(first.status==="committed"&&second.status==="committed") {
    assert.deepEqual(first.state.artifacts?.[0].expiry,second.state.artifacts?.[0].expiry);
  }
});
