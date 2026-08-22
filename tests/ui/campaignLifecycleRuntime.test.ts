import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/campaignRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { setCampaignLibraryStoreForTests } from "../../src/app/campaignRuntimeAdapter";

test("Campaign runtime duplicates Campaign-owned continuity without copying session history",async()=>{
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  await adapter.getSnapshot();
  await adapter.createCampaign({campaignId:"campaign.source",name:"Source"});
  await adapter.upsertCampaignRosterMember("campaign.source",{rosterMemberId:"member.one",label:"리아",kind:"player-character-ref",characterRef:{characterId:"character.external"},active:true,countsForRations:true,rationUnitsPerDay:1,stashPermission:"request"});
  await adapter.configureCampaignCalendar("campaign.source",{enabled:true,providerId:"builtin.gregorian"});
  await adapter.advanceCampaignCalendar("campaign.source",{deltaMinutes:90});
  await adapter.configureCampaignRations("campaign.source",{enabled:true,providerId:"builtin.tracking-only"});
  await adapter.adjustCampaignRations("campaign.source",{amount:5});

  const duplicated=await adapter.duplicateCampaign("campaign.source",{newCampaignId:"campaign.copy",newName:"Source Copy"});
  const copy=duplicated.campaigns?.find((campaign)=>campaign.campaignId==="campaign.copy");
  assert.ok(copy);
  assert.equal(duplicated.activeCampaignId,"campaign.copy");
  assert.equal(copy.name,"Source Copy");
  assert.equal(copy.revision,1);
  assert.equal(copy.roster[0].characterRef?.characterId,"character.external");
  assert.equal(copy.calendar.state.absoluteMinute,90);
  assert.equal(copy.rations.ledger.balances.ration,5);
  assert.equal(copy.partyStash.stashId,"campaign.copy.stash");
  assert.equal(copy.dmLibrary.namespaceId,"campaign.copy.dm-library");
  assert.equal(copy.sessionHistory.length,0);
});

test("Campaign runtime delete removes only the Campaign record and selects a remaining Campaign",async()=>{
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  await adapter.getSnapshot();
  await adapter.createCampaign({campaignId:"campaign.keep",name:"Keep"});
  await adapter.createCampaign({campaignId:"campaign.delete",name:"Delete"});
  let snapshot=await adapter.deleteCampaign("campaign.delete");
  assert.equal(snapshot.campaigns?.some((campaign)=>campaign.campaignId==="campaign.delete"),false);
  assert.equal(snapshot.activeCampaignId,"campaign.keep");
  snapshot=await adapter.deleteCampaign("campaign.keep");
  assert.deepEqual(snapshot.campaigns,[]);
  assert.equal(snapshot.activeCampaignId,null);
});
