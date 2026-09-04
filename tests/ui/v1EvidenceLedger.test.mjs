import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { LEDGER_PATH, checkV1EvidenceLedger, computeScore, validateV1EvidenceLedger } from "../../scripts/check-v1-evidence-ledger.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function ledgerFixture() {
  return JSON.parse(readFileSync(join(repoRoot, LEDGER_PATH), "utf8"));
}

test("the committed ledger validates on the current tree", () => {
  const result = checkV1EvidenceLedger(repoRoot);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

test("weighted score follows the roadmap formula", () => {
  const ledger = ledgerFixture();
  assert.equal(computeScore(ledger.gates), ledger.officialScore);
  assert.equal(computeScore(ledger.gates.map((gate) => ({ ...gate, status: "PASS" }))), 100);
  assert.equal(computeScore(ledger.gates.map((gate) => ({ ...gate, status: "PENDING" }))), 0);
});

test("a misspelled gate field is rejected", () => {
  const ledger = ledgerFixture();
  const gate = ledger.gates[0];
  delete gate.remainingGap;
  gate.remaingGap = null;
  const result = validateV1EvidenceLedger(ledger);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error === `${gate.id}: unknown field remaingGap`));
  assert.ok(result.errors.some((error) => error === `${gate.id}: missing field remainingGap`));
});

test("a stale official score is rejected", () => {
  const ledger = ledgerFixture();
  ledger.officialScore = ledger.officialScore + 1;
  const result = validateV1EvidenceLedger(ledger);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith("officialScore is")));
});

test("counts must match the gate list", () => {
  const ledger = ledgerFixture();
  const pending = ledger.gates.find((gate) => gate.status === "PENDING");
  pending.status = "PASS";
  pending.lastVerifiedSha = ledger.createdFromSha;
  pending.evidence.sources = ["fixture"];
  const result = validateV1EvidenceLedger(ledger);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith("counts.pass is")));
  assert.ok(result.errors.some((error) => error.startsWith("counts.pending is")));
});

test("PASS gates need an exact SHA and evidence", () => {
  const ledger = ledgerFixture();
  const passed = ledger.gates.find((gate) => gate.status === "PASS");
  passed.lastVerifiedSha = "abc123";
  passed.evidence.sources = [];
  const result = validateV1EvidenceLedger(ledger);
  assert.ok(result.errors.includes(`${passed.id}: PASS requires a full 40-hex lastVerifiedSha`));
  assert.ok(result.errors.includes(`${passed.id}: PASS requires at least one evidence source`));
});
