import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { AppSnapshot, CharacterSheet, SceneVm } from "../../src/app/contracts";
import { OPEN_HAND_QUIVERING_PALM_DETONATE_ACTION_ID } from "../../src/app/monkOpenHandQuiveringPalmRuntimeAdapter";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";
import { MONK_FOCUS_RESOURCE_ID, MONK_OPEN_HAND_CLASS_ID, OPEN_HAND_QUIVERING_PALM_TAG } from "../../src/domain/monkOpenHand";
import { MONK_OPEN_HAND_SUBCLASS_ID } from "../../src/domain/srdSubclassCatalog";

const UNARMED_DAMAGE_ACTION_ID="action.unarmed-strike.damage";
const TARGET_A="combatant.goblin-a";
const TARGET_B="combatant.goblin-b";

async function monk(level=17,initiative=false){
  const adapter=new MockAdapter();const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  internal.activeCharacter={...internal.activeCharacter,className:"수도승",subclassName:"열린 손의 전사",level,proficiencyBonus:6,tempHp:0,abilities:{...internal.activeCharacter.abilities,str:18,wis:18},classLevels:[{classId:MONK_OPEN_HAND_CLASS_ID,className:"수도승",subclassName:"열린 손의 전사",level}],subclassIds:{[MONK_OPEN_HAND_CLASS_ID]:MONK_OPEN_HAND_SUBCLASS_ID},resources:[{id:MONK_FOCUS_RESOURCE_ID,label:"기 점수",current:level,max:level,source:`수도승 ${level}레벨`,recovery:{shortRest:"all",longRest:"all"}}]};
  const actor=internal.scene.entities.find((entry)=>entry.id===internal.activeCharacter.id);if(actor){actor.tempHp=0;actor.ac=15;}
  for(const id of [TARGET_A,TARGET_B]){const target=internal.scene.entities.find((entry)=>entry.id===id);if(target){target.hp=200;target.maxHp=200;target.tempHp=0;target.ac=1;target.distance="5피트";}}
  await adapter.getSnapshot();
  if(initiative){await adapter.startInitiative();await adapter.setCurrentActor(internal.activeCharacter.id);await adapter.selectDmActor(internal.activeCharacter.id);}
  return adapter;
}
function action(snapshot:AppSnapshot,id:string){return snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id===id);}
function focus(snapshot:AppSnapshot){return snapshot.activeCharacter.resources.find((entry)=>entry.id===MONK_FOCUS_RESOURCE_ID)?.current??0;}
function markerTargets(adapter:MockAdapter,actorId:string){const scene=(adapter as unknown as {scene:SceneVm}).scene;return snapshotAdapterTurnRuntimeState(adapter,scene)?.effects.filter((effect)=>effect.sourceActorId===actorId&&effect.tags.includes(OPEN_HAND_QUIVERING_PALM_TAG)).map((effect)=>effect.targetId)??[];}
function hp(snapshot:AppSnapshot,targetId:string){return snapshot.scene.entities.find((entry)=>entry.id===targetId)?.hp??0;}
async function resolveUntilInterruptOrComplete(adapter:MockAdapter){for(let step=0;step<10;step++){const snapshot=await adapter.getSnapshot();if(snapshot.resolution?.stage==="interrupt"||snapshot.resolution?.stage==="complete")return snapshot;await adapter.advanceResolution();}throw new Error("resolution did not settle");}
async function hitAndSeed(adapter:MockAdapter,targetId:string){await adapter.resolveAction(UNARMED_DAMAGE_ACTION_ID,[targetId]);let snapshot=await resolveUntilInterruptOrComplete(adapter);assert.equal(snapshot.resolution?.stage,"interrupt");assert.equal(snapshot.resolution?.interrupt?.optionName,"진동장 주입");await adapter.respondToInterrupt(true);snapshot=await adapter.getSnapshot();assert.equal(snapshot.resolution?.stage,"complete");return snapshot;}
async function nextMonkTurn(adapter:MockAdapter,actorId:string){for(let step=0;step<12;step++){const snapshot=await adapter.endTurn();if(snapshot.scene.currentActorId===actorId)return snapshot;}throw new Error("Monk turn did not return");}

test("Open Hand Monk 17+ can seed Quivering Palm after an Unarmed Strike hit and Undo restores the hit follow-up",async()=>{
  const adapter=await monk();let snapshot=await adapter.getSnapshot();const actorId=snapshot.activeCharacter.id,focusBefore=focus(snapshot),hpBefore=hp(snapshot,TARGET_A);
  snapshot=await hitAndSeed(adapter,TARGET_A);assert.equal(focus(snapshot),focusBefore-4);assert.deepEqual(markerTargets(adapter,actorId),[TARGET_A]);assert.deepEqual(action(snapshot,OPEN_HAND_QUIVERING_PALM_DETONATE_ACTION_ID)?.eligibleTargetIds,[TARGET_A]);assert.equal(snapshot.activity.some((entry)=>entry.detail.some((detail)=>detail.includes("진동장 주입"))),true);
  await adapter.undoLastResolution();snapshot=await adapter.getSnapshot();assert.equal(focus(snapshot),focusBefore);assert.deepEqual(markerTargets(adapter,actorId),[]);assert.equal(hp(snapshot,TARGET_A),hpBefore);
});

