import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterSheet } from "../../src/app/contracts";
import {
  CharacterLibraryCorruptError,
  CharacterLibraryMigrationRequiredError,
  CharacterLibraryRepository,
  CharacterLibrarySchemaError,
  decodeCharacterLibrary,
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

function sourceRichSheet():CharacterSheet {
  const value=sheet();
  value.features=["무술","기의 점","source-feature"];
  value.cantrips=["dnd.srd521.spell.guidance"];
  value.preparedSpells=["dnd.srd521.spell.cure-wounds"];
  value.spellbookSpells=["dnd.srd521.spell.magic-missile"];
  value.masteryWeapons=["dnd.srd521.item.weapon.dagger"];
  value.cantripSources={"dnd.srd521.spell.guidance":"source-cantrip"};
  value.preparedSpellSources={"dnd.srd521.spell.cure-wounds":"source-prepared"};
  value.spellbookSpellSources={"dnd.srd521.spell.magic-missile":"source-spellbook"};
  value.persistentFeatureOptionIds=["feature:source-option"];
  value.persistentFeatureOptionSources={"feature:source-option":"source-choice"};
  value.items=[{
    id:"item.test.dagger",
    definitionId:"dnd.srd521.item.weapon.dagger",
    name:"단검",
    nameEn:"Dagger",
    kind:"equipment",
    quantity:2,
    equipped:true,
    wielded:true,
    attunementRequired:false,
    passiveEffects:["source-item-effect"],
    grantedActionIds:["action.source-dagger"],
    provenance:["SRD 5.2.1","source-item"],
  }];
  value.resources=[{
    id:"resource.focus",
    label:"집중점",
    current:2,
    max:3,
    source:"Monk 3 · SRD 5.2.1",
    recovery:{shortRest:"all"},
  }];
  return value;
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

  const sourceStaticChange=structuredClone(renamed);
  sourceStaticChange.items[0].provenance=[...sourceStaticChange.items[0].provenance,"source-only"];
  sourceStaticChange.resources[0].label="집중점 (정규화)";
  sourceStaticChange.features=[...sourceStaticChange.features,"source-only-feature"];
  const sourceStaticCommit=await repository.commit([sourceStaticChange],sourceStaticChange.id);
  assert.equal(sourceStaticCommit.document.characters[0].sourceRevision,3);
  assert.equal(sourceStaticCommit.document.characters[0].runtimeRevision,2,"source-owned item/resource/feature changes must not increment runtime revision");
});

test("source and runtime reconstruct item/spell/resource/feature state when the materialized cache drifts", async () => {
  const store=new MemoryCharacterLibraryStore();
  const writer=new CharacterLibraryRepository(store);
  const original=sourceRichSheet();
  await writer.hydrate([original],original.id);
  const committed=await writer.commit([original],original.id);
  const drifted=structuredClone(committed.document);
  drifted.storageRevision=2;
  const record=drifted.characters[0];
  record.runtime.items[0].quantity=1;
  record.runtime.items[0].equipped=false;
  record.runtime.resources[0].current=1;
  record.materializedCache.sheet.className="CACHE CLASS";
  record.materializedCache.sheet.features=["CACHE FEATURE"];
  record.materializedCache.sheet.cantrips=["cache.cantrip"];
  record.materializedCache.sheet.preparedSpells=["cache.prepared"];
  record.materializedCache.sheet.spellbookSpells=["cache.spellbook"];
  record.materializedCache.sheet.cantripSources={"cache.cantrip":"cache"};
  record.materializedCache.sheet.persistentFeatureOptionIds=["cache-feature-option"];
  record.materializedCache.sheet.items[0]={
    ...record.materializedCache.sheet.items[0],
    definitionId:"cache.item",
    name:"CACHE ITEM",
    quantity:99,
    equipped:true,
    passiveEffects:["cache-effect"],
    grantedActionIds:["cache-action"],
    provenance:["cache"],
  };
  record.materializedCache.sheet.resources[0]={
    ...record.materializedCache.sheet.resources[0],
    label:"CACHE RESOURCE",
    current:99,
    max:99,
    source:"cache",
  };
  store.seed(2,encodeCharacterLibraryV1(drifted));

  const reader=new CharacterLibraryRepository(store);
  const hydration=await reader.hydrate([sheet()],original.id);
  const restored=hydration.sheets[0];
  assert.equal(restored.className,"몽크");
  assert.deepEqual(restored.features,["무술","기의 점","source-feature"]);
  assert.deepEqual(restored.cantrips,["dnd.srd521.spell.guidance"]);
  assert.deepEqual(restored.preparedSpells,["dnd.srd521.spell.cure-wounds"]);
  assert.deepEqual(restored.spellbookSpells,["dnd.srd521.spell.magic-missile"]);
  assert.deepEqual(restored.cantripSources,{"dnd.srd521.spell.guidance":"source-cantrip"});
  assert.deepEqual(restored.persistentFeatureOptionIds,["feature:source-option"]);
  assert.deepEqual(restored.items[0],{
    id:"item.test.dagger",
    definitionId:"dnd.srd521.item.weapon.dagger",
    name:"단검",
    nameEn:"Dagger",
    kind:"equipment",
    quantity:1,
    equipped:false,
    wielded:true,
    attunementRequired:false,
    attuned:undefined,
    charges:undefined,
    passiveEffects:["source-item-effect"],
    grantedActionIds:["action.source-dagger"],
    provenance:["SRD 5.2.1","source-item"],
  });
  assert.equal(restored.resources[0].label,"집중점");
  assert.equal(restored.resources[0].max,3);
  assert.equal(restored.resources[0].current,1);
  assert.equal(restored.resources[0].source,"Monk 3 · SRD 5.2.1");
  assert.deepEqual(restored.resources[0].recovery,{shortRest:"all"});
  assert.deepEqual(restored.equipment,["단검"]);
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
  const decoded = decodeCharacterLibrary(encoded);
  assert.equal(decoded.characters[0].source.rulesProfile.id,"dnd.srd-5.2.1");
  assert.deepEqual(decoded,decodeCharacterLibraryV1(encoded));
  for (const forbidden of ["scene","resolution","connectionState","queuedD20","sessionMode","combatantDefinitions"]) {
    assert.equal(encoded.includes(`\"${forbidden}\"`),false,forbidden);
  }
});

test("an unsupported newer schema is an explicit migration blocker, not corruption fallback", async () => {
  const store = new MemoryCharacterLibraryStore();
  const writer = new CharacterLibraryRepository(store);
  const initial = await writer.hydrate([sheet()],"char.test");
  await writer.commit(initial.sheets,initial.activeCharacterId);
  const v2 = JSON.stringify({
    schemaId:"simplevtt.character-library",
    schemaVersion:2,
    storageRevision:2,
    activeCharacterId:"char.test",
    characters:[],
  });
  store.seed(2,v2);

  const reader = new CharacterLibraryRepository(store);
  await assert.rejects(
    () => reader.hydrate([sheet()],"char.test"),
    (error:unknown) => error instanceof CharacterLibraryMigrationRequiredError && error.schemaVersion === 2,
  );
});

test("an unrelated schema id is an explicit blocker rather than an older-generation fallback", async () => {
  const store = new MemoryCharacterLibraryStore();
  store.seed(1,JSON.stringify({schemaId:"other.app.library",schemaVersion:1}));
  const repository = new CharacterLibraryRepository(store);
  await assert.rejects(() => repository.hydrate([sheet()],"char.test"),CharacterLibrarySchemaError);
});
