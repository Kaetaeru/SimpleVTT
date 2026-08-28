import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CLASSIFICATIONS = new Set([
  "CONTENT/PRESENTATION",
  "LEGACY_EXECUTION",
  "GENERIC_ENGINE",
  "UNCLEAR",
]);

export function scanExecutionComposition(source) {
  const modules = [];
  const pattern = /(?:^|\n)\s*import\s+["'](\.\/[^"']+)["'];/g;
  for (const match of source.matchAll(pattern)) modules.push(match[1]);
  return modules;
}

export function checkLegacyExecutionBoundary(repoRoot) {
  const compositionPath = join(repoRoot, "src", "app", "offlineRuntimeAdapters.ts");
  const baselinePath = join(repoRoot, ".agents", "LEGACY_EXECUTION_BASELINE.json");
  const errors = [];
  if (!existsSync(compositionPath)) return { ok: false, errors: [`missing composition root: ${compositionPath}`] };
  if (!existsSync(baselinePath)) return { ok: false, errors: [`missing baseline: ${baselinePath}`] };

  const actual = scanExecutionComposition(readFileSync(compositionPath, "utf8"));
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  if (baseline.compositionRoot !== "src/app/offlineRuntimeAdapters.ts") {
    errors.push(`unexpected baseline compositionRoot: ${baseline.compositionRoot ?? "<missing>"}`);
  }

  const entries = Array.isArray(baseline.entries) ? baseline.entries : [];
  const expected = [];
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.module !== "string") {
      errors.push("baseline entry missing module");
      continue;
    }
    if (seen.has(entry.module)) errors.push(`duplicate baseline module: ${entry.module}`);
    seen.add(entry.module);
    expected.push(entry.module);
    if (!CLASSIFICATIONS.has(entry.classification)) {
      errors.push(`${entry.module}: invalid classification ${entry.classification ?? "<missing>"}`);
    }
  }

  const actualDuplicates = actual.filter((module, index) => actual.indexOf(module) !== index);
  for (const module of [...new Set(actualDuplicates)]) errors.push(`duplicate composition import: ${module}`);

  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  for (const module of [...actualSet].sort()) {
    if (!expectedSet.has(module)) errors.push(`unclassified composition import: ${module}`);
  }
  for (const module of [...expectedSet].sort()) {
    if (!actualSet.has(module)) errors.push(`stale baseline module: ${module}`);
  }

  return { ok: errors.length === 0, errors, actual, entries };
}

const self = fileURLToPath(import.meta.url);
if (resolve(process.argv[1] ?? "") === self) {
  const repoRoot = resolve(dirname(self), "..");
  const result = checkLegacyExecutionBoundary(repoRoot);
  if (!result.ok) {
    console.error("Legacy execution composition boundary drift detected:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    const counts = Object.fromEntries([...CLASSIFICATIONS].map((classification) => [
      classification,
      result.entries.filter((entry) => entry.classification === classification).length,
    ]));
    console.log(`Legacy execution composition boundary OK: ${result.actual.length} classified import(s).`);
    console.log(Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(" · "));
  }
}
