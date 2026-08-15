import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const progression=readFileSync(new URL("../../src/app/progressionRuntimeAdapter.ts",import.meta.url),"utf8");
const rest=readFileSync(new URL("../../src/app/restSpellManagementRuntimeAdapter.ts",import.meta.url),"utf8");
const pact=readFileSync(new URL("../../src/app/pactTomeRuntimeAdapter.ts",import.meta.url),"utf8");
const circleLand=readFileSync(new URL("../../src/app/druidCircleLandSpellRuntimeAdapter.ts",import.meta.url),"utf8");
const resources=readFileSync(new URL("../../src/app/classFeatureSpellRuntimeAdapter.ts",import.meta.url),"utf8");

test("level-up and rest adapters use the shared ProgressionCharacterState projection/application service", () => {
  assert.match(progression,/projectProgressionCharacterState/);
  assert.match(progression,/applyProgressionCharacterState/);
  assert.doesNotMatch(progression,/function characterState\(/);
  assert.doesNotMatch(progression,/function applyCommittedSheet\(/);
  assert.match(rest,/projectProgressionCharacterState/);
  assert.match(rest,/applyProgressionCharacterState/);
  assert.doesNotMatch(rest,/function characterState\(/);
});

test("Pact Tome uses the shared projection with explicit tome-base exclusion and scoped write-back", () => {
  assert.match(pact,/projectProgressionCharacterState/);
  assert.match(pact,/excludePactTomeFromBaseSpells:true/);
  assert.match(pact,/applyProgressionCharacterState/);
  assert.match(pact,/scope:"pact-tome"/);
  assert.doesNotMatch(pact,/classByName/);
});

test("Circle Land remains an explicit separate rest-configuration revision domain instead of being forced into Character progression write-back", () => {
  assert.match(circleLand,/WeakMap<MockAdapter,Map<string,CircleLandSpellRestState>>/);
  assert.match(circleLand,/resolveCircleLandSpellRest/);
  assert.match(circleLand,/expectedRevision:previous\.revision/);
  assert.doesNotMatch(circleLand,/applyProgressionCharacterState/);
  assert.doesNotMatch(circleLand,/projectProgressionCharacterState/);
});

test("class feature resource materialization uses one non-refill upsert boundary", () => {
  assert.match(resources,/upsertCharacterResource/);
  assert.doesNotMatch(resources,/function upsertResource\(/);
});
