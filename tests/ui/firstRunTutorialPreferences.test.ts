import assert from "node:assert/strict";
import test from "node:test";
import {
  FIRST_RUN_COMPLETION_STORAGE_KEY,
  FIRST_RUN_COMPLETION_VALUE,
  persistFirstRunCompletion,
  readFirstRunCompletion,
  type FirstRunStorage,
} from "../../src/app/firstRunPreferences";
import {
  DEFAULT_SHEET_LAYOUT,
  SHEET_LAYOUT_STORAGE_KEY,
  persistSheetLayoutPreference,
  readSheetLayoutPreference,
  readStoredSheetLayoutPreference,
  type SheetLayoutStorage,
} from "../../src/app/sheetLayoutPreferences";

function memoryStorage() {
  const values = new Map<string, string>();
  const storage: FirstRunStorage & SheetLayoutStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
  return { values, storage };
}

test("fresh local preferences require first-run Tutorial and have no explicit Sheet choice", () => {
  const { storage } = memoryStorage();
  assert.equal(readFirstRunCompletion(storage), false);
  assert.equal(readStoredSheetLayoutPreference(storage), null);
  assert.equal(readSheetLayoutPreference(storage), DEFAULT_SHEET_LAYOUT);
});

test("Tutorial completion and initial Sheet presentation persist independently", () => {
  const { values, storage } = memoryStorage();
  assert.equal(persistSheetLayoutPreference("official", storage), "official");
  assert.equal(persistFirstRunCompletion(storage), true);

  assert.equal(values.get(SHEET_LAYOUT_STORAGE_KEY), "official");
  assert.equal(values.get(FIRST_RUN_COMPLETION_STORAGE_KEY), FIRST_RUN_COMPLETION_VALUE);
  assert.equal(readStoredSheetLayoutPreference(storage), "official");
  assert.equal(readFirstRunCompletion(storage), true);
});

test("invalid or absent stored Sheet values do not pretend the owner selected a layout", () => {
  const { values, storage } = memoryStorage();
  values.set(SHEET_LAYOUT_STORAGE_KEY, "legacy-layout");
  assert.equal(readStoredSheetLayoutPreference(storage), null);
  assert.equal(readSheetLayoutPreference(storage), DEFAULT_SHEET_LAYOUT);
});

test("pre-contract installs without the new completion marker see Tutorial once", () => {
  const { values, storage } = memoryStorage();
  values.set("simplevtt.v1.guide.dismissed", "true");
  values.set(SHEET_LAYOUT_STORAGE_KEY, "simplevtt");

  assert.equal(readFirstRunCompletion(storage), false);
  assert.equal(readStoredSheetLayoutPreference(storage), "simplevtt");
});

test("storage failures degrade to safe local presentation defaults", () => {
  const storage: FirstRunStorage & SheetLayoutStorage = {
    getItem: () => { throw new Error("unavailable"); },
    setItem: () => { throw new Error("unavailable"); },
  };
  assert.equal(readFirstRunCompletion(storage), false);
  assert.equal(readStoredSheetLayoutPreference(storage), null);
  assert.equal(persistFirstRunCompletion(storage), true);
  assert.equal(persistSheetLayoutPreference("official", storage), "official");
});
