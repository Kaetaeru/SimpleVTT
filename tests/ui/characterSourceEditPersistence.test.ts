import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/characterCreationSourceEditAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import {
  decodeCharacterLibraryV1,
  materializeCharacterRecordV1,
} from "../../src/app/characterLibraryPersistence";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import { classIdFromName, classMeta } from "../../src/app/characterCreationV10Data";
import type { CharacterCreationSection } from "../../src/app/contracts";

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

async function prepareExplicitFighter(adapter:MockAdapter,name:string) {
  await adapter.createCharacterDraft("guided");
  await adapter.updateCharacterDraft({type:"set-name",value:name});
  await adapter.updateCharacterDraft({type:"set-species",value:"드워프"});
  await adapter.updateCharacterDraft({type:"set-background",value:"범죄자"});
  await adapter.updateCharacterDraft({type:"set-class",value:"파이터"});
  await adapter.updateCharacterDraft({type:"set-ability-method",value:"rolled"});
  await adapter.updateCharacterDraft({type:"roll-abilities",value:0});
  await adapter.updateCharacterDraft({type:"set-notes",value:"canonical-source-note"});
  await adapter.updateCharacterDraft({type:"set-override",field:"speed",value:35});

  const plan = (await adapter.getSnapshot()).creationPlan;
  const equipment = plan?.sections.find((section) => section.id === "class-equipment");
  const nonDefault = equipment?.options.at(-1);
  if (nonDefault) await adapter.updateCharacterDraft({type:"set-equipment",value:nonDefault.id});
  return fillCurrentCreationDraft(adapter);
}

test("new Character persists explicit authoring source and reopens exact roll/equipment intent after reload", async () => {
  const store = new MemoryCharacterLibraryStore();
  const writer = new MockAdapter();
  setCharacterLibraryStoreForTests(writer,store);
  await writer.getSnapshot();
  const ready = await prepareExplicitFighter(writer,"Source Fighter");
  assert.equal(ready.creationPlan?.summary.blockingCount,0);
  const expected = structuredClone(ready.createDraft!);

  const committed = await writer.finalizeCharacterDraft();
  const characterId = committed.activeCharacter.id;
  const document = await latestDocument(store);
  const record = document.characters.find((entry) => entry.characterId === characterId)!;
  assert.equal(record.source.creationAuthoring?.completeness,"explicit");
  assert.equal(record.source.creationAuthoring?.abilityMethod,"rolled");
  assert.deepEqual(record.source.creationAuthoring?.rolledPool,expected.rolledPool);
  assert.deepEqual(record.source.creationAuthoring?.rolledAssignments,expected.rolledAssignments);
  assert.equal(record.source.creationAuthoring?.equipmentPreset,expected.equipmentPreset);
  assert.deepEqual(record.source.creationAuthoring?.overrides,expected.overrides);
  assert.equal(record.source.build.notes,"canonical-source-note");

  const poisoned = structuredClone(record);
  poisoned.materializedCache.sheet.creationAuthoringSource = {
    ...structuredClone(record.source.creationAuthoring!),
    abilityMethod:"custom",
    equipmentPreset:"poisoned-cache-value",
  };
  const sourceWins = materializeCharacterRecordV1(poisoned);
  assert.equal(sourceWins.creationAuthoringSource?.abilityMethod,"rolled");
  assert.equal(sourceWins.creationAuthoringSource?.equipmentPreset,expected.equipmentPreset);

  const reader = new MockAdapter();
  setCharacterLibraryStoreForTests(reader,store);
  await reader.getSnapshot();
  const reopened = await reader.editCharacterDraft(characterId);
  assert.equal(reopened.createDraft?.authoringSourceCompleteness,"explicit");
  assert.equal(reopened.createDraft?.abilityMethod,"rolled");
  assert.deepEqual(reopened.createDraft?.rolledPool,expected.rolledPool);
  assert.deepEqual(reopened.createDraft?.rolledAssignments,expected.rolledAssignments);
  assert.equal(reopened.createDraft?.equipmentPreset,expected.equipmentPreset);
  assert.deepEqual(reopened.createDraft?.selectedSkills,expected.selectedSkills);
  assert.deepEqual(reopened.createDraft?.choiceSelections,expected.choiceSelections);
  assert.deepEqual(reopened.createDraft?.overrides,expected.overrides);
  assert.equal(reopened.createDraft?.notes,"canonical-source-note");
  assert.ok(!reopened.createDraft?.validation.some((entry) => /이전 기록/.test(entry.message)));
});

test("source-only Character edit increments source revision once and preserves the durable runtime projection", async () => {
  const store = new MemoryCharacterLibraryStore();
  const adapter = new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,store);
  await adapter.getSnapshot();
  await prepareExplicitFighter(adapter,"Runtime Preserved");
  const created = await adapter.finalizeCharacterDraft();
  const characterId = created.activeCharacter.id;
  const item = created.activeCharacter.items[0];
  assert.ok(item);
  await adapter.toggleItemEquipped(item.id);

  const before = (await latestDocument(store)).characters.find((entry) => entry.characterId === characterId)!;
  const runtimeBefore = structuredClone(before.runtime);
  const sourceRevisionBefore = before.sourceRevision;
  const runtimeRevisionBefore = before.runtimeRevision;

  const edit = await adapter.editCharacterDraft(characterId);
  assert.equal(edit.createDraft?.authoringSourceCompleteness,"explicit");
  await adapter.updateCharacterDraft({type:"set-name",value:"Runtime Preserved Renamed"});
  const saved = await adapter.finalizeCharacterDraft();
  assert.equal(saved.activeCharacter.name,"Runtime Preserved Renamed");

  const after = (await latestDocument(store)).characters.find((entry) => entry.characterId === characterId)!;
  assert.equal(after.sourceRevision,sourceRevisionBefore+1);
  assert.equal(after.runtimeRevision,runtimeRevisionBefore);
  assert.deepEqual(after.runtime,runtimeBefore);
});

test("legacy Character edit is explicitly marked as reconstructed instead of claiming canonical authoring input", async () => {
  const store = new MemoryCharacterLibraryStore();
  const adapter = new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,store);
  const initial = await adapter.getSnapshot();
  assert.equal(initial.activeCharacter.creationAuthoringSource?.completeness,"legacy-reconstructed");

  const reopened = await adapter.editCharacterDraft(initial.activeCharacter.id);
  assert.equal(reopened.createDraft?.authoringSourceCompleteness,"legacy-reconstructed");
  assert.ok(reopened.createDraft?.validation.some((entry) => entry.severity === "warning" && /이전 기록/.test(entry.message)));
  assert.ok(reopened.creationPlan?.validation.some((entry) => entry.severity === "warning" && /이전 기록/.test(entry.message)));
});
