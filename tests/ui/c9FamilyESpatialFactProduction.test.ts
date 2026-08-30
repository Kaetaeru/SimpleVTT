import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/installedContentRuntimeAdapter";
import type { SceneVm } from "../../src/app/contracts";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { setSpatialRelation } from "../../src/app/spatialRuntimeContracts";

type Identity={moduleId:string;contentId:string;mechanicId:string;rangeEntryPointId:string;reachEntryPointId:string;displayName:string};
const ORIGINAL:Identity={moduleId:"homebrew.family-e-spatial",contentId:"option.family-e-spatial",mechanicId:"external.unknown.family-e-spatial",rangeEntryPointId:"spatial-target",reachEntryPointId:"reach-target",displayName:"Spatial Target"};
const RENAMED:Identity={moduleId:"homebrew.renamed-family-e-spatial",contentId:"option.renamed-family-e-spatial",mechanicId:"external.renamed.family-e-spatial",rangeEntryPointId:"renamed-spatial-target",reachEntryPointId:"renamed-reach-target",displayName:"Renamed Spatial Target"};

function payload(identity:Identity) {
  const target=(id:string,where:unknown)=>({id,invocation:"manual",targeting:{from:"targets",min:1,max:1,where},operations:[]});
  return JSON.stringify({
    schemaVersion:"0.1-draft",moduleId:identity.moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Family E Spatial Fact Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:identity.contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:identity.displayName,locales:{en:{name:identity.displayName}}},
      mechanics:[{kind:"common-play",config:{
        schemaVersion:"0.2-draft",id:identity.mechanicId,
        entryPoints:[
          target(identity.rangeEntryPointId,{op:"all",args:[
            {op:"lte",left:{ref:"spatial.distance-feet"},right:{value:30}},
            {op:"eq",left:{ref:"sense.can-see"},right:{value:true}},
            {op:"eq",left:{ref:"spatial.total-cover"},right:{value:false}},
          ]}),
          target(identity.reachEntryPointId,{op:"lte",left:{ref:"spatial.distance-feet"},right:{value:10}}),
        ],
      }}],
    }],
  });
}

function spatial(scene:SceneVm,targetId:string,distanceFeet:number,visible:boolean,cover:"none"|"half"|"three-quarters"|"total",provenance="module:c9-family-e-spatial-probe") {
  setSpatialRelation(scene,{sourceId:"char.aelar",targetId,distanceFeet,visible,cover,targetCanSeeAttacker:true,provenance});
}

async function execute(identity:Identity) {
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const scene=(adapter as unknown as {scene:SceneVm}).scene;
  spatial(scene,"combatant.goblin-a",10,true,"half");
  spatial(scene,"combatant.goblin-b",20,false,"none");
  spatial(scene,"combatant.training-guardian",40,true,"none");
  spatial(scene,"combatant.wolf",5,true,"total");
  spatial(scene,"char.aelar",0,true,"none","test:untrusted-spatial-fact");

  const preview=await adapter.previewContentImport(payload(identity));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  const action=(entryPointId:string)=>installedCommonPlayActionId({
    catalogId:catalogQualifiedId(identity.contentId,identity.moduleId,"1"),
    mechanicId:identity.mechanicId,entryPointId,
  });
  const rangeActionId=action(identity.rangeEntryPointId);
  for(const targetId of ["combatant.goblin-b","combatant.training-guardian","combatant.wolf","char.aelar"]) {
    await adapter.resolveAction(rangeActionId,[targetId]);
    assert.equal((await adapter.getSnapshot()).resolution?.finalOutcome,"적용 거부");
  }
  await adapter.resolveAction(rangeActionId,["combatant.goblin-a"]);
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.deepEqual(snapshot.resolution?.targetIds,["combatant.goblin-a"]);

  const reachActionId=action(identity.reachEntryPointId);
  await adapter.resolveAction(reachActionId,["combatant.training-guardian"]);
  assert.equal((await adapter.getSnapshot()).resolution?.finalOutcome,"적용 거부");
  await adapter.resolveAction(reachActionId,["combatant.goblin-a"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.deepEqual(snapshot.resolution?.targetIds,["combatant.goblin-a"]);
  return snapshot.resolution?.targetIds;
}

test("unknown installed Common Play consumes trusted spatial range, reach, sight, and Total Cover facts and survives identity rename",async()=>{
  assert.deepEqual(await execute(RENAMED),await execute(ORIGINAL));
});
