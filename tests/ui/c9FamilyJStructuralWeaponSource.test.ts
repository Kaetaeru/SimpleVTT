import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/productionPlayRuntimeAdapter";
import type { CharacterSheet } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";

type Internal={activeCharacter:CharacterSheet};
const source=(adapter:MockAdapter)=>(adapter as unknown as Internal).activeCharacter;

test("production weapon projection follows grantedActionIds instead of presentation names",async()=>{
  const adapter=new MockAdapter();
  const character=source(adapter);
  const attack=character.attacks.find((candidate)=>candidate.id==="action.shortbow");
  const item=character.items.find((candidate)=>candidate.id==="item.shortbow.aelar");
  assert.ok(attack);assert.ok(item);
  attack.name="Completely Renamed Attack";
  item.name="Unrelated Source Item";item.nameEn="Different Presentation";
  const snapshot=await adapter.startProductionLocalPlay();
  const projected=snapshot.scene.actionsByActor[character.id]?.find((candidate)=>candidate.id===attack.id);
  assert.ok(projected);
  assert.equal(projected.runtimeAttack?.rangeFeet,80);
  assert.equal(projected.runtimeAttack?.ability,"dex");
  assert.equal(projected.attacksPerAction,2);
});

test("production weapon projection does not infer range from presentation text without a structural source link",async()=>{
  const adapter=new MockAdapter();
  const character=source(adapter);
  const attack=character.attacks.find((candidate)=>candidate.id==="action.shortbow");
  const item=character.items.find((candidate)=>candidate.id==="item.shortbow.aelar");
  assert.ok(attack);assert.ok(item);
  attack.name="Longbow";item.grantedActionIds=[];
  const snapshot=await adapter.startProductionLocalPlay();
  const projected=snapshot.scene.actionsByActor[character.id]?.find((candidate)=>candidate.id===attack.id);
  assert.ok(projected);
  assert.equal(projected.runtimeAttack?.rangeFeet,5);
  assert.equal(projected.runtimeAttack?.ability,undefined);
  assert.equal(projected.attacksPerAction,2,"presentation text alone must not imply Loading");
});


test("Loading is derived from the structurally linked weapon source and limits Extra Attack",async()=>{
  const adapter=new MockAdapter();
  const character=source(adapter);
  const attack=character.attacks.find((candidate)=>candidate.id==="action.shortbow");
  const item=character.items.find((candidate)=>candidate.id==="item.shortbow.aelar");
  assert.ok(attack);assert.ok(item);
  attack.name="Renamed Ranged Attack";
  item.name="Unrelated Equipment";item.nameEn="Presentation Removed";
  item.definitionId="dnd.srd521.item.weapon.light-crossbow";
  const snapshot=await adapter.startProductionLocalPlay();
  const projected=snapshot.scene.actionsByActor[character.id]?.find((candidate)=>candidate.id===attack.id);
  assert.ok(projected);
  assert.equal(projected.runtimeAttack?.rangeFeet,80);
  assert.equal(projected.runtimeAttack?.ability,"dex");
  assert.equal(projected.attacksPerAction,1,"Loading weapon must allow only one attack from the Attack action");
});
