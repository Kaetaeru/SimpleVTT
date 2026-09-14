import assert from "node:assert/strict";
import test from "node:test";
import { deriveCharacter } from "../../client/character/derive";
import { exportCharacterFile, importedRecord, looksLikeCharacterFile, parseCharacterFile, serializeCharacterFile } from "../../client/character/json";
import { initialRuntime, reconcileRuntime } from "../../client/character/runtime";
import { build, catalog, sourceOf } from "./support";

test("export → text → import round-trips the source and runtime, and the derived sheet is identical", () => {
  const { source, derived } = build({ species: "dwarf", background: "acolyte", classes: "cleric", level: 5 });
  const runtime = { ...initialRuntime(derived), hp: { current: 20, temp: 3, maxSeen: derived.hp.max }, slotsUsed: { 1: 2 }, resourcesUsed: { "resource.cleric.channel-divinity": 1 } };
  const file = exportCharacterFile(source, runtime, derived, "test");
  const text = serializeCharacterFile(file);
  assert.ok(looksLikeCharacterFile(JSON.parse(text)));
  const parsed = parseCharacterFile(text);
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.source, source);
  assert.deepEqual(parsed.runtime, runtime);
  assert.deepEqual(deriveCharacter(parsed.source!, catalog()), derived);
  assert.equal(file.summary?.classes[0], "클레릭 5");
  const record = importedRecord(parsed, derived, { newId: "char_copy" });
  assert.equal(record.source.id, "char_copy");
  assert.equal(record.runtime.characterId, "char_copy");
  assert.equal(record.runtime.hp.current, 20);
});

test("a bare source is accepted; a runtime-less file gets a fresh runtime", () => {
  const source = sourceOf({ classes: "fighter" });
  const parsed = parseCharacterFile(JSON.stringify(source));
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.source?.name, "테스트");
  assert.equal(parsed.runtime, undefined);
  const derived = deriveCharacter(parsed.source!, catalog());
  const record = importedRecord(parsed, derived);
  assert.equal(record.runtime.hp.current, derived.hp.max);
});

test("broken files report every structural problem at once", () => {
  assert.ok(parseCharacterFile("{").errors[0].includes("JSON"));
  assert.ok(parseCharacterFile([1, 2]).errors.length === 1);
  const bad = parseCharacterFile({ format: "simplevtt.character", schema: 1, source: { id: "", name: 3, origin: { speciesId: 1 }, abilities: { method: "dice", base: { str: "a" } }, tracks: [{ classId: "x", hp: { kind: "roll" } }, {}], choices: { ok: ["a"], nope: "a" }, equipment: { mode: "steal" } } });
  const text = bad.errors.join("\n");
  for (const needle of ["스키마 1", "source.id", "source.name", "source.rules", "origin.speciesId", "abilities.method", "abilities.base.str", "tracks[0].hp", "tracks[1]", "equipment.mode"]) assert.ok(text.includes(needle), `missing "${needle}" in:\n${text}`);
  assert.ok(bad.warnings.some((line) => line.includes("choices.nope")));
  assert.equal(bad.source, undefined);
  const wrong = parseCharacterFile({ format: "something-else", source: sourceOf({ classes: "fighter" }) });
  assert.ok(wrong.errors.some((line) => line.includes("파일 형식")));
  const tooLong = parseCharacterFile({ ...sourceOf({ classes: "fighter", level: 21 }) });
  assert.ok(tooLong.errors.some((line) => line.includes("20레벨")));
});

test("reconcileRuntime raises current HP with the maximum and clamps used pools to the new maxima", () => {
  const level1 = build({ classes: "wizard" });
  const runtime = { ...initialRuntime(level1.derived), hp: { current: 4, temp: 0, maxSeen: level1.derived.hp.max }, slotsUsed: { 1: 2, 2: 1 }, resourcesUsed: { "resource.wizard.arcane-recovery": 1, gone: 1 } };
  const level3 = build({ classes: "wizard", level: 3 }, level1.source.choices);
  const next = reconcileRuntime(runtime, level3.derived);
  assert.equal(next.hp.current, 4 + (level3.derived.hp.max - level1.derived.hp.max));
  assert.equal(next.hp.maxSeen, level3.derived.hp.max);
  assert.deepEqual(next.slotsUsed, { 1: 2, 2: 1 });
  assert.deepEqual(next.resourcesUsed, { "resource.wizard.arcane-recovery": 1 });
  const down = reconcileRuntime({ ...next, slotsUsed: { 1: 4, 2: 3 } }, level1.derived);
  assert.deepEqual(down.slotsUsed, { 1: 2 });
  assert.equal(down.hp.current, Math.min(level1.derived.hp.max, next.hp.current));
});
