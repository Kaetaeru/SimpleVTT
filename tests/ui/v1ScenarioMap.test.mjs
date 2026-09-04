import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { FAMILY_SIZES, SCENARIO_MAP_PATH, buildScenarioMap, expandLink, validateScenarioMap } from "../../scripts/generate-v1-scenario-map.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("the committed scenario map is derived from the catalog, roadmap, and ledger on the current tree", () => {
  const built = buildScenarioMap(repoRoot);
  const committed = JSON.parse(readFileSync(join(repoRoot, SCENARIO_MAP_PATH), "utf8"));
  assert.deepEqual(committed, built, "run node scripts/generate-v1-scenario-map.mjs");
  assert.deepEqual(validateScenarioMap(built), { ok: true, errors: [] });
});

test("all 120 catalog scenarios map to at least one roadmap gate with the family split fixed by the roadmap", () => {
  const map = buildScenarioMap(repoRoot);
  assert.equal(map.counts.scenarios, 120);
  assert.deepEqual(map.counts.families, FAMILY_SIZES);
  assert.equal(map.scenarios.filter((entry) => entry.status === "UNMAPPED").length, 0);
  assert.equal(map.gates.length, 72);
});

test("roadmap link shorthand expands to exact scenario ids", () => {
  const ids = buildScenarioMap(repoRoot).scenarios.map((entry) => entry.id);
  assert.deepEqual(expandLink("MP-B05~B07", ids).scenarios, ["MP-B05", "MP-B06", "MP-B07"]);
  assert.deepEqual(expandLink("MP-H", ids).scenarios.length, 12);
  assert.deepEqual(expandLink("MP-E~G", ids).scenarios.length, 14 + 10 + 9);
  assert.deepEqual(expandLink("MP-01~MP-04", ids).issues, ["MP-01", "MP-02", "MP-03", "MP-04"]);
  assert.deepEqual(expandLink("MP-J05", ids).scenarios, ["MP-J05"]);
  assert.deepEqual(expandLink("V1-60", ids), { scenarios: [], other: ["V1-60"] });
});

test("scenario status follows gate evidence: WIN scenarios stay AUTO_ONLY until a Windows artifact exists", () => {
  const map = buildScenarioMap(repoRoot);
  for (const entry of map.scenarios) {
    const gates = map.gates.filter((gate) => entry.gates.includes(gate.id));
    const pass = gates.filter((gate) => gate.status === "PASS");
    const win = pass.some((gate) => gate.windowsArtifacts.length > 0);
    const expected = pass.length === 0 ? "PENDING" : entry.evidence.includes("WIN") && !win ? "AUTO_ONLY" : "PASS";
    assert.equal(entry.status, expected, entry.id);
  }
});

test("validation rejects a map that drops a family or a gate mapping", () => {
  const map = buildScenarioMap(repoRoot);
  const missingScenario = structuredClone(map);
  missingScenario.scenarios = missingScenario.scenarios.filter((entry) => entry.id !== "MP-A01");
  assert.equal(validateScenarioMap(missingScenario).ok, false);
  const orphan = structuredClone(map);
  orphan.scenarios[0].gates = [];
  assert.ok(validateScenarioMap(orphan).errors.some((error) => error.endsWith("no owning gate")));
});
