import assert from "node:assert/strict";
import test from "node:test";
import { CampaignApplicationService, previewCampaignDailyRations } from "../../src/app/campaignApplicationService";
import { CampaignLibraryRepository } from "../../src/app/campaignPersistence";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { campaignDateTimeToAbsoluteMinute, campaignDayPeriod, formatCampaignCalendarDateTime, isGregorianLeapYear, projectCampaignCalendar } from "../../src/app/campaignCalendar";

const now="2026-08-22T12:00:00.000Z";
const envelope=(campaignRevision:number,requestId:string)=>({requestId,campaignId:"campaign.systems",expectedCampaignRevision:campaignRevision,initiatedByParticipantId:"dm.local",now});

async function setup(){
  const store=new MemoryCampaignLibraryStore();
  const service=new CampaignApplicationService(new CampaignLibraryRepository(store));
  await service.hydrate();
  await service.createCampaign({campaignId:"campaign.systems",name:"Systems",now});
  return {service,store};
}

test("Campaign clock divides the full day into detailed Korean play periods",()=>{
  assert.deepEqual([0,4,6,9,12,14,17,19,22].map((hour)=>campaignDayPeriod(hour).label),["심야","새벽","아침","오전","한낮","오후","해질녘","저녁","밤"]);
  assert.equal(campaignDayPeriod(23).label,"밤");
  assert.throws(()=>campaignDayPeriod(24),/0시부터 23시/);
});

test("Campaign roster drives integer daily ration preview without owning Character files",async()=>{
  const {service}=await setup();
  await service.upsertRosterMember({...envelope(1,"roster.hero"),member:{rosterMemberId:"member.hero",label:"Hero",kind:"player-character-ref",characterRef:{ownerHint:"player.remote",characterId:"character.remote"},active:true,countsForRations:true,rationUnitsPerDay:1,stashPermission:"request"}});
  await service.upsertRosterMember({...envelope(2,"roster.horse"),member:{rosterMemberId:"member.horse",label:"Horse",kind:"companion",active:true,countsForRations:true,rationUnitsPerDay:2,stashPermission:"none"}});
  const campaign=service.getCampaign("campaign.systems")!;
  assert.deepEqual(previewCampaignDailyRations(campaign),{memberCount:2,requiredUnits:3,availableUnits:0,consumedUnits:0,shortageUnits:3,memberUnits:[{rosterMemberId:"member.hero",label:"Hero",units:1},{rosterMemberId:"member.horse",label:"Horse",units:2}]});
  assert.deepEqual(campaign.roster[0].characterRef,{ownerHint:"player.remote",characterId:"character.remote"});
});

test("Party stash stores item references and currency through revisioned Campaign mutations",async()=>{
  const {service}=await setup();
  await service.transferPartyStash({...envelope(1,"stash.gp.in"),direction:"character-to-stash",asset:"currency",amount:25});
  await service.transferPartyStash({...envelope(2,"stash.item.in"),direction:"character-to-stash",asset:"item",definitionId:"dnd.srd521.item.gear.potion-of-healing",quantity:2,itemTemplate:{definitionId:"dnd.srd521.item.gear.potion-of-healing",name:"치유 물약",nameEn:"Potion of Healing",kind:"consumable",passiveEffects:[],grantedActionIds:[],provenance:["SRD 5.2.1"]}});
  let campaign=service.getCampaign("campaign.systems")!;
  assert.equal(campaign.partyStash.wallet.gp,25);
  assert.equal(campaign.partyStash.revision,3);
  assert.equal(campaign.partyStash.itemReferences[0].itemTemplate?.name,"치유 물약");
  assert.equal(campaign.partyStash.itemReferences[0].quantity,2);
  await service.transferPartyStash({...envelope(3,"stash.gp.out"),direction:"stash-to-character",asset:"currency",amount:10});
  await service.transferPartyStash({...envelope(4,"stash.item.out"),direction:"stash-to-character",asset:"item",definitionId:"dnd.srd521.item.gear.potion-of-healing",quantity:1});
  campaign=service.getCampaign("campaign.systems")!;
  assert.equal(campaign.partyStash.wallet.gp,15);
  assert.equal(campaign.partyStash.itemReferences[0].quantity,1);
  await assert.rejects(()=>service.transferPartyStash({...envelope(5,"stash.overdraft"),direction:"stash-to-character",asset:"currency",amount:16}),/non-negative/);
  assert.equal(service.getCampaign("campaign.systems")?.revision,5);
});

