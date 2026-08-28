import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CLASSIFICATIONS = new Set([
  "CONTENT/PRESENTATION",
  "LEGACY_EXECUTION",
  "GENERIC_ENGINE",
  "UNCLEAR",
]);

const NAMED_RUNTIME_ADAPTER = /^(?:barbarian|bard(?:College|ic)?|cleric|druid|fighter|monk|paladin|ranger|rogue|sorcerer|sorcery|warlock|wizard|subclass).*RuntimeAdapter\.ts$/;

export function scanExecutionComposition(source) {
  const modules = [];
  const pattern = /(?:^|\n)\s*import\s+["'](\.\/[^"']+)["'];/g;
  for (const match of source.matchAll(pattern)) modules.push(match[1]);
  return modules;
}

export function scanNamedRuntimeAdapters(repoRoot) {
  const appRoot = join(repoRoot, "src", "app");
  if (!existsSync(appRoot)) return [];
  return readdirSync(appRoot)
    .filter((name) => NAMED_RUNTIME_ADAPTER.test(name))
    .map((name) => `src/app/${name}`)
    .sort();
}

function modulePath(module) {
  const relative = module.startsWith("./") ? module.slice(2) : module;
  return `src/app/${relative.endsWith(".ts") ? relative : `${relative}.ts`}`;
}

function validateClassification(errors, label, classification) {
  if (!CLASSIFICATIONS.has(classification)) {
    errors.push(`${label}: invalid classification ${classification ?? "<missing>"}`);
  } else if (classification === "UNCLEAR") {
    errors.push(`${label}: unresolved UNCLEAR classification`);
  }
}

export function checkLegacyExecutionBoundary(repoRoot) {
  const compositionPath = join(repoRoot, "src", "app", "offlineRuntimeAdapters.ts");
  const baselinePath = join(repoRoot, ".agents", "LEGACY_EXECUTION_BASELINE.json");
  const errors = [];
  if (!existsSync(compositionPath)) return { ok: false, errors: [`missing composition root: ${compositionPath}`] };
  if (!existsSync(baselinePath)) return { ok: false, errors: [`missing baseline: ${baselinePath}`] };

  const actual = scanExecutionComposition(readFileSync(compositionPath, "utf8"));
  const detectedNamed = scanNamedRuntimeAdapters(repoRoot);
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  if (baseline.compositionRoot !== "src/app/offlineRuntimeAdapters.ts") {
    errors.push(`unexpected baseline compositionRoot: ${baseline.compositionRoot ?? "<missing>"}`);
  }

  const entries = Array.isArray(baseline.entries) ? baseline.entries : [];
  const transitiveEntries = Array.isArray(baseline.transitiveEntries) ? baseline.transitiveEntries : [];
  const expected = [];
  const seen = new Set();
  const rootPaths = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.module !== "string") {
      errors.push("baseline entry missing module");
      continue;
    }
    if (seen.has(entry.module)) errors.push(`duplicate baseline module: ${entry.module}`);
    seen.add(entry.module);
    expected.push(entry.module);
    rootPaths.add(modulePath(entry.module));
    validateClassification(errors, entry.module, entry.classification);
  }

  const transitivePaths = new Set();
  for (const entry of transitiveEntries) {
    if (!entry || typeof entry.path !== "string") {
      errors.push("transitive baseline entry missing path");
      continue;
    }
    if (transitivePaths.has(entry.path)) errors.push(`duplicate transitive baseline path: ${entry.path}`);
    transitivePaths.add(entry.path);
    if (rootPaths.has(entry.path)) errors.push(`transitive entry duplicates composition classification: ${entry.path}`);
    validateClassification(errors, entry.path, entry.classification);
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

  const detectedNamedSet = new Set(detectedNamed);
  for (const path of detectedNamed) {
    if (!rootPaths.has(path) && !transitivePaths.has(path)) {
      errors.push(`unclassified named runtime adapter: ${path}`);
    }
  }
  for (const path of [...transitivePaths].sort()) {
    if (!detectedNamedSet.has(path)) errors.push(`stale transitive baseline path: ${path}`);
  }

  return { ok: errors.length === 0, errors, actual, entries, detectedNamed, transitiveEntries };
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
      result.entries.filter((entry) => entry.classification === classification).length
        + result.transitiveEntries.filter((entry) => entry.classification === classification).length,
    ]));
    console.log(`Legacy execution composition boundary OK: ${result.actual.length} classified import(s); ${result.detectedNamed.length} named adapter path(s) guarded.`);
    console.log(Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(" · "));
  }
}
