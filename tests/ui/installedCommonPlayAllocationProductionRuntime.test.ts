import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/installedContentRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";

const MODULE_ID="homebrew.family-f-allocation-probe";
const CONTENT_ID="option.external-family-f-allocation-probe";
const MECHANIC_ID="external.unknown.family-f-allocation-probe";
const ENTRY_POINT_ID="distribute";

function payload() {
  return JSON.stringify({
    schemaVersion:"0.1-draft",moduleId:MODULE_ID,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"External Allocation Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],content:[{
      id:CONTENT_ID,category:"option",
      presentation:{defaultLocale:"en",originalName:"External Allocation Probe",locales:{en:{name:"External Allocation Probe",description:"Portable fixed-pool allocation probe"}}},
      mechanics:[{kind:"common-play",config:{
        schemaVersion:"0.2-draft",id:MECHANIC_ID,entryPoints:[{
          id:ENTRY_POINT_ID,invocation:"manual",
          allocation:{units:{value:3},targets:{from:"targets",min:1,max:3},minimumPerTarget:1,maximumPerTarget:3,totalMustMatch:true},
          operations:[{kind:"economy.modify",bucket:"action.extra.non-magic",amount:{value:1}}],
        }],
      }}],
    }],
  });
}

function actionId() {
  return installedCommonPlayActionId({
    catalogId:catalogQualifiedId(CONTENT_ID,MODULE_ID,"1"),mechanicId:MECHANIC_ID,entryPointId:ENTRY_POINT_ID,
  });
}

async function install(adapter:MockAdapter,store:MemoryInstalledContentStore) {
  setInstalledContentStoreForTests(adapter,store);
  const preview=await adapter.previewContentImport(payload());
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
}

test("unknown installed Common Play validates fixed-pool allocation before downstream production commit",async()=>{
  const store=new MemoryInstalledContentStore();
  const installer=new MockAdapter();
  await install(installer,store);

  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  await adapter.resolveAction(actionId(),["combatant.goblin-a","combatant.goblin-b"]);
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions,undefined,"under-allocation must not partially commit downstream operations");

  await adapter.resolveAction(actionId(),["combatant.goblin-a","combatant.goblin-a","combatant.goblin-b"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.resolution?.actionId,actionId());
  assert.deepEqual(snapshot.resolution?.targetIds,["combatant.goblin-a","combatant.goblin-b"]);
  assert.match(snapshot.resolution?.compact??"",/분배 3/);
  assert.ok(snapshot.resolution?.detail.some((line)=>line.includes("combatant.goblin-a 2")&&line.includes("combatant.goblin-b 1")));
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.length,1);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions,undefined);
});
