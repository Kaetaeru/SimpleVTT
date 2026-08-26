import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { CharacterSheet } from "../../src/app/contracts";
import { DRUID_ID, DRUID_WILD_SHAPE_RESOURCE_ID } from "../../src/domain/coreClassResources";
import type { DruidWildShapeForm } from "../../src/domain/druidWildShape";

const wolf:DruidWildShapeForm={
  id:"dnd.srd521.beast.wolf",
  name:"늑대",
  challengeRating:0.25,
  hasFlySpeed:false,
  armorClass:12,
  speedFeet:40,
};

async function druid(options:{knownForms?:DruidWildShapeForm[];tempHp?:number}={}) {
  const adapter=new MockAdapter();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:{entities:Array<{id:string;tempHp:number}>}};
  internal.activeCharacter={
    ...internal.activeCharacter,
    className:"드루이드",
    level:5,
    classLevels:[{classId:DRUID_ID,className:"드루이드",level:5}],
    tempHp:options.tempHp??0,
    resources:[{
      id:DRUID_WILD_SHAPE_RESOURCE_ID,
      label:"야생 변신",
      current:2,
      max:2,
      source:"test",
      recovery:{shortRest:1,longRest:"all"},
    }],
    wildShapeKnownForms:options.knownForms??[],
  };
  const entity=internal.scene.entities.find((entry)=>entry.id===internal.activeCharacter.id);
  if(entity)entity.tempHp=internal.activeCharacter.tempHp;
  await adapter.getSnapshot();
  return adapter;
}

function wildShapeActions(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  return snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.filter((entry)=>entry.id.startsWith("action.druid.wild-shape."))??[];
}

test("Wild Shape production does not invent forms when Character has no known-form facts",async()=>{
  const adapter=await druid();
  const snapshot=await adapter.getSnapshot();
  assert.equal(wildShapeActions(snapshot).length,0);
});

test("known Wild Shape form spends one use and Bonus Action, projects temp HP/status, and Undo restores all event-native state",async()=>{
  const adapter=await druid({knownForms:[wolf]});
  const internal=adapter as unknown as {activeCharacter:CharacterSheet};
  await adapter.startInitiative();
  await adapter.setCurrentActor(internal.activeCharacter.id);
  await adapter.selectDmActor(internal.activeCharacter.id);
  let snapshot=await adapter.getSnapshot();
  const action=wildShapeActions(snapshot).find((entry)=>entry.name==="야생 변신 · 늑대");
  assert.equal(action?.available,true);
  await adapter.resolveAction(action!.id,[snapshot.activeCharacter.id]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===DRUID_WILD_SHAPE_RESOURCE_ID)?.current,1);
  assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction,false);
  assert.equal(snapshot.activeCharacter.tempHp,5);
  assert.ok(snapshot.scene.entities.find((entry)=>entry.id===snapshot.activeCharacter.id)?.status.some((entry)=>entry.includes("야생 변신")&&entry.includes("늑대")));
  assert.ok(wildShapeActions(snapshot).some((entry)=>entry.id==="action.druid.wild-shape.end"));

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===DRUID_WILD_SHAPE_RESOURCE_ID)?.current,2);
  assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction,true);
  assert.equal(snapshot.activeCharacter.tempHp,0);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===snapshot.activeCharacter.id)?.status.some((entry)=>entry.includes("야생 변신")),false);
});

test("existing temporary HP preserves the explicit keep-or-take choice instead of silently choosing",async()=>{
  const adapter=await druid({knownForms:[wolf],tempHp:8});
  let snapshot=await adapter.getSnapshot();
  const choices=wildShapeActions(snapshot).filter((entry)=>entry.name.startsWith("야생 변신 · 늑대"));
  assert.equal(choices.length,2);
  assert.ok(choices.some((entry)=>entry.name.includes("기존 임시 HP 유지")));
  assert.ok(choices.some((entry)=>entry.name.includes("새 임시 HP 사용")));
  const keep=choices.find((entry)=>entry.name.includes("기존 임시 HP 유지"));
  await adapter.resolveAction(keep!.id,[snapshot.activeCharacter.id]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.tempHp,8);
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===DRUID_WILD_SHAPE_RESOURCE_ID)?.current,1);
});

test("freeform Wild Shape start and voluntary exit do not strand initiative Bonus Action economy",async()=>{
  const adapter=await druid({knownForms:[wolf]});
  await adapter.setSessionMode("freeform");
  let snapshot=await adapter.getSnapshot();
  const start=wildShapeActions(snapshot).find((entry)=>entry.name==="야생 변신 · 늑대");
  await adapter.resolveAction(start!.id,[snapshot.activeCharacter.id]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction,true);
  const end=wildShapeActions(snapshot).find((entry)=>entry.id==="action.druid.wild-shape.end");
  assert.equal(end?.available,true);
  await adapter.resolveAction(end!.id,[snapshot.activeCharacter.id]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction,true);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===snapshot.activeCharacter.id)?.status.some((entry)=>entry.includes("야생 변신")),false);
});
