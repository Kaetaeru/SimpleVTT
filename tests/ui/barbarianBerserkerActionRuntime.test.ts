import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { CharacterSheet, SceneVm } from "../../src/app/contracts";
import { BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID } from "../../src/app/barbarianBerserkerActionRuntimeAdapter";
import {
  BARBARIAN_BERSERKER_SUBCLASS_ID,
  BARBARIAN_CLASS_ID,
  BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID,
} from "../../src/domain/barbarianBerserker";

async function berserker(level=14,mode:"initiative"|"freeform"="initiative") {
  const adapter=new MockAdapter();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  internal.activeCharacter={
    ...internal.activeCharacter,
    className:"바바리안",
    subclassName:"광전사의 길",
    level,
    proficiencyBonus:level>=13?5:4,
    classLevels:[{classId:BARBARIAN_CLASS_ID,className:"바바리안",level}],
    subclassIds:{...(internal.activeCharacter.subclassIds??{}),[BARBARIAN_CLASS_ID]:BARBARIAN_BERSERKER_SUBCLASS_ID},
    resources:[],
  };
  await adapter.getSnapshot();
  if(mode==="initiative"){
    await adapter.startInitiative();
    await adapter.setCurrentActor(internal.activeCharacter.id);
    await adapter.selectDmActor(internal.activeCharacter.id);
  }else{
    await adapter.setSessionMode("freeform");
  }
  return adapter;
}

function presence(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  return snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID);
}

test("Berserker level 14 projects Intimidating Presence as a 30-foot Bonus Action, but level 13 does not",async()=>{
  const level13=await berserker(13);
  assert.equal(presence(await level13.getSnapshot()),undefined);

  const level14=await berserker(14);
  const snapshot=await level14.getSnapshot();
  const action=presence(snapshot);
  assert.equal(action?.economy,"추가 행동");
  assert.equal(action?.target,"any");
  assert.equal(action?.saveAbility,"지혜");
  assert.equal(action?.saveDc,17);
  assert.ok(action?.eligibleTargetIds.includes("combatant.goblin-a"));
  assert.equal(action?.eligibleTargetIds.includes("combatant.goblin-b"),false);
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID)?.current,1);
});

test("Intimidating Presence spends Bonus Action/resource, applies Frightened, records Activity, and Undo restores",async()=>{
  const adapter=await berserker();
  let snapshot=await adapter.getSnapshot();
  const actorId=snapshot.activeCharacter.id;
  await adapter.setQueuedD20(1);
  await adapter.resolveAction(BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID,["combatant.goblin-a"]);
  snapshot=await adapter.getSnapshot();

  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,false);
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID)?.current,0);
  assert.ok(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.status.some((status)=>status.includes("공포")));
  assert.ok(snapshot.activity.some((entry)=>entry.title.includes("위압적인 존재감")));

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,true);
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID)?.current,1);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.status.some((status)=>status.includes("공포")),false);
});

test("freeform Intimidating Presence preserves turn Bonus Action while still spending its feature resource",async()=>{
  const adapter=await berserker(14,"freeform");
  let snapshot=await adapter.getSnapshot();
  const actorId=snapshot.activeCharacter.id;
  const bonusBefore=snapshot.scene.economyByActor[actorId]?.bonusAction;
  await adapter.setQueuedD20(1);
  await adapter.resolveAction(BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID,["combatant.goblin-a"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,bonusBefore);
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID)?.current,0);
  assert.ok(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.status.some((status)=>status.includes("공포")));
});
