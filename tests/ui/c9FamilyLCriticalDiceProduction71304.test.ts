import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";

const ACTOR_ID="char.aelar";
const TARGET_ID="combatant.goblin-b";

function packagePayload(prefix:string) {
  const moduleId=`${prefix}.module`,contentId=`${prefix}.option`,mechanicId=`${prefix}.mechanic`;
  return {moduleId,contentId,mechanicId,json:JSON.stringify({schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",source:{document:"Portable Critical Dice Probe",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",originalName:"Portable Critical Strike",locales:{en:{name:"Portable Critical Strike"}}},mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[{id:"strike",invocation:"manual",targeting:{from:"targets",min:1,max:1},test:{kind:"attack-roll",roller:"actor",dc:{value:1}},operations:[{kind:"damage.apply",amount:"1d6+1",damageType:"force",target:"target",when:{op:"eq",left:{ref:"test.outcome"},right:{value:"success"}}}]}]}}]}]})};
}
function hp(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) { const value=snapshot.scene.entities.find((entry)=>entry.id===TARGET_ID)?.hp; assert.equal(typeof value,"number"); return value as number; }
async function execute(prefix:string,natural:number) {
  const adapter=new MockAdapter(); const pack=packagePayload(prefix); setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json); assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport(); await adapter.startInitiative(); await adapter.setCurrentActor(ACTOR_ID);
  const action=installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId:"strike"});
  const before=hp(await adapter.getSnapshot()); await adapter.setQueuedD20(natural); const snapshot=await adapter.resolveAction(action,[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution)); const dealt=before-hp(snapshot); await adapter.undoLastResolution(); assert.equal(hp(await adapter.getSnapshot()),before); return dealt;
}
test("unknown installed Common Play attack critical doubles damage dice but not flat damage",async()=>{ assert.equal(await execute("external.family-l-critical",19),7); assert.equal(await execute("external.family-l-critical",20),13); });
test("complete external identity rename preserves portable critical-dice semantics",async()=>{ assert.equal(await execute("completely.renamed-family-l-critical",19),7); assert.equal(await execute("completely.renamed-family-l-critical",20),13); });
