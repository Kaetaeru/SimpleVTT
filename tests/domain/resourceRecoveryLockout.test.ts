import assert from "node:assert/strict";
import test from "node:test";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { recoverResources, setResourceRecoveryLockout } from "../../src/domain/resources";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function stateWithFeature(current = 0) {
  const state = runtimeState();
  state.combatants.hero.resources.push({
    id:"feature:locked",
    label:"Locked Feature",
    current,
    maximum:1,
    recovery:{ longRest:"all" },
  });
  return state;
}

function longRest(state:ReturnType<typeof stateWithFeature>, expectedRevision:number, id:string) {
  return resolvePendingResolution(TEST_PROFILE,state,{
    id,
    actorId:"hero",
    sourceId:"test:long-rest",
    expectedRevision,
    operations:[{ id:`${id}:rest`, kind:"long-rest", targetId:"hero" }],
  });
}

test("a three-Long-Rest lockout suppresses the first two recoveries and recovers when the third Long Rest is finished", () => {
  const state = stateWithFeature(0);
  const locked = resolvePendingResolution(TEST_PROFILE,state,{
    id:"lockout.set",
    actorId:"hero",
    sourceId:"feature:test",
    expectedRevision:0,
    operations:[{
      id:"lockout.set:resource",
      kind:"set-resource-recovery-lockout",
      actorId:"hero",
      resourceId:"feature:locked",
      trigger:"longRest",
      rests:3,
    }],
  });
  assert.equal(locked.status,"committed");
  if (locked.status !== "committed") return;
  let pool = locked.state.combatants.hero.resources.find((entry) => entry.id === "feature:locked");
  assert.deepEqual(pool?.recoveryLockouts,{ longRest:3 });
  const setResourceChange=locked.events[0].stateChanges.find((change)=>change.kind==="resource"&&change.resourceId==="feature:locked");
  assert.ok(setResourceChange&&setResourceChange.kind==="resource","setting a lockout must emit a durable resource event");
  if (setResourceChange?.kind==="resource") {
    assert.equal(setResourceChange.before,0);
    assert.equal(setResourceChange.after,0);
    assert.deepEqual(setResourceChange.recoveryLockouts,{before:null,after:{longRest:3}});
  }

  const first = longRest(locked.state,1,"lockout.rest.1");
  assert.equal(first.status,"committed");
  if (first.status !== "committed") return;
  pool = first.state.combatants.hero.resources.find((entry) => entry.id === "feature:locked");
  assert.equal(pool?.current,0);
  assert.deepEqual(pool?.recoveryLockouts,{ longRest:2 });
  const firstResourceChange=first.events[0].stateChanges.find((change)=>change.kind==="resource"&&change.resourceId==="feature:locked");
  assert.ok(firstResourceChange&&firstResourceChange.kind==="resource","lockout-only rest must still emit a durable resource state change");
  if (firstResourceChange?.kind==="resource") {
    assert.equal(firstResourceChange.before,0);
    assert.equal(firstResourceChange.after,0);
    assert.deepEqual(firstResourceChange.recoveryLockouts,{before:{longRest:3},after:{longRest:2}});
  }

  const second = longRest(first.state,2,"lockout.rest.2");
  assert.equal(second.status,"committed");
  if (second.status !== "committed") return;
  pool = second.state.combatants.hero.resources.find((entry) => entry.id === "feature:locked");
  assert.equal(pool?.current,0);
  assert.deepEqual(pool?.recoveryLockouts,{ longRest:1 });

  const third = longRest(second.state,3,"lockout.rest.3");
  assert.equal(third.status,"committed");
  if (third.status !== "committed") return;
  pool = third.state.combatants.hero.resources.find((entry) => entry.id === "feature:locked");
  assert.equal(pool?.current,1,"finishing the third required Long Rest both completes the lockout and permits normal recovery");
  assert.equal(pool?.recoveryLockouts,undefined);
  const thirdResourceChange=third.events[0].stateChanges.find((change)=>change.kind==="resource"&&change.resourceId==="feature:locked");
  assert.ok(thirdResourceChange&&thirdResourceChange.kind==="resource");
  if (thirdResourceChange?.kind==="resource") {
    assert.deepEqual(thirdResourceChange.recoveryLockouts,{before:{longRest:1},after:null});
  }
});

test("short- and Long-Rest lockouts are independent", () => {
  const pool = {
    id:"dual",
    label:"Dual Recovery",
    current:0,
    maximum:2,
    recovery:{ shortRest:1 as const, longRest:"all" as const },
  };
  const shortLocked = setResourceRecoveryLockout(pool,"shortRest",2,"test").next;
  const bothLocked = setResourceRecoveryLockout(shortLocked,"longRest",2,"test").next;
  const short = recoverResources([bothLocked],"shortRest").next[0];
  assert.equal(short.current,0);
  assert.deepEqual(short.recoveryLockouts,{ shortRest:1, longRest:2 });
  const long = recoverResources([short],"longRest").next[0];
  assert.equal(long.current,0);
  assert.deepEqual(long.recoveryLockouts,{ shortRest:1, longRest:1 });
  const nextShort = recoverResources([long],"shortRest").next[0];
  assert.equal(nextShort.current,1);
  assert.deepEqual(nextShort.recoveryLockouts,{ longRest:1 });
});