test("DM can grant XP or immediate level-up credits to multiple roster members without a reason field",async()=>{
  const {service}=await setup();
  await service.upsertRosterMember({...envelope(1,"roster.a"),member:{rosterMemberId:"a",label:"A",kind:"player-character-ref",level:5,active:true,countsForRations:false}});
  await service.upsertRosterMember({...envelope(2,"roster.b"),member:{rosterMemberId:"b",label:"B",kind:"host-preset",active:true,countsForRations:false}});
  await service.grantAdvancement({...envelope(3,"xp.party"),rosterMemberIds:["a","b"],kind:"xp",amount:300});
  await service.grantAdvancement({...envelope(4,"level.a"),rosterMemberIds:["a"],kind:"level-up-credit",amount:1});
  const campaign=service.getCampaign("campaign.systems")!;
  assert.deepEqual(campaign.advancement?.members,{a:{xp:6800,levelUpCredits:1},b:{xp:300,levelUpCredits:0}});
  assert.equal(campaign.advancement?.history.length,2);
  assert.deepEqual(campaign.advancement?.history[0].rosterMemberIds,["a","b"]);
  assert.equal("note" in campaign.advancement!.history[0],false);
  await service.consumeLevelUpCredit({...envelope(5,"level.complete"),rosterMemberId:"a",level:6});
  assert.deepEqual(service.getCampaign("campaign.systems")?.advancement?.members.a,{xp:6800,levelUpCredits:0});
  assert.equal(service.getCampaign("campaign.systems")?.roster.find((member)=>member.rosterMemberId==="a")?.level,6);
  await assert.rejects(()=>service.grantAdvancement({...envelope(6,"xp.missing"),rosterMemberIds:["missing"],kind:"xp",amount:10}),/not found/);
  assert.equal(service.getCampaign("campaign.systems")?.revision,6);
});

test("Campaign DM Library supports isolated custom item CRUD and recent usage",async()=>{
  const {service,store}=await setup();
  const itemTemplate={definitionId:"local.campaign.star-charm",name:"별빛 부적",nameEn:"Starlight Charm",kind:"magic" as const,passiveEffects:["빛"],grantedActionIds:[],provenance:["Campaign DM Library"]};
  await service.upsertDmLibraryEntry({...envelope(1,"library.create"),entry:{entryId:"entry.star",kind:"custom-item",label:"별빛 부적",definitionId:itemTemplate.definitionId,favorite:true,tags:["보물","보물"],itemTemplate}});
  await service.touchDmLibraryEntry({...envelope(2,"library.recent"),entryId:"entry.star"});
  let campaign=service.getCampaign("campaign.systems")!;
  assert.equal(campaign.dmLibrary.entries[0].itemTemplate?.name,"별빛 부적");
  assert.deepEqual(campaign.dmLibrary.entries[0].tags,["보물"]);
  assert.deepEqual(campaign.dmLibrary.recentEntryIds,["entry.star"]);
  const reloaded=new CampaignApplicationService(new CampaignLibraryRepository(store));await reloaded.hydrate();
  assert.equal(reloaded.getCampaign("campaign.systems")?.dmLibrary.entries[0].label,"별빛 부적");
  await reloaded.removeDmLibraryEntry({...envelope(3,"library.remove"),entryId:"entry.star"});
  campaign=reloaded.getCampaign("campaign.systems")!;assert.deepEqual(campaign.dmLibrary.entries,[]);assert.deepEqual(campaign.dmLibrary.recentEntryIds,[]);
});

test("Calendar stores absolute minutes and undo is a compensating transaction",async()=>{
  const {service}=await setup();
  await service.configureCalendar({...envelope(1,"calendar.on"),enabled:true,providerId:"builtin.gregorian"});
  await service.advanceCalendar({...envelope(2,"calendar.advance"),deltaMinutes:1500,note:"travel"});
  let campaign=service.getCampaign("campaign.systems")!;
  assert.equal(campaign.calendar.state.absoluteMinute,1500);
  assert.equal(campaign.calendar.state.displayAnchor.day,2);
  await service.undoRecentCalendar(envelope(3,"calendar.undo"));
  campaign=service.getCampaign("campaign.systems")!;
  assert.equal(campaign.calendar.state.absoluteMinute,0);
  assert.equal(campaign.calendar.state.history.length,2);
  assert.equal(campaign.calendar.state.history[1].revertsTransactionId,"calendar.advance");
  await assert.rejects(()=>service.undoRecentCalendar(envelope(4,"calendar.undo-again")),/Undo 가능한 달력 변경/);
});

