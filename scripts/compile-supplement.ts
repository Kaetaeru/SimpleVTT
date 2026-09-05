import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compileSupplement, listSourceFiles } from "../tools/supplement/compileSupplement";
import { parseRuleModulePackage } from "../src/app/ruleModulePackageImport";

/**
 * CLI for the supplement compiler (X1-07).
 *
 *   npx tsx scripts/compile-supplement.ts --source <checkout>/10-RULEBOOKS/phb-2024 --semantics <dir> \
 *     --out <file.module.json> --module-id phb-2024-supplement --id-prefix phb2024 --document "Player's Handbook 2024"
 *
 * The output is validated with the same parser the Contents screen uses; a source lock (git revision of the
 * checkout, file count, sha256 of the module) is written next to the module as `<out>.lock.json`.
 * Non-SRD text must stay in the private checkout: point `--out` into that repository.
 */
function arg(name:string,fallback?:string) {
  const index=process.argv.indexOf(`--${name}`);
  if(index>=0&&process.argv[index+1]&&!process.argv[index+1].startsWith("--"))return process.argv[index+1];
  if(fallback!==undefined)return fallback;
  throw new Error(`missing --${name}`);
}
function optional(name:string) {
  const index=process.argv.indexOf(`--${name}`);
  return index>=0&&process.argv[index+1]&&!process.argv[index+1].startsWith("--")?process.argv[index+1]:undefined;
}

const sourceRoot=resolve(arg("source"));
const semanticsRoot=optional("semantics")?resolve(optional("semantics")!):undefined;
const out=resolve(arg("out"));
const result=compileSupplement({
  sourceRoot,semanticsRoot,
  moduleId:arg("module-id"),
  moduleVersion:optional("module-version")??"1",
  idPrefix:arg("id-prefix"),
  document:arg("document"),
  license:optional("license"),
  locale:optional("locale"),
});
const payload=`${JSON.stringify(result.module,null,2)}\n`;
const parsed=parseRuleModulePackage(payload);
let revision="unknown";
try { revision=execSync("git rev-parse HEAD",{cwd:sourceRoot,stdio:["ignore","pipe","ignore"]}).toString().trim(); } catch { /* not a git checkout */ }
mkdirSync(dirname(out),{recursive:true});
writeFileSync(out,payload,"utf8");
const lock={
  formatVersion:"1",
  moduleId:result.module.moduleId,
  moduleVersion:result.module.moduleVersion,
  source:{root:sourceRoot,revision,files:listSourceFiles(sourceRoot).length},
  semanticsRoot:semanticsRoot??null,
  output:{path:out,sha256:createHash("sha256").update(payload).digest("hex"),bytes:Buffer.byteLength(payload)},
  counts:result.counts,
  entries:parsed.entries.length,
  warnings:result.warnings,
  compiledAt:new Date().toISOString(),
};
writeFileSync(`${out}.lock.json`,`${JSON.stringify(lock,null,2)}\n`,"utf8");
console.log(`Compiled ${parsed.entries.length} entries → ${out}`);
console.log(`counts: ${JSON.stringify(result.counts)}`);
for(const warning of result.warnings)console.warn(`warning: ${warning}`);
console.log(`sha256: ${lock.output.sha256} (${lock.output.bytes} bytes), source revision ${revision}`);
