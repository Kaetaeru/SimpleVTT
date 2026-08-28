import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RUNTIME_ADAPTER = /RuntimeAdapter\.ts$/;
const CLASSIFICATION_KEYS = [
  "legacyExecutionAdapters",
  "contentPresentationAdapters",
  "genericInfrastructureAdapters",
  "unclearAdapters",
];

export function scanRuntimeAdapters(repoRoot) {
  const appRoot = join(repoRoot, "src", "app");
  if (!existsSync(appRoot)) return [];
  return readdirSync(appRoot)
    .filter((name) => RUNTIME_ADAPTER.test(name))
    .map((name) => relative(repoRoot, join(appRoot, name)).replaceAll("\\", "/"))
    .sort();
}

export function checkLegacyExecutionBoundary(repoRoot) {
  const baselinePath = join(repoRoot, ".agents", "LEGACY_EXECUTION_BASELINE.json");
  const detected = scanRuntimeAdapters(repoRoot);
  if (!existsSync(baselinePath)) {
    return { ok: false, errors: [`missing baseline: ${baselinePath}`], detected };
  }

  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const classifiedBy = new Map();
  const errors = [];

  for (const key of CLASSIFICATION_KEYS) {
    for (const path of baseline[key] ?? []) {
      const previous = classifiedBy.get(path);
      if (previous) errors.push(`${path}: classified twice (${previous}, ${key})`);
      else classifiedBy.set(path, key);
    }
  }

  for (const path of detected) {
    if (!classifiedBy.has(path)) errors.push(`${path}: runtime adapter is not inventoried`);
  }

  return {
    ok: errors.length === 0,
    errors,
    detected,
    classifications: Object.fromEntries(CLASSIFICATION_KEYS.map((key) => [key, [...(baseline[key] ?? [])].sort()])),
  };
}

const self = fileURLToPath(import.meta.url);
if (resolve(process.argv[1] ?? "") === self) {
  const repoRoot = resolve(dirname(self), "..");
  const result = checkLegacyExecutionBoundary(repoRoot);
  if (!result.ok) {
    console.error("Legacy execution boundary drift detected:");
    for (const error of result.errors) console.error(`- ${error}`);
    console.error("\nDetected runtime adapters:");
    for (const path of result.detected) console.error(`- ${path}`);
    process.exitCode = 1;
  } else {
    console.log(`Legacy execution boundary OK: ${result.detected.length} runtime adapter(s) classified; grandfathered debt may shrink but no unreviewed adapter may appear.`);
  }
}
