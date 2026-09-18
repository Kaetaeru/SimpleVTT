/**
 * Grammar check for an installed RuleModule (D300).
 *
 * The client refuses to guess: `parseContract` collects everything it cannot run in `unsupported`, and
 * `contractEffect` names every `property.modify` whose property this engine does not know. This script runs both over
 * every `common-play` mechanic in a module file and prints what is left over, so "the module works" stays a measured
 * claim for installed content the way it already is for the SRD modules.
 *
 *   npx tsx scripts/check-module-grammar.ts <file.module.json> [--verbose]
 *
 * It reads only the module's machine-readable half; no text of the module is printed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseModuleJson } from "../client/catalog/install";
import { parseContract } from "../client/rules/contract";
import { contractEffect } from "../client/rules/contractEffects";
import type { MechanicJson } from "../client/catalog/types";

const file = process.argv[2];
if (!file) { console.error("usage: tsx scripts/check-module-grammar.ts <file.module.json> [--verbose]"); process.exit(2); }
const verbose = process.argv.includes("--verbose");

const parsed = parseModuleJson(readFileSync(resolve(file), "utf8"));
if (parsed.errors.length) { for (const error of parsed.errors) console.error("ERROR:", error); process.exit(1); }
const module = parsed.module!;

/** A scope that answers every named value, so a contract's expressions can be worked out. */
const scope = (ref: string) => (ref.startsWith("effect.running:") ? true : ref.endsWith(".training") ? "heavy" : 5);

let contracts = 0;
let operations = 0;
const unsupported: string[] = [];
const unknownProperties: string[] = [];
const counts: Record<string, number> = {};

for (const entry of module.content) {
  for (const mechanic of (entry.mechanics ?? []) as MechanicJson[]) {
    counts[mechanic.kind] = (counts[mechanic.kind] ?? 0) + 1;
    if (mechanic.kind !== "common-play") continue;
    contracts += 1;
    const contract = parseContract(mechanic.config ?? {}, entry.id);
    for (const gap of contract.unsupported) unsupported.push(`${entry.id}: ${gap}`);
    operations += contract.entryPoints.reduce((sum, point) => sum + point.operations.length, 0)
      + contract.interceptors.reduce((sum, item) => sum + item.operations.length, 0);
    const { unknown } = contractEffect(contract, scope);
    for (const property of unknown) unknownProperties.push(`${entry.id}: ${property}`);
  }
}

console.log(`module: ${module.moduleId} (version ${module.moduleVersion ?? "?"}) — ${module.content.length} entries`);
console.log(`mechanics: ${Object.entries(counts).map(([kind, count]) => `${kind} ${count}`).join(", ")}`);
console.log(`contracts: ${contracts}, operations: ${operations}`);
console.log(`unsupported: ${unsupported.length}, unknown properties: ${unknownProperties.length}`);
for (const warning of parsed.warnings.slice(0, verbose ? parsed.warnings.length : 5)) console.log("warning:", warning);
if (parsed.warnings.length > 5 && !verbose) console.log(`warning: … ${parsed.warnings.length - 5} more (--verbose)`);
for (const gap of (verbose ? unsupported : unsupported.slice(0, 20))) console.log("unsupported:", gap);
for (const gap of (verbose ? unknownProperties : unknownProperties.slice(0, 20))) console.log("unknown property:", gap);
process.exitCode = unsupported.length || unknownProperties.length ? 1 : 0;
