import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import { FIGHTER_SECOND_WIND_RESOURCE_ID } from "../../src/domain/coreClassResources";
import { setSessionDebugPreviewRole } from "../../src/app/sessionDebugPreviewRole";

async function prepareHost(adapter:MockAdapter) {
  const initial=await adapter.getSnapshot();
  const character={...structuredClone(initial.activeCharacter),id:"char.open-check-fighter",name:"Open Check Fighter"};
  const internal=adapter as unknown as {activeCharacter:typeof character;characters:Array<typeof character>;session:{role:"host"}};
  internal.activeCharacter=character;
  internal.characters=[character];
  await adapter.getSnapshot();
  await adapter.startInitiative();
  await adapter.setCurrentActor(character.id);
  await adapter.selectDmActor(character.id);
  const snapshot=await adapter.getSnapshot();
  assert.ok((snapshot.scene.actionsByActor[snapshot.activeCharacter.id]??[]).some((action)=>action.id==="action.ability.str"),JSON.stringify((snapshot.scene.actionsByActor[snapshot.activeCharacter.id]??[]).map((action)=>action.id)));
  internal.session.role="host";
}

test("Host publishes an ability-check DC before commit",async()=>{
  const adapter=new MockAdapter();
  await prepareHost(adapter);
  const ready=await adapter.setQueuedD20(12);
  assert.equal(ready.scene.currentActorId,ready.activeCharacter.id,JSON.stringify({current:ready.scene.currentActorId,active:ready.activeCharacter.id,actions:ready.scene.actionsByActor[ready.activeCharacter.id]?.map((action)=>({id:action.id,available:action.available,reason:action.disabledReason}))}));
  let snapshot=await adapter.resolveAction("action.ability.str",[]);
  assert.equal(snapshot.resolution?.stage,"roll-animation");
  assert.equal(snapshot.resolution?.checkTarget,undefined);

  snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"effect-preview");
  assert.equal(snapshot.resolution?.canAdvance,false);
  assert.match(snapshot.resolution?.compact??"",/DM 공개 DC 대기/);
  assert.equal(snapshot.activity.some((entry)=>entry.id===snapshot.resolution?.id),false);

  const invalid=await adapter.applyDmAdjudication({type:"ability-check-dc",value:0,scope:"resolution"});
  assert.equal(invalid.resolution?.stage,"effect-preview");
  snapshot=await adapter.applyDmAdjudication({type:"ability-check-dc",value:15,scope:"resolution"});
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.resolution?.checkTarget,15);
  assert.equal(snapshot.resolution?.checkOutcome,"성공");
  assert.ok(snapshot.activity.some((entry)=>entry.id===snapshot.resolution?.id));
});

test("a failed open ability check offers Tactical Mind and only spends Second Wind on success",async()=>{
  const adapter=new MockAdapter();
  await prepareHost(adapter);
  const before=(await adapter.getSnapshot()).activeCharacter.resources.find((entry)=>entry.id===FIGHTER_SECOND_WIND_RESOURCE_ID)?.current;
  assert.ok(before);
  await adapter.setQueuedD20(1);
  await adapter.resolveAction("action.ability.str",[]);
  await adapter.advanceResolution();
  let snapshot=await adapter.applyDmAdjudication({type:"ability-check-dc",value:10,scope:"resolution"});
  assert.equal(snapshot.resolution?.checkOutcome,"실패");
  assert.equal(snapshot.resolution?.interrupt?.id,"follow-up.d20-modification");

  await adapter.setQueuedD20(8);
  snapshot=await adapter.respondToInterrupt(true);
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.resolution?.checkOutcome,"성공");
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===FIGHTER_SECOND_WIND_RESOURCE_ID)?.current,before-1);

  snapshot=await adapter.undoLastResolution();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===FIGHTER_SECOND_WIND_RESOURCE_ID)?.current,before);
});

test("DM browser preview simulates the DC step without changing Session authority",async()=>{
  const adapter=new MockAdapter();
  const initial=await adapter.getSnapshot();
  const character={...structuredClone(initial.activeCharacter),id:"char.preview-open-check"};
  const internal=adapter as unknown as {activeCharacter:typeof character;characters:Array<typeof character>};
  internal.activeCharacter=character;
  internal.characters=[character];
  await adapter.getSnapshot();
  setSessionDebugPreviewRole(adapter,"dm");
  try {
    await adapter.setQueuedD20(10);
    await adapter.resolveAction("action.ability.wis",[]);
    const snapshot=await adapter.advanceResolution();
    assert.equal(snapshot.session.role,"offline");
    assert.equal(snapshot.resolution?.stage,"effect-preview");
  } finally {
    setSessionDebugPreviewRole(adapter,null);
  }
});
