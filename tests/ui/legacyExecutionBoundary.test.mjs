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
    version: 1,
    legacyExecutionAdapters: ["src/app/barbarianRageRuntimeAdapter.ts"],
    contentPresentationExceptions: ["src/app/druidCircleLandSpellRuntimeAdapter.ts"],
  }));
  return root;
}

function touch(root, path) {
  writeFileSync(join(root, "src", "app", path), "export {};\n");
}

test("grandfathered named execution may remain or shrink", () => {
  const root = fixture();
  try {
    touch(root, "barbarianRageRuntimeAdapter.ts");
    touch(root, "productionPlayRuntimeAdapter.ts");
    assert.equal(checkLegacyExecutionBoundary(root).ok, true);
    rmSync(join(root, "src", "app", "barbarianRageRuntimeAdapter.ts"));
    assert.equal(checkLegacyExecutionBoundary(root).ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("explicit content/presentation exception is allowed", () => {
  const root = fixture();
  try {
    touch(root, "druidCircleLandSpellRuntimeAdapter.ts");
    assert.equal(checkLegacyExecutionBoundary(root).ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("new class/subclass named runtime adapter fails", () => {
  const root = fixture();
  try {
    touch(root, "wizardExampleRuntimeAdapter.ts");
    const result = checkLegacyExecutionBoundary(root);
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, [
      "src/app/wizardExampleRuntimeAdapter.ts: new class/subclass-named runtime adapter is not inventoried",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
