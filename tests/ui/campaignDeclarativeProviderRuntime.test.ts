import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/installedContentRuntimeAdapter";
import "../../src/app/campaignRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { setCampaignLibraryStoreForTests } from "../../src/app/campaignRuntimeAdapter";
import { CAMPAIGN_CALENDAR_PROFILE_CAPABILITY, CAMPAIGN_RATION_PROFILE_CAPABILITY, providerIdForInstalledCampaignProfile, type InstalledCampaignCalendarProfileV1, type InstalledCampaignRationProfileV1 } from "../../src/app/campaignProviderProfiles";

const calendarProfile:InstalledCampaignCalendarProfileV1={kind:"calendar",defaultEra:"왕국력",weekdays:["해","달"],months:[{id:"first",label:"첫달",days:30},{id:"second",label:"둘째달",days:30}]};
const rationProfile:InstalledCampaignRationProfileV1={kind:"ration",defaultUnitsPerDay:1,unitsByRosterKind:{companion:2},shortageConsequences:["DM 경고"]};
const calendarId=providerIdForInstalledCampaignProfile("homebrew.campaign-providers","calendar.kingdom",calendarProfile);
const rationId=providerIdForInstalledCampaignProfile("homebrew.campaign-providers","ration.gritty",rationProfile);

function packagePayload(){return JSON.stringify({
  schemaVersion:"0.1-draft",moduleId:"homebrew.campaign-providers",moduleVersion:"1.2.0",
  rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"ko",
  source:{document:"Campaign Providers",version:"1.2.0",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],
  capabilities:[CAMPAIGN_CALENDAR_PROFILE_CAPABILITY,CAMPAIGN_RATION_PROFILE_CAPABILITY],
  content:[
    {id:"calendar.kingdom",category:"option",presentation:{defaultLocale:"ko",originalName:"Kingdom Calendar",locales:{ko:{name:"왕국 달력"}}},campaignProvider:calendarProfile},
    {id:"ration.gritty",category:"option",presentation:{defaultLocale:"ko",originalName:"Gritty Rations",locales:{ko:{name:"거친 식량"}}},campaignProvider:rationProfile},
  ],
});}

async function preparedAdapter(campaignStore=new MemoryCampaignLibraryStore(),contentStore=new MemoryInstalledContentStore()){
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,contentStore);
  setCampaignLibraryStoreForTests(adapter,campaignStore);
  await adapter.getSnapshot();
  return {adapter,campaignStore,contentStore};
}

test("installed declarative providers configure durable Campaign capability version and drive calendar/ration rules",async()=>{
  const {adapter}=await preparedAdapter();
  let snapshot=await adapter.previewContentImport(packagePayload());
  assert.equal(snapshot.contentImport?.validation.some((entry)=>entry.severity==="blocking"),false,JSON.stringify(snapshot.contentImport?.validation));
  snapshot=await adapter.activateContentImport();
  assert.ok(snapshot.catalog.some((entry)=>entry.campaignProvider?.kind==="calendar"));
  await adapter.createCampaign({campaignId:"campaign.providers",name:"Providers"});

  snapshot=await adapter.configureCampaignCalendar("campaign.providers",{enabled:true,providerId:calendarId});
  let campaign=snapshot.campaigns!.find((entry)=>entry.campaignId==="campaign.providers")!;
  assert.equal(campaign.calendar.capability.providerVersion,"1.2.0");
  assert.equal(campaign.calendar.state.displayAnchor.monthId,"first");

  snapshot=await adapter.correctCampaignCalendarDateTime("campaign.providers",{dateTime:{era:"왕국력",year:2,monthId:"second",day:3,hour:4,minute:5},note:"시간 이동"});
  campaign=snapshot.campaigns!.find((entry)=>entry.campaignId==="campaign.providers")!;
  assert.deepEqual(campaign.calendar.state.displayAnchor,{era:"왕국력",year:2,monthId:"second",monthLabel:"둘째달",day:3,hour:4,minute:5});

  await adapter.upsertCampaignRosterMember("campaign.providers",{rosterMemberId:"companion.wolf",label:"늑대",kind:"companion",active:true,countsForRations:true});
  snapshot=await adapter.configureCampaignRations("campaign.providers",{enabled:true,providerId:rationId});
  campaign=snapshot.campaigns!.find((entry)=>entry.campaignId==="campaign.providers")!;
  assert.equal(campaign.rations.capability.providerVersion,"1.2.0");
  await adapter.adjustCampaignRations("campaign.providers",{amount:5});
  snapshot=await adapter.consumeCampaignDailyRations("campaign.providers");
  campaign=snapshot.campaigns!.find((entry)=>entry.campaignId==="campaign.providers")!;
  assert.equal(campaign.rations.ledger.balances.ration,3,"companion profile consumes 2 units");
  assert.equal(campaign.rations.ledger.consumptionHistory.at(-1)?.requiredAmount,2);
});

test("missing custom provider does not block Campaign hydration but blocks only provider-specific mutation",async()=>{
  const campaignStore=new MemoryCampaignLibraryStore();
  const contentStore=new MemoryInstalledContentStore();
  const {adapter}=await preparedAdapter(campaignStore,contentStore);
  await adapter.previewContentImport(packagePayload());await adapter.activateContentImport();
  await adapter.createCampaign({campaignId:"campaign.missing-provider",name:"Missing Provider"});
  await adapter.configureCampaignCalendar("campaign.missing-provider",{enabled:true,providerId:calendarId});

  const restarted=new MockAdapter();
  setCampaignLibraryStoreForTests(restarted,campaignStore);
  setInstalledContentStoreForTests(restarted,new MemoryInstalledContentStore());
  const snapshot=await restarted.getSnapshot();
  assert.equal(snapshot.campaigns?.[0].calendar.capability.providerId,calendarId);
  await assert.rejects(()=>restarted.advanceCampaignCalendar("campaign.missing-provider",{deltaMinutes:10}),/공급자를 찾을 수 없습니다/);
});
