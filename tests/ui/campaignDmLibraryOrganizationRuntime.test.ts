import assert from "node:assert/strict";
import test from "node:test";
import type { AppSnapshot, CombatantDefinitionVm } from "../../src/app/contracts";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { setCampaignLibraryStoreForTests } from "../../src/app/campaignRuntimeAdapter";
import "../../src/app/campaignDmLibraryOrganizationContracts";
import "../../src/app/campaignDmLibraryOrganizationRuntimeAdapter";

const CAMPAIGN_ID="campaign.dm-library-organization";

function presetEntry(folderId?:string){
  return {
    entryId:"dm-pc-preset.guard",
    kind:"pc-preset" as const,
    label:"호위 기사",
    definitionId:"local.guard.preset",
    folderId,
    favorite:false,
    tags:["아군","기사"],
    pcPreset:{definitionId:"local.guard.preset",name:"호위 기사",level:3,ac:16,maxHp:28,actions:["장검"],statusImmunities:[],source:"Campaign DM Library · Test",version:"1"},
  };
}

test("DM Library folders organize entries without owning or deleting the preset asset",async()=>{
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  await adapter.createCampaign({campaignId:CAMPAIGN_ID,name:"Library Organization"});

  await adapter.upsertCampaignDmLibraryFolder(CAMPAIGN_ID,{folderId:"folder.allies",label:"아군"});
  await adapter.upsertCampaignDmLibraryEntry(CAMPAIGN_ID,presetEntry("folder.allies"));

  let snapshot=await adapter.getSnapshot();
  let campaign=snapshot.campaigns?.find((candidate)=>candidate.campaignId===CAMPAIGN_ID);
  assert.deepEqual(campaign?.dmLibrary.folders,[{folderId:"folder.allies",label:"아군"}]);
  assert.equal(campaign?.dmLibrary.entries.find((entry)=>entry.entryId==="dm-pc-preset.guard")?.folderId,"folder.allies");

  await adapter.removeCampaignDmLibraryFolder(CAMPAIGN_ID,"folder.allies");
  snapshot=await adapter.getSnapshot();
  campaign=snapshot.campaigns?.find((candidate)=>candidate.campaignId===CAMPAIGN_ID);
  assert.deepEqual(campaign?.dmLibrary.folders,[]);
  const preserved=campaign?.dmLibrary.entries.find((entry)=>entry.entryId==="dm-pc-preset.guard");
  assert.ok(preserved);
  assert.equal(preserved?.folderId,undefined);
  assert.equal(preserved?.pcPreset?.definitionId,"local.guard.preset");
});

test("PC preset validates folder authority and materializes through existing combatant creation",async()=>{
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  await adapter.createCampaign({campaignId:CAMPAIGN_ID,name:"Library Organization"});

  await assert.rejects(()=>adapter.upsertCampaignDmLibraryEntry(CAMPAIGN_ID,presetEntry("folder.missing")),/folder not found/i);
  await adapter.upsertCampaignDmLibraryEntry(CAMPAIGN_ID,presetEntry());

  const definitions:CombatantDefinitionVm[]=[];
  (adapter as unknown as {combatantDefinitions:CombatantDefinitionVm[]}).combatantDefinitions=definitions;
  let instantiated:string|null=null;
  adapter.instantiateCombatant=async(definitionId:string)=>{instantiated=definitionId;return adapter.getSnapshot() as Promise<AppSnapshot>;};

  await adapter.instantiateCampaignDmLibraryPcPreset(CAMPAIGN_ID,"dm-pc-preset.guard");
  assert.equal(instantiated,"local.guard.preset");
  assert.equal(definitions.find((definition)=>definition.id==="local.guard.preset")?.name,"호위 기사");

  const snapshot=await adapter.getSnapshot();
  const campaign=snapshot.campaigns?.find((candidate)=>candidate.campaignId===CAMPAIGN_ID);
  assert.equal(campaign?.dmLibrary.recentEntryIds[0],"dm-pc-preset.guard");
});
