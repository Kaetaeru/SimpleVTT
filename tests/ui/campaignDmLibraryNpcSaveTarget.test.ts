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

async function complete(adapter:MockAdapter) {
  let snapshot=await adapter.getSnapshot();
  for (let step=0;step<10&&snapshot.resolution&&snapshot.resolution.stage!=="complete";step+=1) {
    if (!snapshot.resolution.canAdvance) break;
    snapshot=await adapter.advanceResolution();
  }
  return snapshot;
}

// Reproduced on real Windows H+P1+P2 (W9-02 family C, MP-C13): a Cleric's Sacred Flame at a DM Library goblin was
// refused with "시전 거부 · missing runtime combatant stat definition: local.w9.c.goblin.instance-1".
test("a DM Library NPC can be the target of a saving throw",async()=>{
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  await adapter.setReferenceRole("dm");
  await adapter.getSnapshot();
  await adapter.createCampaign({campaignId:"campaign.npc-save",name:"NPC Save Target"});
  await adapter.upsertCampaignDmLibraryEntry("campaign.npc-save",{entryId:"entry.goblin",kind:"npc-definition",label:"고블린",definitionId:"local.npc-save.goblin",favorite:false,tags:[],npcDefinition:{definitionId:"local.npc-save.goblin",name:"고블린",nameEn:"Goblin",ac:15,maxHp:21,actions:["시미터"],statusImmunities:[],source:"test",version:"1"}});
  const spawned=await adapter.instantiateCampaignDmLibraryNpcDefinition("campaign.npc-save","entry.goblin");
  const npc=spawned.scene.entities.find((entry)=>entry.id.startsWith("local.npc-save.goblin"));
  assert.ok(npc,"the NPC must enter the Scene");
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const snapshot=await adapter.getSnapshot();
  const save=(snapshot.scene.actionsByActor["char.aelar"]??[]).find((action)=>action.resolutionKind==="saving-throw"&&action.available);
  assert.ok(save,`Aelar needs a saving-throw action; have ${(snapshot.scene.actionsByActor["char.aelar"]??[]).map((action)=>`${action.id}:${action.resolutionKind}`).join(", ")}`);
  await adapter.setQueuedD20(3);
  const started=await adapter.resolveAction(save.id,[npc.id]);
  assert.ok(started.resolution,"the saving-throw action must open a Resolution");
  assert.doesNotMatch(started.resolution.finalOutcome??"",/거부|missing runtime combatant stat definition/,started.resolution.compact);
  const done=await complete(adapter);
  assert.equal(done.resolution?.stage,"complete");
  assert.doesNotMatch(done.resolution?.finalOutcome??"",/거부|missing runtime combatant stat definition/,done.resolution?.compact);
  assert.ok((done.resolution?.saveResults??[]).some((entry)=>entry.targetId===npc.id),`the NPC must roll its save; got ${JSON.stringify(done.resolution?.saveResults)}`);
});
