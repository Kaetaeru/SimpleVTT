import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogEntry } from "../../src/app/contracts";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { setCampaignLibraryStoreForTests } from "../../src/app/campaignRuntimeAdapter";
import "../../src/app/campaignPartyStashCapabilityRuntimeAdapter";
import "../../src/app/campaignRationConversionRuntimeAdapter";

const CAMPAIGN_ID="campaign.ration-legacy";
const DEFINITION_ID="item.test.legacy-ration";

test("legacy Stash item without capability snapshot is revalidated from the Host catalog",async()=>{
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  (adapter as unknown as {catalog:CatalogEntry[]}).catalog.push({
    id:"content:test.rations@1#item.test.legacy-ration",
    contentId:DEFINITION_ID,
    category:"item",
    nameKo:"보존 식량",
    nameEn:"Preserved Ration",
    scope:"local",
    sourceId:"test.rations",
    source:"Runtime Test",
    version:"1",
    description:"Legacy stash fixture",
    relationships:[],
    capabilities:["campaign.ration-source"],
  } as CatalogEntry);

  await adapter.createCampaign({campaignId:CAMPAIGN_ID,name:"Legacy Ration"});
  await adapter.configureCampaignRations(CAMPAIGN_ID,{enabled:true,providerId:"builtin.tracking-only"});
  await adapter.commitConnectedPartyStashDeposit({
    requestId:"stash.deposit.legacy-ration",
    campaignId:CAMPAIGN_ID,
    actorId:"character.remote",
    direction:"character-to-stash",
    asset:"item",
    itemId:"item.remote.legacy-ration",
    definitionId:DEFINITION_ID,
    quantity:1,
  });

  let snapshot=await adapter.getSnapshot();
  let campaign=snapshot.campaigns?.find((entry)=>entry.campaignId===CAMPAIGN_ID);
  const stored=campaign?.partyStash.itemReferences.find((entry)=>entry.definitionId===DEFINITION_ID);
  assert.ok(stored);
  assert.equal(stored?.itemTemplate,undefined);

  const preview=await adapter.previewCampaignPartyStashRationConversion(CAMPAIGN_ID,{stashItemInstanceId:stored!.instanceId,quantity:1});
  assert.equal(preview.requiredCapability,"campaign.ration-source");
  assert.equal(preview.rationUnits,1);

  await adapter.convertCampaignPartyStashItemToRations({
    requestId:"ration.convert.legacy-ration",
    campaignId:CAMPAIGN_ID,
    providerId:preview.providerId,
    providerVersion:preview.providerVersion,
    stashItemInstanceId:preview.stashItemInstanceId,
    quantity:preview.quantity,
  });

  snapshot=await adapter.getSnapshot();
  campaign=snapshot.campaigns?.find((entry)=>entry.campaignId===CAMPAIGN_ID);
  assert.equal(campaign?.partyStash.itemReferences.some((entry)=>entry.definitionId===DEFINITION_ID),false);
  assert.equal(campaign?.rations.ledger.balances.ration,1);
  assert.equal(campaign?.rations.ledger.consumptionHistory.at(-1)?.conversionCapability,"campaign.ration-source");
});
