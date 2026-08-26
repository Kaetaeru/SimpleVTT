import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { CharacterSheet, SceneVm } from "../../src/app/contracts";
import { setSpatialRelation } from "../../src/app/spatialRuntimeContracts";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";
import { createEffect } from "../../src/domain/effects";
import {
  BARBARIAN_BERSERKER_SUBCLASS_ID,
  BARBARIAN_CLASS_ID,
  BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID,
  BERSERKER_MINDLESS_RAGE_TAG,
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

test("Berserker Mindless Rage composes into production Rage and shares condition, Activity, Undo, and Rage-end lifecycle",async()=>{
  const adapter=await berserker();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  const actorId=internal.activeCharacter.id;
  internal.activeCharacter.items=[...internal.activeCharacter.items,{
    id:"test.chain-mail",definitionId:"dnd.srd521.item.armor.chain-mail",name:"사슬 갑옷",kind:"equipment",quantity:1,equipped:false,
    passiveEffects:[],grantedActionIds:[],provenance:["test"],
  }];

  let state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  assert.ok(state);
  const seeded=state!;
  seeded.effects.push(
    createEffect({id:"test:mindless:charmed",sourceId:"test:charm",targetId:actorId,kind:"condition",conditionId:"charmed",duration:{kind:"minutes",amount:1}},seeded.clock),
    createEffect({id:"test:mindless:frightened",sourceId:"test:fear",targetId:actorId,kind:"condition",conditionId:"frightened",duration:{kind:"minutes",amount:1}},seeded.clock),
  );
  const expectedRevision=seeded.revision;
  seeded.revision+=1;
  assert.equal(commitAdapterTurnRuntimeState(adapter,internal.scene,expectedRevision,seeded),true);

  let snapshot=await adapter.getSnapshot();
  await adapter.resolveAction("action.barbarian.rage",[actorId]);
  snapshot=await adapter.getSnapshot();
  state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  assert.ok(state);
  assert.equal(state!.effects.some((effect)=>effect.targetId===actorId&&(effect.conditionId==="charmed"||effect.conditionId==="frightened")),false);
  const mindless=state!.effects.find((effect)=>effect.targetId===actorId&&effect.tags.includes(BERSERKER_MINDLESS_RAGE_TAG));
  assert.ok(mindless);
  assert.equal(mindless!.tags.includes("condition-immunity:charmed"),true);
  assert.equal(mindless!.tags.includes("condition-immunity:frightened"),true);
  assert.equal(snapshot.activity.some((entry)=>entry.stateChanges.some((change)=>change.includes("mindless-rage"))),true);

  await adapter.undoLastResolution();
  state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  assert.ok(state);
  assert.equal(state!.effects.some((effect)=>effect.tags.includes(BERSERKER_MINDLESS_RAGE_TAG)),false);
  assert.equal(state!.effects.some((effect)=>effect.id==="test:mindless:charmed"),true);
  assert.equal(state!.effects.some((effect)=>effect.id==="test:mindless:frightened"),true);

  await adapter.resolveAction("action.barbarian.rage",[actorId]);
  await adapter.toggleItemEquipped("test.chain-mail");
  state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  assert.ok(state);
  assert.equal(state!.effects.some((effect)=>effect.tags.includes(BERSERKER_MINDLESS_RAGE_TAG)),false);
});
