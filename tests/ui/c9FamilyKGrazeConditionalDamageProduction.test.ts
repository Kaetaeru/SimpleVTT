import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

const TARGET_ID="combatant.goblin-a";

function moduleJson(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.option`;
  const mechanicId=`${prefix}.mechanic`;
  const config={schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[{
    id:"graze",invocation:"manual",targeting:{from:"targets",min:1,max:1},
    test:{kind:"attack-roll",roller:"actor",dc:{value:10}},
    operations:[{kind:"damage.apply",amount:{value:3},damageType:"force",target:"target",when:{op:"eq",left:{ref:"test.outcome"},right:{value:"failure"}}}],
  }]};
  return {moduleId,contentId,mechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Unknown Family K Graze probe",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],
    content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",originalName:"Portable Graze",locales:{en:{name:"Portable Graze"}}},mechanics:[{kind:"common-play",config}]}],
  })};
}

async function prepare(prefix:string) {
  const adapter=new MockAdapter();
  const pack=moduleJson(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  return {adapter,actionId:installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId:"graze"})};
}

function hp(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  const target=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.combatants[TARGET_ID];
  assert.ok(target);
  return target.life.hp.current;
}

async function exercise(prefix:string,face:number) {
  const {adapter,actionId}=await prepare(prefix);
  const beforeSnapshot=await adapter.getSnapshot();
  const before=hp(adapter,beforeSnapshot);
  await adapter.setQueuedD20(face);
  const afterSnapshot=await adapter.resolveAction(actionId,[TARGET_ID]);
  assert.equal(afterSnapshot.resolution?.stage,"complete",JSON.stringify(afterSnapshot.resolution));
  return {adapter,before,after:hp(adapter,afterSnapshot)};
}

test("unknown installed Common Play applies a Graze-like rider only on attack failure and Undo restores HP",async()=>{
  const miss=await exercise("external-family-k-graze",1);
  assert.equal(miss.after,miss.before-3);
  await miss.adapter.undoLastResolution();
  assert.equal(hp(miss.adapter,await miss.adapter.getSnapshot()),miss.before);

  const hit=await exercise("external-family-k-hit",15);
  assert.equal(hit.after,hit.before);
});

test("Graze-like conditional damage is invariant to external module/content/mechanic identity",async()=>{
  const first=await exercise("external-family-k-a",1);
  const renamed=await exercise("renamed-family-k-b",1);
  assert.equal(first.before-first.after,3);
  assert.equal(renamed.before-renamed.after,3);
});
