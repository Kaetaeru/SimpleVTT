import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";

const TARGET_ID="combatant.goblin-a";

function packagePayload(prefix:string) {
  const moduleId=`${prefix}.module`,contentId=`${prefix}.spell`,mechanicId=`${prefix}.mechanic`;
  return {moduleId,contentId,mechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Portable Spell Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],content:[{
      id:contentId,category:"spell",
      presentation:{defaultLocale:"en",originalName:"Portable Spell Probe",locales:{en:{name:"Portable Spell Probe"}}},
      mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[{
        id:"cast",invocation:"manual",targeting:{from:"targets",min:1,max:1},
        operations:[{kind:"damage.apply",amount:{value:7},damageType:"force",target:"target"}],
      }]}}],
    }],
  })};
}

function hp(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,actorId:string) {
  const value=snapshot.scene.entities.find((entity)=>entity.id===actorId)?.hp;
  assert.equal(typeof value,"number");
  return value as number;
}

async function execute(prefix:string) {
  const adapter=new MockAdapter();
  const pack=packagePayload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  const action=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),
    mechanicId:pack.mechanicId,
    entryPointId:"cast",
  });
  let snapshot=await adapter.getSnapshot();
  const before=hp(snapshot,TARGET_ID);
  snapshot=await adapter.resolveAction(action,[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(hp(snapshot,TARGET_ID),before-7);

  await adapter.undoLastResolution();
  assert.equal(hp(await adapter.getSnapshot(),TARGET_ID),before,"Undo must restore portable spell damage");
}

test("unknown external spell content executes through generic Common Play under identity rename",async()=>{
  await execute("external.family-z-portable-spell");
  await execute("completely.renamed-family-z-portable-spell");
});
