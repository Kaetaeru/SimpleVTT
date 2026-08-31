import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { checkLegacyExecutionBoundary } from "../../scripts/check-legacy-execution-boundary.mjs";

function fixture(entries, imports, { transitiveEntries = [], namedFiles = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), "simplevtt-legacy-boundary-"));
  mkdirSync(join(root, ".agents"), { recursive: true });
  mkdirSync(join(root, "src", "app"), { recursive: true });
  writeFileSync(join(root, ".agents", "LEGACY_EXECUTION_BASELINE.json"), JSON.stringify({
    version: 3,
    compositionRoot: "src/app/offlineRuntimeAdapters.ts",
    entries,
    transitiveEntries,
  }));
  writeFileSync(
    join(root, "src", "app", "offlineRuntimeAdapters.ts"),
    imports.map((module) => `import "${module}";`).join("\n") + "\n",
  );
  for (const path of namedFiles) {
    const name = path.replace(/^src\/app\//, "");
    writeFileSync(join(root, "src", "app", name), "export {};\n");
  }
  return root;
}

const legacy = { module: "./barbarianRageRuntimeAdapter", classification: "LEGACY_EXECUTION" };
const generic = { module: "./phase09RealResolutionAdapter", classification: "GENERIC_ENGINE" };
const transitiveLegacy = {
  path: "src/app/bardicInspirationRuntimeAdapter.ts",
  classification: "LEGACY_EXECUTION",
};

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

test("classified transitive named runtime adapter is accepted", () => {
  const root = fixture([generic], [generic.module], {
    transitiveEntries: [transitiveLegacy],
    namedFiles: [transitiveLegacy.path],
  });
  try {
    assert.equal(checkLegacyExecutionBoundary(root).ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("new transitive named runtime adapter fails until explicitly classified", () => {
  const root = fixture([generic], [generic.module], {
    namedFiles: [transitiveLegacy.path],
  });
  try {
    const result = checkLegacyExecutionBoundary(root);
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, [
      "unclassified named runtime adapter: src/app/bardicInspirationRuntimeAdapter.ts",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("UNCLEAR classification cannot close the production boundary", () => {
  const unclear = { module: "./characterCreationV10Adapter", classification: "UNCLEAR" };
  const root = fixture([unclear], [unclear.module]);
  try {
    const result = checkLegacyExecutionBoundary(root);
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, ["./characterCreationV10Adapter: unresolved UNCLEAR classification"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("stale baseline and invalid classification fail", () => {
  const root = fixture([
    generic,
    { module: "./removedRuntimeAdapter", classification: "LEGACY_EXECUTION" },
    { module: "./badRuntimeAdapter", classification: "MAYBE" },
  ], [generic.module, "./badRuntimeAdapter"], {
    transitiveEntries: [transitiveLegacy],
  });
  try {
    const result = checkLegacyExecutionBoundary(root);
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.sort(), [
      "./badRuntimeAdapter: invalid classification MAYBE",
      "stale baseline module: ./removedRuntimeAdapter",
      "stale transitive baseline path: src/app/bardicInspirationRuntimeAdapter.ts",
    ].sort());
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
