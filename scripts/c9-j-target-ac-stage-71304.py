from pathlib import Path
import json


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old!r}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "src/domain/commonPlayOperationRuntime.ts",
    "  actorProperties?:Record<string,number>;\n  movementProperties?:Record<string,number>;\n",
    "  actorProperties?:Record<string,number>;\n  targetProperties?:Record<string,number>;\n  movementProperties?:Record<string,number>;\n",
)

actor_helper = '''function actorExpressionInteger(
  expression:CommonPlayExpression,
  input:CommonPlayOperationExecutionInput,
  label:string,
  minimum?:number,
) {
  const properties=input.actorProperties??{};
  const value=evaluateExpression(expression as ExpressionNode,(property)=>{
    const resolved=properties[property];
    if(!Number.isFinite(resolved)) throw new DomainEvaluationError(`${label} actor property is unavailable: ${property}`);
    return Number(resolved);
  });
  if(!Number.isFinite(value)||!Number.isInteger(value)) throw new DomainEvaluationError(`${label} must resolve to a finite integer`);
  if(minimum!==undefined&&value<minimum) throw new DomainEvaluationError(`${label} must resolve to an integer >= ${minimum}`);
  return value;
}
'''

d20_helper = actor_helper + '''
function d20TargetExpressionInteger(
  expression:CommonPlayExpression,
  input:CommonPlayOperationExecutionInput,
  label:string,
  minimum?:number,
) {
  const actorProperties=input.actorProperties??{};
  const targetProperties=input.targetProperties??{};
  const value=evaluateExpression(expression as ExpressionNode,(property)=>{
    const targetProperty=property.startsWith("target.")?property.slice("target.".length):undefined;
    const resolved=targetProperty===undefined?actorProperties[property]:targetProperties[targetProperty];
    if(!Number.isFinite(resolved)) throw new DomainEvaluationError(`${label} property is unavailable: ${property}`);
    return Number(resolved);
  });
  if(!Number.isFinite(value)||!Number.isInteger(value)) throw new DomainEvaluationError(`${label} must resolve to a finite integer`);
  if(minimum!==undefined&&value<minimum) throw new DomainEvaluationError(`${label} must resolve to an integer >= ${minimum}`);
  return value;
}
'''
replace_once("src/domain/commonPlayOperationRuntime.ts", actor_helper, d20_helper)
replace_once(
    "src/domain/commonPlayOperationRuntime.ts",
    'target:actorExpressionInteger(entryPoint.test.dc,input,"d20 target",0)+attackCoverTargetModifier,',
    'target:d20TargetExpressionInteger(entryPoint.test.dc,input,"d20 target",0)+attackCoverTargetModifier,',
)

replace_once(
    "src/app/installedCommonPlayRuntimeAdapter.ts",
    "  const movementProperties=commonPlayActorProfileProperties(internal,state,actor.id);\n  const d20Faces=",
    "  const movementProperties=commonPlayActorProfileProperties(internal,state,actor.id);\n  const targetProperties=selectedTargetId?commonPlayActorProfileProperties(internal,state,selectedTargetId):undefined;\n  const d20Faces=",
)
replace_once(
    "src/app/installedCommonPlayRuntimeAdapter.ts",
    "    ...(movementProperties?{actorProperties:movementProperties,movementProperties}:{}),\n    ...(Object.keys(movementFactAnswers).length?",
    "    ...(movementProperties?{actorProperties:movementProperties,movementProperties}:{}),\n    ...(targetProperties?{targetProperties}:{}),\n    ...(Object.keys(movementFactAnswers).length?",
)

ledger_path = Path("docs/rules/v1-mechanism-coverage-ledger.json")
ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
row = next(entry for entry in ledger["rows"] if entry["family"] == "J")
sentence = " Portable attack DC expressions can resolve target.* refs from authoritative target profile properties, so target.defense.ac is available without action/content identity dispatch."
if sentence.strip() not in row["currentState"]:
    row["currentState"] += sentence
