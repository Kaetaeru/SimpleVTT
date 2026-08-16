import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterSheet } from "../../src/app/contracts";
import { CharacterLibraryRepository } from "../../src/app/characterLibraryPersistence";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";

function sheet():CharacterSheet {
  return {
    id:"char.atomic-save",
    name:"Atomic Hero",
    className:"파이터",
    level:1,
    species:"인간",
    background:"병사",
    hp:12,
    maxHp:12,
    tempHp:0,
    ac:16,
    speed:30,
    proficiencyBonus:2,
    saveState:"saved",
    abilities:{str:16,dex:12,con:14,int:10,wis:10,cha:8},
    saves:["STR +5","CON +4"],
    skills:["운동","감지"],
    features:["Second Wind"],
    equipment:["Longsword"],
    items:[{
      id:"item.atomic.longsword",
      definitionId:"dnd.srd521.item.longsword",
      name:"Longsword",
      kind:"equipment",
      quantity:1,
      equipped:true,
      wielded:true,
      passiveEffects:[],
      grantedActionIds:[],
      provenance:["SRD 5.2.1"],
    }],
    resources:[{id:"resource.second-wind",label:"Second Wind",current:1,max:1,source:"Fighter"}],
    attacks:[{id:"attack.longsword",name:"Longsword",bonus:5,damage:"1d8+3 slashing"}],
    rulesProfileId:"dnd.srd-5.2.1",
    rulesProfileVersion:"0.1-draft",
    classLevels:[{classId:"dnd.srd521.class.fighter",level:1}],
    creationSelections:{},
  };
}

test("failed Character save does not advance state; restart recovers the last commit and retry succeeds", async () => {
  const store=new MemoryCharacterLibraryStore();
  const writer=new CharacterLibraryRepository(store);
  const initial=await writer.hydrate([sheet()],"char.atomic-save");

  const stable=structuredClone(initial.sheets[0]);
  stable.hp=9;
  const first=await writer.commit([stable],stable.id);
  assert.equal(first.document.storageRevision,1);
  assert.equal(first.sheets[0].hp,9);
  const beforeFailure=writer.snapshot();

  const candidate=structuredClone(first.sheets[0]);
  candidate.hp=3;
  store.failNextWrite("simulated durable Character save failure");
  await assert.rejects(
    () => writer.commit([candidate],candidate.id),
    /simulated durable Character save failure/,
  );

  assert.deepEqual(writer.snapshot(),beforeFailure,"failed persistence must not publish candidate state in memory");
  const generationsAfterFailure=await store.readGenerations();
  assert.deepEqual(generationsAfterFailure.map((entry)=>entry.generation),[1],"failed persistence must not publish a new committed generation");

  const restarted=new CharacterLibraryRepository(store);
  const recovered=await restarted.hydrate([sheet()],"char.atomic-save");
  assert.equal(recovered.document.storageRevision,1);
  assert.equal(recovered.loadedGeneration,1);
  assert.equal(recovered.physicalGeneration,1);
  assert.equal(recovered.sheets[0].hp,9,"restart must recover the last durable Character state");

  const retried=structuredClone(recovered.sheets[0]);
  retried.hp=6;
  const second=await restarted.commit([retried],retried.id);
  assert.equal(second.document.storageRevision,2);
  assert.equal(second.sheets[0].hp,6);

  const verified=new CharacterLibraryRepository(store);
  const finalHydration=await verified.hydrate([sheet()],"char.atomic-save");
  assert.equal(finalHydration.loadedGeneration,2);
  assert.equal(finalHydration.sheets[0].hp,6,"successful retry must survive another restart");
});
