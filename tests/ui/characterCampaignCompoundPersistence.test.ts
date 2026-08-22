import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import { CharacterLibraryRepository } from "../../src/app/characterLibraryPersistence";
import { CampaignLibraryRepository, createCampaignRecordV1 } from "../../src/app/campaignPersistence";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import {
  MemoryCharacterCampaignCompoundWriter,
  prepareCampaignLibraryGeneration,
  prepareCharacterLibraryGeneration,
} from "../../src/app/characterCampaignCompoundPersistence";
import type { CampaignDocumentV1 } from "../../src/app/campaignPersistenceContracts";

async function preparedPair(campaignId:string){
  const reference=await new MockAdapter().getSnapshot();
  const characterStore=new MemoryCharacterLibraryStore();
  const campaignStore=new MemoryCampaignLibraryStore();
  const characters=new CharacterLibraryRepository(characterStore);
  const campaigns=new CampaignLibraryRepository(campaignStore);
  await characters.hydrate([reference.activeCharacter],reference.activeCharacter.id);
  await campaigns.hydrate();
  const campaign=createCampaignRecordV1({campaignId,name:campaignId,now:"2026-08-23T04:15:00+09:00"});
  const initialCampaignDocument:CampaignDocumentV1={schemaId:"simplevtt.campaign-library",schemaVersion:1,storageRevision:0,activeCampaignId:campaign.campaignId,campaigns:[campaign]};
  await campaigns.commit(initialCampaignDocument);
  return {reference,characterStore,campaignStore,characters,campaigns};
}

test("prepared Character and Campaign generations do not advance repository heads before compound commit",async()=>{
  const {reference,characterStore,campaignStore,characters,campaigns}=await preparedPair("campaign.compound");
  const rested=structuredClone(reference.activeCharacter);rested.hp=rested.maxHp;
  const characterPrepared=await prepareCharacterLibraryGeneration(characters.snapshot()!,characterStore,[rested],rested.id);
  const campaignCandidate=campaigns.snapshot()!;
  campaignCandidate.campaigns[0].calendar.state.absoluteMinute+=480;
  campaignCandidate.campaigns[0].calendar.state.revision+=1;
  campaignCandidate.campaigns[0].revision+=1;
  const campaignPrepared=await prepareCampaignLibraryGeneration(campaignStore,campaignCandidate);

  assert.equal(characters.snapshot()?.storageRevision,0);
  assert.equal(campaigns.snapshot()?.storageRevision,1);
  assert.equal((await characterStore.readGenerations()).length,0);
  assert.equal((await campaignStore.readGenerations()).length,1);
  assert.equal(characterPrepared.nextGeneration,1);
  assert.equal(campaignPrepared.nextGeneration,2);
});

test("memory compound writer preflights both stores so second participant failure leaves neither generation visible",async()=>{
  const {reference,characterStore,campaignStore,characters,campaigns}=await preparedPair("campaign.compound-failure");
  const rested=structuredClone(reference.activeCharacter);rested.hp=rested.maxHp;
  const characterPrepared=await prepareCharacterLibraryGeneration(characters.snapshot()!,characterStore,[rested],rested.id);
  const campaignCandidate=campaigns.snapshot()!;
  campaignCandidate.campaigns[0].rations.ledger.balances.ration=9;
  campaignCandidate.campaigns[0].rations.ledger.revision+=1;
  campaignCandidate.campaigns[0].revision+=1;
  const campaignPrepared=await prepareCampaignLibraryGeneration(campaignStore,campaignCandidate);
  const writer=new MemoryCharacterCampaignCompoundWriter(characterStore,campaignStore);

  campaignStore.failNextWrite("campaign compound disk full");
  await assert.rejects(()=>writer.write({transactionId:"compound.failure",character:characterPrepared,campaign:campaignPrepared}),/campaign compound disk full/);
  assert.equal((await characterStore.readGenerations()).length,0,"Character generation must not become visible");
  assert.equal((await campaignStore.readGenerations()).length,1,"Campaign remains at its previous generation");
  assert.equal(characters.snapshot()?.storageRevision,0);
  assert.equal(campaigns.snapshot()?.storageRevision,1);
});

test("successful memory compound write exposes both immutable generations together and repositories rehydrate them",async()=>{
  const {reference,characterStore,campaignStore,characters,campaigns}=await preparedPair("campaign.compound-success");
  const rested=structuredClone(reference.activeCharacter);rested.hp=rested.maxHp;
  const characterPrepared=await prepareCharacterLibraryGeneration(characters.snapshot()!,characterStore,[rested],rested.id);
  const campaignCandidate=campaigns.snapshot()!;
  campaignCandidate.campaigns[0].calendar.state.absoluteMinute+=480;
  campaignCandidate.campaigns[0].calendar.state.revision+=1;
  campaignCandidate.campaigns[0].revision+=1;
  const campaignPrepared=await prepareCampaignLibraryGeneration(campaignStore,campaignCandidate);

  const writer=new MemoryCharacterCampaignCompoundWriter(characterStore,campaignStore);
  await writer.write({transactionId:"compound.success",character:characterPrepared,campaign:campaignPrepared});
  await characters.hydrate([reference.activeCharacter],reference.activeCharacter.id);
  await campaigns.hydrate();

  assert.equal((await characterStore.readGenerations())[0].generation,1);
  assert.equal((await campaignStore.readGenerations())[0].generation,2);
  assert.equal(characters.snapshot()?.storageRevision,1);
  assert.equal(campaigns.snapshot()?.storageRevision,2);
  assert.equal(campaigns.snapshot()?.campaigns[0].calendar.state.absoluteMinute,480);
});
