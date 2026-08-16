import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/authoringDraftRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { MemoryAuthoringDraftStore } from "../../src/app/memoryAuthoringDraftStore";
import { setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import {
  getAuthoringDraftPersistenceStateForTests,
  setAuthoringDraftStoreForTests,
} from "../../src/app/authoringDraftRuntimeAdapter";
import { decodeAuthoringDrafts } from "../../src/app/authoringDraftPersistence";
import { CharacterLibraryRepository } from "../../src/app/characterLibraryPersistence";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";

function adapterWithStores(characterStore:MemoryCharacterLibraryStore,draftStore:MemoryAuthoringDraftStore) {
  const adapter = new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,characterStore);
  setAuthoringDraftStoreForTests(adapter,draftStore);
  return adapter;
}

async function latestDraftDocument(store:MemoryAuthoringDraftStore) {
  const generations = await store.readGenerations();
  assert.ok(generations[0]?.payload);
  return decodeAuthoringDrafts(generations[0].payload!);
}

async function selectFighterSixAsi(adapter:MockAdapter) {
  let snapshot = await adapter.getSnapshot();
  const choice = snapshot.progressionPlan?.choices.find((entry) => entry.kind === "asi-or-feat");
  assert.ok(choice);
  const phase07 = adapter as unknown as Phase07AdapterCommands;
  await phase07.setProgressionChoice(choice!.id,{kind:"asi",mode:"plus-two",primary:"str"});
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.blocking.length,0);
}

test("Character creation intent autosaves and recovers through the current creation planner", async () => {
  const characterStore = new MemoryCharacterLibraryStore();
  const draftStore = new MemoryAuthoringDraftStore();
  const writer = adapterWithStores(characterStore,draftStore);
  await writer.createCharacterDraft("guided");
  await writer.updateCharacterDraft({type:"set-name",value:"Recovered Hero"});
  await writer.updateCharacterDraft({type:"set-notes",value:"autosaved note"});

  const persisted = await latestDraftDocument(draftStore);
  assert.equal(persisted.creation?.name,"Recovered Hero");
  assert.equal(persisted.creation?.notes,"autosaved note");
  const payload = JSON.stringify(persisted.creation);
  for (const forbidden of ["derived","validation","finalAbilities","creationPlan"]) assert.equal(payload.includes(`\"${forbidden}\"`),false,forbidden);

  const reader = adapterWithStores(characterStore,draftStore);
  const restored = await reader.getSnapshot();
  assert.equal(restored.createDraft?.name,"Recovered Hero");
  assert.equal(restored.createDraft?.notes,"autosaved note");
  assert.ok(restored.creationPlan);
  assert.equal(restored.creationPlan?.draftId,restored.createDraft?.id);
  assert.equal(restored.persistence?.authoringDrafts?.status,"ready");
});

test("failed creation autosave preserves the in-memory editable draft and prior committed generation", async () => {
  const characterStore = new MemoryCharacterLibraryStore();
  const draftStore = new MemoryAuthoringDraftStore();
  const adapter = adapterWithStores(characterStore,draftStore);
  await adapter.createCharacterDraft("guided");
  const before = await latestDraftDocument(draftStore);
  assert.equal(before.creation?.name,"");

  draftStore.failNextWrite("draft disk full");
  const failed = await adapter.updateCharacterDraft({type:"set-name",value:"Still Editable"});
  assert.equal(failed.createDraft?.name,"Still Editable");
  assert.equal(failed.persistence?.authoringDrafts?.status,"error");
  assert.match(failed.persistence?.authoringDrafts?.message ?? "",/draft disk full/);
  assert.equal((await latestDraftDocument(draftStore)).creation?.name,"");

  const retried = await adapter.updateCharacterDraft({type:"set-notes",value:"retry"});
  assert.equal(retried.persistence?.authoringDrafts?.status,"ready");
  const committed = await latestDraftDocument(draftStore);
  assert.equal(committed.creation?.name,"Still Editable");
  assert.equal(committed.creation?.notes,"retry");
});

test("progression intent autosaves choices and recovery rebuilds the current progression plan", async () => {
  const characterStore = new MemoryCharacterLibraryStore();
  const draftStore = new MemoryAuthoringDraftStore();
  const writer = adapterWithStores(characterStore,draftStore);
  await writer.startLevelUp("char.aelar");
  await selectFighterSixAsi(writer);

  const persisted = await latestDraftDocument(draftStore);
  assert.equal(persisted.progression?.characterId,"char.aelar");
  assert.equal(persisted.progression?.baseSourceRevision,1);
  const payload = JSON.stringify(persisted.progression);
  for (const forbidden of ["preview","validation","hpGain","fromLevel","toLevel","asiMode"]) assert.equal(payload.includes(`\"${forbidden}\"`),false,forbidden);

  const reader = adapterWithStores(characterStore,draftStore);
  const restored = await reader.getSnapshot();
  assert.equal(restored.levelUpDraft?.characterId,"char.aelar");
  assert.ok(restored.progressionPlan);
  assert.equal(restored.progressionPlan?.targetClassLevel,6);
  assert.equal(restored.progressionPlan?.blocking.length,0);
  assert.equal(restored.levelUpDraft?.preview.maxHpBefore,42);
});

