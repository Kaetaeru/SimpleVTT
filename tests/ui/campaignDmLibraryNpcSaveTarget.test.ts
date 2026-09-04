import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/sessionInventoryRuntimeAdapter";
import "../../src/app/campaignRuntimeAdapter";
import "../../src/app/campaignDmLibraryMaterializationAdapter";
import "../../src/app/campaignDmLibraryOrganizationContracts";
import "../../src/app/campaignDmLibraryOrganizationRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { setCampaignLibraryStoreForTests } from "../../src/app/campaignRuntimeAdapter";
import { parseCampaignDmLibraryJson } from "../../src/app/campaignDmLibraryImport";
import type { CampaignNpcActorDefinition } from "../../src/app/campaignPersistenceContracts";

const GOBLIN_STATS={abilities:{str:8,dex:14,con:10,int:10,wis:8,cha:8},proficiencyBonus:2,savingThrowProficiencies:[],speed:30,resistances:[],immunities:[],vulnerabilities:[]};
const GOBLIN_ACTIONS=[
  {id:"scimitar",name:"시미터",category:"weapon" as const,sourceKind:"weapon" as const,attackBonus:4,rangeFeet:5,damage:{type:"참격",dice:"1d6",flat:2}},
  {id:"shortbow",name:"숏보우",category:"weapon" as const,sourceKind:"weapon" as const,attackBonus:4,rangeFeet:80,damage:{type:"관통",dice:"1d6",flat:2}},
];

function goblin(definitionId:string,structured:boolean):CampaignNpcActorDefinition {
  return {definitionId,name:"고블린",nameEn:"Goblin",ac:15,maxHp:21,actions:["시미터","숏보우"],statusImmunities:[],source:"test",version:"1",...(structured?{runtimeStats:structuredClone(GOBLIN_STATS),runtimeActions:structuredClone(GOBLIN_ACTIONS)}:{})};
}

async function dmWithNpc(campaignId:string,definition:CampaignNpcActorDefinition) {
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  await adapter.setReferenceRole("dm");
  await adapter.getSnapshot();
  await adapter.createCampaign({campaignId,name:campaignId});
  await adapter.upsertCampaignDmLibraryEntry(campaignId,{entryId:"entry.goblin",kind:"npc-definition",label:"고블린",definitionId:definition.definitionId,favorite:false,tags:[],npcDefinition:definition});
  const spawned=await adapter.instantiateCampaignDmLibraryNpcDefinition(campaignId,"entry.goblin");
  const npc=spawned.scene.entities.find((entry)=>entry.id.startsWith(definition.definitionId));
  assert.ok(npc,"the NPC must enter the Scene");
  return {adapter,npc,spawned};
}

async function complete(adapter:MockAdapter) {
  let snapshot=await adapter.getSnapshot();
  for (let step=0;step<10&&snapshot.resolution&&snapshot.resolution.stage!=="complete";step+=1) {
    if (!snapshot.resolution.canAdvance) break;
    snapshot=await adapter.advanceResolution();
  }
  return snapshot;
}

async function forceSavingThrow(adapter:MockAdapter,targetId:string) {
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const snapshot=await adapter.getSnapshot();
  const save=(snapshot.scene.actionsByActor["char.aelar"]??[]).find((action)=>action.resolutionKind==="saving-throw"&&action.available);
  assert.ok(save,"Aelar needs a saving-throw action");
  await adapter.setQueuedD20(3);
  await adapter.resolveAction(save.id,[targetId]);
  return complete(adapter);
}

