import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import { applyResolutionEvents } from "../../src/app/realEventApplyService";
import { createTurnRuntimeSession } from "../../src/app/realTurnRuntimeService";
import type { ResolutionEvent } from "../../src/domain/resolutionTypes";

const SECOND_WIND="resource:fighter.second-wind";

function debitEvent(targetId:string,before:number,after:number):ResolutionEvent {
  return {
    id:"event.observer.second-wind",
    resolutionId:"resolution.observer.second-wind",
    operationId:"operation.observer.second-wind",
    kind:"connected-test",
    actorId:targetId,
    targetId,
    summary:"remote Second Wind debit",
    provenance:[],
    stateChanges:[{kind:"resource",targetId,resourceId:SECOND_WIND,before,after,provenance:[],lifetime:"character-durable",writeBack:"character"}],
    result:{ connected:true },
  };
}

// Reproduced on real Windows H+P1+P2 (W9-02 family C, MP-C11): the observer P2 rejected the Host's
// committed Second Wind debit for P1 with "event-native apply target is missing", and when P2 owned
// a same-id resource the debit silently landed on P2's own sheet instead of P1's combatant.
test("an observer replica applies a remote Character's resource debit to that combatant, never to its own same-id resource",async()=>{
  const snapshot=await new MockAdapter().getSnapshot();
  const runtime=createTurnRuntimeSession(snapshot.scene).state;
  const remote="char.aelar";
  const observer="char.mira";
  assert.ok(runtime.combatants[remote],"the remote Character must be a runtime combatant");
  assert.equal(runtime.combatants[remote].resources.some((entry)=>entry.id===SECOND_WIND),false,"the observer replica has not seen the remote resource yet");
  const ownResources=[{id:SECOND_WIND,label:"Second Wind",current:2,max:2,source:"파이터"}];

  const applied=applyResolutionEvents(snapshot.scene,[debitEvent(remote,2,1)],ownResources,[],runtime,{ownerId:observer});
  assert.equal(applied.status,"committed",applied.status==="rejected"?applied.error:"");
  if (applied.status!=="committed") return;
  assert.equal(applied.resources.find((entry)=>entry.id===SECOND_WIND)?.current,2,"the observer's own same-id resource must stay untouched");
  const seeded=applied.runtimeState?.combatants[remote]?.resources.find((entry)=>entry.id===SECOND_WIND);
  assert.ok(seeded,"the remote combatant resource is seeded from the authoritative event");
  assert.equal(seeded.current,1);
  assert.equal(seeded.maximum,2);
  assert.deepEqual(applied.stateChanges,[`${remote} resource.${SECOND_WIND} 2 → 1`]);

  const duplicate=applyResolutionEvents(applied.scene,[debitEvent(remote,2,1)],applied.resources,[],applied.runtimeState,{ownerId:observer});
  assert.equal(duplicate.status,"rejected","the same authoritative event must not apply twice");
  if (duplicate.status==="rejected") assert.match(duplicate.error,/runtime drift/);

  const next=applyResolutionEvents(applied.scene,[debitEvent(remote,1,0)],applied.resources,[],applied.runtimeState,{ownerId:observer});
  assert.equal(next.status,"committed");
  if (next.status==="committed") assert.equal(next.runtimeState?.combatants[remote]?.resources.find((entry)=>entry.id===SECOND_WIND)?.current,0);
});

test("the owner's own resource debit still applies to the supplied sheet resources",async()=>{
  const snapshot=await new MockAdapter().getSnapshot();
  const runtime=createTurnRuntimeSession(snapshot.scene).state;
  const owner="char.aelar";
  const ownResources=[{id:SECOND_WIND,label:"Second Wind",current:2,max:2,source:"파이터"}];
  const applied=applyResolutionEvents(snapshot.scene,[debitEvent(owner,2,1)],ownResources,[],runtime,{ownerId:owner});
  assert.equal(applied.status,"committed",applied.status==="rejected"?applied.error:"");
  if (applied.status!=="committed") return;
  assert.equal(applied.resources.find((entry)=>entry.id===SECOND_WIND)?.current,1);
});

test("without an owner the legacy contract matches the supplied resources by id",async()=>{
  const snapshot=await new MockAdapter().getSnapshot();
  const ownResources=[{id:SECOND_WIND,label:"Second Wind",current:2,max:2,source:"파이터"}];
  const applied=applyResolutionEvents(snapshot.scene,[debitEvent("char.aelar",2,1)],ownResources,[]);
  assert.equal(applied.status,"committed");
  if (applied.status==="committed") assert.equal(applied.resources.find((entry)=>entry.id===SECOND_WIND)?.current,1);
});
