import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/campaignRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { setCampaignLibraryStoreForTests } from "../../src/app/campaignRuntimeAdapter";

test("production Campaign runtime hydrates creates and selects Campaigns through AppSnapshot",async()=>{
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  let snapshot=await adapter.getSnapshot();
  assert.deepEqual(snapshot.campaigns,[]);
  assert.equal(snapshot.activeCampaignId,null);

  snapshot=await adapter.createCampaign({campaignId:"campaign.runtime",name:"Runtime Campaign",description:"test"});
  assert.equal(snapshot.campaigns?.length,1);
  assert.equal(snapshot.activeCampaignId,"campaign.runtime");

  snapshot=await adapter.archiveCampaign("campaign.runtime");
  assert.equal(snapshot.campaigns?.[0].status,"archived");
  snapshot=await adapter.restoreCampaign("campaign.runtime");
  assert.equal(snapshot.campaigns?.[0].status,"active");
  snapshot=await adapter.openCampaign("campaign.runtime");
  assert.equal(snapshot.activeCampaignId,"campaign.runtime");
});

test("Campaign runtime reports durable failures without publishing candidate state",async()=>{
  const adapter=new MockAdapter();
  const store=new MemoryCampaignLibraryStore();
  setCampaignLibraryStoreForTests(adapter,store);
  await adapter.getSnapshot();
  await adapter.createCampaign({campaignId:"campaign.stable",name:"Stable"});
  store.failNextWrite("Campaign disk unavailable");
  await assert.rejects(()=>adapter.updateCampaign("campaign.stable",{name:"Unsaved"}),/Campaign disk unavailable/);
  assert.equal((await adapter.getSnapshot()).campaigns?.[0].name,"Stable");
});

test("Session preparation captures an immutable Campaign settings snapshot",async()=>{
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  await adapter.getSnapshot();
  await adapter.createCampaign({campaignId:"campaign.snapshot",name:"Snapshot Campaign"});
  await adapter.configureCampaignSessionDefaults("campaign.snapshot",{sessionNameTemplate:"First",startingMode:"initiative",calendarEnabled:true,rationsEnabled:true});
  let snapshot=await adapter.prepareCampaignSessionSnapshot("campaign.snapshot",{sessionName:"Opening Session"});
  assert.equal(snapshot.campaignSessionSnapshot?.campaignName,"Snapshot Campaign");
  assert.equal(snapshot.campaignSessionSnapshot?.sessionName,"Opening Session");
  assert.equal(snapshot.campaignSessionSnapshot?.calendar.enabled,true);
  assert.equal(snapshot.campaignSessionSnapshot?.rations.enabled,true);
  const capturedRevision=snapshot.campaignSessionSnapshot?.settingsRevision;

  await adapter.configureCampaignSessionDefaults("campaign.snapshot",{sessionNameTemplate:"Changed",startingMode:"freeform",calendarEnabled:false,rationsEnabled:false});
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.campaignSessionSnapshot?.settingsRevision,capturedRevision);
  assert.equal(snapshot.campaignSessionSnapshot?.calendar.enabled,true);
  assert.equal(snapshot.campaignSessionSnapshot?.rations.enabled,true);
});
