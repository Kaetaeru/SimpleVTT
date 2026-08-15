import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const adapter=readFileSync(new URL("../../src/app/characterCreationV10Adapter.ts",import.meta.url),"utf8");
const plan=readFileSync(new URL("../../src/app/characterCreationV10Plan.ts",import.meta.url),"utf8");
const shared=readFileSync(new URL("../../src/app/characterCreationChoiceDefinition.ts",import.meta.url),"utf8");
const app=readFileSync(new URL("../../src/App.tsx",import.meta.url),"utf8");
const creationUi=readFileSync(new URL("../../src/CharacterCreateV10.tsx",import.meta.url),"utf8");

test("creation Plan and Adapter consume the shared ChoiceDefinition boundary", () => {
  assert.match(plan,/creationChoiceDefinitions/);
  assert.match(plan,/validateCreationChoiceDefinitions/);
  assert.match(adapter,/normalizeCreationChoiceSelections/);
  assert.match(adapter,/toggleCreationChoiceSelection/);
  assert.doesNotMatch(plan,/creationChoiceSpecs/);
  assert.doesNotMatch(adapter,/normalizeChoiceSelections/);
  assert.doesNotMatch(adapter,/toggleChoiceSelection/);
});

test("shared creation adapter delegates validation to the domain ChoiceDefinition validator", () => {
  assert.match(shared,/from "\.\.\/domain\/choiceDefinition"/);
  assert.match(shared,/validateChoiceDefinitions/);
  assert.match(shared,/ChoiceSelectionMap/);
  assert.doesNotMatch(shared,/능력치 향상\/재주 선택 형식/);
  assert.doesNotMatch(shared,/같은 선택지를 중복 선택할 수 없습니다/);
});

test("React creation UI remains presentation-only for ChoiceDefinition validation", () => {
  assert.doesNotMatch(app,/validateChoiceDefinitions/);
  assert.doesNotMatch(creationUi,/validateChoiceDefinitions/);
  assert.doesNotMatch(app,/creationChoiceDefinitions/);
  assert.doesNotMatch(creationUi,/creationChoiceDefinitions/);
});
