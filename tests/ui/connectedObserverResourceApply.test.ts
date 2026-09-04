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

// Reproduced on real Windows H+P1+P2 (W9-02 family C, MP-C18): P1 drank a DM-granted Potion of Healing; the observer P2
// rejected the Host's committed event ("event-native apply target is missing: <P1>/resource.phase09:item:...:quantity")
// because item quantities live on the owner's sheet only, and P2 stayed one event behind the Host for good.
test("an observer replica accepts a remote Character's item quantity change as an authoritative no-op",async()=>{
  const snapshot=await new MockAdapter().getSnapshot();
  const runtime=createTurnRuntimeSession(snapshot.scene).state;
  const remote="char.aelar";
  const observer="char.mira";
  const itemResourceId="phase09:item:item.session.remote.potion:quantity";
  const event:ResolutionEvent={
    id:"event.observer.remote-potion",resolutionId:"resolution.observer.remote-potion",operationId:"operation.observer.remote-potion",kind:"spend-resource",
    actorId:remote,targetId:remote,summary:"remote potion quantity",provenance:[],
    stateChanges:[{kind:"resource",targetId:remote,resourceId:itemResourceId,before:1,after:0,provenance:[],lifetime:"character-durable",writeBack:"character"}],
    result:{ connected:true },
  };
  const ownItems=[{id:"item.session.observer.potion",definitionId:"dnd.srd521.item.gear.potion-of-healing",name:"치유 물약",nameEn:"Potion of Healing",kind:"consumable" as const,quantity:2,equipped:false,passiveEffects:[],grantedActionIds:[],provenance:["test"]}];
  const applied=applyResolutionEvents(snapshot.scene,[event],[],ownItems,runtime,{ownerId:observer});
  assert.equal(applied.status,"committed",applied.status==="rejected"?applied.error:"");
  if (applied.status!=="committed") return;
  assert.equal(applied.items[0]?.quantity,2,"the observer's own items stay untouched");
  assert.equal(applied.runtimeState?.combatants[remote]?.resources.some((entry)=>entry.id===itemResourceId),false,"item quantities are never seeded into the runtime");
  assert.equal(applied.stateChanges.length,1,"the authoritative change is still recorded in the Activity");

  const removed:ResolutionEvent={...event,id:"event.observer.remote-potion-removed",stateChanges:[{kind:"inventory-item",targetId:remote,itemId:"item.session.remote.potion",operation:"removed",before:{id:"item.session.remote.potion",definitionId:"dnd.srd521.item.gear.potion-of-healing",name:"치유 물약",nameEn:"Potion of Healing",kind:"consumable",quantity:0,equipped:false,passiveEffects:[],grantedActionIds:[],provenance:["test"]},provenance:[],lifetime:"character-durable",writeBack:"character"}]};
  const next=applyResolutionEvents(applied.scene,[removed],[],applied.items,applied.runtimeState,{ownerId:observer});
  assert.equal(next.status,"committed",next.status==="rejected"?next.error:"");
  if (next.status==="committed") assert.equal(next.items.length,1,"a remote item removal never touches the observer's inventory");
});