test("Gregorian Campaign calendar records era year month day hour minute across leap and month boundaries",async()=>{
  assert.equal(isGregorianLeapYear(2000),true);
  assert.equal(isGregorianLeapYear(1900),false);
  const start=campaignDateTimeToAbsoluteMinute("builtin.gregorian",{era:"왕국력",year:2024,monthId:"2",day:28,hour:23,minute:30});
  let projected=projectCampaignCalendar("builtin.gregorian",start+60,"왕국력");
  assert.deepEqual(projected,{era:"왕국력",year:2024,monthId:"2",monthLabel:"2월",day:29,hour:0,minute:30});
  projected=projectCampaignCalendar("builtin.gregorian",start+60+1440,"왕국력");
  assert.equal(formatCampaignCalendarDateTime("builtin.gregorian",projected),"왕국력 2024년 3월 1일 · 00:30");
  assert.throws(()=>campaignDateTimeToAbsoluteMinute("builtin.gregorian",{era:"왕국력",year:2023,monthId:"2",day:29,hour:0,minute:0}),/28일까지/);

  const {service}=await setup();
  await service.configureCalendar({...envelope(1,"calendar.on"),enabled:true,providerId:"builtin.gregorian"});
  await service.correctCalendarDateTime({...envelope(2,"calendar.date-time"),dateTime:{era:"제국력",year:1492,monthId:"12",day:31,hour:23,minute:45},note:"캠페인 시작 시각"});
  await service.advanceCalendar({...envelope(3,"calendar.new-year"),deltaMinutes:30});
  const campaign=service.getCampaign("campaign.systems")!;
  assert.deepEqual(campaign.calendar.state.displayAnchor,{era:"제국력",year:1493,monthId:"1",monthLabel:"1월",day:1,hour:0,minute:15});
});

test("Ration consumption records shortage as warning data and never invents Character consequences",async()=>{
  const {service}=await setup();
  await service.upsertRosterMember({...envelope(1,"roster.a"),member:{rosterMemberId:"a",label:"A",kind:"host-preset",active:true,countsForRations:true,rationUnitsPerDay:2}});
  await service.configureRations({...envelope(2,"ration.on"),enabled:true,providerId:"builtin.tracking-only"});
  await service.adjustRations({...envelope(3,"ration.add"),amount:1,note:"found food"});
  await service.consumeDailyRations({...envelope(4,"ration.consume")});
  let campaign=service.getCampaign("campaign.systems")!;
  assert.equal(campaign.rations.ledger.balances.ration,0);
  assert.equal(campaign.rations.ledger.consumptionHistory.at(-1)?.shortage,1);
  assert.equal(campaign.rations.ledger.consumptionHistory.at(-1)?.amount,-1);
  await service.undoRecentRationConsumption(envelope(5,"ration.undo"));
  campaign=service.getCampaign("campaign.systems")!;
  assert.equal(campaign.rations.ledger.balances.ration,1);
  assert.equal(campaign.rations.ledger.consumptionHistory.at(-1)?.kind,"undo");
});

test("DM meal service tracks each character and atomically charges rations or party funds",async()=>{
  const {service}=await setup();
  await service.upsertRosterMember({...envelope(1,"roster.a"),member:{rosterMemberId:"a",label:"A",kind:"host-preset",active:true,countsForRations:true}});
  await service.upsertRosterMember({...envelope(2,"roster.b"),member:{rosterMemberId:"b",label:"B",kind:"host-preset",active:true,countsForRations:true}});
  await service.configureRations({...envelope(3,"ration.on"),enabled:true,providerId:"builtin.tracking-only"});
  await service.adjustRations({...envelope(4,"ration.add"),amount:2});
  await service.transferPartyStash({...envelope(5,"stash.fund"),direction:"character-to-stash",asset:"currency",amount:2});
  await service.serveMeals({...envelope(6,"meal.ration"),rosterMemberIds:["a"],mealUnits:2,source:"ration"});
  await service.serveMeals({...envelope(7,"meal.tavern"),rosterMemberIds:["b"],mealUnits:1,source:"tavern",costSpPerPerson:5});
  let campaign=service.getCampaign("campaign.systems")!;
  assert.deepEqual(campaign.rations.ledger.mealTracking?.mealsByRosterMember,{a:2,b:1});
  assert.equal(campaign.rations.ledger.balances.ration,1);
  assert.deepEqual(campaign.partyStash.wallet,{gp:1,sp:5,cp:0});
  assert.equal(campaign.rations.ledger.consumptionHistory.at(-1)?.mealSource,"tavern");
  await service.undoRecentMeal(envelope(8,"meal.undo"));
  campaign=service.getCampaign("campaign.systems")!;
  assert.deepEqual(campaign.rations.ledger.mealTracking?.mealsByRosterMember,{a:2,b:0});
  assert.deepEqual(campaign.partyStash.wallet,{gp:2,sp:0,cp:0});
  await service.setMemberMeals({...envelope(9,"meal.manual"),rosterMemberId:"b",mealCount:1});
  campaign=service.getCampaign("campaign.systems")!;
  assert.equal(campaign.rations.ledger.mealTracking?.mealsByRosterMember.b,1);
  assert.equal(campaign.rations.ledger.consumptionHistory.at(-1)?.mealSource,"manual");
});