evidence = {
    "implementationEvidence": "commonPlayOperationRuntime.ts resolves target.* d20 DC expression refs from structural targetProperties while installedCommonPlayRuntimeAdapter.ts supplies authoritative target profile properties, including defense.ac",
    "productionEvidence": "c9FamilyJTargetAcExpressionProduction71304.test.ts proves unknown and fully renamed external attacks resolve dc={ref: target.defense.ac} through production Common Play and commit damage",
    "identityInvarianceEvidence": "c9FamilyJTargetAcExpressionProduction71304.test.ts repeats target.defense.ac attack resolution after complete external module/content/mechanic identity rename",
}
for key, value in evidence.items():
    if value not in row[key]:
        row[key].append(value)
ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

Path("tests/domain/c9FamilyJTargetDcExpression71304.test.ts").write_text(r'''import assert from "node:assert/strict";
import test from "node:test";
import { compileCommonPlayEntryPointOperations, parseCommonPlayOperationDefinition } from "../../src/domain/commonPlayOperationRuntime";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

test("portable attack DC can read structural target profile properties",()=>{
  const definition=parseCommonPlayOperationDefinition({
    schemaVersion:"0.2-draft",id:"external.target-ac",
    entryPoints:[{id:"attack",invocation:"manual",test:{kind:"attack-roll",roller:"actor",dc:{ref:"target.defense.ac"}},operations:[]}],
  });
  const pending=compileCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition,{
    resolutionId:"target-ac",actorId:"hero",entryPointId:"attack",targetId:"goblin",
    actorProperties:{},targetProperties:{"defense.ac":17},
    d20:{faces:[12],targetId:"goblin",modifierContributions:[]},
  });
  const operation=pending.operations.find((candidate)=>candidate.kind==="d20");
  assert.equal(operation?.kind,"d20");
  if(operation?.kind==="d20") assert.equal(operation.request.target,17);
  assert.throws(()=>compileCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition,{
    resolutionId:"missing-target-ac",actorId:"hero",entryPointId:"attack",targetId:"goblin",
    actorProperties:{},targetProperties:{},d20:{faces:[12],targetId:"goblin",modifierContributions:[]},
  }),/d20 target property is unavailable: target\.defense\.ac/);
});
''', encoding="utf-8")

Path("tests/ui/c9FamilyJTargetAcExpressionProduction71304.test.ts").write_text(r'''import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";

function packagePayload(prefix:string) {
  const moduleId=`${prefix}.module`,contentId=`${prefix}.content`,mechanicId=`${prefix}.attack`;
  const json=JSON.stringify({schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",source:{document:"External target AC probe",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",originalName:"Target AC Probe",locales:{en:{name:"Target AC Probe"}}},mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[{id:"strike",invocation:"manual",targeting:{from:"targets",where:{op:"relation-matches",ref:"relation",value:"enemy"},min:1,max:1},test:{kind:"attack-roll",roller:"actor",dc:{ref:"target.defense.ac"}},operations:[{kind:"damage.apply",amount:{value:1},damageType:"bludgeoning",target:"target",when:{op:"eq",left:{ref:"test.outcome"},right:{value:"success"}}}]}]}}]}]});
  return {moduleId,contentId,mechanicId,json};
}
function hp(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) { return snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.hp; }
async function run(prefix:string) {
  const adapter=new MockAdapter();
  const pack=packagePayload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const actionId=installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId:"strike"});
  let snapshot=await adapter.getSnapshot();
  const before=hp(snapshot);
  await adapter.setQueuedD20(20);
  await adapter.resolveAction(actionId,["combatant.goblin-a"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.notEqual(snapshot.resolution?.calculatedOutcome,"적용 거부");
  assert.equal(hp(snapshot),before!-1);
}
test("unknown portable attack resolves target.defense.ac through production Common Play",async()=>{await run("external-family-j-target-ac");});
test("renaming external identities preserves target.defense.ac attack resolution",async()=>{await run("renamed-family-j-target-ac");});
''', encoding="utf-8")
