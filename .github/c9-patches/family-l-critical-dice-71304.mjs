import { readFileSync, writeFileSync } from "node:fs";

function replaceRequired(path, oldText, newText, label) {
  const text = readFileSync(path, "utf8");
  if (text.includes(newText)) return false;
  if (!text.includes(oldText)) throw new Error(`${label} anchor not found`);
  writeFileSync(path, text.replace(oldText, newText), "utf8");
  return true;
}

replaceRequired(
  "src/domain/commonPlayOperationRuntime.ts",
  '      const criticalFrom=entryPoint.test?.kind==="attack-roll"?`${input.resolutionId}:test`:undefined;',
  '      const criticalFrom=entryPoint.test?.kind==="attack-roll"&&(operation.when===undefined||operation.when.right.value==="success")?`${input.resolutionId}:test`:undefined;',
  "criticalFrom eligibility",
);

replaceRequired(
  "src/app/installedCommonPlayRuntimeAdapter.ts",
  '    if(entryPoint.test?.kind==="attack-roll") attackDice.push({operationIndex,count:formula.count,sides:formula.sides});',
  '    if(entryPoint.test?.kind==="attack-roll"&&(operation.when===undefined||operation.when.right.value==="success")) attackDice.push({operationIndex,count:formula.count,sides:formula.sides});',
  "critical damage dice eligibility",
);

const testPath = "tests/ui/c9FamilyLDamageDefenseProduction.test.ts";
let testText = readFileSync(testPath, "utf8");
const testName = 'unknown installed attack-roll doubles damage dice but not flat damage on critical with rename invariance and Undo';
if (!testText.includes(testName)) {
  const helperAnchor = 'function hp(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,actorId:string) {';
  const helper = `function criticalPackagePayload(prefix:string) {\n  const moduleId=\`${"${prefix}"}.module\`,contentId=\`${"${prefix}"}.option\`,mechanicId=\`${"${prefix}"}.damage\`;\n  return {moduleId,contentId,mechanicId,json:JSON.stringify({\n    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",\n    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",\n    source:{document:"Portable Critical Damage Probe",version:"1",license:"CC0",srdDerived:false},\n    dependencies:[],conflicts:[],capabilities:[],content:[{\n      id:contentId,category:"option",\n      presentation:{defaultLocale:"en",originalName:"Portable Critical Damage Probe",locales:{en:{name:"Portable Critical Damage Probe"}}},\n      mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[{\n        id:"attack",invocation:"manual",targeting:{from:"targets",min:1,max:1},\n        test:{kind:"attack-roll",roller:"actor",dc:{value:10}},\n        operations:[{kind:"damage.apply",amount:"1d6+2",damageType:"fire",target:"target",when:{op:"eq",left:{ref:"test.outcome"},right:{value:"success"}}}],\n      }]}}],\n    }],\n  })};\n}\n\n`;
  if (!testText.includes(helperAnchor)) throw new Error("critical helper anchor not found");
  testText = testText.replace(helperAnchor, helper + helperAnchor);

  const executeAnchor = 'async function executeInstantDeath(prefix:string) {';
  const execute = `async function executeCritical(prefix:string) {\n  const adapter=new MockAdapter();\n  const pack=criticalPackagePayload(prefix);\n  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());\n  const preview=await adapter.previewContentImport(pack.json);\n  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));\n  await adapter.activateContentImport();\n  await adapter.startInitiative();\n  await adapter.setCurrentActor("char.aelar");\n\n  const action=installedCommonPlayActionId({\n    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),\n    mechanicId:pack.mechanicId,\n    entryPointId:"attack",\n  });\n  const before=hp(await adapter.getSnapshot(),TARGET_ID);\n  (adapter as unknown as {queuedD20:number|null}).queuedD20=20;\n  const snapshot=await adapter.resolveAction(action,[TARGET_ID]);\n  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));\n  const component=snapshot.resolution?.damageComponents[0];\n  assert.equal(component?.raw,14,"critical must roll 2d6 but add the +2 flat contribution only once");\n  assert.equal(component?.adjusted,14);\n  await adapter.undoLastResolution();\n  assert.equal(hp(await adapter.getSnapshot(),TARGET_ID),before,"Undo must restore HP after portable critical damage");\n  return component?.raw;\n}\n\n`;
  if (!testText.includes(executeAnchor)) throw new Error("critical execute anchor not found");
  testText = testText.replace(executeAnchor, execute + executeAnchor);

  const testAnchor = 'test("unknown installed damage.apply enforces character instant-death overkill with rename invariance and Undo",async()=>{';
  const testBlock = `test("${testName}",async()=>{\n  assert.equal(await executeCritical("external.family-l-critical-dice"),14);\n  assert.equal(await executeCritical("completely.renamed-family-l-critical-dice"),14);\n});\n\n`;
  if (!testText.includes(testAnchor)) throw new Error("critical test anchor not found");
  testText = testText.replace(testAnchor, testBlock + testAnchor);
  writeFileSync(testPath, testText, "utf8");
}
