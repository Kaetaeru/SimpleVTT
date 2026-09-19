/**
 * Feat audit: for every feat in the catalog (the SRD, plus any module files given), what the app does with it.
 *
 * A feat is played by its definition (`feat-definition`: ability increases, proficiencies, spells, choices) and by its
 * contract (`feat:<slug>`: buttons, riders, windows, passives). This lists, per feat, which of those exist, what the
 * contract cannot run (`unsupported`), and whether everything it does is a line for the DM (`adjudication.request`
 * only) — the feats a table would have to play by hand. It prints the feats that need a look and writes all of them.
 *
 *   npx tsx scripts/audit-feats.ts [--module <file.module.json> …] [--out <report.json>]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCatalog } from "../client/catalog";
import { slugOfId } from "../client/catalog/catalog";
import type { RuleModuleJson } from "../client/catalog/types";

const args = process.argv.slice(2);
const modules: RuleModuleJson[] = [];
let out = "feat-audit.json";
for (let at = 0; at < args.length; at += 1) {
  if (args[at] === "--module") modules.push(JSON.parse(readFileSync(resolve(args[++at]), "utf8")));
  else if (args[at] === "--out") out = args[++at];
}

const catalog = createCatalog(modules);
const rows = catalog.feats.map((feat) => {
  const contract = catalog.contractFor(`feat:${slugOfId(feat.id)}`) ?? catalog.contractFor(`feat:${feat.id.split(".feat.").pop()}`);
  const operations = contract ? [...contract.entryPoints.flatMap((entry) => entry.operations), ...contract.interceptors.flatMap((item) => item.operations)] : [];
  const kinds = [...new Set(operations.map((operation) => (operation.kind === "property.modify" ? `pm:${operation.property}` : operation.kind)))];
  const config = Object.keys(feat.config).filter((key) => !["tier", "repeatable", "minimumLevel", "abilityPrerequisite", "requires"].includes(key));
  const handOnly = operations.length > 0 && operations.every((operation) => operation.kind === "adjudication.request" || (operation.kind === "property.modify" && operation.property === "rule.applied-elsewhere"));
  const verdict = contract?.unsupported.length ? "unsupported" : !contract && !config.length ? "nothing" : handOnly && !config.length ? "hand-only" : "ok";
  return { id: feat.id, name: feat.name, tier: feat.tier, scope: feat.scope, verdict, config, invocations: contract ? [...new Set([...contract.entryPoints.map((entry) => entry.invocation), ...contract.interceptors.map((item) => item.timing)])] : [], kinds, unsupported: contract?.unsupported ?? [] };
});

const counts: Record<string, number> = {};
for (const row of rows) counts[row.verdict] = (counts[row.verdict] ?? 0) + 1;
console.log(`feats: ${rows.length}`, counts);
for (const row of rows.filter((item) => item.verdict !== "ok")) console.log(`${row.verdict.padEnd(11)} ${row.scope.padEnd(9)} ${row.name} (${row.id}) ${row.unsupported.join(", ")}`);
writeFileSync(out, JSON.stringify(rows, null, 1));
console.log(`written: ${out}`);
