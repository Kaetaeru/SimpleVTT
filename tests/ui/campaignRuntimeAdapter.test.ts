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

test("connected stash deposit commits only the Campaign aggregate after the client owns its inventory mutation",async()=>{
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  await adapter.getSnapshot();
  await adapter.createCampaign({campaignId:"campaign.client-deposit",name:"Client Deposit"});
  const before=await adapter.getSnapshot();
  const inventory=Object.values(before.sessionCharacterInventories??{})[0];
  const item=inventory.items[0];
  const after=await adapter.commitConnectedPartyStashDeposit({requestId:"client.deposit.item",campaignId:"campaign.client-deposit",actorId:inventory.characterId,direction:"character-to-stash",asset:"item",itemId:item.id,definitionId:item.definitionId,quantity:1});
  assert.equal(after.campaignSessionSystems?.partyStash.itemReferences[0].quantity,1);
  assert.equal(after.sessionCharacterInventories?.[inventory.characterId].items.find((candidate)=>candidate.id===item.id)?.quantity,item.quantity);
  const entry=after.catalog.find((candidate)=>candidate.category==="item"&&(candidate.contentId===item.definitionId||candidate.id===item.definitionId))??after.catalog.find((candidate)=>candidate.category==="item")!;
  const returned=await adapter.commitConnectedPartyStashDeposit({requestId:"client.withdraw.item",campaignId:"campaign.client-deposit",actorId:inventory.characterId,direction:"stash-to-character",asset:"item",definitionId:item.definitionId,catalogEntryId:entry.id,quantity:1});
  assert.deepEqual(returned.campaignSessionSystems?.partyStash.itemReferences,[]);
  assert.equal(returned.sessionCharacterInventories?.[inventory.characterId].items.find((candidate)=>candidate.id===item.id)?.quantity,item.quantity);
});

test("party stash returns a catalog-less charged item from its stored template",async()=>{
  const adapter=new MockAdapter();
  setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  await adapter.getSnapshot();
  await adapter.createCampaign({campaignId:"campaign.template-stash",name:"Template Stash"});
  let snapshot=await adapter.getSnapshot();
  const inventory=snapshot.sessionCharacterInventories?.["char.aelar"]!;
  const item=inventory.items.find((candidate)=>candidate.definitionId==="item.wand-of-magic-missiles")!;
  const itemTemplate={definitionId:item.definitionId,name:item.name,nameEn:item.nameEn,kind:item.kind,charges:item.charges,passiveEffects:item.passiveEffects,grantedActionIds:item.grantedActionIds,provenance:item.provenance};
  snapshot=await adapter.transferPartyStash({requestId:"template.in",campaignId:"campaign.template-stash",actorId:inventory.characterId,direction:"character-to-stash",asset:"item",itemId:item.id,definitionId:item.definitionId,quantity:1,itemTemplate,forceUnequip:true});
  assert.equal(snapshot.campaignSessionSystems?.partyStash.itemReferences[0].itemTemplate?.name,"마법 미사일 완드");
  snapshot=await adapter.transferPartyStash({requestId:"template.out",campaignId:"campaign.template-stash",actorId:inventory.characterId,direction:"stash-to-character",asset:"item",definitionId:item.definitionId,itemTemplate,quantity:1});
  const restored=snapshot.sessionCharacterInventories?.[inventory.characterId].items.find((candidate)=>candidate.definitionId===item.definitionId);
  assert.equal(restored?.name,"마법 미사일 완드");
  assert.deepEqual(restored?.charges,{current:7,max:7});
  assert.equal(snapshot.campaignSessionSystems?.partyStash.itemReferences.length,0);
});

test("DM Library grants a Campaign custom item to a Character or Party Stash",async()=>{
  const adapter=new MockAdapter();setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());await adapter.getSnapshot();await adapter.createCampaign({campaignId:"campaign.library",name:"Library"});
  const template={definitionId:"local.library.moon-key",name:"달빛 열쇠",nameEn:"Moon Key",kind:"magic" as const,passiveEffects:[],grantedActionIds:[],provenance:["Campaign DM Library"]};
  await adapter.upsertCampaignDmLibraryEntry("campaign.library",{entryId:"entry.moon-key",kind:"custom-item",label:"달빛 열쇠",definitionId:template.definitionId,itemTemplate:template,favorite:true,tags:["퀘스트"]});
  let snapshot=await adapter.grantCampaignDmLibraryItem("campaign.library","entry.moon-key",{kind:"character",actorId:"char.aelar"},2);
  assert.equal(snapshot.sessionCharacterInventories?.["char.aelar"].items.find((item)=>item.definitionId===template.definitionId)?.quantity,2);
  snapshot=await adapter.grantCampaignDmLibraryItem("campaign.library","entry.moon-key",{kind:"stash"},1);
  assert.equal(snapshot.campaignSessionSystems?.partyStash.itemReferences.find((item)=>item.definitionId===template.definitionId)?.quantity,1);
  assert.equal(snapshot.campaigns?.find((campaign)=>campaign.campaignId==="campaign.library")?.dmLibrary.recentEntryIds[0],"entry.moon-key");
});

test("DM Library materializes a Campaign NPC definition into the live Encounter",async()=>{
  const adapter=new MockAdapter();setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());await adapter.getSnapshot();await adapter.createCampaign({campaignId:"campaign.npc-library",name:"NPC Library"});
  const definition={definitionId:"local.campaign.npc-library.npc.bandit-captain",name:"산적 대장",nameEn:"Bandit Captain",ac:15,maxHp:42,actions:["장검","단검"],statusImmunities:[],source:"Campaign DM Library · NPC Library",version:"1"};
  await adapter.upsertCampaignDmLibraryEntry("campaign.npc-library",{entryId:"entry.bandit-captain",kind:"npc-definition",label:definition.name,definitionId:definition.definitionId,npcDefinition:definition,tags:["산적"]});
  const snapshot=await adapter.instantiateCampaignDmLibraryNpc("campaign.npc-library","entry.bandit-captain");
  assert.ok(snapshot.scene.entities.some((entity)=>entity.kind==="combatant"&&entity.name.startsWith("산적 대장")));
  assert.equal(snapshot.campaigns?.find((campaign)=>campaign.campaignId==="campaign.npc-library")?.dmLibrary.recentEntryIds[0],"entry.bandit-captain");
});
