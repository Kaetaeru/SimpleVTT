import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { AppSnapshot, CharacterSheet } from "../../src/app/contracts";
import { MONK_FOCUS_RESOURCE_ID, MONK_OPEN_HAND_CLASS_ID } from "../../src/domain/monkOpenHand";

const FLURRY="action.monk.flurry-of-blows";
const PATIENT="action.monk.patient-defense";
const PATIENT_FOCUS="action.monk.patient-defense.focus";
const STEP="action.monk.step-of-the-wind";
const STEP_FOCUS="action.monk.step-of-the-wind.focus";

async function monk(focus=5){
  const adapter=new MockAdapter();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet};
  internal.activeCharacter={
    ...internal.activeCharacter,
    className:"수도승",
    level:5,
    classLevels:[{classId:MONK_OPEN_HAND_CLASS_ID,className:"수도승",level:5}],
    resources:[{id:MONK_FOCUS_RESOURCE_ID,label:"기 점수",current:focus,max:5,source:"test"}],
  };
  await adapter.getSnapshot();
  return adapter;
}

function action(snapshot:AppSnapshot,id:string){
  return snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id===id);
}

async function finish(adapter:MockAdapter){
  for(let step=0;step<8;step++){
    const snapshot=await adapter.getSnapshot();
    if(snapshot.resolution?.stage==="complete")return snapshot;
    await adapter.advanceResolution();
  }
  throw new Error("resolution did not complete");
}

test("Monk level 2+ projects Flurry, Patient Defense, and Step of the Wind from the existing Focus pool",async()=>{
  const adapter=await monk();
  const snapshot=await adapter.getSnapshot();
  for(const id of [FLURRY,PATIENT,PATIENT_FOCUS,STEP,STEP_FOCUS]) assert.ok(action(snapshot,id),id);
  assert.equal(action(snapshot,FLURRY)?.resourceCost?.resourceId,MONK_FOCUS_RESOURCE_ID);
  assert.equal(action(snapshot,PATIENT)?.resourceCost,undefined);
  assert.equal(action(snapshot,STEP)?.resourceCost,undefined);
});

test("Flurry spends one Focus plus Bonus Action and grants two Unarmed Strike attacks without spending the standard Action",async()=>{
  const adapter=await monk();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet};
  await adapter.startInitiative();
  await adapter.setCurrentActor(internal.activeCharacter.id);
  await adapter.selectDmActor(internal.activeCharacter.id);
  let snapshot=await adapter.getSnapshot();
  assert.equal(action(snapshot,FLURRY)?.available,true);
  await adapter.resolveAction(FLURRY,[snapshot.activeCharacter.id]);
  snapshot=await finish(adapter);
  const economy=snapshot.scene.economyByActor[snapshot.activeCharacter.id];
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===MONK_FOCUS_RESOURCE_ID)?.current,4);
  assert.equal(economy?.bonusAction,false);
  assert.equal(economy?.action,true);
  assert.equal(economy?.extraAttacks?.filter((entry)=>entry.source.includes("flurry-of-blows")).length,2);
  assert.equal(snapshot.activity.some((entry)=>entry.title.includes("연타")),true);
  const weapon=snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.resolutionKind==="attack"&&!entry.id.startsWith("action.unarmed-strike."));
  if(weapon)assert.equal(weapon.available,false,"weapon attacks must not consume Flurry-only Unarmed Strike grants");

  const unarmed=action(snapshot,"action.unarmed-strike.damage");
  assert.equal(unarmed?.available,true);
  const targetId=unarmed?.eligibleTargetIds[0];
  assert.ok(targetId);
  await adapter.resolveAction("action.unarmed-strike.damage",[targetId!]);
  snapshot=await finish(adapter);
  assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.action,true);
  assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.extraAttacks?.filter((entry)=>entry.source.includes("flurry-of-blows")).length,1);
});

test("focused Patient Defense reuses Disengage and Dodge state, spends Focus/Bonus Action, and Undo restores all three",async()=>{
  const adapter=await monk();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet};
  await adapter.startInitiative();
  await adapter.setCurrentActor(internal.activeCharacter.id);
  await adapter.selectDmActor(internal.activeCharacter.id);
  let snapshot=await adapter.getSnapshot();
  await adapter.resolveAction(PATIENT_FOCUS,[snapshot.activeCharacter.id]);
  snapshot=await finish(adapter);
  const actor=snapshot.scene.entities.find((entry)=>entry.id===snapshot.activeCharacter.id);
  assert.ok(actor?.status.includes("이탈"));
  assert.ok(actor?.status.includes("회피"));
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===MONK_FOCUS_RESOURCE_ID)?.current,4);
  assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction,false);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  const restored=snapshot.scene.entities.find((entry)=>entry.id===snapshot.activeCharacter.id);
  assert.equal(restored?.status.includes("이탈"),false);
  assert.equal(restored?.status.includes("회피"),false);
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===MONK_FOCUS_RESOURCE_ID)?.current,5);
  assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction,true);
});

test("focused Step of the Wind in freeform spends Focus, keeps Bonus Action economy, and reuses Dash plus Disengage semantics",async()=>{
  const adapter=await monk();
  await adapter.setSessionMode("freeform");
  let snapshot=await adapter.getSnapshot();
  const before=snapshot.scene.economyByActor[snapshot.activeCharacter.id];
  assert.ok(before);
  await adapter.resolveAction(STEP_FOCUS,[snapshot.activeCharacter.id]);
  snapshot=await finish(adapter);
  const after=snapshot.scene.economyByActor[snapshot.activeCharacter.id];
  const actor=snapshot.scene.entities.find((entry)=>entry.id===snapshot.activeCharacter.id);
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===MONK_FOCUS_RESOURCE_ID)?.current,4);
  assert.equal(after?.bonusAction,true);
  assert.equal(after?.movementMax,(before?.movementMax??0)+snapshot.activeCharacter.speed);
  assert.ok(actor?.status.includes("이탈"));
});

test("zero Focus disables only Focus-spending Monk actions",async()=>{
  const adapter=await monk(0);
  const snapshot=await adapter.getSnapshot();
  assert.equal(action(snapshot,FLURRY)?.available,false);
  assert.equal(action(snapshot,PATIENT_FOCUS)?.available,false);
  assert.equal(action(snapshot,STEP_FOCUS)?.available,false);
  assert.equal(action(snapshot,PATIENT)?.available,true);
  assert.equal(action(snapshot,STEP)?.available,true);
});