test("Quivering Palm seed replaces the Monk's prior marked target",async()=>{
  const adapter=await monk();let snapshot=await hitAndSeed(adapter,TARGET_A);const actorId=snapshot.activeCharacter.id;assert.deepEqual(markerTargets(adapter,actorId),[TARGET_A]);snapshot=await hitAndSeed(adapter,TARGET_B);assert.deepEqual(markerTargets(adapter,actorId),[TARGET_B]);assert.deepEqual(action(snapshot,OPEN_HAND_QUIVERING_PALM_DETONATE_ACTION_ID)?.eligibleTargetIds,[TARGET_B]);
});

test("freeform Quivering Palm detonation uses the target Constitution save, deals 10d12 force damage, and Undo restores the marker",async()=>{
  const adapter=await monk();let snapshot=await hitAndSeed(adapter,TARGET_A);const actorId=snapshot.activeCharacter.id,hpBefore=hp(snapshot,TARGET_A);assert.equal(snapshot.scene.economyByActor[actorId],undefined);
  await adapter.resolveAction(OPEN_HAND_QUIVERING_PALM_DETONATE_ACTION_ID,[TARGET_A]);snapshot=await adapter.getSnapshot();const component=snapshot.resolution?.damageComponents[0],save=snapshot.resolution?.saveResults[0];assert.equal(snapshot.resolution?.actionId,OPEN_HAND_QUIVERING_PALM_DETONATE_ACTION_ID);assert.equal(snapshot.resolution?.stage,"complete");assert.equal(component?.roll,"10d12");assert.equal(component?.raw,(snapshot.resolution?.authoritativeDice.slice(1)??[]).reduce((sum,face)=>sum+face,0));assert.equal(component?.adjusted,save?.outcome==="성공"?Math.floor((component?.raw??0)/2):component?.raw);assert.equal(hp(snapshot,TARGET_A),hpBefore-(component?.adjusted??0));assert.deepEqual(markerTargets(adapter,actorId),[]);assert.equal(snapshot.scene.economyByActor[actorId],undefined);
  await adapter.undoLastResolution();snapshot=await adapter.getSnapshot();assert.equal(hp(snapshot,TARGET_A),hpBefore);assert.deepEqual(markerTargets(adapter,actorId),[TARGET_A]);assert.equal(snapshot.scene.economyByActor[actorId],undefined);
});

test("initiative Quivering Palm detonation spends Action and Undo restores Action, HP, and the marker",async()=>{
  const adapter=await monk(17,true);let snapshot=await hitAndSeed(adapter,TARGET_A);const actorId=snapshot.activeCharacter.id;assert.equal(snapshot.scene.economyByActor[actorId]?.action,false);snapshot=await nextMonkTurn(adapter,actorId);assert.equal(snapshot.scene.economyByActor[actorId]?.action,true);assert.equal(action(snapshot,OPEN_HAND_QUIVERING_PALM_DETONATE_ACTION_ID)?.available,true);const hpBefore=hp(snapshot,TARGET_A);
  await adapter.resolveAction(OPEN_HAND_QUIVERING_PALM_DETONATE_ACTION_ID,[TARGET_A]);snapshot=await adapter.getSnapshot();assert.equal(snapshot.scene.economyByActor[actorId]?.action,false);assert.deepEqual(markerTargets(adapter,actorId),[]);assert.ok(hp(snapshot,TARGET_A)<hpBefore);
  await adapter.undoLastResolution();snapshot=await adapter.getSnapshot();assert.equal(snapshot.scene.economyByActor[actorId]?.action,true);assert.equal(hp(snapshot,TARGET_A),hpBefore);assert.deepEqual(markerTargets(adapter,actorId),[TARGET_A]);
});

test("Open Hand Monk below level 17 never receives the Quivering Palm seed follow-up",async()=>{
  const adapter=await monk(16);await adapter.resolveAction(UNARMED_DAMAGE_ACTION_ID,[TARGET_A]);const snapshot=await resolveUntilInterruptOrComplete(adapter);assert.equal(snapshot.resolution?.stage,"complete");assert.equal(snapshot.resolution?.interrupt,undefined);assert.equal(action(snapshot,OPEN_HAND_QUIVERING_PALM_DETONATE_ACTION_ID),undefined);
});