test("Next-day calendar and optional ration consumption commit atomically",async()=>{
  const {service,store}=await setup();
  await service.upsertRosterMember({...envelope(1,"roster.a"),member:{rosterMemberId:"a",label:"A",kind:"companion",active:true,countsForRations:true,rationUnitsPerDay:1}});
  await service.configureCalendar({...envelope(2,"calendar.on"),enabled:true,providerId:"builtin.simple-day"});
  await service.configureRations({...envelope(3,"ration.on"),enabled:true,providerId:"builtin.tracking-only"});
  await service.adjustRations({...envelope(4,"ration.add"),amount:2});
  store.failNextWrite("disk unavailable");
  await assert.rejects(()=>service.advanceDayWithOptionalRations({...envelope(5,"day.failed"),consumeRations:true}),/disk unavailable/);
  let campaign=service.getCampaign("campaign.systems")!;
  assert.equal(campaign.calendar.state.absoluteMinute,0);
  assert.equal(campaign.rations.ledger.balances.ration,2);
  await service.advanceDayWithOptionalRations({...envelope(5,"day.success"),consumeRations:true});
  campaign=service.getCampaign("campaign.systems")!;
  assert.equal(campaign.calendar.state.absoluteMinute,1440);
  assert.equal(campaign.rations.ledger.balances.ration,1);
});

test("disabled calendar and ration capabilities preserve values and reject automation without blocking other Campaign state",async()=>{
  const {service}=await setup();
  await service.configureCalendar({...envelope(1,"calendar.on"),enabled:true,providerId:"builtin.simple-day"});
  await service.advanceCalendar({...envelope(2,"calendar.advance"),deltaMinutes:60});
  await service.configureRations({...envelope(3,"ration.on"),enabled:true,providerId:"builtin.tracking-only"});
  await service.adjustRations({...envelope(4,"ration.add"),amount:3});
  await service.configureCalendar({...envelope(5,"calendar.off"),enabled:false,providerId:"builtin.simple-day"});
  await service.configureRations({...envelope(6,"ration.off"),enabled:false,providerId:"builtin.tracking-only"});
  const campaign=service.getCampaign("campaign.systems")!;
  assert.equal(campaign.calendar.state.absoluteMinute,60);
  assert.equal(campaign.rations.ledger.balances.ration,3);
  await assert.rejects(()=>service.advanceCalendar({...envelope(7,"calendar.disabled"),deltaMinutes:10}),/disabled/);
  await assert.rejects(()=>service.consumeDailyRations(envelope(7,"ration.disabled")),/disabled/);
  assert.equal(service.getCampaign("campaign.systems")?.revision,7);
});

test("Session history remains bounded and excludes transient runtime fields by contract",async()=>{
  const {service}=await setup();
  let revision=1;
  for(let index=0;index<55;index+=1){
    await service.appendSessionSummary({...envelope(revision++,`summary.${index}`),summary:{sessionId:`session.${index}`,title:`Session ${index}`,startedAt:now,endedAt:now,participantLabels:["DM","Player"],calendarBefore:"Day 1",calendarAfter:"Day 2",rationDelta:-2,stashTransactionCount:0,dmNote:"note"}});
  }
  const campaign=service.getCampaign("campaign.systems")!;
  assert.equal(campaign.sessionHistory.length,50);
  assert.equal(campaign.sessionHistory[0].sessionId,"session.5");
  assert.equal(campaign.lastSessionId,"session.54");
  assert.equal("participants" in campaign.sessionHistory.at(-1)!,false);
});
