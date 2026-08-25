import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { CharacterSheet, SceneVm } from "../../src/app/contracts";
import { BARBARIAN_CLASS_ID, BARBARIAN_RAGE_RESOURCE_ID } from "../../src/domain/barbarianBerserker";

async function barbarian(){
  const adapter=new MockAdapter();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  internal.activeCharacter={
    ...internal.activeCharacter,
    className:"바바리안",
    level:5,
    classLevels:[{classId:BARBARIAN_CLASS_ID,className:"바바리안",level:5}],
    resources:[{id:BARBARIAN_RAGE_RESOURCE_ID,label:"격노",current:3,max:3,source:"test",recovery:{shortRest:1,longRest:"all"}}],
  };
  await adapter.getSnapshot();
  return adapter;
}

async function advanceToNextTurn(adapter:MockAdapter,actorId:string){
  for(let step=0;step<12;step++){
    const snapshot=await adapter.getSnapshot();
    if((snapshot.scene.round??1)>1&&snapshot.scene.currentActorId===actorId)return snapshot;
    await adapter.endTurn();
  }
  throw new Error(`failed to reach next turn for ${actorId}`);
}

test("Rage production action spends one use and Bonus Action in initiative, projects active Rage, and Undo restores it",async()=>{
  const adapter=await barbarian();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet};
  await adapter.startInitiative();
  await adapter.setCurrentActor(internal.activeCharacter.id);
  await adapter.selectDmActor(internal.activeCharacter.id);
  let snapshot=await adapter.getSnapshot();
  const action=snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id==="action.barbarian.rage");
  assert.equal(action?.available,true);
  await adapter.resolveAction("action.barbarian.rage",[snapshot.activeCharacter.id]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===BARBARIAN_RAGE_RESOURCE_ID)?.current,2);
  assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction,false);
  assert.ok(snapshot.scene.entities.find((entry)=>entry.id===snapshot.activeCharacter.id)?.status.some((entry)=>entry.includes("격노")));
  assert.equal(snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id==="action.barbarian.rage")?.available,false);
  assert.equal(snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.some((entry)=>entry.name==="격노 종료"),false);
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===BARBARIAN_RAGE_RESOURCE_ID)?.current,3);
  assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction,true);
});

test("active Rage exposes a dedicated next-turn Bonus Action extension without spending another Rage use",async()=>{
  const adapter=await barbarian();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet};
  await adapter.startInitiative();
  await adapter.setCurrentActor(internal.activeCharacter.id);
  await adapter.selectDmActor(internal.activeCharacter.id);
  let snapshot=await adapter.getSnapshot();
  await adapter.resolveAction("action.barbarian.rage",[snapshot.activeCharacter.id]);
  snapshot=await adapter.getSnapshot();
  const alreadyExtended=snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id==="action.barbarian.rage.extend");
  assert.equal(alreadyExtended?.available,false);
  assert.match(alreadyExtended?.disabledReason??"",/이미 다음 턴 끝까지/);

  snapshot=await advanceToNextTurn(adapter,snapshot.activeCharacter.id);
  const extend=snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id==="action.barbarian.rage.extend");
  assert.equal(extend?.available,true);
  const usesBefore=snapshot.activeCharacter.resources.find((entry)=>entry.id===BARBARIAN_RAGE_RESOURCE_ID)?.current;
  await adapter.resolveAction("action.barbarian.rage.extend",[snapshot.activeCharacter.id]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===BARBARIAN_RAGE_RESOURCE_ID)?.current,usesBefore);
  assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction,false);
  assert.equal(snapshot.resolution?.actionId,"action.barbarian.rage.extend");
});

test("Rage production action is disabled while equipped Heavy armor is worn",async()=>{
  const adapter=await barbarian();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet};
  internal.activeCharacter.items=[...internal.activeCharacter.items,{
    id:"test.chain-mail",definitionId:"dnd.srd521.item.armor.chain-mail",name:"사슬 갑옷",kind:"equipment",quantity:1,equipped:true,
    passiveEffects:[],grantedActionIds:[],provenance:["test"],
  }];
  const snapshot=await adapter.getSnapshot();
  const action=snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id==="action.barbarian.rage");
  assert.equal(action?.available,false);
  assert.match(action?.disabledReason??"",/중갑/);
});

test("equipping Heavy armor while raging automatically ends Rage without a voluntary End Rage action",async()=>{
  const adapter=await barbarian();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet};
  internal.activeCharacter.items=[...internal.activeCharacter.items,{
    id:"test.chain-mail",definitionId:"dnd.srd521.item.armor.chain-mail",name:"사슬 갑옷",kind:"equipment",quantity:1,equipped:false,
    passiveEffects:[],grantedActionIds:[],provenance:["test"],
  }];
  await adapter.startInitiative();
  await adapter.setCurrentActor(internal.activeCharacter.id);
  await adapter.selectDmActor(internal.activeCharacter.id);
  let snapshot=await adapter.getSnapshot();
  await adapter.resolveAction("action.barbarian.rage",[snapshot.activeCharacter.id]);
  snapshot=await adapter.getSnapshot();
  assert.ok(snapshot.scene.entities.find((entry)=>entry.id===snapshot.activeCharacter.id)?.status.some((entry)=>entry.includes("격노")));

  await adapter.toggleItemEquipped("test.chain-mail");
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.items.find((entry)=>entry.id==="test.chain-mail")?.equipped,true);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===snapshot.activeCharacter.id)?.status.some((entry)=>entry.includes("격노")),false);
  assert.equal(snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.some((entry)=>entry.id==="action.barbarian.rage.extend"),false);
  assert.equal(snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.some((entry)=>entry.name==="격노 종료"),false);
});

test("freeform Rage spends the resource without stranding Bonus Action economy",async()=>{
  const adapter=await barbarian();
  await adapter.setSessionMode("freeform");
  let snapshot=await adapter.getSnapshot();
  await adapter.resolveAction("action.barbarian.rage",[snapshot.activeCharacter.id]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===BARBARIAN_RAGE_RESOURCE_ID)?.current,2);
  assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction,true);
  const extend=snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id==="action.barbarian.rage.extend");
  assert.equal(extend?.available,false);
  assert.match(extend?.disabledReason??"",/자신의 턴/);
});