test("a progression draft with an old Character source revision is not silently replayed", async () => {
  const characterStore = new MemoryCharacterLibraryStore();
  const draftStore = new MemoryAuthoringDraftStore();
  const writer = adapterWithStores(characterStore,draftStore);
  await writer.startLevelUp("char.aelar");
  const baseline = (await writer.getSnapshot()).activeCharacter;
  assert.equal(baseline.sourceRevision,1);

  const external = new CharacterLibraryRepository(characterStore);
  await external.hydrate([baseline],baseline.id);
  const renamed = structuredClone(baseline);
  renamed.name = "Aelar Revised";
  const committed = await external.commit([renamed],renamed.id);
  assert.equal(committed.document.characters[0].sourceRevision,2);

  const reader = adapterWithStores(characterStore,draftStore);
  const restored = await reader.getSnapshot();
  assert.equal(restored.activeCharacter.sourceRevision,2);
  assert.equal(restored.levelUpDraft,null);
  assert.equal(restored.persistence?.authoringDrafts?.status,"stale");
  assert.match(restored.persistence?.authoringDrafts?.message ?? "",/source revision 1.*현재 2/);
  assert.ok(getAuthoringDraftPersistenceStateForTests(reader)?.document?.progression);
});

test("an edit draft with an old Character source revision is not silently replayed", async () => {
  const characterStore = new MemoryCharacterLibraryStore();
  const draftStore = new MemoryAuthoringDraftStore();
  const writer = adapterWithStores(characterStore,draftStore);
  const baseline = (await writer.getSnapshot()).activeCharacter;
  await writer.editCharacterDraft(baseline.id);
  const persisted = await latestDraftDocument(draftStore);
  assert.equal(persisted.creation?.editingCharacterId,baseline.id);
  assert.equal(persisted.creation?.editingBaseSourceRevision,1);

  const external = new CharacterLibraryRepository(characterStore);
  await external.hydrate([baseline],baseline.id);
  const renamed = structuredClone(baseline);
  renamed.name = "Aelar External Revision";
  const committed = await external.commit([renamed],renamed.id);
  assert.equal(committed.document.characters[0].sourceRevision,2);

  const reader = adapterWithStores(characterStore,draftStore);
  const restored = await reader.getSnapshot();
  assert.equal(restored.createDraft,null);
  assert.equal(restored.persistence?.authoringDrafts?.status,"stale");
  assert.match(restored.persistence?.authoringDrafts?.message ?? "",/편집 draft의 기준 source revision 1.*현재 2/);
});

test("a new creation draft is not replayed after the Character library changed since its autosave base", async () => {
  const characterStore = new MemoryCharacterLibraryStore();
  const draftStore = new MemoryAuthoringDraftStore();
  const writer = adapterWithStores(characterStore,draftStore);
  await writer.createCharacterDraft("guided");
  await writer.updateCharacterDraft({type:"set-name",value:"Already Committed Candidate"});
  const baseline = (await writer.getSnapshot()).activeCharacter;
  const persisted = await latestDraftDocument(draftStore);
  assert.deepEqual(persisted.creation?.baseCharacterIds,["char.aelar","char.mira"]);

  const external = new CharacterLibraryRepository(characterStore);
  await external.hydrate([baseline],baseline.id);
  const added = structuredClone(baseline);
  added.id = "char.already-committed-candidate";
  added.name = "Already Committed Candidate";
  await external.commit([baseline,added],added.id);

  const reader = adapterWithStores(characterStore,draftStore);
  const restored = await reader.getSnapshot();
  assert.equal(restored.createDraft,null);
  assert.equal(restored.persistence?.authoringDrafts?.status,"stale");
  assert.match(restored.persistence?.authoringDrafts?.message ?? "",/기준 Character library가 변경/);
  assert.ok(getAuthoringDraftPersistenceStateForTests(reader)?.document?.creation);
});

test("successful progression commit clears the autosaved draft only after Character persistence succeeds", async () => {
  const characterStore = new MemoryCharacterLibraryStore();
  const draftStore = new MemoryAuthoringDraftStore();
  const adapter = adapterWithStores(characterStore,draftStore);
  await adapter.startLevelUp("char.aelar");
  await selectFighterSixAsi(adapter);
  const result = await adapter.commitLevelUp();
  assert.equal(result.activeCharacter.level,6);
  assert.equal(result.levelUpDraft,null);
  assert.equal(getAuthoringDraftPersistenceStateForTests(adapter)?.document?.progression,null);
});

test("failed Character persistence keeps the autosaved progression draft available for retry", async () => {
  const characterStore = new MemoryCharacterLibraryStore();
  const draftStore = new MemoryAuthoringDraftStore();
  const adapter = adapterWithStores(characterStore,draftStore);
  await adapter.startLevelUp("char.aelar");
  await selectFighterSixAsi(adapter);
  characterStore.failNextWrite("character disk full");

  const result = await adapter.commitLevelUp();
  assert.equal(result.activeCharacter.level,5);
  assert.ok(result.levelUpDraft);
  assert.equal(result.persistence?.status,"error");
  assert.ok(getAuthoringDraftPersistenceStateForTests(adapter)?.document?.progression);
});
