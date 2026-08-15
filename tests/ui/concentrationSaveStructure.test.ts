import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const bridge=readFileSync(new URL("../../src/ConcentrationSaveBridge.tsx",import.meta.url),"utf-8");
const adapter=readFileSync(new URL("../../src/app/phase09ConcentrationSaveAdapter.ts",import.meta.url),"utf-8");
const provider=readFileSync(new URL("../../src/app/AppProvider.tsx",import.meta.url),"utf-8");
const main=readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf-8");

test("concentration save bridge exposes an explicit d20 input through the normal adapter contract", () => {
  assert.match(bridge,/createPortal/);
  assert.match(bridge,/\.resolution-drawer/);
  assert.match(bridge,/submitConcentrationSaveD20/);
  assert.match(bridge,/type="number"/);
  assert.match(bridge,/min=\{1\}/);
  assert.match(bridge,/max=\{20\}/);
  assert.match(provider,/submitConcentrationSaveD20/);
  assert.match(main,/ConcentrationSaveBridge/);
});

test("concentration save UI displays authoritative output without owning DC or save-rule arithmetic", () => {
  assert.doesNotMatch(bridge,/concentrationCheckDc/);
  assert.doesNotMatch(bridge,/resolveConcentrationDamageCheck/);
  assert.doesNotMatch(bridge,/Math\.floor\(/);
  assert.match(bridge,/save\.natural/);
  assert.match(bridge,/save\.total/);
  assert.match(bridge,/save\.dc/);
  assert.match(bridge,/save\.outcome/);
  assert.match(bridge,/피해 적용 시 Rules Domain 계산/);
});

test("application layer delegates concentration save facts and resolution to existing authoritative boundaries", () => {
  assert.match(adapter,/resolveRuntimeSaveModifier/);
  assert.match(adapter,/resolveAtomicAttackTransaction/);
  assert.match(adapter,/resolveDamageRoll/);
  assert.match(adapter,/requires fixed concentration-check input/);
  assert.doesNotMatch(adapter,/concentrationCheckDc/);
  assert.doesNotMatch(adapter,/resolveConcentrationDamageCheck/);
});
