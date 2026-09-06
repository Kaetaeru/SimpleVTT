import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/campaignRuntimeAdapter";
import { setCampaignLibraryStoreForTests } from "../../src/app/campaignRuntimeAdapter";
import { syncConnectedCampaignRoster } from "../../src/app/connectedCampaignRosterPort";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { MockAdapter } from "../../src/app/mockAdapter";

/**
 * C1-08 (seen on the Windows four-peer run): two joins, or a join beside a Host-side Campaign write, raced on the same
 * Campaign library generation and the second player was rejected with "stale Campaign library generation".
 */
async function hostWithCampaign() {
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  await adapter.createCampaign({campaignId:"campaign.race",name:"Race"});
  await adapter.prepareCampaignSessionSnapshot("campaign.race");
  return adapter;
}

test("C1-08: two players joining at the same time both land on the Campaign roster", async () => {
  const adapter=await hostWithCampaign();
  const results=await Promise.all([
    syncConnectedCampaignRoster(adapter,{participantId:"peer.p1",participantName:"P1",characterId:"char.p1",level:1}),
    syncConnectedCampaignRoster(adapter,{participantId:"peer.p2",participantName:"P2",characterId:"char.p2",level:1}),
  ]);
  assert.deepEqual(results.map((result)=>result.status),["committed","committed"],JSON.stringify(results));
  const snapshot=await adapter.getSnapshot();
  const campaign=snapshot.campaigns?.find((entry)=>entry.campaignId==="campaign.race");
  const ids=(campaign?.roster??[]).map((member)=>member.characterRef?.characterId).sort();
  assert.deepEqual(ids,["char.p1","char.p2"],"both connected members persist in the roster");
});

test("C1-08: a join racing a Host-side Campaign write is applied on top of it", async () => {
  const adapter=await hostWithCampaign();
  const [defaults,join]=await Promise.all([
    adapter.configureCampaignSessionDefaults("campaign.race",{sessionNameTemplate:"Renamed",startingMode:"freeform",calendarEnabled:false,rationsEnabled:false}),
    syncConnectedCampaignRoster(adapter,{participantId:"peer.p1",participantName:"P1",characterId:"char.p1",level:1}),
  ]);
  assert.ok(defaults);
  assert.equal(join.status,"committed",JSON.stringify(join));
  const campaign=(await adapter.getSnapshot()).campaigns?.find((entry)=>entry.campaignId==="campaign.race");
  assert.equal(campaign?.sessionDefaults.sessionNameTemplate,"Renamed","the Host write is kept");
  assert.equal(campaign?.roster.some((member)=>member.characterRef?.characterId==="char.p1"),true,"the join is applied after it");
});
