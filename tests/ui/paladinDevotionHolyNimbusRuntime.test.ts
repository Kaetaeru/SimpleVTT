import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { CharacterSheet, SceneVm } from "../../src/app/contracts";
import { DEVOTION_HOLY_NIMBUS_ACTION_ID } from "../../src/app/paladinDevotionHolyNimbusRuntimeAdapter";
import { PALADIN_ID } from "../../src/domain/coreClassResources";
import { DEVOTION_HOLY_NIMBUS_RESOURCE_ID } from "../../src/domain/paladinDevotion";
import { PALADIN_DEVOTION_SUBCLASS_ID } from "../../src/domain/srdSubclassCatalog";

async function devotionPaladin(level=20){
  const adapter=new MockAdapter();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  internal.activeCharacter={
    ...internal.activeCharacter,
    className:"팔라딘",
    subclassName:"헌신의 맹세",
    level,
    classLevels:[{classId:PALADIN_ID,className:"팔라딘",level}],
    subclassIds:{...(internal.activeCharacter.subclassIds??{}),[PALADIN_ID]:PALADIN_DEVOTION_SUBCLASS_ID},
    abilities:{...internal.activeCharacter.abilities,cha:18},
    resources:[],
  };
  await adapter.getSnapshot();
  if(level>=20){
    await adapter.startInitiative();
    await adapter.setCurrentActor(internal.activeCharacter.id);
    await adapter.selectDmActor(internal.activeCharacter.id);
  }
  return adapter;
}

test("Devotion Holy Nimbus projects as a Bonus Action, spends its resource/economy, records Activity, and generic Undo restores",async()=>{
  const adapter=await devotionPaladin();
  let snapshot=await adapter.getSnapshot();
  const actorId=snapshot.activeCharacter.id;
  const action=snapshot.scene.actionsByActor[actorId]?.find((entry)=>entry.id===DEVOTION_HOLY_NIMBUS_ACTION_ID);
  assert.equal(action?.target,"self");
  assert.equal(action?.economy,"추가 행동");
  assert.deepEqual(action?.eligibleTargetIds,[actorId]);
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===DEVOTION_HOLY_NIMBUS_RESOURCE_ID)?.current,1);

  await adapter.resolveAction(DEVOTION_HOLY_NIMBUS_ACTION_ID,[actorId]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===DEVOTION_HOLY_NIMBUS_RESOURCE_ID)?.current,0);
  assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,false);
  assert.equal(snapshot.activity.some((entry)=>entry.title.includes("성스러운 후광")),true);
  assert.equal(snapshot.resolution?.finalOutcome,"성스러운 후광 활성화 · 10분");

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===DEVOTION_HOLY_NIMBUS_RESOURCE_ID)?.current,1);
  assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,true);
});

test("Devotion Holy Nimbus stays absent before Paladin level 20",async()=>{
  const adapter=await devotionPaladin(19);
  const snapshot=await adapter.getSnapshot();
  const actorId=snapshot.activeCharacter.id;
  assert.equal(snapshot.scene.actionsByActor[actorId]?.some((entry)=>entry.id===DEVOTION_HOLY_NIMBUS_ACTION_ID),false);
  assert.equal(snapshot.activeCharacter.resources.some((entry)=>entry.id===DEVOTION_HOLY_NIMBUS_RESOURCE_ID),false);
});
