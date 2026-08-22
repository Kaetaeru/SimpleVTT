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
