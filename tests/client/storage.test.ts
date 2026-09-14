import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { IndexedDbStore, MemoryStore, openClientStore, type CharacterRecord, type ClientStore } from "../../client/storage/store";
import { initialRuntime } from "../../client/character/runtime";
import { build } from "./support";

function record(name: string, level = 1): CharacterRecord {
  const { source, derived } = build({ name, classes: "fighter", level });
  return { id: source.id, source, runtime: initialRuntime(derived), savedAt: new Date(Date.UTC(2026, 0, level)).toISOString() };
}

async function exercise(store: ClientStore) {
  const a = record("가");
  const b = record("나", 2);
  await store.putCharacter(a);
  await store.putCharacter(b);
  const listed = await store.listCharacters();
  assert.deepEqual(listed.map((item) => item.source.name), ["나", "가"], "newest first");
  assert.deepEqual(await store.getCharacter(a.id), a);
  await store.putCharacter({ ...a, source: { ...a.source, name: "가2" }, savedAt: new Date(Date.UTC(2026, 0, 9)).toISOString() });
  assert.equal((await store.getCharacter(a.id))?.source.name, "가2");
  assert.equal((await store.listCharacters())[0].id, a.id);
  await store.deleteCharacter(b.id);
  assert.equal((await store.listCharacters()).length, 1);
  assert.equal(await store.getCharacter(b.id), undefined);
  await store.putModule({ moduleId: "m1", module: { moduleId: "m1", content: [] }, installedAt: "2026-01-01T00:00:00Z", fileName: "m1.json" });
  await store.putModule({ moduleId: "m0", module: { moduleId: "m0", content: [] }, installedAt: "2025-12-31T00:00:00Z" });
  assert.deepEqual((await store.listModules()).map((item) => item.moduleId), ["m0", "m1"]);
  await store.deleteModule("m0");
  assert.deepEqual((await store.listModules()).map((item) => item.moduleId), ["m1"]);
  assert.equal(await store.getSetting("theme"), undefined);
  await store.putSetting("theme", { dark: true });
  assert.deepEqual(await store.getSetting("theme"), { dark: true });
}

test("MemoryStore keeps copies, not references", async () => {
  const store = new MemoryStore();
  await exercise(store);
  const a = (await store.listCharacters())[0];
  a.source.name = "mutated";
  assert.notEqual((await store.getCharacter(a.id))?.source.name, "mutated");
});

test("IndexedDbStore persists across reopen on the same database", async () => {
  const factory = new IDBFactory();
  const store = await IndexedDbStore.open(factory);
  assert.equal(store.kind, "indexeddb");
  await exercise(store);
  const again = await IndexedDbStore.open(factory);
  assert.equal((await again.listCharacters()).length, 1);
  assert.deepEqual((await again.listModules()).map((item) => item.moduleId), ["m1"]);
  assert.deepEqual(await again.getSetting("theme"), { dark: true });
});

test("openClientStore falls back to memory without IndexedDB", async () => {
  const store = await openClientStore(undefined);
  assert.equal(store.kind, "memory");
  const withDb = await openClientStore(new IDBFactory());
  assert.equal(withDb.kind, "indexeddb");
});
