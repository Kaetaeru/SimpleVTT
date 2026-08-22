import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import { mutateActiveCharacterDurably } from "../../src/app/characterLibraryRuntimeAdapter";
import { performProductionLongRest } from "../../src/app/longRestCompoundRuntimeAdapter";

test("production Long Rest bridge rehydrates Character Campaign and Scene only after compound memory commit",async()=>{
  const adapter=new MockAdapter();
  await adapter.getSnapshot();
  await adapter.createCampaign({campaignId:"campaign.runtime-rest",name:"Runtime Rest"});
  await adapter.configureCampaignCalendar("campaign.runtime-rest",{enabled:true,providerId:"builtin.gregorian"});
  await adapter.configureCampaignRations("campaign.runtime-rest",{enabled:true,providerId:"builtin.tracking-only"});
  await adapter.adjustCampaignRations("campaign.runtime-rest",{amount:5,note:"test seed"});
  const before=await adapter.getSnapshot();
  await adapter.upsertCampaignRosterMember("campaign.runtime-rest",{
    rosterMemberId:"active-character",
    label:before.activeCharacter.name,
    kind:"player-character-ref",
    characterRef:{characterId:before.activeCharacter.id},
    active:true,
    countsForRations:true,
    rationUnitsPerDay:1,
    stashPermission:"request",
  });
  await mutateActiveCharacterDurably(adapter,(character)=>{
    character.hp=Math.max(1,character.maxHp-7);
    character.tempHp=4;
  });

  const result=await performProductionLongRest(adapter,{
    transactionId:"long-rest.runtime-success",
    advanceMinutes:480,
    consumeRations:true,
    note:"runtime test rest",
  });

  assert.equal(result.status,"committed");
  assert.equal(result.snapshot.activeCharacter.hp,result.snapshot.activeCharacter.maxHp);
  assert.equal(result.snapshot.activeCharacter.tempHp,0);
  assert.equal(result.snapshot.scene.entities.find((entity)=>entity.id===result.snapshot.activeCharacter.id)?.hp,result.snapshot.activeCharacter.maxHp);
  assert.equal(result.snapshot.campaignSessionSystems?.calendar.absoluteMinute,480);
  assert.equal(result.snapshot.campaignSessionSystems?.rations.balance,4);
  assert.deepEqual(result.applied,{calendar:true,rations:true});
});

test("production Long Rest bridge keeps Campaign options opt-in by default",async()=>{
  const adapter=new MockAdapter();
  await adapter.getSnapshot();
  await adapter.createCampaign({campaignId:"campaign.runtime-rest-only",name:"Runtime Rest Only"});
  await adapter.configureCampaignCalendar("campaign.runtime-rest-only",{enabled:true,providerId:"builtin.gregorian"});
  await adapter.configureCampaignRations("campaign.runtime-rest-only",{enabled:true,providerId:"builtin.tracking-only"});
  await adapter.adjustCampaignRations("campaign.runtime-rest-only",{amount:3,note:"test seed"});
  await mutateActiveCharacterDurably(adapter,(character)=>{character.hp=Math.max(1,character.maxHp-3);});

  const result=await performProductionLongRest(adapter,{transactionId:"long-rest.runtime-rest-only"});

  assert.equal(result.snapshot.activeCharacter.hp,result.snapshot.activeCharacter.maxHp);
  assert.equal(result.snapshot.campaignSessionSystems?.calendar.absoluteMinute,0);
  assert.equal(result.snapshot.campaignSessionSystems?.rations.balance,3);
  assert.deepEqual(result.applied,{calendar:false,rations:false});
});
