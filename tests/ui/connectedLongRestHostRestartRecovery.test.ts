import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryConnectedLongRestHostCoordinatorStore } from "../../src/app/connectedLongRestHostCoordinatorStore";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import {
  completeConnectedLongRestHostOwnerAbort,
  connectedLongRestHostRecoveryMessages,
  recoverConnectedLongRestHostTransactions,
  setConnectedLongRestHostCoordinatorStoreForTests,
} from "../../src/app/connectedLongRestRuntimePort";
import {
  commitConnectedLongRestCampaignParticipant,
  connectedLongRestCampaignCommitId,
} from "../../src/app/connectedLongRestCampaignPersistence";
import type { ConnectedLongRestCommitPreflight } from "../../src/app/connectedLongRestPreflight";

const PEER="peer.restart-owner";

async function configuredAdapter() {
  const adapter=new MockAdapter();
  await adapter.getSnapshot();
  await adapter.createCampaign({campaignId:"campaign.restart-rest",name:"Restart Rest"});
  await adapter.configureCampaignCalendar("campaign.restart-rest",{enabled:true,providerId:"builtin.gregorian"});
  await adapter.configureCampaignRations("campaign.restart-rest",{enabled:true,providerId:"builtin.tracking-only"});
  await adapter.adjustCampaignRations("campaign.restart-rest",{amount:4,note:"seed"});
  const campaign=(await adapter.getSnapshot()).campaigns?.find((entry)=>entry.campaignId==="campaign.restart-rest");
  assert.ok(campaign);
  const preflight:ConnectedLongRestCommitPreflight={
    transactionId:"connected-rest.restart.1",
    sessionId:"session.before-restart",
    campaignId:campaign.campaignId,
    expectedCampaignRevision:campaign.revision,
    ownerParticipantId:"client:char.remote",
    character:{characterId:"char.remote",sourceRevision:2,runtimeRevision:5},
    options:{advanceMinutes:480,consumeRations:true},
  };
  connectedStateFor(adapter).peerParticipants.set(PEER,preflight.ownerParticipantId);
  return {adapter,preflight};
}

test("Host restart upgrades durable owner-prepared to committed when Campaign idempotency proves global commit",async()=>{
  const {adapter,preflight}=await configuredAdapter();
  await commitConnectedLongRestCampaignParticipant(adapter,preflight);
  const store=new MemoryConnectedLongRestHostCoordinatorStore();
  await store.write({version:1,phase:"owner-prepared",preflight,preparationId:"prep.restart.1"});
  setConnectedLongRestHostCoordinatorStoreForTests(adapter,store);

  assert.deepEqual(await recoverConnectedLongRestHostTransactions(adapter),[preflight.transactionId]);
  const [recovered]=await store.readAll();
  assert.equal(recovered.phase,"committed");
  assert.equal(recovered.preparationId,"prep.restart.1");
  assert.equal(recovered.campaignCommitId,connectedLongRestCampaignCommitId(preflight.transactionId));
  const [replay]=connectedLongRestHostRecoveryMessages(adapter,PEER);
  assert.equal(replay?.type,"long-rest-global-commit");
  if(replay?.type==="long-rest-global-commit"){
    assert.equal(replay.commit.ownerParticipantId,preflight.ownerParticipantId);
    assert.deepEqual(replay.commit.character,preflight.character);
    assert.equal(replay.commit.preparationId,"prep.restart.1");
  }
});

test("Host restart abort replay closes durable coordinator after exact owner cleanup acknowledgement",async()=>{
  const {adapter,preflight}=await configuredAdapter();
  const store=new MemoryConnectedLongRestHostCoordinatorStore();
  await store.write({version:1,phase:"owner-prepared",preflight,preparationId:"prep.restart.precommit"});
  setConnectedLongRestHostCoordinatorStoreForTests(adapter,store);

  await recoverConnectedLongRestHostTransactions(adapter);
  const [recovered]=await store.readAll();
  assert.equal(recovered.phase,"aborted");
  assert.equal(recovered.preparationId,"prep.restart.precommit");
  assert.match(recovered.reason??"",/restarted before.*global commit/i);

  const [replay]=connectedLongRestHostRecoveryMessages(adapter,PEER);
  assert.equal(replay?.type,"long-rest-abort");
  if(replay?.type!=="long-rest-abort") return;
  assert.equal(replay.ownerParticipantId,preflight.ownerParticipantId);
  assert.deepEqual(replay.character,preflight.character);
  assert.equal(replay.preparationId,"prep.restart.precommit");

  const completed=await completeConnectedLongRestHostOwnerAbort(adapter,PEER,{
    transactionId:preflight.transactionId,
    ownerParticipantId:preflight.ownerParticipantId,
    character:preflight.character,
    preparationId:"prep.restart.precommit",
  });
  assert.deepEqual(completed,{status:"complete",transactionId:preflight.transactionId});
  assert.equal((await store.readAll()).length,0,"owner abort acknowledgement deletes durable Host recovery record");
  assert.equal(connectedLongRestHostRecoveryMessages(adapter,PEER).length,0,"completed abort is not replayed again");
});
