import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { CharacterSheet, CombatantDefinitionVm, SceneVm, SessionMode } from "../../src/app/contracts";
import {
  BARBARIAN_BERSERKER_SUBCLASS_ID,
  BARBARIAN_CLASS_ID,
  BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID,
} from "../../src/domain/barbarianBerserker";
import { BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID } from "../../src/app/berserkerIntimidatingPresenceActionRuntimeAdapter";

const TARGET_ID="combatant.intimidated.instance-1";

async function berserker(mode:SessionMode){
  const adapter=new MockAdapter();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm;combatantDefinitions:CombatantDefinitionVm[]};
  internal.activeCharacter={
    ...internal.activeCharacter,
    className:"바바리안",
    subclassName:"광전사",
    level:14,
    proficiencyBonus:5,
    classLevels:[{classId:BARBARIAN_CLASS_ID,className:"바바리안",level:14}],
    subclassIds:{[BARBARIAN_CLASS_ID]:BARBARIAN_BERSERKER_SUBCLASS_ID},
    abilities:{...internal.activeCharacter.abilities,str:18},
    resources:[
      ...internal.activeCharacter.resources.filter((entry)=>entry.id!==BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID),
      {id:BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID,label:"위압적인 존재감",current:1,max:1,source:"Path of the Berserker 14 · SRD 5.2.1"},
    ],
  };
  internal.combatantDefinitions.push({
    id:"combatant.intimidated",
    name:"훈련 표적",
    ac:12,
    maxHp:20,
    source:"test",
    version:"1",
    actions:[],
    statusImmunities:[],
    runtimeStats:{
      creatureType:"humanoid",
      abilities:{str:10,dex:10,con:10,int:10,wis:8,cha:10},
      proficiencyBonus:2,
      savingThrowProficiencies:[],
      speed:30,
      resistances:[],
      immunities:[],
      vulnerabilities:[],
    },
  });
  internal.scene.entities.push({
    id:TARGET_ID,
    name:"훈련 표적",
    side:"enemy",
    kind:"combatant",
    hp:20,
    maxHp:20,
    tempHp:0,
    ac:12,
    initiative:8,
    status:[],
    distance:"20피트",
    resistances:[],
    immunities:[],
    vulnerabilities:[],
    reactions:[],
  });
  internal.scene.actionsByActor[TARGET_ID]=[];
  internal.scene.economyByActor[TARGET_ID]={action:true,bonusAction:true,reaction:true,movement:30,movementMax:30};
  await adapter.getSnapshot();
  if(mode==="freeform")await adapter.setSessionMode("freeform");
  else {
    await adapter.startInitiative();
    await adapter.setCurrentActor(internal.activeCharacter.id);
    await adapter.selectDmActor(internal.activeCharacter.id);
  }
  return adapter;
}

async function exercise(mode:SessionMode){
  const adapter=await berserker(mode);
  let snapshot=await adapter.getSnapshot();
  const actorId=snapshot.activeCharacter.id;
  const action=snapshot.scene.actionsByActor[actorId]?.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID);
  assert.equal(action?.economy,"추가 행동");
  assert.equal(action?.target,"any");
  assert.equal(action?.eligibleTargetIds.includes(actorId),false);
  assert.equal(action?.eligibleTargetIds.includes(TARGET_ID),true);

  await adapter.setQueuedD20(1);
  await adapter.resolveAction(BERSERKER_INTIMIDATING_PRESENCE_ACTION_ID,[TARGET_ID]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID)?.current,0);
  assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,false);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===TARGET_ID)?.status.some((entry)=>entry.includes("공포")),true);
  assert.equal(snapshot.activity.some((entry)=>entry.title.includes("위압적인 존재감")),true);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID)?.current,1);
  assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,true);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===TARGET_ID)?.status.some((entry)=>entry.includes("공포")),false);
}

test("Berserker Intimidating Presence is a mechanics-complete local action in freeform and initiative",async()=>{
  await exercise("freeform");
  await exercise("initiative");
});