test("invalid recovery lockout operations reject atomically", () => {
  const state = stateWithFeature(0);
  const badCount = resolvePendingResolution(TEST_PROFILE,state,{
    id:"lockout.bad-count",
    actorId:"hero",
    sourceId:"feature:test",
    expectedRevision:0,
    operations:[{
      id:"lockout.bad-count:set",
      kind:"set-resource-recovery-lockout",
      resourceId:"feature:locked",
      trigger:"longRest",
      rests:0,
    }],
  });
  assert.equal(badCount.status,"rejected");
  assert.equal(badCount.state,state);
  assert.equal(state.combatants.hero.resources.find((entry) => entry.id === "feature:locked")?.recoveryLockouts,undefined);

  const missing = resolvePendingResolution(TEST_PROFILE,state,{
    id:"lockout.missing",
    actorId:"hero",
    sourceId:"feature:test",
    expectedRevision:0,
    operations:[{
      id:"lockout.missing:set",
      kind:"set-resource-recovery-lockout",
      resourceId:"feature:missing",
      trigger:"longRest",
      rests:2,
    }],
  });
  assert.equal(missing.status,"rejected");
  assert.equal(missing.state,state);
});

test("turn-start recovery emits the durable resource delta used by connected projection and Undo", () => {
  const state=runtimeState();
  state.combatants.hero.resources.push({
    id:"feature:turn-start",
    label:"Turn Start Feature",
    current:0,
    maximum:2,
    recovery:{ turnStart:1 },
  });

  const committed=resolvePendingResolution(TEST_PROFILE,state,{
    id:"turn-start.resource-recovery",
    actorId:"hero",
    sourceId:"feature:turn-start",
    expectedRevision:0,
    operations:[{
      id:"turn-start.resource-recovery:begin",
      kind:"begin-turn",
      actorId:"hero",
      round:1,
    }],
  });
  assert.equal(committed.status,"committed");
  if (committed.status!=="committed") return;

  assert.equal(committed.state.combatants.hero.resources.find((entry)=>entry.id==="feature:turn-start")?.current,1);
  const change=committed.events[0].stateChanges.find((entry)=>entry.kind==="resource"&&entry.resourceId==="feature:turn-start");
  assert.ok(change&&change.kind==="resource","turn-start resource recovery must be represented in the authoritative event stream");
  if (change?.kind==="resource") {
    assert.equal(change.before,0);
    assert.equal(change.after,1);
    assert.equal(change.writeBack,"character");
    assert.equal(change.lifetime,"character-durable");
  }
});

test("temporary resource maximum emits authoritative capacity changes and Long Rest normalization", () => {
  const state=stateWithFeature(1);
  const expanded=resolvePendingResolution(TEST_PROFILE,state,{
    id:"temporary-capacity.expand",
    actorId:"hero",
    sourceId:"feature:temporary-capacity",
    expectedRevision:0,
    operations:[{
      id:"temporary-capacity.expand:resource",
      kind:"gain-resource",
      resourceId:"feature:locked",
      amount:1,
      maximumDelta:1,
      temporaryCapacityUntilLongRest:true,
    }],
  });
  assert.equal(expanded.status,"committed");
  if (expanded.status!=="committed") return;

  let pool=expanded.state.combatants.hero.resources.find((entry)=>entry.id==="feature:locked");
  assert.equal(pool?.current,2);
  assert.equal(pool?.maximum,2);
  assert.equal(pool?.maximumAfterLongRest,1);
  const expansion=expanded.events[0].stateChanges.find((entry)=>entry.kind==="resource"&&entry.resourceId==="feature:locked");
  assert.ok(expansion&&expansion.kind==="resource");
  if (expansion?.kind==="resource") {
    assert.deepEqual(expansion.capacity,{
      before:{maximum:1,maximumAfterLongRest:null},
      after:{maximum:2,maximumAfterLongRest:1},
    });
  }

  const rested=longRest(expanded.state,1,"temporary-capacity.long-rest");
  assert.equal(rested.status,"committed");
  if (rested.status!=="committed") return;
  pool=rested.state.combatants.hero.resources.find((entry)=>entry.id==="feature:locked");
  assert.equal(pool?.current,1);
  assert.equal(pool?.maximum,1);
  assert.equal(pool?.maximumAfterLongRest,undefined);
  const normalization=rested.events[0].stateChanges.find((entry)=>entry.kind==="resource"&&entry.resourceId==="feature:locked");
  assert.ok(normalization&&normalization.kind==="resource");
  if (normalization?.kind==="resource") {
    assert.deepEqual(normalization.capacity,{
      before:{maximum:2,maximumAfterLongRest:1},
      after:{maximum:1,maximumAfterLongRest:null},
    });
  }
});