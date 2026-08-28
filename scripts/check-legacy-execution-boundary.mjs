import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const NAMED_RUNTIME_ADAPTER = /^(?:barbarian|bard(?:College|ic)?|cleric|druid|fighter|monk|paladin|ranger|rogue|sorcerer|sorcery|warlock|wizard|subclass).*RuntimeAdapter\.ts$/;

export function scanNamedRuntimeAdapters(repoRoot) {
  const appRoot = join(repoRoot, "src", "app");
  if (!existsSync(appRoot)) return [];
  return readdirSync(appRoot)
    .filter((name) => NAMED_RUNTIME_ADAPTER.test(name))
    .map((name) => relative(repoRoot, join(appRoot, name)).replaceAll("\\", "/"))
    .sort();
}

export function checkLegacyExecutionBoundary(repoRoot) {
  const baselinePath = join(repoRoot, ".agents", "LEGACY_EXECUTION_BASELINE.json");
  const detected = scanNamedRuntimeAdapters(repoRoot);
  if (!existsSync(baselinePath)) {
    return { ok: false, errors: [`missing baseline: ${baselinePath}`], detected };
  }

  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const grandfathered = new Set(baseline.legacyExecutionAdapters ?? []);
  const exceptions = new Set(baseline.contentPresentationExceptions ?? []);
  const unexpected = detected.filter((path) => !grandfathered.has(path) && !exceptions.has(path));
  const errors = unexpected.map((path) => `${path}: new class/subclass-named runtime adapter is not inventoried`);
  return { ok: errors.length === 0, errors, detected, grandfathered: [...grandfathered].sort(), exceptions: [...exceptions].sort() };
}

const self = fileURLToPath(import.meta.url);
if (resolve(process.argv[1] ?? "") === self) {
  const repoRoot = resolve(dirname(self), "..");
  const result = checkLegacyExecutionBoundary(repoRoot);
  if (!result.ok) {
    console.error("Legacy named-execution boundary drift detected:");
    for (const error of result.errors) console.error(`- ${error}`);
    console.error("\nDetected class/subclass-named runtime adapters:");
    for (const path of result.detected) console.error(`- ${path}`);
    process.exitCode = 1;
  } else {
    console.log(`Legacy named-execution boundary OK: ${result.detected.length} detected adapter(s); grandfathered debt may shrink but not grow.`);
  }
}
