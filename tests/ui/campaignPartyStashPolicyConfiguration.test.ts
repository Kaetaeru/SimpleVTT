import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/sessionInventoryRuntimeAdapter";
import "../../src/app/campaignRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { setCampaignLibraryStoreForTests } from "../../src/app/campaignRuntimeAdapter";

test("Campaign Party Stash policy persists with the matching Session default",async()=>{
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  await adapter.getSnapshot();
  await adapter.createCampaign({campaignId:"campaign.policy-config",name:"Policy Config"});

  let snapshot=await adapter.configureCampaignPartyStashPolicy("campaign.policy-config","shared");
  let campaign=snapshot.campaigns?.find((entry)=>entry.campaignId==="campaign.policy-config");
  assert.equal(campaign?.partyStash.policy,"shared");
  assert.equal(campaign?.sessionDefaults.stashPolicy,"shared");
  assert.equal(snapshot.campaignSessionSystems?.partyStash.policy,"shared");

  snapshot=await adapter.configureCampaignPartyStashPolicy("campaign.policy-config","dm-managed");
  campaign=snapshot.campaigns?.find((entry)=>entry.campaignId==="campaign.policy-config");
  assert.equal(campaign?.partyStash.policy,"dm-managed");
  assert.equal(campaign?.sessionDefaults.stashPolicy,"dm-managed");

  snapshot=await adapter.prepareCampaignSessionSnapshot("campaign.policy-config");
  assert.equal(snapshot.campaignSessionSnapshot?.stashPolicy,"dm-managed");
});
