import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { AppSnapshot, CharacterSheet, SceneVm } from "../../src/app/contracts";
import { previewRuntimeAtomicAttackDamage } from "../../src/app/phase09RealRuntimeAttackAdapter";
import {
  CUNNING_DASH_ACTION_ID,
  CUNNING_DISENGAGE_ACTION_ID,
  CUNNING_HIDE_ACTION_ID,
  ROGUE_CLASS_ID,
  UNCANNY_DODGE_REACTION_ID,
} from "../../src/app/rogueCoreRuntimeAdapter";

async function rogue(level=5){
  const adapter=new MockAdapter();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm;role:"player"|"dm"};
  internal.activeCharacter={
    ...internal.activeCharacter,
    className:"도적",
    level,
    ac:15,
    tempHp:0,
    skills:[...internal.activeCharacter.skills.filter((entry)=>!entry.startsWith("은신")),"은신 +5"],
    classLevels:[{classId:ROGUE_CLASS_ID,className:"도적",level}],
  };
  const actor=internal.scene.entities.find((entry)=>entry.id===internal.activeCharacter.id);
  if(actor){actor.ac=15;actor.tempHp=0;}
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

test("Rogue level 2+ projects Cunning Action Dash, Disengage, and Hide as Bonus Actions",async()=>{
  const adapter=await rogue(2);
  const snapshot=await adapter.getSnapshot();
  for(const id of [CUNNING_DASH_ACTION_ID,CUNNING_DISENGAGE_ACTION_ID,CUNNING_HIDE_ACTION_ID]) {
    assert.equal(action(snapshot,id)?.economy,"추가 행동",id);
  }
  assert.equal(action(snapshot,CUNNING_HIDE_ACTION_ID)?.resolutionKind,"ability-check");
});

test("Cunning Action Dash spends only Bonus Action, applies movement, and Undo restores both",async()=>{
  const adapter=await rogue(5);
  await adapter.startInitiative();
  const before=await adapter.getSnapshot();
  const actorId=before.activeCharacter.id;
  await adapter.setCurrentActor(actorId);
  const movementBefore=before.scene.economyByActor[actorId]?.movementMax??0;
  await adapter.resolveAction(CUNNING_DASH_ACTION_ID,[actorId]);
  let snapshot=await finish(adapter);
  assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,false);
  assert.equal(snapshot.scene.economyByActor[actorId]?.action,true);
  assert.equal(snapshot.scene.economyByActor[actorId]?.movementMax,movementBefore+snapshot.activeCharacter.speed);
  assert.equal(snapshot.activity.some((entry)=>entry.title.includes("교활한 행동 · 질주")),true);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,true);
  assert.equal(snapshot.scene.economyByActor[actorId]?.movementMax,movementBefore);
});

test("Cunning Action Disengage applies the existing Disengage state and Undo restores it",async()=>{
  const adapter=await rogue(5);
  await adapter.startInitiative();
  let snapshot=await adapter.getSnapshot();
  const actorId=snapshot.activeCharacter.id;
  await adapter.setCurrentActor(actorId);
  await adapter.resolveAction(CUNNING_DISENGAGE_ACTION_ID,[actorId]);
  snapshot=await finish(adapter);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===actorId)?.status.some((status)=>status.endsWith("이탈")),true);
  assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,false);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===actorId)?.status.some((status)=>status.endsWith("이탈")),false);
  assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,true);
});

test("Rogue level 5 Uncanny Dodge spends Reaction, halves a hit, records Activity, and Undo restores HP/economy",async()=>{
  const adapter=await rogue(5);
  const internal=adapter as unknown as {role:"player"|"dm"};
  internal.role="dm";
  await adapter.startInitiative();
  let snapshot=await adapter.getSnapshot();
  const actorId=snapshot.activeCharacter.id;
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===actorId)?.reactions.some((entry)=>entry.id===UNCANNY_DODGE_REACTION_ID),true);
  const hpBefore=snapshot.scene.entities.find((entry)=>entry.id===actorId)?.hp??0;

  await adapter.resolveAction("action.scimitar",[actorId]);
  snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"interrupt");
  assert.equal(snapshot.resolution?.interrupt?.id,UNCANNY_DODGE_REACTION_ID);
  await adapter.respondToInterrupt(true);
  const preview=previewRuntimeAtomicAttackDamage(adapter);
  assert.ok(preview,"damage preview must not consume the queued Uncanny Dodge multiplier");
  snapshot=await finish(adapter);
  assert.equal(snapshot.resolution?.damageComponents[0]?.raw,5);
  assert.equal(snapshot.resolution?.damageComponents[0]?.adjusted,2);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===actorId)?.hp,hpBefore-2);
  assert.equal(snapshot.scene.economyByActor[actorId]?.reaction,false);
  assert.equal(snapshot.activity.some((entry)=>entry.detail.some((detail)=>detail.includes("기묘한 회피"))),true);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===actorId)?.hp,hpBefore);
  assert.equal(snapshot.scene.economyByActor[actorId]?.reaction,true);
});

test("Rogue below feature levels does not project Cunning Action or Uncanny Dodge",async()=>{
  const adapter=await rogue(1);
  const snapshot=await adapter.getSnapshot();
  assert.equal(action(snapshot,CUNNING_DASH_ACTION_ID),undefined);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===snapshot.activeCharacter.id)?.reactions.some((entry)=>entry.id===UNCANNY_DODGE_REACTION_ID),false);
});
