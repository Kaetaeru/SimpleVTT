import assert from "node:assert/strict";
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
