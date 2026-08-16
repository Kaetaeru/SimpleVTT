import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import { decodeCharacterLibraryV1 } from "../../src/app/characterLibraryPersistence";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import {
  getCharacterLibraryPersistenceStateForTests,
  setCharacterLibraryStoreForTests,
} from "../../src/app/characterLibraryRuntimeAdapter";
import { classIdFromName, classMeta } from "../../src/app/characterCreationV10Data";
import type { CharacterCreationSection } from "../../src/app/contracts";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";

async function latestDocument(store:MemoryCharacterLibraryStore) {
  const generations = await store.readGenerations();
  assert.ok(generations[0]?.payload);
  return decodeCharacterLibraryV1(generations[0].payload!);
}

async function fillCurrentCreationDraft(adapter:MockAdapter) {
  for (let pass = 0; pass < 40; pass++) {
    const snapshot = await adapter.getSnapshot();
    const draft = snapshot.createDraft;
    const plan = snapshot.creationPlan;
    assert.ok(draft && plan,"creation draft/plan must exist");
    let changed = false;

    const skills = plan.sections.find((section) => section.id === "proficiencies");
    if (skills?.status === "incomplete") {
      const count = classMeta(classIdFromName(draft.className)).semantics.skills.count;
      for (const option of skills.options.filter((item) => !item.selected).slice(0,Math.max(0,count-draft.selectedSkills.length))) {
        await adapter.updateCharacterDraft({type:"toggle-skill",value:option.name});
        changed = true;
      }
    }

    const equipment = plan.sections.find((section) => section.id === "class-equipment");
    if (equipment?.status === "incomplete" && equipment.options[0]) {
      await adapter.updateCharacterDraft({type:"set-equipment",value:equipment.options[0].id});
      changed = true;
    }

    const current = await adapter.getSnapshot();
    const dynamic = (current.creationPlan?.sections ?? []).filter(
      (section) => section.kind === "dynamic-choice" && section.status === "incomplete" && section.selection,
    ) as Array<CharacterCreationSection & {selection:{choiceId:string;count:number}}>;
    for (const section of dynamic) {
      const targetIds = section.options
        .filter((option) => !option.selected)
        .slice(0,section.selection.count-section.options.filter((option) => option.selected).length)
        .map((option) => option.id);
      for (const id of targetIds) {
        const latest = await adapter.getSnapshot();
        const target = latest.creationPlan?.sections.find((item) => item.selection?.choiceId === section.selection.choiceId);
        if (!target || target.status === "complete" || target.status === "blocked") break;
        if (!target.options.some((option) => option.id === id && !option.selected)) continue;
        await adapter.updateCharacterDraft({type:"toggle-class-choice",choiceId:section.selection.choiceId,value:id});
        changed = true;
      }
    }

    const after = await adapter.getSnapshot();
    if ((after.creationPlan?.summary.blockingCount ?? 1) === 0) return after;
    if (!changed) {
      const unresolved = after.creationPlan?.sections
        .filter((section) => section.status === "incomplete" || section.status === "blocked")
        .map((section) => `${section.id}:${section.status}`)
        .join(", ");
      assert.fail(`unable to complete creation draft: ${unresolved}`);
    }
  }
  assert.fail("creation completion exceeded 40 passes");
}

async function prepareFighterCreation(adapter:MockAdapter,name:string) {
  await adapter.createCharacterDraft("guided");
  await adapter.updateCharacterDraft({type:"set-name",value:name});
  await adapter.updateCharacterDraft({type:"set-species",value:"드워프"});
  await adapter.updateCharacterDraft({type:"set-background",value:"범죄자"});
  await adapter.updateCharacterDraft({type:"set-class",value:"파이터"});
  await adapter.updateCharacterDraft({type:"apply-recommended-array"});
  return fillCurrentCreationDraft(adapter);
}

test("direct durable ItemInstance mutation persists and hydrates before the next adapter snapshot", async () => {
  const store = new MemoryCharacterLibraryStore();
  const first = new MockAdapter();
  setCharacterLibraryStoreForTests(first,store);
  const before = await first.getSnapshot();
  assert.equal(before.persistence?.durability,"volatile");
  assert.equal(before.persistence?.status,"ready");
  const item = before.activeCharacter.items.find((entry) => entry.id === "item.shield.aelar")!;
  const expected = !item.equipped;

  const committed = await first.toggleItemEquipped(item.id);
  assert.equal(committed.activeCharacter.items.find((entry) => entry.id === item.id)?.equipped,expected);
  assert.equal(committed.persistence?.storageRevision,1);
  const document = await latestDocument(store);
  const record = document.characters.find((entry) => entry.characterId === before.activeCharacter.id)!;
  assert.equal(record.sourceRevision,1);
  assert.equal(record.runtimeRevision,2);

  const second = new MockAdapter();
  setCharacterLibraryStoreForTests(second,store);
  const restored = await second.getSnapshot();
  assert.equal(restored.activeCharacter.items.find((entry) => entry.id === item.id)?.equipped,expected);
  assert.equal(restored.activeCharacter.runtimeRevision,2);
  assert.equal(restored.persistence?.storageRevision,1);
});

