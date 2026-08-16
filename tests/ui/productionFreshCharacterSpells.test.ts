import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { CharacterLibraryRepository } from "../../src/app/characterLibraryPersistence";
import { setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import type { CharacterSheet } from "../../src/app/contracts";

const CHARACTER_ID="char.phase14-spell-sorcerer";
const FIRE_BOLT="dnd.srd521.spell.fire-bolt";
const MAGIC_MISSILE="dnd.srd521.spell.magic-missile";

function persistedSpellcaster():CharacterSheet {
  return {
    id:CHARACTER_ID,
    name:"Phase14 Spell Sorcerer",
    className:"소서러",
    level:1,
    species:"인간",
    background:"학자",
    hp:8,
    maxHp:8,
    tempHp:0,
    ac:12,
    speed:30,
    proficiencyBonus:2,
    saveState:"saved",
    abilities:{str:8,dex:14,con:14,int:12,wis:10,cha:16},
    saves:["CON +4","CHA +5"],
    skills:["비전","설득"],
    features:["주문 시전"],
    equipment:[],
    items:[],
    resources:[],
    attacks:[],
    classLevels:[{classId:"dnd.srd521.class.sorcerer",className:"소서러",level:1}],
    cantrips:[FIRE_BOLT],
    preparedSpells:[MAGIC_MISSILE],
    spellSlotMaximums:{1:2},
  };
}

async function seedPersistedCharacter(store:MemoryCharacterLibraryStore) {
  const sheet=persistedSpellcaster();
  const repository=new CharacterLibraryRepository(store);
  await repository.hydrate([sheet],sheet.id);
  const committed=await repository.commit([sheet],sheet.id);
  assert.equal(committed.document.storageRevision,1);
}

function action(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,id:string) {
  return (snapshot.scene.actionsByActor[CHARACTER_ID]??[]).find((entry)=>entry.id===id);
}

function slot(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,level:number) {
  return snapshot.scene.spellcastingByActor?.[CHARACTER_ID]?.slots.find((entry)=>entry.level===level);
}

async function nextTurnFor(adapter:MockAdapter,actorId:string) {
  for (let index=0;index<12;index+=1) {
    const snapshot=await adapter.endTurn();
    if (snapshot.scene.currentActorId===actorId) return snapshot;
  }
  assert.fail(`initiative did not cycle back to ${actorId}`);
}

test("persisted non-fixture Sorcerer casts executable cantrip and slotted spell through production authority",async()=>{
  const store=new MemoryCharacterLibraryStore();
  await seedPersistedCharacter(store);

  const player=new MockAdapter();
  setCharacterLibraryStoreForTests(player,store);
  let snapshot=await player.getSnapshot();
  assert.equal(snapshot.activeCharacter.id,CHARACTER_ID);
  assert.deepEqual(snapshot.activeCharacter.cantrips,[FIRE_BOLT]);
  assert.deepEqual(snapshot.activeCharacter.preparedSpells,[MAGIC_MISSILE]);
  assert.deepEqual(snapshot.activeCharacter.spellSlotMaximums,{1:2});
  assert.equal(snapshot.persistence?.storageRevision,1);

  await player.startProductionLocalPlay("player");
  await player.startInitiative();
  snapshot=await player.setCurrentActor(CHARACTER_ID);
  assert.equal(snapshot.activeCharacter.id,CHARACTER_ID);
  assert.equal(snapshot.scene.entities.some((entry)=>entry.id==="char.aelar"||entry.id==="char.mira"),false);

  const hud=snapshot.scene.spellcastingByActor?.[CHARACTER_ID];
  assert.ok(hud,"persisted production spellcaster must own a spellcasting HUD/runtime caster projection");
  assert.equal(hud.spellcastingAbilityModifier,3);
  assert.equal(hud.spellAttackModifier,5);
  assert.equal(hud.spellSaveDc,13);
  assert.deepEqual(hud.cantripSpellIds,[FIRE_BOLT]);
  assert.deepEqual(hud.preparedSpellIds,[MAGIC_MISSILE]);
  assert.deepEqual(slot(snapshot,1),{level:1,current:2,max:2});

  const fireBolt=action(snapshot,"action.fire-bolt");
  assert.ok(fireBolt,"persisted Fire Bolt must derive a production spell action");
  assert.equal(fireBolt.actorId,CHARACTER_ID);
  assert.equal(fireBolt.spellCast?.spellId,FIRE_BOLT);
  assert.equal(fireBolt.spellCast?.runtimeSupport,"combat-executable");
  assert.equal(fireBolt.spellCast?.baseLevel,0);
  assert.equal(fireBolt.available,true);

  const firstTarget=snapshot.scene.entities.find((entry)=>entry.side==="enemy"&&Number.parseInt(entry.distance??"")<=120);
  assert.ok(firstTarget,"Fire Bolt requires a production enemy within 120 feet");
  const firstHp=firstTarget.hp;
  await player.setQueuedD20(18);
  const cantrip=await player.resolveAction(fireBolt.id,[firstTarget.id]);
  const cantripResolutionId=cantrip.resolution?.id;
  assert.ok(cantripResolutionId);
  assert.equal(cantrip.resolution?.stage,"complete");
  assert.equal(cantrip.resolution?.actorId,CHARACTER_ID);
  assert.equal(cantrip.resolution?.actionId,fireBolt.id);
  assert.ok(cantrip.resolution?.provenance.some((entry)=>entry.includes(FIRE_BOLT)));
  assert.ok((cantrip.scene.entities.find((entry)=>entry.id===firstTarget.id)?.hp??firstHp)<firstHp,"Fire Bolt must commit authoritative damage");
  assert.deepEqual(slot(cantrip,1),{level:1,current:2,max:2},"cantrip must not spend a spell slot");
  const cantripActivity=cantrip.activity.find((entry)=>entry.id===cantripResolutionId);
  assert.ok(cantripActivity,"cantrip commit must create Activity");
  assert.ok(cantripActivity.detail.some((entry)=>entry.includes("ResolutionEvent")));
  assert.ok(cantripActivity.detail.some((entry)=>entry.includes(FIRE_BOLT)));
  assert.equal(cantripActivity.stateChanges.some((entry)=>entry.includes("resource.spell-slot-1")),false);

  snapshot=await nextTurnFor(player,CHARACTER_ID);
  assert.equal(snapshot.scene.economyByActor[CHARACTER_ID]?.action,true,"new turn must restore Action before slotted cast");
  assert.deepEqual(slot(snapshot,1),{level:1,current:2,max:2});

  const magicMissile=action(snapshot,"action.magic-missile");
  assert.ok(magicMissile,"persisted Magic Missile must derive a production spell action");
  assert.equal(magicMissile.actorId,CHARACTER_ID);
  assert.equal(magicMissile.spellCast?.spellId,MAGIC_MISSILE);
  assert.equal(magicMissile.spellCast?.runtimeSupport,"combat-executable");
  assert.equal(magicMissile.spellCast?.baseLevel,1);
  assert.equal(magicMissile.available,true);

  const secondTarget=snapshot.scene.entities.find((entry)=>entry.side==="enemy"&&entry.id!==firstTarget.id)??firstTarget;
  const secondHp=secondTarget.hp;
  const slotted=await player.resolveAction(magicMissile.id,[secondTarget.id]);
  const slottedResolutionId=slotted.resolution?.id;
  assert.ok(slottedResolutionId);
  assert.equal(slotted.resolution?.stage,"complete");
  assert.equal(slotted.resolution?.actorId,CHARACTER_ID);
  assert.equal(slotted.resolution?.actionId,magicMissile.id);
  assert.ok(slotted.resolution?.provenance.some((entry)=>entry.includes(MAGIC_MISSILE)));
  assert.ok((slotted.scene.entities.find((entry)=>entry.id===secondTarget.id)?.hp??secondHp)<secondHp,"Magic Missile must commit authoritative projectile damage");
  assert.deepEqual(slot(slotted,1),{level:1,current:1,max:2},"slotted cast must spend exactly one authoritative slot");
  assert.equal(slotted.scene.spellcastingByActor?.[CHARACTER_ID]?.slottedSpellCastThisTurn,true);
  const slottedActivity=slotted.activity.find((entry)=>entry.id===slottedResolutionId);
  assert.ok(slottedActivity,"slotted spell commit must create Activity");
  assert.ok(slottedActivity.detail.some((entry)=>entry.includes("ResolutionEvent")));
  assert.ok(slottedActivity.detail.some((entry)=>entry.includes(MAGIC_MISSILE)));
  assert.ok(slottedActivity.stateChanges.some((entry)=>entry.includes("resource.spell-slot-1")&&entry.includes("2 → 1")));
  assert.equal(slotted.persistence?.storageRevision,1,"session spell-slot spend must not invent a parallel Character-library write-back");

  const sameTurnAction=action(slotted,"action.magic-missile");
  assert.equal(sameTurnAction?.available,false);
  assert.match(sameTurnAction?.disabledReason??"",/이미 주문 슬롯을 소비/);

  const reader=new MockAdapter();
  setCharacterLibraryStoreForTests(reader,store);
  const restored=await reader.getSnapshot();
  assert.equal(restored.activeCharacter.id,CHARACTER_ID);
  assert.deepEqual(restored.activeCharacter.cantrips,[FIRE_BOLT]);
  assert.deepEqual(restored.activeCharacter.preparedSpells,[MAGIC_MISSILE]);
  assert.deepEqual(restored.activeCharacter.spellSlotMaximums,{1:2});
  assert.equal(restored.persistence?.storageRevision,1,"Character source remains durable while session-only slot state is not serialized");
});
