import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import {
  getCharacterLibraryPersistenceStateForTests,
  mutateActiveCharacterDurably,
} from "../../src/app/characterLibraryRuntimeAdapter";
import {
  decodeCharacterLibraryV1,
  encodeCharacterLibraryV1,
} from "../../src/app/characterLibraryPersistence";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { MemoryConnectedLongRestOwnerPreparationStore } from "../../src/app/connectedLongRestOwnerPreparationStore";
import {
  abortConnectedLongRestOwnerCandidate,
  materializeConnectedLongRestOwnerCandidate,
  prepareConnectedLongRestOwnerCandidate,
} from "../../src/app/connectedLongRestOwnerPersistence";
import type { ConnectedLongRestCommitPreflight } from "../../src/app/connectedLongRestPreflight";

async function setup(){
  const adapter=new MockAdapter();
  await adapter.getSnapshot();
  await mutateActiveCharacterDurably(adapter,(character)=>{
    character.hp=Math.max(1,character.maxHp-6);
    character.tempHp=3;
  });
  const snapshot=await adapter.getSnapshot();
  const persistence=getCharacterLibraryPersistenceStateForTests(adapter);
  assert.ok(persistence?.document);
  const document=structuredClone(persistence.document);
  const characterStore=new MemoryCharacterLibraryStore();
  characterStore.seed(document.storageRevision,encodeCharacterLibraryV1(document));
  const preparationStore=new MemoryConnectedLongRestOwnerPreparationStore(characterStore);
  const preflight:ConnectedLongRestCommitPreflight={
    transactionId:"long-rest.remote.owner.1",
    sessionId:"session.connected",
    campaignId:"campaign.live",
    expectedCampaignRevision:9,
    ownerParticipantId:`client:${snapshot.activeCharacter.id}`,
    character:{
      characterId:snapshot.activeCharacter.id,
      sourceRevision:snapshot.activeCharacter.sourceRevision??0,
      runtimeRevision:snapshot.activeCharacter.runtimeRevision??0,
    },
    options:{advanceMinutes:480,consumeRations:true},
  };
  return {snapshot,document,characterStore,preparationStore,preflight};
}

test("owner Long Rest prepares the canonical Character candidate without exposing a generation",async()=>{
  const state=await setup();
  const prepared=await prepareConnectedLongRestOwnerCandidate({
    preflight:state.preflight,
    currentDocument:state.document,
    currentCharacter:state.snapshot.activeCharacter,
    characterStore:state.characterStore,
    preparationStore:state.preparationStore,
  });
  assert.equal(prepared.candidate.sheet.hp,state.snapshot.activeCharacter.maxHp);
  assert.equal(prepared.candidate.sheet.tempHp,0);
  assert.equal(prepared.preparation.phase,"prepared");
  assert.equal((await state.characterStore.readGenerations()).length,1,"seed generation remains the only visible generation");

  await materializeConnectedLongRestOwnerCandidate(state.preparationStore,prepared.prepared);
  const generations=await state.characterStore.readGenerations();
  assert.equal(generations[0].generation,state.document.storageRevision+1);
  const committed=decodeCharacterLibraryV1(generations[0].payload!);
  const record=committed.characters.find((entry)=>entry.characterId===state.snapshot.activeCharacter.id);
  assert.equal(record?.runtime.hp,state.snapshot.activeCharacter.maxHp);
  assert.equal(record?.runtime.tempHp,0);
});

test("owner Long Rest rejects stale Character revisions before durable prepare",async()=>{
  const state=await setup();
  const stale=structuredClone(state.preflight);
  stale.character.runtimeRevision+=1;
  await assert.rejects(()=>prepareConnectedLongRestOwnerCandidate({
    preflight:stale,
    currentDocument:state.document,
    currentCharacter:state.snapshot.activeCharacter,
    characterStore:state.characterStore,
    preparationStore:state.preparationStore,
  }),/runtime revision is stale/);
  assert.equal((await state.characterStore.readGenerations()).length,1);
});

test("owner Long Rest precommit abort keeps the prepared candidate invisible",async()=>{
  const state=await setup();
  const prepared=await prepareConnectedLongRestOwnerCandidate({
    preflight:state.preflight,
    currentDocument:state.document,
    currentCharacter:state.snapshot.activeCharacter,
    characterStore:state.characterStore,
    preparationStore:state.preparationStore,
  });
  const aborted=await abortConnectedLongRestOwnerCandidate(state.preparationStore,prepared.prepared);
  assert.equal(aborted.phase,"aborted");
  assert.equal((await state.characterStore.readGenerations()).length,1);
  await assert.rejects(
    ()=>materializeConnectedLongRestOwnerCandidate(state.preparationStore,prepared.prepared),
    /cannot be materialized/,
  );
});
