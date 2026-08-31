import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import type { CharacterSheet, SceneVm } from "../../src/app/contracts";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { setSpatialRelation } from "../../src/app/spatialRuntimeContracts";

type Identity={moduleId:string;contentId:string;mechanicId:string;interceptorId:string;interactionId:string;displayName:string};

const ORIGINAL:Identity={
  moduleId:"homebrew.tremorsense-probe",
  contentId:"item.tremorsense-probe",
  mechanicId:"external.tremorsense-probe",
  interceptorId:"detect-by-tremor",
  interactionId:"tremor-choice",
  displayName:"Tremorsense Probe",
};

function packagePayload(identity:Identity){
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:identity.moduleId,
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"Portable Tremorsense Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:identity.contentId,
      category:"item",
      presentation:{defaultLocale:"en",originalName:identity.displayName,locales:{en:{name:identity.displayName,description:"Unknown external Tremorsense reaction"}}},
      mechanics:[{
        kind:"common-play",
        config:{
          schemaVersion:"0.2-draft",
          id:identity.mechanicId,
          payments:[{kind:"economy",bucket:"reaction",amount:{value:1},consumeAt:"commit"}],
          interceptors:[{
            id:identity.interceptorId,
            timing:"d20.outcome-determined",
            factQueries:[{id:"target-detected",fact:"sense.detected",subject:"intercepted.actor",authority:"dm",visibility:"dm",unknownPolicy:"treat-false"}],
            when:{op:"eq",left:{ref:"target-detected"},right:{value:true}},
            interaction:{id:identity.interactionId,kind:"choice",responder:"actor-owner",mode:"blocking",input:{type:"boolean"},revalidate:"if-revision-changed",stalePolicy:"reject"},
            operation:"recalculate",
            slot:"d20.roll",
            operations:[{kind:"roll.modify",mode:"minimum",value:{value:1}}],
          }],
        },
      }],
    }],
  });
}

async function prepare(identity:Identity,sharedGroundContact:boolean){
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
  setSpatialRelation(internal.scene,{
    sourceId:internal.activeCharacter.id,
    targetId:"combatant.goblin-a",
    distanceFeet:20,
    visible:false,
    cover:"none",
    targetCanSeeAttacker:false,
    observerSenses:[{kind:"tremorsense",rangeFeet:30}],
    targetInvisible:true,
    targetAudible:false,
    observerCanHear:false,
    sharedGroundContact,
    light:"darkness",
    obscurement:"heavy",
    provenance:`module:tremor-map:${sharedGroundContact?"grounded":"separated"}`,
  });
  await adapter.startInitiative();
  await adapter.setCurrentActor("combatant.goblin-a");
  return adapter;
}

async function openAttack(identity:Identity,sharedGroundContact:boolean){
  const adapter=await prepare(identity,sharedGroundContact);
  const owner=(await adapter.getSnapshot()).activeCharacter.id;
  await adapter.setQueuedD20(18);
  let snapshot=await adapter.resolveAction("action.scimitar",[owner]);
  for(let step=0;step<4&&snapshot.resolution?.stage!=="interrupt"&&snapshot.resolution?.stage!=="complete";step++)snapshot=await adapter.advanceResolution();
  return snapshot;
}

test("unknown installed Common Play consumes production Tremorsense detection without content identity dispatch",async()=>{
  const renamed:Identity={
    moduleId:"external.renamed-tremor-module",
    contentId:"item.renamed-tremor-content",
    mechanicId:"mechanic.renamed-tremor",
    interceptorId:"renamed-tremor-interceptor",
    interactionId:"renamed-tremor-choice",
    displayName:"Renamed Tremor Probe",
  };
  for(const identity of [ORIGINAL,renamed]){
    const detected=await openAttack(identity,true);
    assert.equal(detected.resolution?.stage,"interrupt",JSON.stringify(detected.resolution));
    const separated=await openAttack(identity,false);
    assert.notEqual(separated.resolution?.stage,"interrupt","Tremorsense must not detect without shared ground contact");
  }
});
