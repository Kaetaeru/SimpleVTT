import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/installedContentRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";

type Identity={moduleId:string;contentId:string;mechanicId:string;entryPointId:string;displayName:string};
const ORIGINAL:Identity={moduleId:"homebrew.family-e-tag",contentId:"option.family-e-tag",mechanicId:"external.unknown.family-e-tag",entryPointId:"tagged-target",displayName:"Tagged Target"};
const RENAMED:Identity={moduleId:"homebrew.renamed-family-e-tag",contentId:"option.renamed-family-e-tag",mechanicId:"external.renamed.family-e-tag",entryPointId:"renamed-tagged-target",displayName:"Renamed Tagged Target"};
const TAG="selector:marked";

function payload(identity:Identity) {
  return JSON.stringify({
    schemaVersion:"0.1-draft",moduleId:identity.moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Family E Tag Selector Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:identity.contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:identity.displayName,locales:{en:{name:identity.displayName}}},
      mechanics:[{kind:"common-play",config:{
        schemaVersion:"0.2-draft",id:identity.mechanicId,
        entryPoints:[{id:identity.entryPointId,invocation:"manual",targeting:{from:"targets",where:{op:"has-tag",ref:"status",value:TAG},min:1,max:1},operations:[]}],
      }}],
    }],
  });
}

async function execute(identity:Identity) {
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const internal=adapter as unknown as {scene:{entities:Array<{id:string;status:string[]}>}};
  const marked=internal.scene.entities.find((entity)=>entity.id==="combatant.goblin-a");
  assert.ok(marked);
  marked.status.push(TAG);

  const preview=await adapter.previewContentImport(payload(identity));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  const actionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(identity.contentId,identity.moduleId,"1"),
    mechanicId:identity.mechanicId,entryPointId:identity.entryPointId,
  });
  await adapter.resolveAction(actionId,["combatant.goblin-b"]);
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.actionId,actionId);
  assert.equal(snapshot.resolution?.finalOutcome,"적용 거부");

  await adapter.resolveAction(actionId,["combatant.goblin-a"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.resolution?.actionId,actionId);
  assert.deepEqual(snapshot.resolution?.targetIds,["combatant.goblin-a"]);
  return snapshot.resolution?.targetIds;
}

test("unknown installed Common Play has-tag selector uses authoritative Scene status and survives identity rename",async()=>{
  const original=await execute(ORIGINAL);
  const renamed=await execute(RENAMED);
  assert.deepEqual(renamed,original);
});