test("storage failure rolls direct ItemInstance mutation back instead of accepting unsaved state", async () => {
  const store = new MemoryCharacterLibraryStore();
  const adapter = new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,store);
  const before = await adapter.getSnapshot();
  const item = before.activeCharacter.items.find((entry) => entry.id === "item.shield.aelar")!;
  store.failNextWrite("disk full");

  const result = await adapter.toggleItemEquipped(item.id);
  assert.equal(result.activeCharacter.items.find((entry) => entry.id === item.id)?.equipped,item.equipped);
  assert.equal(result.persistence?.status,"error");
  assert.match(result.persistence?.message ?? "",/disk full/);
  assert.equal((await store.readGenerations()).length,0);
  assert.equal(getCharacterLibraryPersistenceStateForTests(adapter)?.document?.storageRevision,0);
});

test("persisted Character runtime state wins over the built-in scene projection during hydration", async () => {
  const store = new MemoryCharacterLibraryStore();
  const writer = new MockAdapter();
  setCharacterLibraryStoreForTests(writer,store);
  const initial = await writer.getSnapshot();
  const potion = initial.activeCharacter.items.find((entry) => entry.id === "item.potion.aelar")!;
  await writer.useItem(potion.id);

  const reader = new MockAdapter();
  setCharacterLibraryStoreForTests(reader,store);
  const restored = await reader.getSnapshot();
  assert.equal(restored.activeCharacter.items.find((entry) => entry.id === potion.id)?.quantity,potion.quantity - 1);
  const sceneEntity = restored.scene.entities.find((entry) => entry.id === restored.activeCharacter.id)!;
  assert.equal(sceneEntity.hp,restored.activeCharacter.hp);
  assert.equal(sceneEntity.tempHp,restored.activeCharacter.tempHp);
});

test("a production Character creation commit persists the new active Character and reloads it", async () => {
  const store = new MemoryCharacterLibraryStore();
  const writer = new MockAdapter();
  setCharacterLibraryStoreForTests(writer,store);
  await writer.getSnapshot();
  const ready = await prepareFighterCreation(writer,"Persisted Fighter");
  assert.equal(ready.creationPlan?.summary.blockingCount,0);
  assert.equal((await store.readGenerations()).length,0,"draft edits are not part of the Character library slice");

  const committed = await writer.finalizeCharacterDraft();
  assert.equal(committed.createDraft,null);
  assert.equal(committed.activeCharacter.name,"Persisted Fighter");
  assert.equal(committed.persistence?.storageRevision,1);
  const createdId = committed.activeCharacter.id;
  const document = await latestDocument(store);
  const record = document.characters.find((entry) => entry.characterId === createdId);
  assert.ok(record);
  assert.equal(record.sourceRevision,1);
  assert.equal(record.runtimeRevision,1);
  assert.equal(document.activeCharacterId,createdId);

  const reader = new MockAdapter();
  setCharacterLibraryStoreForTests(reader,store);
  const restored = await reader.getSnapshot();
  assert.equal(restored.activeCharacter.id,createdId);
  assert.equal(restored.activeCharacter.name,"Persisted Fighter");
  assert.equal(restored.activeCharacter.className,"파이터");
  assert.equal(restored.persistence?.storageRevision,1);
});

test("a failed Character creation save keeps the editable draft and previous active Character", async () => {
  const store = new MemoryCharacterLibraryStore();
  const adapter = new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,store);
  const initial = await adapter.getSnapshot();
  const ready = await prepareFighterCreation(adapter,"Unsaved Fighter");
  assert.equal(ready.creationPlan?.summary.blockingCount,0);
  const draftId = ready.createDraft!.id;
  store.failNextWrite("simulated creation save failure");

  const failed = await adapter.finalizeCharacterDraft();
  assert.equal(failed.activeCharacter.id,initial.activeCharacter.id);
  assert.equal(failed.createDraft?.id,draftId);
  assert.ok(failed.createDraft?.validation.some((entry) => /Character library 저장 실패/.test(entry.message)));
  assert.equal(failed.persistence?.status,"error");
  assert.equal((await store.readGenerations()).length,0);
});

test("the production Fighter 5 to 6 level-up persists source revision and reloads the committed sheet", async () => {
  const store = new MemoryCharacterLibraryStore();
  const writer = new MockAdapter();
  setCharacterLibraryStoreForTests(writer,store);
  await writer.getSnapshot();
  await writer.startLevelUp("char.aelar");
  let snapshot = await writer.getSnapshot();
  const choice = snapshot.progressionPlan?.choices.find((entry) => entry.kind === "asi-or-feat");
  assert.ok(choice);
  const progression = writer as unknown as Phase07AdapterCommands;
  await progression.setProgressionChoice(choice.id,{kind:"asi",mode:"plus-two",primary:"str"});
  snapshot = await writer.getSnapshot();
  assert.equal(snapshot.progressionPlan?.blocking.length,0);

  const committed = await writer.commitLevelUp();
  assert.equal(committed.activeCharacter.level,6);
  assert.equal(committed.activeCharacter.abilities.str,20);
  assert.equal(committed.activeCharacter.maxHp,51);
  assert.equal(committed.persistence?.storageRevision,1);
  const record = (await latestDocument(store)).characters.find((entry) => entry.characterId === "char.aelar")!;
  assert.equal(record.sourceRevision,2);
  assert.equal(record.runtimeRevision,1);

  const reader = new MockAdapter();
  setCharacterLibraryStoreForTests(reader,store);
  const restored = await reader.getSnapshot();
  assert.equal(restored.activeCharacter.level,6);
  assert.equal(restored.activeCharacter.abilities.str,20);
  assert.equal(restored.activeCharacter.maxHp,51);
  assert.equal(restored.activeCharacter.sourceRevision,2);
  assert.equal(restored.activeCharacter.runtimeRevision,1);
});
