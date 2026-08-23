import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogEntry } from "../../src/app/contracts";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { setCampaignLibraryStoreForTests } from "../../src/app/campaignRuntimeAdapter";
import "../../src/app/campaignPartyStashCapabilityRuntimeAdapter";
import "../../src/app/campaignRationConversionRuntimeAdapter";

const CAMPAIGN_ID="campaign.ration-runtime";
const DEFINITION_ID="item.test.travel-ration";

function testCatalogEntry():CatalogEntry{
  return {
    id:"content:test.rations@1#item.test.travel-ration",
    contentId:DEFINITION_ID,
    category:"item",
    nameKo:"여행 식량",
    nameEn:"Travel Ration",
    scope:"local",
    sourceId:"test.rations",
    source:"Runtime Test",
    version:"1",
    description:"Test ration item",
    relationships:[],
    capabilities:["campaign.ration-source"],
  } as CatalogEntry;
}

function itemTemplate(){
  return {
    definitionId:DEFINITION_ID,
    name:"여행 식량",
    nameEn:"Travel Ration",
    kind:"consumable" as const,
    passiveEffects:[],
    grantedActionIds:[],
    capabilities:["forged.player-capability"],
    provenance:["client fixture"],
  };
}

test("production runtime normalizes Host catalog capability and converts through the existing Campaign service",async()=>{
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  (adapter as unknown as {catalog:CatalogEntry[]}).catalog.push(testCatalogEntry());

  await adapter.createCampaign({campaignId:CAMPAIGN_ID,name:"Ration Runtime"});
  await adapter.configureCampaignRations(CAMPAIGN_ID,{enabled:true,providerId:"builtin.tracking-only"});
  await adapter.commitConnectedPartyStashDeposit({
    requestId:"stash.deposit.rations",
    campaignId:CAMPAIGN_ID,
    actorId:"character.remote",
    direction:"character-to-stash",
    asset:"item",
    itemId:"item.remote.rations",
    definitionId:DEFINITION_ID,
    quantity:2,
    itemTemplate:itemTemplate(),
  });

  let snapshot=await adapter.getSnapshot();
  let campaign=snapshot.campaigns?.find((entry)=>entry.campaignId===CAMPAIGN_ID);
  const stored=campaign?.partyStash.itemReferences.find((entry)=>entry.definitionId===DEFINITION_ID);
  assert.deepEqual(stored?.itemTemplate?.capabilities,["campaign.ration-source"]);
  assert.ok(!stored?.itemTemplate?.capabilities?.includes("forged.player-capability"));

  const preview=await adapter.previewCampaignPartyStashRationConversion(CAMPAIGN_ID,{stashItemInstanceId:stored!.instanceId,quantity:1});
  assert.equal(preview.rationUnitsPerItem,1);
  assert.equal(preview.rationUnits,1);
  assert.equal(preview.stashQuantityAfter,1);

  const beforeStaleCommit=structuredClone(campaign);
  await assert.rejects(()=>adapter.convertCampaignPartyStashItemToRations({
    requestId:"ration.convert.runtime.stale-provider",
    campaignId:CAMPAIGN_ID,
    providerId:preview.providerId,
    providerVersion:"0",
    stashItemInstanceId:preview.stashItemInstanceId,
    quantity:preview.quantity,
  }),/Ration provider changed/);
  snapshot=await adapter.getSnapshot();
  campaign=snapshot.campaigns?.find((entry)=>entry.campaignId===CAMPAIGN_ID);
  assert.deepEqual(campaign,beforeStaleCommit);

  const command={
    requestId:"ration.convert.runtime.1",
    campaignId:CAMPAIGN_ID,
    providerId:preview.providerId,
    providerVersion:preview.providerVersion,
    stashItemInstanceId:preview.stashItemInstanceId,
    quantity:preview.quantity,
  };
  await adapter.convertCampaignPartyStashItemToRations(command);
  snapshot=await adapter.getSnapshot();
  campaign=snapshot.campaigns?.find((entry)=>entry.campaignId===CAMPAIGN_ID);
  assert.equal(campaign?.partyStash.itemReferences.find((entry)=>entry.definitionId===DEFINITION_ID)?.quantity,1);
  assert.equal(campaign?.rations.ledger.balances.ration,1);
  assert.equal(campaign?.rations.ledger.consumptionHistory.at(-1)?.kind,"convert");

  await adapter.convertCampaignPartyStashItemToRations(command);
  snapshot=await adapter.getSnapshot();
  campaign=snapshot.campaigns?.find((entry)=>entry.campaignId===CAMPAIGN_ID);
  assert.equal(campaign?.partyStash.itemReferences.find((entry)=>entry.definitionId===DEFINITION_ID)?.quantity,1);
  assert.equal(campaign?.rations.ledger.balances.ration,1);
});
