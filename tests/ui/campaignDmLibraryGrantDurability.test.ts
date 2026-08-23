import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/sessionInventoryRuntimeAdapter";
import "../../src/app/campaignRuntimeAdapter";
import "../../src/app/campaignDmLibraryMaterializationAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { setCampaignLibraryStoreForTests } from "../../src/app/campaignRuntimeAdapter";

test("DM Library recents persistence failure does not roll back an already materialized Character item",async()=>{
  const adapter=new MockAdapter();
  const store=new MemoryCampaignLibraryStore();
  setCampaignLibraryStoreForTests(adapter,store);
  await adapter.getSnapshot();
  await adapter.createCampaign({campaignId:"campaign.dm-recents",name:"DM Recents"});
  const template={definitionId:"local.dm-recents.key",name:"은빛 열쇠",nameEn:"Silver Key",kind:"magic" as const,passiveEffects:[],grantedActionIds:[],provenance:["Campaign DM Library · DM Recents"]};
  await adapter.upsertCampaignDmLibraryEntry("campaign.dm-recents",{entryId:"entry.silver-key",kind:"custom-item",label:"은빛 열쇠",definitionId:template.definitionId,itemTemplate:template});
  const before=await adapter.getSnapshot();
  const actorId="char.aelar";
  const beforeQuantity=before.sessionCharacterInventories?.[actorId]?.items.filter((item)=>item.definitionId===template.definitionId).reduce((sum,item)=>sum+item.quantity,0)??0;

  store.failNextWrite("recents disk unavailable");
  const after=await adapter.grantCampaignDmLibraryItem("campaign.dm-recents","entry.silver-key",{kind:"character",actorId},1);

  const afterQuantity=after.sessionCharacterInventories?.[actorId]?.items.filter((item)=>item.definitionId===template.definitionId).reduce((sum,item)=>sum+item.quantity,0)??0;
  assert.equal(afterQuantity,beforeQuantity+1);
  assert.deepEqual(after.campaigns?.find((campaign)=>campaign.campaignId==="campaign.dm-recents")?.dmLibrary.recentEntryIds,[]);
});
