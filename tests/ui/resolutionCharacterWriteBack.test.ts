import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealAtomicSavingThrowAdapter";
import "../../src/app/characterLibraryRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import {
  getCharacterLibraryPersistenceStateForTests,
  setCharacterLibraryStoreForTests,
} from "../../src/app/characterLibraryRuntimeAdapter";
import { persistCharacterResolutionEvents } from "../../src/app/resolutionCharacterWriteBackPort";
import type { ResolutionEvent } from "../../src/domain/resolutionTypes";
import type { RuntimeStateChange } from "../../src/domain/runtimeStateChange";

function adapterWithStore(store:MemoryCharacterLibraryStore) {
  const adapter=new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,store);
  return adapter;
}

async function applySecondWind(adapter:MockAdapter) {
  await adapter.resolveAction("action.second-wind",["char.aelar"]);
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  return adapter.getSnapshot();
}

async function applyPotion(adapter:MockAdapter) {
  await adapter.resolveAction("action.healing-potion",["char.aelar"]);
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  return adapter.getSnapshot();
}

async function applyWand(adapter:MockAdapter) {
  await adapter.resolveAction("action.wand",["combatant.goblin-a"]);
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  return adapter.getSnapshot();
}

const hp=(field:"current"|"temporary",before:number,after:number):RuntimeStateChange=>({
  kind:"hp",targetId:"char.aelar",field,before,after,provenance:[],lifetime:"character-durable",writeBack:"character",
});
const life=(field:"stable"|"unconscious"|"dead",before:boolean,after:boolean):RuntimeStateChange=>({
  kind:"life",targetId:"char.aelar",field,before,after,provenance:[],lifetime:"character-durable",writeBack:"character",
});
function event(...stateChanges:RuntimeStateChange[]):ResolutionEvent {
  return {
    id:"event.character-damage",resolutionId:"resolution.character-damage",operationId:"operation.character-damage",kind:"damage",
    actorId:"combatant.goblin-a",targetId:"char.aelar",summary:"Character durable damage",provenance:[],stateChanges,result:null,
  };
}

test("Second Wind persists HP/resource once, reloads, and Undo persists the inverse once", async () => {
  const store=new MemoryCharacterLibraryStore();
  const adapter=adapterWithStore(store);
  const initial=await adapter.getSnapshot();
  assert.equal(initial.activeCharacter.runtimeRevision,1);
  assert.equal(initial.persistence?.storageRevision,0);

  let snapshot=await applySecondWind(adapter);
  assert.equal(snapshot.activeCharacter.hp,42);
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id==="resource.second-wind")?.current,0);
  assert.equal(snapshot.activeCharacter.runtimeRevision,2);
  assert.equal(snapshot.persistence?.storageRevision,1);
  assert.equal(getCharacterLibraryPersistenceStateForTests(adapter)?.document?.characters.find((entry)=>entry.characterId==="char.aelar")?.runtimeRevision,2);

  const reader=adapterWithStore(store);
  const restored=await reader.getSnapshot();
  assert.equal(restored.activeCharacter.hp,42);
  assert.equal(restored.activeCharacter.resources.find((entry)=>entry.id==="resource.second-wind")?.current,0);
  assert.equal(restored.activeCharacter.runtimeRevision,2);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.hp,31);
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id==="resource.second-wind")?.current,1);
  assert.equal(snapshot.activeCharacter.runtimeRevision,3);
  assert.equal(snapshot.persistence?.storageRevision,2);

  const rereader=adapterWithStore(store);
  const restoredUndo=await rereader.getSnapshot();
  assert.equal(restoredUndo.activeCharacter.hp,31);
  assert.equal(restoredUndo.activeCharacter.resources.find((entry)=>entry.id==="resource.second-wind")?.current,1);
  assert.equal(restoredUndo.activeCharacter.runtimeRevision,3);
});

