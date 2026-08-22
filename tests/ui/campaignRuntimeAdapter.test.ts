import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/sessionInventoryRuntimeAdapter";
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

test("Campaign runtime projects live Session calendar and ration state without duplicating the aggregate",async()=>{
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  await adapter.getSnapshot();
  await adapter.createCampaign({campaignId:"campaign.session-systems",name:"Session Systems"});
  await adapter.upsertCampaignRosterMember("campaign.session-systems",{rosterMemberId:"member.one",label:"One",kind:"host-preset",active:true,countsForRations:true,rationUnitsPerDay:2});
  await adapter.configureCampaignCalendar("campaign.session-systems",{enabled:true,providerId:"builtin.gregorian"});
  await adapter.configureCampaignRations("campaign.session-systems",{enabled:true,providerId:"builtin.tracking-only"});
  await adapter.adjustCampaignRations("campaign.session-systems",{amount:3});
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.campaignSessionSystems?.campaignName,"Session Systems");
  assert.equal(snapshot.campaignSessionSystems?.roster[0].label,"One");
  assert.equal(snapshot.campaignSessionSystems?.roster[0].countsForRations,true);
  assert.equal(snapshot.campaignSessionSystems?.calendar.displayAnchor.year,1);
  assert.equal(snapshot.campaignSessionSystems?.rations.balance,3);
  assert.equal(snapshot.campaignSessionSystems?.rations.dailyRequired,2);
  await adapter.advanceCampaignCalendar("campaign.session-systems",{deltaMinutes:90});
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.campaignSessionSystems?.calendar.displayAnchor.hour,1);
  assert.equal(snapshot.campaignSessionSystems?.calendar.displayAnchor.minute,30);
});

test("Session party stash transfers keep Character inventory and Campaign aggregate in sync",async()=>{
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  await adapter.getSnapshot();
  await adapter.createCampaign({campaignId:"campaign.stash",name:"Stash Campaign"});
  let snapshot=await adapter.getSnapshot();
  const inventory=Object.values(snapshot.sessionCharacterInventories??{})[0];
  const actorId=inventory.characterId;
  const entry=snapshot.catalog.find((candidate)=>candidate.category==="item")!;
  assert.ok(entry);
  await adapter.adjustDmInventory({requestId:"stash.runtime.seed",actorId,operation:"grant-item",catalogEntryId:entry.id,quantity:2});
  snapshot=await adapter.getSnapshot();
  const item=snapshot.sessionCharacterInventories?.[actorId].items.find((candidate)=>candidate.definitionId===(entry.contentId||entry.id))!;
  assert.ok(item);
  const beforeQuantity=item.quantity;
  const beforeGold=inventory.goldGp;
  snapshot=await adapter.transferPartyStash({requestId:"stash.runtime.item.in",campaignId:"campaign.stash",actorId,direction:"character-to-stash",asset:"item",itemId:item.id,definitionId:item.definitionId,quantity:1,forceUnequip:Boolean(item.equipped||item.wielded||item.attuned)});
  assert.equal(snapshot.sessionCharacterInventories?.[actorId].items.find((candidate)=>candidate.id===item.id)?.quantity??0,beforeQuantity-1);
  assert.equal(snapshot.campaignSessionSystems?.partyStash.itemReferences[0].quantity,1);
  snapshot=await adapter.transferPartyStash({requestId:"stash.runtime.gold.in",campaignId:"campaign.stash",actorId,direction:"character-to-stash",asset:"currency",amount:5});
  assert.equal(snapshot.sessionCharacterInventories?.[actorId].goldGp,beforeGold-5);
  assert.equal(snapshot.campaignSessionSystems?.partyStash.wallet.gp,5);
  snapshot=await adapter.transferPartyStash({requestId:"stash.runtime.item.out",campaignId:"campaign.stash",actorId,direction:"stash-to-character",asset:"item",definitionId:item.definitionId,catalogEntryId:entry.id,quantity:1});
  assert.equal(snapshot.campaignSessionSystems?.partyStash.itemReferences.length,0);
  assert.equal(snapshot.sessionCharacterInventories?.[actorId].items.find((candidate)=>candidate.definitionId===item.definitionId)?.quantity,beforeQuantity);
});

test("Party stash transfer compensates Character inventory when Campaign persistence fails",async()=>{
  const adapter=new MockAdapter();
  const store=new MemoryCampaignLibraryStore();
  setCampaignLibraryStoreForTests(adapter,store);
  await adapter.getSnapshot();
  await adapter.createCampaign({campaignId:"campaign.stash-failure",name:"Stash Failure"});
  const before=await adapter.getSnapshot();
  const inventory=Object.values(before.sessionCharacterInventories??{})[0];
  const item=inventory.items[0];
  store.failNextWrite("stash disk unavailable");
  await assert.rejects(()=>adapter.transferPartyStash({requestId:"stash.runtime.failed",campaignId:"campaign.stash-failure",actorId:inventory.characterId,direction:"character-to-stash",asset:"item",itemId:item.id,definitionId:item.definitionId,quantity:1,forceUnequip:Boolean(item.equipped||item.wielded||item.attuned)}),/stash disk unavailable/);
  const after=await adapter.getSnapshot();
  assert.equal(after.sessionCharacterInventories?.[inventory.characterId].items.find((candidate)=>candidate.id===item.id)?.quantity,item.quantity);
  assert.deepEqual(after.campaignSessionSystems?.partyStash.itemReferences,[]);
  const retried=await adapter.transferPartyStash({requestId:"stash.runtime.failed",campaignId:"campaign.stash-failure",actorId:inventory.characterId,direction:"character-to-stash",asset:"item",itemId:item.id,definitionId:item.definitionId,quantity:1,forceUnequip:Boolean(item.equipped||item.wielded||item.attuned)});
  assert.equal(retried.sessionCharacterInventories?.[inventory.characterId].items.find((candidate)=>candidate.id===item.id)?.quantity??0,item.quantity-1);
  assert.equal(retried.campaignSessionSystems?.partyStash.itemReferences[0].quantity,1);
});
