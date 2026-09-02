import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/installedContentRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import type { CharacterSheet, SceneVm } from "../../src/app/contracts";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { authoritativeCommonPlaySpatialRelation } from "../../src/app/realSpatialRuntimeService";
import { setSpatialRelation } from "../../src/app/spatialRuntimeContracts";

const TARGET_ID="combatant.goblin-a";
const MODULE_PROVENANCE="module:g09-compatible:spatial:session.g09";
const MODULE_ID="homebrew.mp-g09";
const CONTENT_ID="option.mp-g09";
const MECHANIC_ID="external.mp-g09-spatial";
const ENTRY_POINT_ID="spatial-target";

function payload() {
  return JSON.stringify({
    schemaVersion:"0.1-draft",moduleId:MODULE_ID,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"MP-G09 compatible spatial provider acceptance",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:CONTENT_ID,category:"option",
      presentation:{defaultLocale:"en",originalName:"G09 Spatial Target",locales:{en:{name:"G09 Spatial Target"}}},
      mechanics:[{kind:"common-play",config:{
        schemaVersion:"0.2-draft",id:MECHANIC_ID,
        entryPoints:[{
          id:ENTRY_POINT_ID,invocation:"manual",
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

function setProviderFacts(internal:{activeCharacter:CharacterSheet;scene:SceneVm},distanceFeet:number) {
  setSpatialRelation(internal.scene,{
    sourceId:internal.activeCharacter.id,
    targetId:TARGET_ID,
    distanceFeet,
    visible:true,
    cover:"none",
    targetCanSeeAttacker:true,
    withinReach:true,
    provenance:MODULE_PROVENANCE,
  });
}

test("MP-G09 compatible spatial provider keeps provenance and Host alone validates dependent mechanics",async()=>{
  const host=new MockAdapter();
  const hostState=connectedStateFor(host);
  hostState.mode="host";
  hostState.sessionId="session.g09";
  setInstalledContentStoreForTests(host,new MemoryInstalledContentStore());

  const preview=await host.previewContentImport(payload());
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await host.activateContentImport();
  await host.startInitiative();
  await host.setCurrentActor("char.aelar");

  const actionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(CONTENT_ID,MODULE_ID,"1"),
    mechanicId:MECHANIC_ID,
    entryPointId:ENTRY_POINT_ID,
  });
  const hostInternal=host as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};

  setProviderFacts(hostInternal,35);
  const authoritative=authoritativeCommonPlaySpatialRelation(hostInternal.scene,hostInternal.activeCharacter.id,TARGET_ID);
  assert.ok(authoritative,"compatible module relation must be accepted as Common Play spatial authority");
  assert.equal(authoritative.provenance,MODULE_PROVENANCE,"provider provenance must survive into the authoritative spatial fact");

  const client=new MockAdapter();
  const clientState=connectedStateFor(client);
  clientState.mode="client";
  clientState.sessionId="session.g09";
  const clientBefore=await client.getSnapshot();
  setSpatialRelation((client as unknown as {scene:SceneVm}).scene,{
    sourceId:"char.aelar",targetId:TARGET_ID,distanceFeet:5,visible:true,cover:"none",targetCanSeeAttacker:true,withinReach:true,
    provenance:"module:g09-client-local:spatial:session.g09",
  });
  const clientAttempt=await client.resolveAction(actionId,[TARGET_ID]);
  assert.equal(clientAttempt.resolution,clientBefore.resolution,"connected Client must not locally validate or commit the spatial-dependent action");

  const rejected=await host.resolveAction(actionId,[TARGET_ID]);
  assert.equal(rejected.resolution?.finalOutcome,"적용 거부",JSON.stringify(rejected.resolution));

  setProviderFacts(hostInternal,20);
  const accepted=await host.resolveAction(actionId,[TARGET_ID]);
  assert.equal(accepted.resolution?.stage,"complete",JSON.stringify(accepted.resolution));
  assert.deepEqual(accepted.resolution?.targetIds,[TARGET_ID]);
});