test("healing potion persists HP and quantity in one generation and Undo restores both", async () => {
  const store=new MemoryCharacterLibraryStore();
  const adapter=adapterWithStore(store);
  await adapter.getSnapshot();
  let snapshot=await applyPotion(adapter);
  assert.equal(snapshot.activeCharacter.hp,37);
  assert.equal(snapshot.activeCharacter.items.find((entry)=>entry.id==="item.potion.aelar")?.quantity,1);
  assert.equal(snapshot.activeCharacter.runtimeRevision,2);
  assert.equal(snapshot.persistence?.storageRevision,1);

  const reader=adapterWithStore(store);
  const restored=await reader.getSnapshot();
  assert.equal(restored.activeCharacter.hp,37);
  assert.equal(restored.activeCharacter.items.find((entry)=>entry.id==="item.potion.aelar")?.quantity,1);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.hp,31);
  assert.equal(snapshot.activeCharacter.items.find((entry)=>entry.id==="item.potion.aelar")?.quantity,2);
  assert.equal(snapshot.activeCharacter.runtimeRevision,3);
  assert.equal(snapshot.persistence?.storageRevision,2);
});

test("wand persists Character charge but never persists combatant HP into the Character library", async () => {
  const store=new MemoryCharacterLibraryStore();
  const adapter=adapterWithStore(store);
  await adapter.getSnapshot();
  const applied=await applyWand(adapter);
  assert.equal(applied.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.hp,3);
  assert.equal(applied.activeCharacter.items.find((entry)=>entry.id==="item.wand.aelar")?.charges?.current,6);
  assert.equal(applied.activeCharacter.runtimeRevision,2);
  assert.equal(applied.persistence?.storageRevision,1);

  const reader=adapterWithStore(store);
  const restored=await reader.getSnapshot();
  assert.equal(restored.activeCharacter.items.find((entry)=>entry.id==="item.wand.aelar")?.charges?.current,6);
  assert.equal(restored.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.hp,12,"combatant HP remains Scene/session state");
});

test("Character-target HP/life ResolutionEvents persist and inverse without serializing Scene state", async () => {
  const store=new MemoryCharacterLibraryStore();
  const adapter=adapterWithStore(store);
  await adapter.getSnapshot();
  const events=[event(
    hp("temporary",5,0),
    hp("current",31,0),
    life("unconscious",false,true),
  )];
  const forward=await persistCharacterResolutionEvents(adapter,events,"forward");
  assert.deepEqual(forward,{status:"committed",changed:true});
  assert.equal(getCharacterLibraryPersistenceStateForTests(adapter)?.document?.storageRevision,1);

  const reader=adapterWithStore(store);
  const restored=await reader.getSnapshot();
  assert.equal(restored.activeCharacter.hp,0);
  assert.equal(restored.activeCharacter.tempHp,0);
  assert.deepEqual(restored.activeCharacter.durableLifeFlags,{stable:false,unconscious:true,dead:false});
  assert.equal(restored.scene.entities.find((entry)=>entry.id==="char.aelar")?.runtimeLife?.unconscious,true);

  const inverse=await persistCharacterResolutionEvents(adapter,events,"inverse");
  assert.deepEqual(inverse,{status:"committed",changed:true});
  assert.equal(getCharacterLibraryPersistenceStateForTests(adapter)?.document?.storageRevision,2);
  const rereader=adapterWithStore(store);
  const restoredInverse=await rereader.getSnapshot();
  assert.equal(restoredInverse.activeCharacter.hp,31);
  assert.equal(restoredInverse.activeCharacter.tempHp,5);
  assert.deepEqual(restoredInverse.activeCharacter.durableLifeFlags,{stable:false,unconscious:false,dead:false});
});

test("Character storage failure rejects confirmed Second Wind before Scene/resource/history apply", async () => {
  const store=new MemoryCharacterLibraryStore();
  const adapter=adapterWithStore(store);
  await adapter.getSnapshot();
  await adapter.resolveAction("action.second-wind",["char.aelar"]);
  await adapter.advanceResolution();
  store.failNextWrite("resolution disk full");
  const failed=await adapter.advanceResolution();
  assert.equal(failed.activeCharacter.hp,31);
  assert.equal(failed.activeCharacter.resources.find((entry)=>entry.id==="resource.second-wind")?.current,1);
  assert.equal(failed.scene.entities.find((entry)=>entry.id==="char.aelar")?.hp,31);
  assert.equal(failed.scene.economyByActor["char.aelar"]?.bonusAction,true);
  assert.equal(failed.persistence?.status,"error");
  assert.match(failed.resolution?.finalOutcome ?? "",/Character write-back 실패/);
  assert.equal((await store.readGenerations()).length,0);
  assert.equal(failed.activity.some((entry)=>entry.id===failed.resolution?.id),false);
});
