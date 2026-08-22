import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import { CharacterLibraryRepository } from "../../src/app/characterLibraryPersistence";
import { CampaignLibraryRepository, createCampaignRecordV1 } from "../../src/app/campaignPersistence";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { MemoryCharacterCampaignCompoundWriter } from "../../src/app/characterCampaignCompoundPersistence";
import { executeLongRestCompound } from "../../src/app/longRestCompoundCoordinator";
import type { CampaignDocumentV1 } from "../../src/app/campaignPersistenceContracts";

const now="2026-08-23T05:00:00+09:00";

async function fixture(campaignId:string){
  const reference=await new MockAdapter().getSnapshot();
  const sheet=structuredClone(reference.activeCharacter);
  sheet.hp=Math.max(1,sheet.maxHp-5);
  sheet.tempHp=3;
  sheet.resources=[...sheet.resources,{id:"resource:test.long-rest",label:"Long Rest Test",current:0,max:2,source:"test",recovery:{longRest:"all"}}];

  const characterStore=new MemoryCharacterLibraryStore();
  const characterRepository=new CharacterLibraryRepository(characterStore);
  const characterHydration=await characterRepository.hydrate([sheet],sheet.id);

  const campaignStore=new MemoryCampaignLibraryStore();
  const campaignRepository=new CampaignLibraryRepository(campaignStore);
  await campaignRepository.hydrate();
  const campaign=createCampaignRecordV1({campaignId,name:campaignId,now});
  campaign.calendar.capability.enabled=true;
  campaign.sessionDefaults.calendarEnabled=true;
  campaign.rations.capability.enabled=true;
  campaign.sessionDefaults.rationsEnabled=true;
  campaign.rations.ledger.balances.ration=5;
  campaign.roster.push({
    rosterMemberId:"hero",
    label:sheet.name,
    kind:"player-character-ref",
    characterRef:{characterId:sheet.id},
    active:true,
    countsForRations:true,
    rationUnitsPerDay:1,
    stashPermission:"request",
  });
  const initialCampaignDocument:CampaignDocumentV1={
    schemaId:"simplevtt.campaign-library",
    schemaVersion:1,
    storageRevision:0,
    activeCampaignId:campaignId,
    campaigns:[campaign],
  };
  await campaignRepository.commit(initialCampaignDocument);

  return {
    sheet,
    characterStore,
    characterRepository,
    characterHydration,
    campaignStore,
    campaignRepository,
    writer:new MemoryCharacterCampaignCompoundWriter(characterStore,campaignStore),
  };
}

function input(campaignId:string,activeCharacterId:string,transactionId:string){
  return {
    transactionId,
    campaignId,
    activeCharacterId,
    initiatedByParticipantId:"dm.local",
    now,
  };
}

async function execute(
  setup:Awaited<ReturnType<typeof fixture>>,
  transactionId:string,
  options:{advanceMinutes?:number;consumeRations?:boolean;calendarEnabled?:boolean;rationsEnabled?:boolean}={},
){
  return executeLongRestCompound({
    ...input(setup.campaignRepository.snapshot()!.activeCampaignId!,setup.sheet.id,transactionId),
    ...options,
  },{
    characterDocument:setup.characterRepository.snapshot()!,
    characterSheets:setup.characterHydration.sheets,
    characterStore:setup.characterStore,
    campaignDocument:setup.campaignRepository.snapshot()!,
    campaignStore:setup.campaignStore,
    writer:setup.writer,
  });
}

async function rehydrate(setup:Awaited<ReturnType<typeof fixture>>){
  const characters=await setup.characterRepository.hydrate([setup.sheet],setup.sheet.id);
  const campaigns=await setup.campaignRepository.hydrate();
  return {characters,campaigns,campaign:campaigns.document.campaigns[0]};
}

test("Rest-only compound commit recovers Character state without implicitly advancing Calendar or consuming Rations",async()=>{
  const setup=await fixture("campaign.rest-only");
  const result=await execute(setup,"rest.only");
  const hydrated=await rehydrate(setup);
  const rested=hydrated.characters.sheets.find((sheet)=>sheet.id===setup.sheet.id)!;

  assert.equal(result.status,"committed");
  assert.deepEqual(result.applied,{calendar:false,rations:false});
  assert.equal(rested.hp,rested.maxHp);
  assert.equal(rested.tempHp,0);
  assert.equal(rested.resources.find((resource)=>resource.id==="resource:test.long-rest")?.current,2);
  assert.equal(hydrated.campaign.calendar.state.absoluteMinute,0);
  assert.equal(hydrated.campaign.rations.ledger.balances.ration,5);
  assert.ok(hydrated.campaign.recentRequestIds.includes("rest.only"));
});

test("Calendar and Ration side effects are independently optional",async()=>{
  const calendarSetup=await fixture("campaign.rest-calendar");
  const calendarResult=await execute(calendarSetup,"rest.calendar",{advanceMinutes:480});
  const calendarHydrated=await rehydrate(calendarSetup);
  assert.deepEqual(calendarResult.applied,{calendar:true,rations:false});
  assert.equal(calendarHydrated.campaign.calendar.state.absoluteMinute,480);
  assert.equal(calendarHydrated.campaign.rations.ledger.balances.ration,5);

  const rationSetup=await fixture("campaign.rest-rations");
  const rationResult=await execute(rationSetup,"rest.rations",{consumeRations:true});
  const rationHydrated=await rehydrate(rationSetup);
  assert.deepEqual(rationResult.applied,{calendar:false,rations:true});
  assert.equal(rationHydrated.campaign.calendar.state.absoluteMinute,0);
  assert.equal(rationHydrated.campaign.rations.ledger.balances.ration,4);
});

