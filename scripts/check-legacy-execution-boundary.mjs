import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CONTENT_ID_LITERAL = /["'`]dnd\.srd521\.(?:class|subclass|feature|feat|spell|item|invocation|boon)(?:\.[^"'`\s]+)+["'`]/g;
const ACTION_BRANCH_LITERAL = /\bactionId\s*(?:===|!==)\s*["'`](action\.[^"'`]+)["'`]/g;
const NAMED_DOMAIN_IMPORT = /import\s*\{([\s\S]*?)\}\s*from\s*["']\.\.\/domain\/[^"']+["'];?/g;
const LEGACY_HANDLER_IMPORT = /from\s*["']\.\/legacySpellRuntimeHandler["']/g;

function tsFiles(root) {
  const files=[];
  const walk=(path)=>{
    for (const name of readdirSync(path)) {
      const full=join(path,name);
      const stat=statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (name.endsWith(".ts")&&!name.endsWith(".d.ts")) files.push(full);
    }
  };
  walk(root);
  return files.sort();
}

function lineNumber(source,index) {
  return source.slice(0,index).split("\n").length;
}

function pushMatches(findings,source,file,rule,pattern,transform=(match)=>match[0]) {
  pattern.lastIndex=0;
  for (const match of source.matchAll(pattern)) {
    findings.push({ file,rule,line:lineNumber(source,match.index ?? 0),match:transform(match).replace(/\s+/g," ").trim() });
  }
}

export function scanLegacyExecutionSource(source,file="fixture.ts") {
  const findings=[];
  pushMatches(findings,source,file,"known-content-id-literal",CONTENT_ID_LITERAL);
  pushMatches(findings,source,file,"action-id-execution-branch",ACTION_BRANCH_LITERAL,(match)=>match[0]);
  pushMatches(findings,source,file,"legacy-spell-handler-import",LEGACY_HANDLER_IMPORT);

  NAMED_DOMAIN_IMPORT.lastIndex=0;
  for (const importMatch of source.matchAll(NAMED_DOMAIN_IMPORT)) {
    const body=importMatch[1] ?? "";
    const importedIds=body.match(/\b[A-Z][A-Z0-9_]*_ID\b/g) ?? [];
    for (const importedId of [...new Set(importedIds)]) {
      findings.push({
        file,
        rule:"known-domain-id-import",
        line:lineNumber(source,importMatch.index ?? 0),
        match:importedId,
      });
    }
  }
  return findings;
}

export function scanLegacyExecutionTree(repoRoot) {
  const appRoot=join(repoRoot,"src","app");
  return tsFiles(appRoot).flatMap((file)=>scanLegacyExecutionSource(
    readFileSync(file,"utf8"),
    relative(repoRoot,file).replaceAll("\\","/"),
  ));
}

function grouped(findings) {
  const map=new Map();
  for (const finding of findings) {
    const key=`${finding.file}::${finding.rule}`;
    const entry=map.get(key) ?? { file:finding.file,rule:finding.rule,count:0,matches:[] };
    entry.count+=1;
    entry.matches.push({ line:finding.line,match:finding.match });
    map.set(key,entry);
  }
  return [...map.values()].sort((a,b)=>`${a.file}:${a.rule}`.localeCompare(`${b.file}:${b.rule}`));
}

export function compareLegacyExecutionBoundary(findings,baseline) {
  const actual=grouped(findings);
  const maxima=new Map((baseline.entries ?? []).map((entry)=>[`${entry.file}::${entry.rule}`,entry.maxCount]));
  const errors=[];
  for (const entry of actual) {
    const key=`${entry.file}::${entry.rule}`;
    const max=maxima.get(key) ?? 0;
    if (entry.count>max) errors.push(`${key}: baseline max ${max}, current ${entry.count}`);
  }
  return { ok:errors.length===0,errors,actual };
}

export function checkLegacyExecutionBoundary(repoRoot) {
  const baselinePath=join(repoRoot,".agents","LEGACY_EXECUTION_BASELINE.json");
  const findings=scanLegacyExecutionTree(repoRoot);
  if (!existsSync(baselinePath)) return { ok:false,errors:[`missing baseline: ${baselinePath}`],findings,actual:grouped(findings) };
  const baseline=JSON.parse(readFileSync(baselinePath,"utf8"));
  return { ...compareLegacyExecutionBoundary(findings,baseline),findings };
}

const self=fileURLToPath(import.meta.url);
if (resolve(process.argv[1] ?? "")===self) {
  const repoRoot=resolve(dirname(self),"..");
  const result=checkLegacyExecutionBoundary(repoRoot);
  if (!result.ok) {
    console.error("Legacy execution boundary growth detected:");
    for (const error of result.errors) console.error(`- ${error}`);
    console.error("\nCurrent high-signal findings:");
    for (const entry of result.actual) {
      console.error(`- ${entry.file} :: ${entry.rule} x${entry.count}`);
      for (const match of entry.matches) console.error(`    L${match.line}: ${match.match}`);
    }
    process.exitCode=1;
  } else {
    console.log(`Legacy execution boundary OK: ${result.findings.length} frozen high-signal finding(s); debt may shrink but may not grow.`);
  }
}