// Reproduced on real Windows H+P1+P2 (W9-02 family C, MP-C13): a Cleric's Sacred Flame at a DM Library goblin was
// refused with "시전 거부 · missing runtime combatant stat definition". The runtime deliberately rejects saves against
// a Combatant without an authored ability block, so DM Library NPC definitions can now author the same structured
// runtime stats and atomic attack actions the Combatant JSON import accepts.
test("a structured DM Library NPC answers saving throws and projects its authored attacks",async()=>{
  const {adapter,npc,spawned}=await dmWithNpc("campaign.npc-structured",goblin("local.npc-structured.goblin",true));
  const actions=spawned.scene.actionsByActor[npc.id]??[];
  assert.ok(actions.some((action)=>action.name==="시미터"&&action.attackBonus===4),`structured actions must project the authored scimitar; have ${actions.map((action)=>`${action.name}:${action.attackBonus}`).join(", ")}`);
  assert.ok(actions.some((action)=>action.name==="숏보우"));
  assert.equal(spawned.scene.economyByActor[npc.id]?.movementMax,30);
  const done=await forceSavingThrow(adapter,npc.id);
  assert.equal(done.resolution?.stage,"complete");
  assert.doesNotMatch(done.resolution?.finalOutcome??"",/거부|missing runtime combatant stat definition/,done.resolution?.compact);
  assert.ok((done.resolution?.saveResults??[]).some((entry)=>entry.targetId===npc.id),`the NPC must roll its save; got ${JSON.stringify(done.resolution?.saveResults)}`);
});

test("a legacy DM Library NPC without an ability block keeps its legacy actions and stays an explicit save reject",async()=>{
  const {adapter,npc,spawned}=await dmWithNpc("campaign.npc-legacy",goblin("local.npc-legacy.goblin",false));
  const actions=spawned.scene.actionsByActor[npc.id]??[];
  assert.ok(actions.some((action)=>/시미터/.test(action.name)),`legacy actions stay projected; have ${actions.map((action)=>action.name).join(", ")||"(none)"}`);
  const done=await forceSavingThrow(adapter,npc.id);
  // The runtime keeps its explicit reject for unstructured Combatants: no save is ever rolled against the NPC.
  assert.equal((done.resolution?.saveResults??[]).some((entry)=>entry.targetId===npc.id),false,JSON.stringify(done.resolution?.saveResults));
  if (done.resolution) assert.match(done.resolution.finalOutcome??"",/missing runtime combatant stat definition|시전 거부|거부/,done.resolution.compact);
});

test("the DM Library JSON import parses structured NPC runtime stats and actions and rejects invalid ones",()=>{
  const context={campaignId:"campaign.import",campaignName:"Import",createEntryId:()=>"entry.generated"};
  const entries=parseCampaignDmLibraryJson(JSON.stringify([{kind:"npc-definition",label:"고블린",definitionId:"local.import.goblin",npcDefinition:goblin("local.import.goblin",true)}]),context);
  const npc=entries[0]?.npcDefinition;
  assert.ok(npc,"import must yield the NPC definition");
  assert.deepEqual(npc.runtimeStats?.abilities,GOBLIN_STATS.abilities);
  assert.equal(npc.runtimeActions?.length,2);
  assert.throws(()=>parseCampaignDmLibraryJson(JSON.stringify([{kind:"npc-definition",label:"고블린",definitionId:"local.import.bad",npcDefinition:{...goblin("local.import.bad",true),runtimeStats:{abilities:{str:99}}}}]),context),/abilities\.str/);
});

test("upserting an NPC definition with invalid structured actions is refused",async()=>{
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  await adapter.setReferenceRole("dm");
  await adapter.getSnapshot();
  await adapter.createCampaign({campaignId:"campaign.npc-invalid",name:"Invalid"});
  const bad={...goblin("local.npc-invalid.goblin",true),runtimeActions:[{...GOBLIN_ACTIONS[0],damage:{type:"참격",dice:"lots",flat:2}}]} as CampaignNpcActorDefinition;
  await assert.rejects(adapter.upsertCampaignDmLibraryEntry("campaign.npc-invalid",{entryId:"entry.bad",kind:"npc-definition",label:"고블린",definitionId:bad.definitionId,favorite:false,tags:[],npcDefinition:bad}),/damage dice/);
});
