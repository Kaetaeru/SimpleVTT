import assert from "node:assert/strict";
import test from "node:test";
import { CampaignApplicationService } from "../../src/app/campaignApplicationService";
import { CampaignLibraryRepository } from "../../src/app/campaignPersistence";
import type { CampaignPartyStashItemTemplate, CampaignRecordV1 } from "../../src/app/campaignPersistenceContracts";
import { convertPartyStashItemToRations, previewPartyStashItemRationConversion } from "../../src/app/campaignRationConversion";
import { parseInstalledCampaignProviderProfile } from "../../src/app/campaignProviderProfiles";
import type { InstalledCampaignRationProfileV1 } from "../../src/app/installedContentContracts";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";

const NOW="2026-08-23T12:20:00+09:00";

function context(campaign:CampaignRecordV1,requestId:string){
  return {requestId,campaignId:campaign.campaignId,expectedCampaignRevision:campaign.revision,initiatedByParticipantId:"dm.test",now:NOW};
}

function template(definitionId:string,capabilities:string[]):CampaignPartyStashItemTemplate {
  return {definitionId,name:"Travel Ration",kind:"consumable",passiveEffects:[],grantedActionIds:[],capabilities,provenance:["test-fixture"]};
}

async function createService(){
  const service=new CampaignApplicationService(new CampaignLibraryRepository(new MemoryCampaignLibraryStore()));
  await service.hydrate();
  const campaign=await service.createCampaign({campaignId:"campaign.ration-convert",name:"Ration Conversion",now:NOW});
  return {service,campaign};
}

async function enableBuiltin(service:CampaignApplicationService,campaign:CampaignRecordV1){
  return service.configureRations({...context(campaign,"ration.enable"),enabled:true,providerId:"builtin.tracking-only"});
}

async function stashItem(service:CampaignApplicationService,campaign:CampaignRecordV1,input:{definitionId:string;quantity:number;capabilities:string[]}){
  return service.transferPartyStash({...context(campaign,"stash.seed."+input.definitionId),direction:"character-to-stash",asset:"item",definitionId:input.definitionId,quantity:input.quantity,itemTemplate:template(input.definitionId,input.capabilities)});
}

test("Party Stash ration conversion commits item debit and ration credit atomically and idempotently",async()=>{
  const {service,campaign:created}=await createService();
  let campaign=await enableBuiltin(service,created);
  campaign=await stashItem(service,campaign,{definitionId:"item.travel-ration",quantity:3,capabilities:["campaign.ration-source"]});
  const before=campaign;
  const input={...context(campaign,"ration.convert.1"),providerId:"builtin.tracking-only",providerVersion:"1",stashItemInstanceId:"stash.item.travel-ration",quantity:2};
  const preview=previewPartyStashItemRationConversion(campaign,input);
  assert.equal(preview.rationUnits,2);
  assert.equal(preview.stashQuantityAfter,1);

  const converted=await convertPartyStashItemToRations(service,input);
  assert.equal(converted.revision,before.revision+1);
  assert.equal(converted.partyStash.revision,before.partyStash.revision+1);
  assert.equal(converted.rations.ledger.revision,before.rations.ledger.revision+1);
  assert.equal(converted.partyStash.itemReferences.find((item)=>item.instanceId==="stash.item.travel-ration")?.quantity,1);
  assert.equal(converted.rations.ledger.balances.ration,2);
  const history=converted.rations.ledger.consumptionHistory.at(-1)!;
  assert.equal(history.kind,"convert");
  assert.equal(history.amount,2);
  assert.equal(history.sourceItemInstanceId,"stash.item.travel-ration");
  assert.equal(history.sourceDefinitionId,"item.travel-ration");
  assert.equal(history.sourceQuantity,2);
  assert.equal(history.conversionCapability,"campaign.ration-source");

  const retried=await convertPartyStashItemToRations(service,input);
  assert.deepEqual(retried,converted);
});

test("ration conversion rejects ineligible or insufficient stash items without partial mutation",async()=>{
  const {service,campaign:created}=await createService();
  let campaign=await enableBuiltin(service,created);
  campaign=await stashItem(service,campaign,{definitionId:"item.rock",quantity:1,capabilities:["item.throwable"]});
  const beforeIneligible=structuredClone(campaign);
  await assert.rejects(()=>convertPartyStashItemToRations(service,{...context(campaign,"ration.convert.ineligible"),providerId:"builtin.tracking-only",providerVersion:"1",stashItemInstanceId:"stash.item.rock",quantity:1}),/not eligible/);
  assert.deepEqual(service.getCampaign(campaign.campaignId),beforeIneligible);

  campaign=await stashItem(service,campaign,{definitionId:"item.ration-small",quantity:1,capabilities:["campaign.ration-source"]});
  const beforeInsufficient=structuredClone(campaign);
  await assert.rejects(()=>convertPartyStashItemToRations(service,{...context(campaign,"ration.convert.insufficient"),providerId:"builtin.tracking-only",providerVersion:"1",stashItemInstanceId:"stash.item.ration-small",quantity:2}),/quantity is insufficient/);
  assert.deepEqual(service.getCampaign(campaign.campaignId),beforeInsufficient);
});

test("module ration profile declares capability eligibility and integer conversion ratio",async()=>{
  const profile:InstalledCampaignRationProfileV1={kind:"ration",defaultUnitsPerDay:1,itemConversions:[{requiredCapability:"ration.travel-biscuit",rationUnitsPerItem:3}]};
  const {service,campaign:created}=await createService();
  let campaign=await service.configureRations({...context(created,"ration.module.enable"),enabled:true,providerId:"module.ration-profile:example:rations",providerVersion:"7",rationProfile:profile});
  campaign=await stashItem(service,campaign,{definitionId:"item.travel-biscuit",quantity:4,capabilities:["ration.travel-biscuit"]});
  const converted=await convertPartyStashItemToRations(service,{...context(campaign,"ration.convert.module"),providerId:"module.ration-profile:example:rations",providerVersion:"7",stashItemInstanceId:"stash.item.travel-biscuit",quantity:2,rationProfile:profile});
  assert.equal(converted.rations.ledger.balances.ration,6);
  assert.equal(converted.partyStash.itemReferences.find((item)=>item.instanceId==="stash.item.travel-biscuit")?.quantity,2);
});

test("ration provider parser validates conversion rules as data-only profile fields",()=>{
  const parsed=parseInstalledCampaignProviderProfile({kind:"ration",defaultUnitsPerDay:1,itemConversions:[{requiredCapability:"ration.standard",rationUnitsPerItem:2}]});
  assert.equal(parsed.kind,"ration");
  assert.deepEqual(parsed.kind==="ration"?parsed.itemConversions:undefined,[{requiredCapability:"ration.standard",rationUnitsPerItem:2}]);
  assert.throws(()=>parseInstalledCampaignProviderProfile({kind:"ration",defaultUnitsPerDay:1,itemConversions:[{requiredCapability:"ration.standard",rationUnitsPerItem:1},{requiredCapability:"ration.standard",rationUnitsPerItem:2}]}),/must be unique/);
  assert.throws(()=>parseInstalledCampaignProviderProfile({kind:"ration",defaultUnitsPerDay:1,itemConversions:[{requiredCapability:"ration.standard",rationUnitsPerItem:0}]}),/must be an integer/);
});
