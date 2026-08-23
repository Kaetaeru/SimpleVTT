import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/sessionInventoryRuntimeAdapter";
import "../../src/app/campaignRuntimeAdapter";
import "../../src/app/campaignDmLibraryMaterializationAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { setCampaignLibraryStoreForTests } from "../../src/app/campaignRuntimeAdapter";

test("deleting a DM Library definition does not delete an already granted Character item or its provenance",async()=>{
  const adapter=new MockAdapter();setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  await adapter.getSnapshot();await adapter.createCampaign({campaignId:"campaign.provenance",name:"Provenance"});
  const template={definitionId:"local.provenance.moon-seal",name:"달의 인장",nameEn:"Moon Seal",kind:"magic" as const,passiveEffects:["표시용 문구"],grantedActionIds:[],provenance:["Campaign DM Library · Provenance"]};
  await adapter.upsertCampaignDmLibraryEntry("campaign.provenance",{entryId:"entry.moon-seal",kind:"custom-item",label:"달의 인장",definitionId:template.definitionId,itemTemplate:template});
  let snapshot=await adapter.grantCampaignDmLibraryItem("campaign.provenance","entry.moon-seal",{kind:"character",actorId:"char.aelar"},1);
  const granted=snapshot.sessionCharacterInventories?.["char.aelar"]?.items.find((item)=>item.definitionId===template.definitionId);
  assert.ok(granted);assert.deepEqual(granted?.provenance,template.provenance);

  snapshot=await adapter.removeCampaignDmLibraryEntry("campaign.provenance","entry.moon-seal");
  assert.equal(snapshot.campaigns?.find((campaign)=>campaign.campaignId==="campaign.provenance")?.dmLibrary.entries.some((entry)=>entry.entryId==="entry.moon-seal"),false);
  const retained=snapshot.sessionCharacterInventories?.["char.aelar"]?.items.find((item)=>item.definitionId===template.definitionId);
  assert.ok(retained);assert.deepEqual(retained?.provenance,template.provenance);
});
