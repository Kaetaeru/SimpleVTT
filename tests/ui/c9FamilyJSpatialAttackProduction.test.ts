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
import { runtimeResolutionEventHistory } from "../../src/app/runtimeResolutionEventHistory";
import { setSpatialRelation, type RuntimeCover } from "../../src/app/spatialRuntimeContracts";

const TARGET_ID="combatant.goblin-a";

type Identity={moduleId:string;contentId:string;mechanicId:string;entryPointId:string;displayName:string};
const ORIGINAL:Identity={moduleId:"homebrew.family-j-spatial-attack",contentId:"option.family-j-spatial-attack",mechanicId:"external.unknown.family-j-spatial-attack",entryPointId:"strike",displayName:"Spatial Strike"};
const RENAMED:Identity={moduleId:"homebrew.renamed-family-j-spatial-attack",contentId:"option.renamed-family-j-spatial-attack",mechanicId:"external.renamed.family-j-spatial-attack",entryPointId:"renamed-strike",displayName:"Renamed Spatial Strike"};

function packagePayload(identity:Identity) {
  return JSON.stringify({
    schemaVersion:"0.1-draft",moduleId:identity.moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Family J spatial attack probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:identity.contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:identity.displayName,locales:{en:{name:identity.displayName}}},
      mechanics:[{kind:"common-play",config:{
        schemaVersion:"0.2-draft",id:identity.mechanicId,
        payments:[{kind:"economy",bucket:"action",amount:{value:1},consumeAt:"commit",refundOnCancel:true}],
        entryPoints:[{
          id:identity.entryPointId,invocation:"manual",
          targeting:{
            from:"targets",min:1,max:1,
            where:{op:"all",args:[
              {op:"lte",left:{ref:"spatial.distance-feet"},right:{value:30}},
              {op:"eq",left:{ref:"spatial.within-reach"},right:{value:true}},
              {op:"eq",left:{ref:"spatial.total-cover"},right:{value:false}},
            ]},
          },
          test:{kind:"attack-roll",roller:"actor",dc:{value:10}},
          operations:[{kind:"damage.apply",amount:{value:3},damageType:"force",target:"target"}],
        }],
      }}],
    }],
  });
}

function setRelation(internal:{activeCharacter:CharacterSheet;scene:SceneVm},distanceFeet:number,withinReach:boolean,cover:RuntimeCover) {
  setSpatialRelation(internal.scene,{
    sourceId:internal.activeCharacter.id,targetId:TARGET_ID,distanceFeet,visible:true,cover,targetCanSeeAttacker:true,withinReach,
    provenance:"module:c9-family-j-spatial-attack",
  });
}

async function exercise(identity:Identity) {
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(packagePayload(identity));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  const actionId=installedCommonPlayActionId({catalogId:catalogQualifiedId(identity.contentId,identity.moduleId,"1"),mechanicId:identity.mechanicId,entryPointId:identity.entryPointId});

  setRelation(internal,35,true,"none");
  let snapshot=await adapter.resolveAction(actionId,[TARGET_ID]);
  assert.equal(snapshot.resolution?.finalOutcome,"적용 거부",JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);

  setRelation(internal,5,false,"none");
  snapshot=await adapter.resolveAction(actionId,[TARGET_ID]);
  assert.equal(snapshot.resolution?.finalOutcome,"적용 거부",JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);

  setRelation(internal,5,true,"total");
  snapshot=await adapter.resolveAction(actionId,[TARGET_ID]);
  assert.equal(snapshot.resolution?.finalOutcome,"적용 거부",JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);

  setRelation(internal,5,true,"half");
  await adapter.setQueuedD20(15);
  snapshot=await adapter.resolveAction(actionId,[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.notEqual(snapshot.resolution?.finalOutcome,"적용 거부",JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.resolution?.rollKind,"attack");
  assert.deepEqual(snapshot.resolution?.targetIds,[TARGET_ID]);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  const attack=runtimeResolutionEventHistory(adapter)?.events.find((event)=>event.kind==="attack.hit");
  assert.ok(attack,JSON.stringify(runtimeResolutionEventHistory(adapter)));
  assert.equal(attack.actorId,"char.aelar");
  assert.equal(attack.targetId,TARGET_ID);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);
}

test("unknown installed attack consumes authoritative range, reach, and Total Cover facts under identity rename",async()=>{
  await exercise(ORIGINAL);
  await exercise(RENAMED);
});
