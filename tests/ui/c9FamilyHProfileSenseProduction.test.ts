import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import type { ActionVm, CharacterSheet, SceneVm } from "../../src/app/contracts";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { setSpatialRelation } from "../../src/app/spatialRuntimeContracts";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "../../src/app/realResolutionService";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { compileCommonPlayEntryPointOperations, parseCommonPlayOperationDefinition } from "../../src/domain/commonPlayOperationRuntime";

const TARGET_ID="char.c9-family-h-profile-sense-target";
const CHECK_ID="action.c9-family-h-profile-sense-target.check";

type Identity={moduleId:string;contentId:string;mechanicId:string;interceptorId:string;interactionId:string;displayName:string};
const ORIGINAL:Identity={
  moduleId:"homebrew.c9-family-h-profile-sense",
  contentId:"item.c9-family-h-profile-sense",
  mechanicId:"external.c9-family-h-profile-sense",
  interceptorId:"verify-profile-sense",
  interactionId:"confirm-profile-sense",
  displayName:"Profile Sense Probe",
};

function payload(identity:Identity,expectedCanSee:boolean){
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:identity.moduleId,
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"C9 Family H Profile Sense Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:identity.contentId,
      category:"item",
      presentation:{defaultLocale:"en",originalName:identity.displayName,locales:{en:{name:identity.displayName,description:"Unknown external profile-derived sense probe"}}},
      mechanics:[{
        kind:"common-play",
        config:{
          schemaVersion:"0.2-draft",
          id:identity.mechanicId,
          interceptors:[{
            id:identity.interceptorId,
            timing:"d20.outcome-determined",
            factQueries:[
              {id:"source-sees-target",fact:"sense.can-see",subject:"intercepted.actor",authority:"dm",visibility:"dm",unknownPolicy:"block"},
              {id:"source-detects-target",fact:"sense.detected",subject:"intercepted.actor",authority:"dm",visibility:"dm",unknownPolicy:"block"},
            ],
            when:{op:"all",args:[
              {op:"eq",left:{ref:"source-sees-target"},right:{value:expectedCanSee}},
              {op:"eq",left:{ref:"source-detects-target"},right:{value:true}},
            ]},
            interaction:{id:identity.interactionId,kind:"choice",responder:"actor-owner",mode:"blocking",input:{type:"boolean"},revalidate:"if-revision-changed",stalePolicy:"reject"},
            operation:"recalculate",
            slot:"d20.roll",
            operations:[{kind:"roll.modify",mode:"subtract-die",dice:"1d4"}],
          }],
        },
      }],
    }],
  });
}

function targetCheck():ActionVm{
  return {
    id:CHECK_ID,actorId:TARGET_ID,name:"Profile Sense Target Check",category:"basic",target:"none",economy:"없음",
    resolutionKind:"ability-check",summary:"Strength +0",available:true,eligibleTargetIds:[],checkBonus:0,details:[{label:"판정",value:"근력"}],
  };
}

async function prepare(identity:Identity,expectedCanSee:boolean){
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  await adapter.startProductionLocalPlay("dm");
  const preview=await adapter.previewContentImport(payload(identity,expectedCanSee));
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
    id:TARGET_ID,name:"Profile Sense Target",side:"ally",kind:"character",hp:20,maxHp:20,tempHp:0,ac:12,initiative:18,
    status:[],resistances:[],immunities:[],vulnerabilities:[],reactions:[],
  });
  internal.scene.actionsByActor[TARGET_ID]=[targetCheck()];
  await adapter.startInitiative();
  return adapter;
}

function seedProfileSense(adapter:MockAdapter,sourceId:string,property:string,rangeFeet:number){
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  const state=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  assert.ok(state,"TurnRuntime state must exist before sense profile seeding");
  const definition=parseCommonPlayOperationDefinition({
    schemaVersion:"0.2-draft",id:sourceId,entryPoints:[{id:"activate",invocation:"manual",operations:[{
      kind:"property.modify",property,operation:"set",value:{value:rangeFeet},target:"actor",owner:"effect",source:"definition",
      duration:{kind:"elapsed",amount:{value:1},unit:"hours"},lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:"unique-by-source",
    }]}],
  });
  const pending=compileCommonPlayEntryPointOperations(SIMPLEVTT_APP_RULES_PROFILE,state!,definition,{
    resolutionId:`sense-profile.${sourceId}`,actorId:internal.activeCharacter.id,entryPointId:"activate",
  });
  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state!,pending);
  assert.notEqual(committed.status,"rejected");
  if(committed.status==="rejected")return;
  assert.equal(commitAdapterTurnRuntimeState(adapter,internal.scene,state!.revision,committed.state),true);
}

async function openInterrupt(adapter:MockAdapter){
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

test("unknown external Common Play derives all standard special senses from generic RulesProfile modifiers under identity rename",async()=>{
  const renamed:Identity={...ORIGINAL,moduleId:"external.c9-family-h-profile-sense-renamed",contentId:"item.c9-family-h-profile-sense-renamed",mechanicId:"mechanic.c9-family-h-profile-sense-renamed",interceptorId:"interceptor.c9-family-h-profile-sense-renamed",interactionId:"interaction.c9-family-h-profile-sense-renamed",displayName:"Renamed Profile Sense Probe"};
  const scenarios=[
    {label:"darkvision",property:"sense.darkvision.range-feet",rangeFeet:60,light:"darkness" as const,obscurement:"none" as const,targetInvisible:false,expectedCanSee:true,visible:true,sharedGroundContact:false},
    {label:"blindsight",property:"sense.blindsight.range-feet",rangeFeet:60,light:"dim" as const,obscurement:"heavy" as const,targetInvisible:true,expectedCanSee:true,visible:true,sharedGroundContact:false},
    {label:"tremorsense",property:"sense.tremorsense.range-feet",rangeFeet:60,light:"dim" as const,obscurement:"none" as const,targetInvisible:true,expectedCanSee:false,visible:false,sharedGroundContact:true},
    {label:"truesight",property:"sense.truesight.range-feet",rangeFeet:120,light:"darkness" as const,obscurement:"none" as const,targetInvisible:true,expectedCanSee:true,visible:true,sharedGroundContact:false},
  ];
  for(const identity of [ORIGINAL,renamed]){
    for(const scenario of scenarios){
      const adapter=await prepare(identity,scenario.expectedCanSee);
      const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
      setSpatialRelation(internal.scene,{
        sourceId:internal.activeCharacter.id,targetId:TARGET_ID,distanceFeet:30,visible:scenario.visible,cover:"none",targetCanSeeAttacker:true,
        light:scenario.light,obscurement:scenario.obscurement,targetInvisible:scenario.targetInvisible,sharedGroundContact:scenario.sharedGroundContact,
        provenance:`module:c9-family-h-profile-sense:${scenario.label}`,
      });
      seedProfileSense(adapter,`${identity.moduleId}.${scenario.label}`,scenario.property,scenario.rangeFeet);
      let snapshot=await openInterrupt(adapter);
      assert.equal(snapshot.resolution?.stage,"interrupt",`${scenario.label}: ${JSON.stringify(snapshot.resolution)}`);
      snapshot=await adapter.respondToInterrupt(false);
      assert.equal(snapshot.resolution?.stage,"complete",`${scenario.label}: ${JSON.stringify(snapshot.resolution)}`);
    }
  }
});
