import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { CharacterLibraryRepository } from "../../src/app/characterLibraryPersistence";
import { setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import type { CharacterSheet, ItemInstanceVm } from "../../src/app/contracts";

const CHARACTER_ID="char.phase14-inventory-fighter";
const POTION_ID="item.phase14-inventory-fighter.healing-potion";

function persistedInventoryCharacter():CharacterSheet {
  const potion:ItemInstanceVm={
    id:POTION_ID,
    definitionId:"item.potion-of-healing",
    name:"치유 물약",
    nameEn:"Potion of Healing",
    kind:"consumable",
    quantity:2,
    equipped:false,
    passiveEffects:[],
    grantedActionIds:["action.healing-potion"],
    provenance:["SRD 5.2.1 · 소모품","Phase 14 persisted non-fixture ItemInstance"],
  };
  return {
    id:CHARACTER_ID,
    name:"Phase14 Inventory Fighter",
    className:"파이터",
    level:1,
    species:"드워프",
    background:"범죄자",
    hp:4,
    maxHp:12,
    tempHp:0,
    ac:16,
    speed:25,
    proficiencyBonus:2,
    saveState:"saved",
    abilities:{str:16,dex:13,con:15,int:10,wis:12,cha:8},
    saves:["STR +5","CON +4"],
    skills:["운동","지각"],
    features:["전투 방식"],
    equipment:["치유 물약 ×2"],
    items:[potion],
    resources:[],
    attacks:[],
  };
}

async function seedPersistedCharacter(store:MemoryCharacterLibraryStore) {
  const sheet=persistedInventoryCharacter();
  const repository=new CharacterLibraryRepository(store);
  await repository.hydrate([sheet],sheet.id);
  const committed=await repository.commit([sheet],sheet.id);
  assert.equal(committed.document.storageRevision,1);
  return sheet;
}

function potionQuantity(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  return snapshot.activeCharacter.items.find((item)=>item.id===POTION_ID)?.quantity;
}

test("persisted non-fixture Character uses its exact healing-potion ItemInstance atomically and rehydrates durable HP/quantity",async()=>{
  const store=new MemoryCharacterLibraryStore();
  await seedPersistedCharacter(store);

  const player=new MockAdapter();
  setCharacterLibraryStoreForTests(player,store);
  const hydrated=await player.getSnapshot();
  assert.equal(hydrated.activeCharacter.id,CHARACTER_ID);
  assert.equal(hydrated.activeCharacter.hp,4);
  assert.equal(potionQuantity(hydrated),2);
  assert.equal(hydrated.persistence?.storageRevision,1);

  await player.startProductionLocalPlay("player");
  const freeform=await player.setSessionMode("freeform");
  assert.equal(freeform.activeCharacter.id,CHARACTER_ID);
  assert.equal(freeform.scene.entities.some((entity)=>entity.id==="char.aelar"||entity.id==="char.mira"),false);
  const potionAction=(freeform.scene.actionsByActor[CHARACTER_ID]??[]).find((action)=>action.id==="action.healing-potion");
  assert.ok(potionAction,"persisted potion ItemInstance must derive the production healing-potion action");
  assert.equal(potionAction.actorId,CHARACTER_ID);
  assert.equal(potionAction.itemCost?.itemId,POTION_ID);
  assert.equal(potionAction.itemCost?.quantity,1);
  assert.equal(potionAction.available,true);
  const economyBefore=structuredClone(freeform.scene.economyByActor[CHARACTER_ID]);

  const roll=await player.resolveAction(potionAction.id,[CHARACTER_ID]);
  const resolutionId=roll.resolution?.id;
  assert.ok(resolutionId);
  assert.equal(roll.resolution?.actorId,CHARACTER_ID);
  assert.equal(roll.resolution?.stage,"roll-animation");
  assert.equal(potionQuantity(roll),2,"item quantity must not be spent during roll preview");
  assert.equal(roll.activeCharacter.hp,4,"HP must not change during roll preview");

  const preview=await player.advanceResolution();
  assert.equal(preview.resolution?.stage,"effect-preview");
  assert.equal(preview.resolution?.authoritativeDice.length,2);
  assert.equal(potionQuantity(preview),2,"item quantity must not be spent before confirmed commit");
  assert.equal(preview.activeCharacter.hp,4,"HP must remain unchanged before confirmed commit");
  assert.equal(preview.persistence?.storageRevision,1,"preview must not create a durable generation");

  const committed=await player.advanceResolution();
  assert.equal(committed.resolution?.stage,"complete");
  assert.ok(committed.activeCharacter.hp>4&&committed.activeCharacter.hp<=committed.activeCharacter.maxHp);
  assert.equal(potionQuantity(committed),1);
  assert.equal(committed.persistence?.storageRevision,2,"HP and quantity must commit in one durable generation");
  assert.deepEqual(committed.scene.economyByActor[CHARACTER_ID],economyBefore,"Freeform item use must not consume hidden Initiative economy");
  const activity=committed.activity.find((entry)=>entry.id===resolutionId);
  assert.ok(activity,"committed item use must create event-native Activity");
  assert.ok(activity.detail.some((line)=>line.startsWith("ResolutionEvent ")));
  assert.ok(activity.stateChanges.some((line)=>line.includes(`${CHARACTER_ID} HP `)));
  assert.ok(activity.stateChanges.some((line)=>line.includes(`phase09:item:${POTION_ID}:quantity`)&&line.includes("2 → 1")));

  const reader=new MockAdapter();
  setCharacterLibraryStoreForTests(reader,store);
  const restored=await reader.getSnapshot();
  assert.equal(restored.activeCharacter.id,CHARACTER_ID);
  assert.equal(restored.activeCharacter.hp,committed.activeCharacter.hp);
  assert.equal(potionQuantity(restored),1);
  assert.equal(restored.persistence?.storageRevision,2);

  const replay=await reader.startProductionLocalPlay("player");
  const restoredAction=(replay.scene.actionsByActor[CHARACTER_ID]??[]).find((action)=>action.id==="action.healing-potion");
  assert.ok(restoredAction);
  assert.equal(restoredAction.itemCost?.itemId,POTION_ID);
  assert.equal(restoredAction.summary.includes("1개"),true);
});
