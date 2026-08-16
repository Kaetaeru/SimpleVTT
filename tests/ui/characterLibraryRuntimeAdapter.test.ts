import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import { decodeCharacterLibraryV1 } from "../../src/app/characterLibraryPersistence";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import {
  getCharacterLibraryPersistenceStateForTests,
  setCharacterLibraryStoreForTests,
} from "../../src/app/characterLibraryRuntimeAdapter";

async function latestDocument(store:MemoryCharacterLibraryStore) {
  const generations = await store.readGenerations();
  assert.ok(generations[0]?.payload);
  return decodeCharacterLibraryV1(generations[0].payload!);
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
