import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { AppSnapshot, CharacterSheet, SceneVm } from "../../src/app/contracts";
import { OPEN_HAND_WHOLENESS_ACTION_ID } from "../../src/app/monkOpenHandWholenessRuntimeAdapter";
import { OPEN_HAND_FLEET_STEP_ACTION_ID, OPEN_HAND_FLEET_STEP_FOCUS_ACTION_ID } from "../../src/app/monkOpenHandFleetStepRuntimeAdapter";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";
import { MONK_FOCUS_RESOURCE_ID, MONK_OPEN_HAND_CLASS_ID, OPEN_HAND_FLEET_STEP_JUMP_TAG } from "../../src/domain/monkOpenHand";
import { MONK_OPEN_HAND_SUBCLASS_ID } from "../../src/domain/srdSubclassCatalog";

async function monk(level=11){
  const adapter=new MockAdapter();const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  internal.activeCharacter={...internal.activeCharacter,className:"수도승",subclassName:"열린 손의 전사",level,hp:10,maxHp:30,abilities:{...internal.activeCharacter.abilities,wis:16},classLevels:[{classId:MONK_OPEN_HAND_CLASS_ID,className:"수도승",subclassName:"열린 손의 전사",level}],subclassIds:{[MONK_OPEN_HAND_CLASS_ID]:MONK_OPEN_HAND_SUBCLASS_ID},resources:[{id:MONK_FOCUS_RESOURCE_ID,label:"기 점수",current:level,max:level,source:`수도승 ${level}레벨`,recovery:{shortRest:"all",longRest:"all"}}]};
  const actor=internal.scene.entities.find((entry)=>entry.id===internal.activeCharacter.id);if(actor){actor.hp=10;actor.maxHp=30;}
  await adapter.getSnapshot();await adapter.startInitiative();await adapter.setCurrentActor(internal.activeCharacter.id);await adapter.selectDmActor(internal.activeCharacter.id);return adapter;
}

function action(snapshot:AppSnapshot,id:string){return snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id===id);}
function focus(snapshot:AppSnapshot){return snapshot.activeCharacter.resources.find((entry)=>entry.id===MONK_FOCUS_RESOURCE_ID)?.current??0;}
function hasJumpEffect(adapter:MockAdapter,actorId:string){const scene=(adapter as unknown as {scene:SceneVm}).scene;return snapshotAdapterTurnRuntimeState(adapter,scene)?.effects.some((effect)=>effect.sourceActorId===actorId&&effect.tags.includes(OPEN_HAND_FLEET_STEP_JUMP_TAG))??false;}

async function triggerWithWholeness(adapter:MockAdapter){let snapshot=await adapter.getSnapshot();const actorId=snapshot.activeCharacter.id;assert.equal(action(snapshot,OPEN_HAND_FLEET_STEP_ACTION_ID),undefined);await adapter.resolveAction(OPEN_HAND_WHOLENESS_ACTION_ID,[actorId]);snapshot=await adapter.getSnapshot();return snapshot;}

test("Open Hand Monk level 11 exposes Fleet Step only immediately after an authoritative non-Step Bonus Action",async()=>{
  const adapter=await monk();const snapshot=await triggerWithWholeness(adapter);assert.equal(action(snapshot,OPEN_HAND_FLEET_STEP_ACTION_ID)?.economy,"없음");assert.equal(action(snapshot,OPEN_HAND_FLEET_STEP_FOCUS_ACTION_ID)?.economy,"없음");assert.equal(action(snapshot,OPEN_HAND_FLEET_STEP_FOCUS_ACTION_ID)?.available,true);
});

test("Fleet Step grants its immediate movement without spending another Bonus Action or Focus",async()=>{
  const adapter=await monk();let snapshot=await triggerWithWholeness(adapter);const actorId=snapshot.activeCharacter.id;const focusBefore=focus(snapshot);assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,false);
  await adapter.resolveAction(OPEN_HAND_FLEET_STEP_ACTION_ID,[actorId]);snapshot=await adapter.getSnapshot();assert.equal(snapshot.resolution?.actionId,OPEN_HAND_FLEET_STEP_ACTION_ID);assert.equal(snapshot.resolution?.stage,"complete");assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,false);assert.equal(focus(snapshot),focusBefore);assert.equal(snapshot.activity.some((entry)=>entry.title.includes("날랜 발걸음")),true);assert.equal(action(snapshot,OPEN_HAND_FLEET_STEP_ACTION_ID),undefined);
});

test("Focused Fleet Step spends one Focus, applies its jump effect, and Undo restores exactly that follow-up",async()=>{
  const adapter=await monk();let snapshot=await triggerWithWholeness(adapter);const actorId=snapshot.activeCharacter.id;const focusBefore=focus(snapshot);
  await adapter.resolveAction(OPEN_HAND_FLEET_STEP_FOCUS_ACTION_ID,[actorId]);snapshot=await adapter.getSnapshot();assert.equal(focus(snapshot),focusBefore-1);assert.equal(hasJumpEffect(adapter,actorId),true);assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,false);assert.equal(snapshot.activity.some((entry)=>entry.title.includes("날랜 발걸음")),true);
  await adapter.undoLastResolution();snapshot=await adapter.getSnapshot();assert.equal(focus(snapshot),focusBefore);assert.equal(hasJumpEffect(adapter,actorId),false);assert.equal(snapshot.scene.economyByActor[actorId]?.bonusAction,false);
});

test("Open Hand Monk below level 11 never exposes Fleet Step",async()=>{const adapter=await monk(10);const snapshot=await triggerWithWholeness(adapter);assert.equal(action(snapshot,OPEN_HAND_FLEET_STEP_ACTION_ID),undefined);assert.equal(action(snapshot,OPEN_HAND_FLEET_STEP_FOCUS_ACTION_ID),undefined);});
