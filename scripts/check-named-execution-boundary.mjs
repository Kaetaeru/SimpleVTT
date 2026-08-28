import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CONTENT_TERMS=[
  "barbarian","bard","cleric","druid","fighter","monk","paladin","ranger","rogue","sorcerer","warlock","wizard",
];
const TERM=CONTENT_TERMS.join("|");
const RULES=[
  { id:"named-runtime-filename", test:(_source,file)=>new RegExp(`^(?:${TERM}|bardic|sorcery|pactTome)`,"i").test(file.split("/").pop() ?? "") && /(?:Runtime|Adapter)\.ts$/i.test(file) },
  { id:"known-content-domain-import", pattern:new RegExp(`(?:^|\\n)\\s*import\\s+(?!type\\b)[^;\\n]+from\\s+[\"']\\.\\./domain\\/[^\"']*(?:${TERM})[^\"']*[\"']`,"gim") },
  { id:"known-content-action-id", pattern:new RegExp(`\\baction\\.(?:${TERM})\\.`,"gi") },
  { id:"known-content-class-id", pattern:new RegExp(`dnd\\.srd[\\w.-]*\\.class\\.(?:${TERM})\\b`,"gi") },
  { id:"known-content-feature-source", pattern:new RegExp(`\\bfeature:(?:${TERM})[.:-]`,"gi") },
];

function appTsFiles(root) {
  const files=[];
  const walk=(path)=>{
    for(const name of readdirSync(path)){
      const full=join(path,name);
      const stat=statSync(full);
      if(stat.isDirectory())walk(full);
      else if(name.endsWith(".ts")&&!name.endsWith(".d.ts"))files.push(full);
    }
  };
  walk(root);
  return files.sort();
}

export function scanNamedExecutionSource(source,file="fixture.ts") {
  const rules=[];
  for(const rule of RULES){
    if(rule.test?.(source,file))rules.push(rule.id);
    if(rule.pattern){
      rule.pattern.lastIndex=0;
      if(rule.pattern.test(source))rules.push(rule.id);
    }
  }
  return [...new Set(rules)].sort();
}

export function scanNamedExecutionTree(repoRoot) {
  const appRoot=join(repoRoot,"src","app");
  return appTsFiles(appRoot).flatMap((absolute)=>{
    const file=relative(repoRoot,absolute).replaceAll("\\","/");
    const rules=scanNamedExecutionSource(readFileSync(absolute,"utf8"),file);
    return rules.length?[{file,rules}]:[];
  });
}

export function checkNamedExecutionBoundary(repoRoot) {
  const baselinePath=join(repoRoot,".agents","NAMED_EXECUTION_BASELINE.json");
  const findings=scanNamedExecutionTree(repoRoot);
  if(!existsSync(baselinePath))return {ok:false,errors:[`missing baseline: ${baselinePath}`],findings};
  const baseline=JSON.parse(readFileSync(baselinePath,"utf8"));
  const allowedClassifications=new Set(["CONTENT/PRESENTATION","LEGACY_EXECUTION","GENERIC_ENGINE","UNCLEAR"]);
  const entries=baseline.entries??[];
  const errors=[];
  const known=new Map();
  for(const entry of entries){
    if(!allowedClassifications.has(entry.classification))errors.push(`${entry.file}: invalid classification ${entry.classification}`);
    if(known.has(entry.file))errors.push(`${entry.file}: duplicate baseline entry`);
    known.set(entry.file,entry);
  }
  for(const finding of findings){
    if(!known.has(finding.file))errors.push(`${finding.file}: unclassified named-execution candidate (${finding.rules.join(", ")})`);
  }
  return {ok:errors.length===0,errors,findings,baseline};
}

const self=fileURLToPath(import.meta.url);
if(resolve(process.argv[1]??"")===self){
  const repoRoot=resolve(dirname(self),"..");
  const result=checkNamedExecutionBoundary(repoRoot);
  if(!result.ok){
    console.error("Named execution boundary drift detected:");
    for(const error of result.errors)console.error(`- ${error}`);
    console.error("\nCurrent semantic candidates:");
    for(const finding of result.findings)console.error(`- ${finding.file} :: ${finding.rules.join(", ")}`);
    process.exitCode=1;
  }else{
    const legacy=(result.baseline.entries??[]).filter((entry)=>entry.classification==="LEGACY_EXECUTION").length;
    console.log(`Named execution boundary OK: ${result.findings.length} classified candidate(s); ${legacy} frozen legacy entry/entries.`);
  }
}
