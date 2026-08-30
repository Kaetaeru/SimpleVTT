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

type Identity={moduleId:string;contentId:string;mechanicId:string;entryPointId:string;displayName:string};
const ORIGINAL:Identity={moduleId:"homebrew.rich-selector-probe",contentId:"option.rich-selector-probe",mechanicId:"external.unknown.rich-selector-probe",entryPointId:"select-enemies",displayName:"Rich Selector Probe"};
const RENAMED:Identity={moduleId:"homebrew.renamed-rich-selector",contentId:"option.previously-unseen.rich-selector",mechanicId:"external.previously-unseen.rich-selector",entryPointId:"renamed-selector",displayName:"Completely Renamed Rich Selector"};

function payload(identity:Identity,area=false) {
  return JSON.stringify({
    schemaVersion:"0.1-draft",moduleId:identity.moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Rich Selector Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:identity.contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:identity.displayName,locales:{en:{name:identity.displayName,description:"Portable rich selector production probe"}}},
      mechanics:[{kind:"common-play",config:{
        schemaVersion:"0.2-draft",id:identity.mechanicId,
        entryPoints:[{id:identity.entryPointId,invocation:"manual",targeting:area
          ?{from:"targets",min:1,max:3,area:{kind:"instant",shape:"cone",origin:"self",lengthFeet:15}}
          :{from:"targets",min:1,max:2,where:{op:"eq",left:{ref:"relation"},right:{value:"enemy"}}},
          operations:[]}],
      }}],
    }],
  });
}

async function install(adapter:MockAdapter,identity:Identity,area=false) {
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(payload(identity,area));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  return installedCommonPlayActionId({catalogId:catalogQualifiedId(identity.contentId,identity.moduleId,"1"),mechanicId:identity.mechanicId,entryPointId:identity.entryPointId});
}


function automaticPayload(identity:Identity) {
  const authored=JSON.parse(payload(identity));
  authored.content[0].mechanics[0].config.entryPoints[0].targeting={
    from:"targets",selection:"automatic",min:1,max:1,orderBy:"hp",
    where:{op:"eq",left:{ref:"relation"},right:{value:"enemy"}},
  };
  return JSON.stringify(authored);
}

async function installAutomatic(adapter:MockAdapter,identity:Identity) {
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(automaticPayload(identity));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  return installedCommonPlayActionId({catalogId:catalogQualifiedId(identity.contentId,identity.moduleId,"1"),mechanicId:identity.mechanicId,entryPointId:identity.entryPointId});
}

async function execute(identity:Identity) {
  const adapter=new MockAdapter();
  const actionId=await install(adapter,identity);
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  await adapter.resolveAction(actionId,["char.aelar"]);
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.actionId,actionId);
  assert.equal(snapshot.resolution?.finalOutcome,"적용 거부");
  await adapter.resolveAction(actionId,["combatant.goblin-a","combatant.goblin-b"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.resolution?.actionId,actionId);
  assert.deepEqual(snapshot.resolution?.targetIds,["combatant.goblin-a","combatant.goblin-b"]);
  assert.ok(snapshot.resolution?.detail.some((line)=>/validated 2 target/.test(line)));
  return snapshot.resolution?.targetIds;
}

test("unknown installed target predicate gates the production Common Play path and survives identity rename",async()=>{
  const original=await execute(ORIGINAL);
  const renamed=await execute(RENAMED);
  assert.deepEqual(renamed,original);
});

test("unknown installed automatic selector uses host authority and authored ordering without manual target identity",async()=>{
  async function run(identity:Identity) {
    const adapter=new MockAdapter();
    const actionId=await installAutomatic(adapter,identity);
    await adapter.startInitiative();
    await adapter.setCurrentActor("char.aelar");
    await adapter.resolveAction(actionId,["char.aelar"]);
    const snapshot=await adapter.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"complete");
    assert.deepEqual(snapshot.resolution?.targetIds,["combatant.wolf"],"lowest-HP eligible enemy is selected by the shared orderBy kernel");
    return snapshot.resolution?.targetIds;
  }
  assert.deepEqual(await run(RENAMED),await run(ORIGINAL));
});

test("unknown installed area selector imports but refuses execution without provider-backed membership",async()=>{
  const adapter=new MockAdapter();
  const actionId=await install(adapter,ORIGINAL,true);
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  await adapter.resolveAction(actionId,["combatant.goblin-a"]);
  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.actionId,actionId);
  assert.equal(snapshot.resolution?.finalOutcome,"적용 거부");
});
