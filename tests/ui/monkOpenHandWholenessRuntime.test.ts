import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { CharacterSheet, SceneVm } from "../../src/app/contracts";
import { OPEN_HAND_WHOLENESS_ACTION_ID } from "../../src/app/monkOpenHandWholenessRuntimeAdapter";
import { MONK_OPEN_HAND_CLASS_ID, OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID } from "../../src/domain/monkOpenHand";
import { MONK_OPEN_HAND_SUBCLASS_ID } from "../../src/domain/srdSubclassCatalog";

async function monk(level=6,initiative=true){
  const adapter=new MockAdapter();const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  internal.activeCharacter={...internal.activeCharacter,className:"수도승",subclassName:"열린 손의 전사",level,hp:10,maxHp:30,abilities:{...internal.activeCharacter.abilities,wis:16},classLevels:[{classId:MONK_OPEN_HAND_CLASS_ID,className:"수도승",subclassName:"열린 손의 전사",level}],subclassIds:{[MONK_OPEN_HAND_CLASS_ID]:MONK_OPEN_HAND_SUBCLASS_ID},resources:[]};
  const actor=internal.scene.entities.find((entry)=>entry.id===internal.activeCharacter.id);if(actor){actor.hp=10;actor.maxHp=30;}
  await adapter.getSnapshot();if(initiative){await adapter.startInitiative();await adapter.setCurrentActor(internal.activeCharacter.id);await adapter.selectDmActor(internal.activeCharacter.id);}else await adapter.setSessionMode("freeform");return adapter;
}

function action(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>){return snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id===OPEN_HAND_WHOLENESS_ACTION_ID);}

test("Open Hand Monk level 6 projects Wholeness of Body with its long-rest resource",async()=>{
  const adapter=await monk();const snapshot=await adapter.getSnapshot();const projected=action(snapshot);assert.ok(projected);assert.equal(projected.economy,"추가 행동");assert.equal(projected.resolutionKind,"healing");const resource=snapshot.activeCharacter.resources.find((entry)=>entry.id===OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID);assert.equal(resource?.max,3);assert.equal(resource?.current,3);assert.equal(resource?.recovery?.longRest,"all");
});

test("Wholeness of Body heals, spends Bonus Action/resource, records Activity, and Undo restores exact state",async()=>{
  const adapter=await monk();let snapshot=await adapter.getSnapshot();const actorId=snapshot.activeCharacter.id;const hpBefore=snapshot.scene.entities.find((entry)=>entry.id===actorId)?.hp??0;const usesBefore=snapshot.activeCharacter.resources.find((entry)=>entry.id===OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID)?.current??0;
  await adapter.resolveAction(OPEN_HAND_WHOLENESS_ACTION_ID,[actorId]);snapshot=await adapter.getSnapshot();assert.ok((snapshot.scene.entities.find((entry)=>entry.id===actorId)?.hp??0)>hpBefore);assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID)?.current,usesBefore-1);assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,false);assert.equal(snapshot.activity.some((entry)=>entry.title.includes("신체 완성")),true);
  await adapter.undoLastResolution();snapshot=await adapter.getSnapshot();assert.equal(snapshot.scene.entities.find((entry)=>entry.id===actorId)?.hp,hpBefore);assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID)?.current,usesBefore);assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,true);
});

test("Wholeness of Body works in freeform without stranding Bonus Action economy",async()=>{
  const adapter=await monk(6,false);let snapshot=await adapter.getSnapshot();const actorId=snapshot.activeCharacter.id;const hpBefore=snapshot.scene.entities.find((entry)=>entry.id===actorId)?.hp??0;const usesBefore=snapshot.activeCharacter.resources.find((entry)=>entry.id===OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID)?.current??0;const bonusBefore=snapshot.scene.economyByActor[actorId]?.bonusAction;
  await adapter.resolveAction(OPEN_HAND_WHOLENESS_ACTION_ID,[actorId]);snapshot=await adapter.getSnapshot();assert.ok((snapshot.scene.entities.find((entry)=>entry.id===actorId)?.hp??0)>hpBefore);assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID)?.current,usesBefore-1);assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,bonusBefore);assert.equal(snapshot.activity.some((entry)=>entry.title.includes("신체 완성")),true);
  await adapter.undoLastResolution();snapshot=await adapter.getSnapshot();assert.equal(snapshot.scene.entities.find((entry)=>entry.id===actorId)?.hp,hpBefore);assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID)?.current,usesBefore);assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,bonusBefore);
});

test("Monk below level 6 does not project Wholeness of Body",async()=>{const adapter=await monk(5);const snapshot=await adapter.getSnapshot();assert.equal(action(snapshot),undefined);});
