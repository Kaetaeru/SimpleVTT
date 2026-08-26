import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { CharacterSheet, SceneVm } from "../../src/app/contracts";
import { setSpatialRelation } from "../../src/app/spatialRuntimeContracts";
import {
  BARBARIAN_BERSERKER_SUBCLASS_ID,
  BARBARIAN_CLASS_ID,
  BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID,
} from "../../src/domain/barbarianBerserker";
import { BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID } from "../../src/app/barbarianBerserkerIntimidatingPresenceRuntimeAdapter";

async function berserker(mode:"initiative"|"freeform"="initiative"){
  const adapter=new MockAdapter();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  internal.activeCharacter={
    ...internal.activeCharacter,
    className:"바바리안",
    subclassName:"광전사의 길",
    level:14,
    classLevels:[{classId:BARBARIAN_CLASS_ID,className:"바바리안",level:14}],
    subclassIds:{...(internal.activeCharacter.subclassIds??{}),[BARBARIAN_CLASS_ID]:BARBARIAN_BERSERKER_SUBCLASS_ID},
    abilities:{...internal.activeCharacter.abilities,str:18},
    resources:[],
  };
  setSpatialRelation(internal.scene,{
    sourceId:internal.activeCharacter.id,
    targetId:"combatant.goblin-b",
    distanceFeet:35,
    visible:true,
    cover:"none",
    targetCanSeeAttacker:true,
    provenance:"module:test:berserker-intimidating-presence:35ft",
  });
  await adapter.getSnapshot();
  if(mode==="initiative"){
    await adapter.startInitiative();
    await adapter.setCurrentActor(internal.activeCharacter.id);
    await adapter.selectDmActor(internal.activeCharacter.id);
  }else await adapter.setSessionMode("freeform");
  return adapter;
}

test("Berserker Intimidating Presence projects, frightens on a failed save, spends Bonus Action/resource, records Activity, and generic Undo restores",async()=>{
  const adapter=await berserker();
  let snapshot=await adapter.getSnapshot();
  const actorId=snapshot.activeCharacter.id;
  const action=snapshot.scene.actionsByActor[actorId]?.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID);
  assert.equal(action?.target,"any");
  assert.equal(action?.economy,"추가 행동");
  assert.equal(action?.eligibleTargetIds.includes(actorId),false);
  assert.equal(action?.eligibleTargetIds.includes("combatant.goblin-a"),true);
  assert.equal(action?.eligibleTargetIds.includes("combatant.goblin-b"),false);
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID)?.current,1);

  await adapter.setQueuedD20(1);
  await adapter.resolveAction(BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID,["combatant.goblin-a"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID)?.current,0);
  assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,false);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.status.some((status)=>status.includes("공포")),true);
  assert.equal(snapshot.activity.some((entry)=>entry.title.includes("위압적인 존재감")),true);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID)?.current,1);
  assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,true);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.status.some((status)=>status.includes("공포")),false);
});

test("freeform Intimidating Presence spends its feature resource without stranding Bonus Action economy",async()=>{
  const adapter=await berserker("freeform");
  let snapshot=await adapter.getSnapshot();
  const actorId=snapshot.activeCharacter.id;
  const bonusBefore=snapshot.scene.economyByActor[actorId]?.bonusAction;
  await adapter.setQueuedD20(1);
  await adapter.resolveAction(BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID,["combatant.goblin-a"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,bonusBefore);
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID)?.current,0);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.status.some((status)=>status.includes("공포")),true);
});
