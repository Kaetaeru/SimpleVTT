import assert from "node:assert/strict";
import test from "node:test";

import "../../src/app/offlineRuntimeAdapters";
import type { ActionVm, CharacterSheet, SceneVm } from "../../src/app/contracts";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { setSpatialRelation } from "../../src/app/spatialRuntimeContracts";

const TARGET_ID="char.c9-family-g-adjacent-target";
const CHECK_ID="action.c9-family-g-adjacent-check";

type Identity={moduleId:string;contentId:string;mechanicId:string;interceptorId:string;interactionId:string;displayName:string};

const ORIGINAL:Identity={
  moduleId:"external.c9-family-g-adjacent",
  contentId:"item.c9-family-g-adjacent",
  mechanicId:"mechanic.c9-family-g-adjacent",
  interceptorId:"interceptor.c9-family-g-adjacent",
  interactionId:"interaction.c9-family-g-adjacent",
  displayName:"Portable Adjacent Probe",
};

function packagePayload(identity:Identity){
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:identity.moduleId,
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"Unknown Family G adjacency probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:identity.contentId,
      category:"item",
      presentation:{defaultLocale:"en",originalName:identity.displayName,locales:{en:{name:identity.displayName}}},
      mechanics:[{
        kind:"common-play",
        config:{
          schemaVersion:"0.2-draft",
          id:identity.mechanicId,
          interceptors:[{
            id:identity.interceptorId,
            timing:"d20.outcome-determined",
            factQueries:[{
              id:"target-adjacent",
              fact:"spatial.adjacent",
              subject:"intercepted.actor",
              authority:"host",
              visibility:"public",
              unknownPolicy:"block",
            }],
            when:{op:"eq",left:{ref:"target-adjacent"},right:{value:true}},
            interaction:{
              id:identity.interactionId,
              kind:"choice",
              responder:"actor-owner",
              mode:"blocking",
              input:{type:"boolean"},
              revalidate:"if-revision-changed",
              stalePolicy:"reject",
            },
            operation:"recalculate",
            slot:"d20.roll",
            operations:[{kind:"roll.modify",mode:"minimum",value:{value:1}}],
          }],
        },
      }],
    }],
  });
}

function targetCheck():ActionVm{
  return {
    id:CHECK_ID,actorId:TARGET_ID,name:"Family G adjacency check",category:"basic",target:"none",economy:"없음",
    resolutionKind:"ability-check",summary:"Strength +0",available:true,eligibleTargetIds:[],checkBonus:0,
    details:[{label:"판정",value:"근력"}],
  };
}

async function prepare(identity:Identity,distanceFeet:number){
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  await adapter.startProductionLocalPlay("dm");
  const preview=await adapter.previewContentImport(packagePayload(identity));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();

  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  internal.activeCharacter.items.push({
    id:`owned.${identity.contentId}`,
    definitionId:identity.contentId,
    name:identity.displayName,
    nameEn:identity.displayName,
    kind:"magic",quantity:1,equipped:true,passiveEffects:[],grantedActionIds:[],provenance:[identity.moduleId],
  });
  internal.scene.entities.push({
    id:TARGET_ID,name:"Family G Target",side:"ally",kind:"character",hp:20,maxHp:20,tempHp:0,ac:12,initiative:18,
    status:[],resistances:[],immunities:[],vulnerabilities:[],reactions:[],
  });
  internal.scene.actionsByActor[TARGET_ID]=[targetCheck()];
  setSpatialRelation(internal.scene,{
    sourceId:internal.activeCharacter.id,
    targetId:TARGET_ID,
    distanceFeet,
    visible:true,
    cover:"none",
    targetCanSeeAttacker:true,
    provenance:"module:c9-family-g-adjacent:spatial",
  });
  await adapter.startInitiative();
  return adapter;
}

async function resolveSuccessfulCheck(adapter:MockAdapter){
  await adapter.setCurrentActor(TARGET_ID);
  await adapter.setQueuedD20(15);
  let snapshot=await adapter.resolveAction(CHECK_ID,[]);
  assert.equal(snapshot.resolution?.stage,"roll-animation",JSON.stringify(snapshot.resolution));
  snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"effect-preview",JSON.stringify(snapshot.resolution));
  const total=snapshot.resolution?.rollTotal;
  assert.equal(typeof total,"number");
  return adapter.applyDmAdjudication({type:"ability-check-dc",scope:"resolution",value:total!-2});
}

test("unknown installed Common Play derives adjacency from authoritative production distance",async()=>{
  const adjacent=await resolveSuccessfulCheck(await prepare(ORIGINAL,5));
  assert.equal(adjacent.resolution?.stage,"interrupt",JSON.stringify(adjacent.resolution));

  const separated=await resolveSuccessfulCheck(await prepare(ORIGINAL,10));
  assert.notEqual(separated.resolution?.stage,"interrupt","10ft target must not satisfy spatial.adjacent");
});

test("Family G production adjacency is invariant under every external identity rename",async()=>{
  const renamed:Identity={
    moduleId:"external.completely-renamed-g",
    contentId:"item.completely-renamed-g",
    mechanicId:"mechanic.completely-renamed-g",
    interceptorId:"interceptor.completely-renamed-g",
    interactionId:"interaction.completely-renamed-g",
    displayName:"Completely Renamed Spatial Probe",
  };
  for(const identity of [ORIGINAL,renamed]){
    const snapshot=await resolveSuccessfulCheck(await prepare(identity,5));
    assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));
  }
});
