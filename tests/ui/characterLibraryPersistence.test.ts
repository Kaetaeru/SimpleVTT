import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterSheet } from "../../src/app/contracts";
import {
  CharacterLibraryCorruptError,
  CharacterLibraryRepository,
  decodeCharacterLibraryV1,
  encodeCharacterLibraryV1,
} from "../../src/app/characterLibraryPersistence";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";

function sheet(id="char.test"):CharacterSheet {
  return {
    id,
    name:"Test Hero",
    className:"몽크",
    level:3,
    species:"인간",
    background:"수도승",
    hp:18,
    maxHp:24,
    tempHp:0,
    ac:15,
    speed:40,
    proficiencyBonus:2,
    saveState:"saved",
    abilities:{str:10,dex:16,con:14,int:10,wis:16,cha:8},
    saves:["STR +2","DEX +5"],
    skills:["곡예","통찰"],
    features:["무술","기의 점"],
    equipment:["단검"],
    items:[{id:"item.test.dagger",definitionId:"dnd.srd521.item.dagger",name:"단검",kind:"equipment",quantity:1,equipped:true,wielded:true,passiveEffects:[],grantedActionIds:[],provenance:["SRD 5.2.1"]}],
    resources:[{id:"resource.focus",label:"집중점",current:3,max:3,source:"Monk"}],
    attacks:[{id:"attack.dagger",name:"단검",bonus:5,damage:"1d4+3 관통"}],
    rulesProfileId:"dnd.srd-5.2.1",
    rulesProfileVersion:"0.1-draft",
    classLevels:[{classId:"dnd.srd521.class.monk",level:3,subclassName:"열린 손"}],
    creationSelections:{"species.size":["medium"]},
    subclassIds:{"dnd.srd521.class.monk":"dnd.srd521.subclass.open-hand"},
    subclassSources:{"dnd.srd521.class.monk":"SRD 5.2.1"},
  };
}

test("Character library keeps source and durable runtime revisions independent", async () => {
  const store = new MemoryCharacterLibraryStore();
  const repository = new CharacterLibraryRepository(store);
  const initial = await repository.hydrate([sheet()],"char.test");
  assert.equal(initial.document.storageRevision,0);
  assert.equal(initial.document.characters[0].sourceRevision,1);
  assert.equal(initial.document.characters[0].runtimeRevision,1);

  const damaged = sheet();
  damaged.hp = 11;
  const runtimeCommit = await repository.commit([damaged],damaged.id);
  assert.equal(runtimeCommit.document.storageRevision,1);
  assert.equal(runtimeCommit.document.characters[0].sourceRevision,1);
  assert.equal(runtimeCommit.document.characters[0].runtimeRevision,2);

  const renamed = structuredClone(damaged);
  renamed.name = "Renamed Hero";
  const sourceCommit = await repository.commit([renamed],renamed.id);
  assert.equal(sourceCommit.document.storageRevision,2);
  assert.equal(sourceCommit.document.characters[0].sourceRevision,2);
  assert.equal(sourceCommit.document.characters[0].runtimeRevision,2);
});

test("stale Character library writers cannot overwrite a newer generation", async () => {
  const store = new MemoryCharacterLibraryStore();
  const first = new CharacterLibraryRepository(store);
  const stale = new CharacterLibraryRepository(store);
  await first.hydrate([sheet()],"char.test");
  await stale.hydrate([sheet()],"char.test");
  const changed = sheet();
  changed.hp = 9;
  await first.commit([changed],changed.id);
  await assert.rejects(() => stale.commit([sheet()],"char.test"),/stale Character library generation/);
});

test("a corrupt newest generation recovers from the previous valid commit without overwriting it", async () => {
  const store = new MemoryCharacterLibraryStore();
  const writer = new CharacterLibraryRepository(store);
  await writer.hydrate([sheet()],"char.test");
  const changed = sheet();
  changed.hp = 12;
  const committed = await writer.commit([changed],changed.id);
  assert.equal(committed.document.storageRevision,1);
  store.seed(2,"{not-json");

  const recovered = new CharacterLibraryRepository(store);
  const hydration = await recovered.hydrate([sheet()],"char.test");
  assert.equal(hydration.physicalGeneration,2);
  assert.equal(hydration.loadedGeneration,1);
  assert.equal(hydration.recoveredFromOlderGeneration,true);
  assert.equal(hydration.sheets[0].hp,12);

  hydration.sheets[0].hp = 10;
  const next = await recovered.commit(hydration.sheets,hydration.activeCharacterId);
  assert.equal(next.document.storageRevision,3);
});

test("all-corrupt generations are an explicit blocker", async () => {
  const store = new MemoryCharacterLibraryStore();
  store.seed(1,"{broken");
  const repository = new CharacterLibraryRepository(store);
  await assert.rejects(() => repository.hydrate([sheet()],"char.test"),CharacterLibraryCorruptError);
});

test("the persisted document excludes transient AppSnapshot/session fields", async () => {
  const store = new MemoryCharacterLibraryStore();
  const repository = new CharacterLibraryRepository(store);
  const hydration = await repository.hydrate([sheet()],"char.test");
  const encoded = encodeCharacterLibraryV1(hydration.document);
  const decoded = decodeCharacterLibraryV1(encoded);
  assert.equal(decoded.characters[0].source.rulesProfile.id,"dnd.srd-5.2.1");
  for (const forbidden of ["scene","resolution","connectionState","queuedD20","sessionMode","combatantDefinitions"]) {
    assert.equal(encoded.includes(`\"${forbidden}\"`),false,forbidden);
  }
});
