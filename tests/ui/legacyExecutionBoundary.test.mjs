import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { checkLegacyExecutionBoundary } from "../../scripts/check-legacy-execution-boundary.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "simplevtt-legacy-boundary-"));
  mkdirSync(join(root, ".agents"), { recursive: true });
  mkdirSync(join(root, "src", "app"), { recursive: true });
  writeFileSync(join(root, ".agents", "LEGACY_EXECUTION_BASELINE.json"), JSON.stringify({
    version: 2,
    legacyExecutionAdapters: ["src/app/barbarianRageRuntimeAdapter.ts"],
    contentPresentationAdapters: ["src/app/spellPresentationRuntimeAdapter.ts"],
    genericInfrastructureAdapters: ["src/app/connectedSessionRuntimeAdapter.ts"],
    unclearAdapters: ["src/app/exampleRuntimeAdapter.ts"],
  }));
  return root;
}

function touch(root, name) {
  writeFileSync(join(root, "src", "app", name), "export {};\n");
}

test("classified runtime adapters may remain or shrink", () => {
  const root = fixture();
  try {
    touch(root, "barbarianRageRuntimeAdapter.ts");
    touch(root, "spellPresentationRuntimeAdapter.ts");
    touch(root, "connectedSessionRuntimeAdapter.ts");
    touch(root, "exampleRuntimeAdapter.ts");
    assert.equal(checkLegacyExecutionBoundary(root).ok, true);
    rmSync(join(root, "src", "app", "barbarianRageRuntimeAdapter.ts"));
    assert.equal(checkLegacyExecutionBoundary(root).ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("new unclassified runtime adapter fails", () => {
  const root = fixture();
  try {
    touch(root, "wizardExampleRuntimeAdapter.ts");
    const result = checkLegacyExecutionBoundary(root);
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, [
      "src/app/wizardExampleRuntimeAdapter.ts: runtime adapter is not inventoried",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the same runtime adapter cannot have two classifications", () => {
  const root = fixture();
  try {
    writeFileSync(join(root, ".agents", "LEGACY_EXECUTION_BASELINE.json"), JSON.stringify({
      version: 2,
      legacyExecutionAdapters: ["src/app/barbarianRageRuntimeAdapter.ts"],
      genericInfrastructureAdapters: ["src/app/barbarianRageRuntimeAdapter.ts"],
    }));
    touch(root, "barbarianRageRuntimeAdapter.ts");
    const result = checkLegacyExecutionBoundary(root);
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, [
      "src/app/barbarianRageRuntimeAdapter.ts: classified twice (legacyExecutionAdapters, genericInfrastructureAdapters)",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
