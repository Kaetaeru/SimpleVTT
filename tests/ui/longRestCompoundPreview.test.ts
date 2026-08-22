import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import { CharacterLibraryRepository } from "../../src/app/characterLibraryPersistence";
import { CampaignLibraryRepository, createCampaignRecordV1 } from "../../src/app/campaignPersistence";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { MemoryCharacterCampaignCompoundWriter } from "../../src/app/characterCampaignCompoundPersistence";
import { executeLongRestCompound, previewLongRestCompound } from "../../src/app/longRestCompoundCoordinator";
import type { CampaignDocumentV1 } from "../../src/app/campaignPersistenceContracts";

const now="2026-08-23T05:10:00+09:00";

test("Long Rest preview performs no production writes and matches the committed Character Campaign candidate",async()=>{
  const reference=await new MockAdapter().getSnapshot();
  const sheet=structuredClone(reference.activeCharacter);
  sheet.hp=Math.max(1,sheet.maxHp-4);
  sheet.tempHp=2;
  const characterStore=new MemoryCharacterLibraryStore();
  const characters=new CharacterLibraryRepository(characterStore);
  const characterHydration=await characters.hydrate([sheet],sheet.id);

  const campaignStore=new MemoryCampaignLibraryStore();
  const campaigns=new CampaignLibraryRepository(campaignStore);
  await campaigns.hydrate();
  const campaign=createCampaignRecordV1({campaignId:"campaign.preview",name:"Preview",now});
  campaign.calendar.capability.enabled=true;
  campaign.rations.capability.enabled=true;
  campaign.rations.ledger.balances.ration=2;
  campaign.roster.push({rosterMemberId:"hero",label:sheet.name,kind:"player-character-ref",characterRef:{characterId:sheet.id},active:true,countsForRations:true,rationUnitsPerDay:1,stashPermission:"request"});
  const initial:CampaignDocumentV1={schemaId:"simplevtt.campaign-library",schemaVersion:1,storageRevision:0,activeCampaignId:campaign.campaignId,campaigns:[campaign]};
  await campaigns.commit(initial);

  const input={transactionId:"long-rest.preview",campaignId:campaign.campaignId,activeCharacterId:sheet.id,initiatedByParticipantId:"dm.local",now,advanceMinutes:480,consumeRations:true};
  const preview=await previewLongRestCompound(input,{characterSheets:characterHydration.sheets,campaignDocument:campaigns.snapshot()!});

  assert.equal((await characterStore.readGenerations()).length,0);
  assert.equal((await campaignStore.readGenerations()).length,1);
  assert.equal(preview.status,"ready");
  assert.equal(preview.character?.sheet.hp,sheet.maxHp);
  assert.equal(preview.campaignDocument.campaigns[0].calendar.state.absoluteMinute,480);
  assert.equal(preview.campaignDocument.campaigns[0].rations.ledger.balances.ration,1);

  const committed=await executeLongRestCompound(input,{
    characterDocument:characters.snapshot()!,
    characterSheets:characterHydration.sheets,
    characterStore,
    campaignDocument:campaigns.snapshot()!,
    campaignStore,
    writer:new MemoryCharacterCampaignCompoundWriter(characterStore,campaignStore),
  });

  assert.equal(committed.character?.sheet.hp,preview.character?.sheet.hp);
  assert.equal(committed.campaignDocument.campaigns[0].calendar.state.absoluteMinute,preview.campaignDocument.campaigns[0].calendar.state.absoluteMinute);
  assert.equal(committed.campaignDocument.campaigns[0].rations.ledger.balances.ration,preview.campaignDocument.campaigns[0].rations.ledger.balances.ration);
});
