import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { AppSnapshot, CharacterSheet } from "../../src/app/contracts";
import { BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID } from "../../src/app/berserkerIntimidatingPresenceRuntimeAdapter";
import {
  BARBARIAN_BERSERKER_SUBCLASS_ID,
  BARBARIAN_CLASS_ID,
  BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID,
} from "../../src/domain/barbarianBerserker";

async function berserker(){
  const adapter=new MockAdapter();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet};
  internal.activeCharacter={
    ...internal.activeCharacter,
    className:"바바리안",
    subclassName:"광전사의 길",
    level:14,
    proficiencyBonus:5,
    abilities:{...internal.activeCharacter.abilities,str:18},
    classLevels:[{classId:BARBARIAN_CLASS_ID,className:"바바리안",level:14,subclassName:"광전사의 길"}],
    subclassIds:{...(internal.activeCharacter.subclassIds??{}),[BARBARIAN_CLASS_ID]:BARBARIAN_BERSERKER_SUBCLASS_ID},
    resources:[],
  };
  await adapter.getSnapshot();
  await adapter.startInitiative();
  await adapter.setCurrentActor(internal.activeCharacter.id);
  await adapter.selectDmActor(internal.activeCharacter.id);
  return adapter;
}

function action(snapshot:AppSnapshot){
  return snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID);
}

test("Berserker Intimidating Presence projects and resolves resource, Bonus Action, Frightened, Activity, and Undo",async()=>{
  const adapter=await berserker();
  let snapshot=await adapter.getSnapshot();
  const projected=action(snapshot);
  assert.equal(projected?.target,"any");
  assert.equal(projected?.economy,"추가 행동");
  assert.equal(projected?.saveDc,17);
  assert.equal(projected?.eligibleTargetIds.includes(snapshot.activeCharacter.id),false);
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID)?.current,1);

  await adapter.setQueuedD20(1);
  await adapter.resolveAction(BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID,["combatant.goblin-a"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID)?.current,0);
  assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction,false);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.status.some((entry)=>entry.includes("공포")),true);
  assert.equal(snapshot.activity.some((entry)=>entry.title.includes("위압적인 존재감")),true);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID)?.current,1);
  assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction,true);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.status.some((entry)=>entry.includes("공포")),false);
});
