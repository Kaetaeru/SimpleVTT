import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { checkLegacyExecutionBoundary } from "../../scripts/check-legacy-execution-boundary.mjs";

function fixture(entries, imports) {
  const root = mkdtempSync(join(tmpdir(), "simplevtt-legacy-boundary-"));
  mkdirSync(join(root, ".agents"), { recursive: true });
  mkdirSync(join(root, "src", "app"), { recursive: true });
  writeFileSync(join(root, ".agents", "LEGACY_EXECUTION_BASELINE.json"), JSON.stringify({
    version: 2,
    compositionRoot: "src/app/offlineRuntimeAdapters.ts",
    entries,
  }));
  writeFileSync(
    join(root, "src", "app", "offlineRuntimeAdapters.ts"),
    imports.map((module) => `import "${module}";`).join("\n") + "\n",
  );
  return root;
}

const legacy = { module: "./barbarianRageRuntimeAdapter", classification: "LEGACY_EXECUTION" };
const generic = { module: "./productionPlayRuntimeAdapter", classification: "GENERIC_ENGINE" };

test("classified legacy and generic composition is accepted", () => {
  const root = fixture([legacy, generic], [legacy.module, generic.module]);
  try {
    assert.equal(checkLegacyExecutionBoundary(root).ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("legacy debt may shrink when composition and baseline shrink together", () => {
  const root = fixture([generic], [generic.module]);
  try {
    assert.equal(checkLegacyExecutionBoundary(root).ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("new composition import fails until explicitly classified", () => {
  const root = fixture([generic], [generic.module, "./wizardExampleRuntimeAdapter"]);
  try {
    const result = checkLegacyExecutionBoundary(root);
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, ["unclassified composition import: ./wizardExampleRuntimeAdapter"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("stale baseline and invalid classification fail", () => {
  const root = fixture([
    generic,
    { module: "./removedRuntimeAdapter", classification: "LEGACY_EXECUTION" },
    { module: "./badRuntimeAdapter", classification: "MAYBE" },
  ], [generic.module, "./badRuntimeAdapter"]);
  try {
    const result = checkLegacyExecutionBoundary(root);
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.sort(), [
      "./badRuntimeAdapter: invalid classification MAYBE",
      "stale baseline module: ./removedRuntimeAdapter",
    ].sort());
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