test("Long Rest can atomically apply both selected Campaign side effects",async()=>{
  const setup=await fixture("campaign.rest-both");
  const result=await execute(setup,"rest.both",{advanceMinutes:480,consumeRations:true});
  const hydrated=await rehydrate(setup);

  assert.deepEqual(result.applied,{calendar:true,rations:true});
  assert.equal(hydrated.campaign.calendar.state.absoluteMinute,480);
  assert.equal(hydrated.campaign.rations.ledger.balances.ration,4);
  assert.equal((await setup.characterStore.readGenerations())[0].generation,1);
  assert.equal((await setup.campaignStore.readGenerations())[0].generation,2);
});

test("disabled effective Session capabilities skip only optional effects and never block Rest",async()=>{
  const setup=await fixture("campaign.rest-disabled");
  const result=await execute(setup,"rest.disabled",{
    advanceMinutes:480,
    consumeRations:true,
    calendarEnabled:false,
    rationsEnabled:false,
  });
  const hydrated=await rehydrate(setup);
  const rested=hydrated.characters.sheets.find((sheet)=>sheet.id===setup.sheet.id)!;

  assert.deepEqual(result.applied,{calendar:false,rations:false});
  assert.equal(result.warnings.length,2);
  assert.equal(rested.hp,rested.maxHp);
  assert.equal(hydrated.campaign.calendar.state.absoluteMinute,0);
  assert.equal(hydrated.campaign.rations.ledger.balances.ration,5);
});

test("unavailable custom providers skip only their optional effects while Rest still commits",async()=>{
  const setup=await fixture("campaign.rest-provider-missing");
  const current=setup.campaignRepository.snapshot()!;
  current.campaigns[0].calendar.capability.providerId="calendar.missing";
  current.campaigns[0].calendar.state.providerId="calendar.missing";
  current.campaigns[0].rations.capability.providerId="ration.missing";
  await setup.campaignRepository.commit(current);

  const result=await executeLongRestCompound({
    ...input(current.activeCampaignId!,setup.sheet.id,"rest.provider-missing"),
    advanceMinutes:480,
    consumeRations:true,
  },{
    characterDocument:setup.characterRepository.snapshot()!,
    characterSheets:setup.characterHydration.sheets,
    characterStore:setup.characterStore,
    campaignDocument:setup.campaignRepository.snapshot()!,
    campaignStore:setup.campaignStore,
    writer:setup.writer,
  });
  const hydrated=await rehydrate(setup);

  assert.deepEqual(result.applied,{calendar:false,rations:false});
  assert.equal(result.warnings.length,2);
  assert.equal(hydrated.characters.sheets.find((sheet)=>sheet.id===setup.sheet.id)!.hp,setup.sheet.maxHp);
});

test("master transaction id makes a retried Long Rest a no-write duplicate",async()=>{
  const setup=await fixture("campaign.rest-duplicate");
  await execute(setup,"rest.same",{advanceMinutes:480,consumeRations:true});
  const first=await rehydrate(setup);
  const characterGenerationCount=(await setup.characterStore.readGenerations()).length;
  const campaignGenerationCount=(await setup.campaignStore.readGenerations()).length;

  const duplicate=await executeLongRestCompound({
    ...input(first.campaign.campaignId,setup.sheet.id,"rest.same"),
    advanceMinutes:480,
    consumeRations:true,
  },{
    characterDocument:setup.characterRepository.snapshot()!,
    characterSheets:first.characters.sheets,
    characterStore:setup.characterStore,
    campaignDocument:setup.campaignRepository.snapshot()!,
    campaignStore:setup.campaignStore,
    writer:setup.writer,
  });

  assert.equal(duplicate.status,"duplicate");
  assert.equal(duplicate.write,undefined);
  assert.equal((await setup.characterStore.readGenerations()).length,characterGenerationCount);
  assert.equal((await setup.campaignStore.readGenerations()).length,campaignGenerationCount);
});

test("compound writer rejection leaves both production stores at their previous durable generations",async()=>{
  const setup=await fixture("campaign.rest-writer-failure");
  const failingWriter={write:async()=>{throw new Error("compound writer rejected");}};

  await assert.rejects(()=>executeLongRestCompound({
    ...input(setup.campaignRepository.snapshot()!.activeCampaignId!,setup.sheet.id,"rest.failure"),
    advanceMinutes:480,
    consumeRations:true,
  },{
    characterDocument:setup.characterRepository.snapshot()!,
    characterSheets:setup.characterHydration.sheets,
    characterStore:setup.characterStore,
    campaignDocument:setup.campaignRepository.snapshot()!,
    campaignStore:setup.campaignStore,
    writer:failingWriter,
  }),/compound writer rejected/);

  assert.equal((await setup.characterStore.readGenerations()).length,0,"Character candidate must remain invisible");
  assert.equal((await setup.campaignStore.readGenerations()).length,1,"Campaign must remain at its pre-Rest generation");
  assert.equal(setup.characterRepository.snapshot()!.storageRevision,0);
  assert.equal(setup.campaignRepository.snapshot()!.storageRevision,1);
});
