import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RULES=[
  { id:"direct-domain-value-import",pattern:/(?:^|\n)\s*import\s+(?!type\b)[^;\n]+from\s+["'][^"']*domain\/[^"']+["']/gm },
  { id:"ability-modifier-arithmetic",pattern:/Math\.floor\s*\(\s*\(\s*[A-Za-z_$][\w$]*\s*-\s*10\s*\)\s*\/\s*2\s*\)/g },
  { id:"standard-ability-array-literal",pattern:/\[\s*15\s*,\s*14\s*,\s*13\s*,\s*12\s*,\s*10\s*,\s*8\s*\]/g },
  { id:"point-buy-cost-table",pattern:/\{\s*8\s*:\s*0\s*,\s*9\s*:\s*1\s*,\s*10\s*:\s*2\s*,\s*11\s*:\s*3\s*,\s*12\s*:\s*4\s*,\s*13\s*:\s*5\s*,\s*14\s*:\s*7\s*,\s*15\s*:\s*9\s*\}/g },
  { id:"point-buy-cost-symbol",pattern:/\b(?:POINT_COST|COST)\b/g },
  { id:"spellcasting-ability-mapping",pattern:/function\s+spellcastingAbility\s*\(/g },
  { id:"spellcasting-modifier-arithmetic",pattern:/c\.proficiencyBonus\s*\+\s*castingMod/g },
  { id:"spell-slot-level-arithmetic",pattern:/Math\.max\s*\(\s*meta\.baseLevel\s*,\s*slotLevel\s*\)/g },
  { id:"levelup-fixed-hp-arithmetic",pattern:/Math\.floor\s*\(\s*plan\.hp\.hitDie\s*\/\s*2\s*\)/g },
  { id:"multiclass-eligibility-in-ui",pattern:/multiclassEligibility\s*\(/g },
  { id:"concentration-rule-in-ui",pattern:/\b(?:concentrationCheckDc|resolveConcentrationDamageCheck)\s*\(/g },
];

function tsxFiles(root) {
  const files=[];
  const walk=(path)=>{
    for (const name of readdirSync(path)) {
      const full=join(path,name);
      const stat=statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (name.endsWith(".tsx")) files.push(full);
    }
  };
  walk(root);
  return files.sort();
}

function lineNumber(source,index) {
  return source.slice(0,index).split("\n").length;
}

export function scanUiSource(source,file="fixture.tsx") {
  const findings=[];
  for (const rule of RULES) {
    rule.pattern.lastIndex=0;
    for (const match of source.matchAll(rule.pattern)) {
      findings.push({
        file,
        rule:rule.id,
        line:lineNumber(source,match.index ?? 0),
        match:match[0].replace(/\s+/g," ").trim(),
      });
    }
  }
  return findings;
}

export function scanUiTree(repoRoot) {
  const srcRoot=join(repoRoot,"src");
  return tsxFiles(srcRoot).flatMap((file)=>scanUiSource(
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

export function checkUiRuleBoundary(repoRoot) {
  const baselinePath=join(repoRoot,".agents","UI_NAMED_RULE_BASELINE.json");
  if (!existsSync(baselinePath)) return { ok:false,errors:[`missing baseline: ${baselinePath}`],findings:scanUiTree(repoRoot) };
  const baseline=JSON.parse(readFileSync(baselinePath,"utf8"));
  const findings=scanUiTree(repoRoot);
  const actual=grouped(findings);
  const expected=[...(baseline.entries ?? [])]
    .map((entry)=>({ file:entry.file,rule:entry.rule,count:entry.count }))
    .sort((a,b)=>`${a.file}:${a.rule}`.localeCompare(`${b.file}:${b.rule}`));
  const actualCounts=actual.map(({ file,rule,count })=>({ file,rule,count }));
  const errors=[];
  const allKeys=new Set([
    ...expected.map((entry)=>`${entry.file}::${entry.rule}`),
    ...actualCounts.map((entry)=>`${entry.file}::${entry.rule}`),
  ]);
  for (const key of [...allKeys].sort()) {
    const want=expected.find((entry)=>`${entry.file}::${entry.rule}`===key)?.count ?? 0;
    const have=actualCounts.find((entry)=>`${entry.file}::${entry.rule}`===key)?.count ?? 0;
    if (want!==have) errors.push(`${key}: baseline ${want}, current ${have}`);
  }
  return { ok:errors.length===0,errors,findings,actual };
}

const self=fileURLToPath(import.meta.url);
if (resolve(process.argv[1] ?? "")===self) {
  const repoRoot=resolve(dirname(self),"..");
  const result=checkUiRuleBoundary(repoRoot);
  if (!result.ok) {
    console.error("UI named-rule boundary drift detected:");
    for (const error of result.errors) console.error(`- ${error}`);
    console.error("\nCurrent findings:");
    for (const entry of result.actual ?? grouped(result.findings)) {
      console.error(`- ${entry.file} :: ${entry.rule} x${entry.count}`);
      for (const match of entry.matches) console.error(`    L${match.line}: ${match.match}`);
    }
    process.exitCode=1;
  } else {
    console.log(`UI named-rule boundary OK: ${result.findings.length} frozen finding(s), no new rule ownership in React.`);
  }
}
