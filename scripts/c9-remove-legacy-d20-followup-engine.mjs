import fs from "node:fs";
import path from "node:path";

function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap((entry)=>{const full=path.join(dir,entry.name);return entry.isDirectory()?walk(full):[full];});}

const sourceMatches=walk("src/app").filter((file)=>file.endsWith(".ts")&&fs.readFileSync(file,"utf8").includes("runtimeD20FollowUps"));
const expectedSource=new Set(["src/app/contracts.ts","src/app/d20FollowUpRuntimeAdapter.ts"]);
const unexpectedSource=sourceMatches.filter((file)=>!expectedSource.has(file));
if(unexpectedSource.length)throw new Error(`unexpected runtimeD20FollowUps source producer(s): ${unexpectedSource.join(", ")}`);
for(const expected of expectedSource)if(!sourceMatches.includes(expected))throw new Error(`expected legacy source missing: ${expected}`);

const testMatches=walk("tests").filter((file)=>file.endsWith(".ts")&&fs.readFileSync(file,"utf8").includes("runtimeD20FollowUps"));
if(testMatches.length!==1||testMatches[0]!=="tests/ui/d20FollowUpRuntime.test.ts")throw new Error(`unexpected legacy d20 test coverage: ${testMatches.join(", ")}`);

const offlinePath="src/app/offlineRuntimeAdapters.ts";
let offline=fs.readFileSync(offlinePath,"utf8");
const importLine='import "./d20FollowUpRuntimeAdapter";\n';
if(!offline.includes(importLine))throw new Error("legacy d20FollowUp runtime import missing");
offline=offline.replace(importLine,"");
fs.writeFileSync(offlinePath,offline);

const contractsPath="src/app/contracts.ts";
let contracts=fs.readFileSync(contractsPath,"utf8");
const start='  runtimeD20FollowUps?:Array<{\n';
const end='  checkSuccessOperations?:Array<{kind:"stabilize";target:"first-target"}>;\n';
const startIndex=contracts.indexOf(start);
const endIndex=contracts.indexOf(end,startIndex);
if(startIndex<0||endIndex<0)throw new Error("legacy ActionVm runtimeD20FollowUps block not found");
contracts=contracts.slice(0,startIndex)+contracts.slice(endIndex);
fs.writeFileSync(contractsPath,contracts);

fs.unlinkSync("src/app/d20FollowUpRuntimeAdapter.ts");
fs.unlinkSync("tests/ui/d20FollowUpRuntime.test.ts");
