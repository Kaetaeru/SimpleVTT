import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/installedContentRuntimeAdapter";
import type { CharacterSheet, SceneVm } from "../../src/app/contracts";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { setSpatialRelation, type RuntimeCover } from "../../src/app/spatialRuntimeContracts";

type Identity={moduleId:string;contentId:string;mechanicId:string;entryPointId:string;displayName:string};
const ORIGINAL:Identity={moduleId:"homebrew.family-e-spatial",contentId:"option.family-e-spatial",mechanicId:"external.unknown.family-e-spatial",entryPointId:"spatial-target",displayName:"Spatial Target"};
const RENAMED:Identity={moduleId:"homebrew.renamed-family-e-spatial",contentId:"option.renamed-family-e-spatial",mechanicId:"external.renamed.family-e-spatial",entryPointId:"renamed-spatial-target",displayName:"Renamed Spatial Target"};
const TARGET_ID="combatant.goblin-a";

function payload(identity:Identity) {
  return JSON.stringify({
    schemaVersion:"0.1-draft",moduleId:identity.moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Family E spatial selector probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:identity.contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:identity.displayName,locales:{en:{name:identity.displayName}}},
      mechanics:[{kind:"common-play",config:{
        schemaVersion:"0.2-draft",id:identity.mechanicId,
        entryPoints:[{
          id:identity.entryPointId,invocation:"manual",
          targeting:{
            from:"targets",min:1,max:1,
            where:{op:"all",args:[
              {op:"lte",left:{ref:"spatial.distance-feet"},right:{value:30}},
              {op:"eq",left:{ref:"sense.can-see"},right:{value:true}},
              {op:"eq",left:{ref:"spatial.within-reach"},right:{value:true}},
              {op:"eq",left:{ref:"spatial.total-cover"},right:{value:false}},
            ]},
          },
          operations:[],
        }],
      }}],
    }],
  });
}

function setRelation(internal:{activeCharacter:CharacterSheet;scene:SceneVm},distanceFeet:number,visible:boolean,cover:RuntimeCover,withinReach:boolean) {
  setSpatialRelation(internal.scene,{
    sourceId:internal.activeCharacter.id,targetId:TARGET_ID,distanceFeet,visible,cover,targetCanSeeAttacker:true,withinReach,
    provenance:"module:c9-family-e-spatial:selector",
  });
}

async function exercise(identity:Identity) {
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(payload(identity));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  const actionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(identity.contentId,identity.moduleId,"1"),
    mechanicId:identity.mechanicId,entryPointId:identity.entryPointId,
  });

  for(const [distanceFeet,visible,cover,withinReach] of [
    [35,true,"none",true],
    [20,false,"none",true],
    [20,true,"total",true],
    [5,true,"none",false],
  ] as const) {
    setRelation(internal,distanceFeet,visible,cover,withinReach);
    const rejected=await adapter.resolveAction(actionId,[TARGET_ID]);
    assert.equal(rejected.resolution?.finalOutcome,"적용 거부",JSON.stringify(rejected.resolution));
  }

  // Reach is provider-owned: a module may author a reach result that is not derivable from distance alone.
  setRelation(internal,20,true,"half",true);
  const accepted=await adapter.resolveAction(actionId,[TARGET_ID]);
  assert.equal(accepted.resolution?.stage,"complete",JSON.stringify(accepted.resolution));
  assert.deepEqual(accepted.resolution?.targetIds,[TARGET_ID]);
  return accepted.resolution?.targetIds;
}

test("unknown installed selector consumes authoritative range, sight, reach, and Total Cover facts under identity rename",async()=>{
  const original=await exercise(ORIGINAL);
  const renamed=await exercise(RENAMED);
  assert.deepEqual(renamed,original);
});
