import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryConnectedLongRestHostCoordinatorStore } from "../../src/app/connectedLongRestHostCoordinatorStore";
import {
  recoverConnectedLongRestHostTransactions,
  setConnectedLongRestHostCoordinatorStoreForTests,
} from "../../src/app/connectedLongRestRuntimePort";
import {
  commitConnectedLongRestCampaignParticipant,
  connectedLongRestCampaignCommitId,
} from "../../src/app/connectedLongRestCampaignPersistence";
import type { ConnectedLongRestCommitPreflight } from "../../src/app/connectedLongRestPreflight";

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
});

test("Host restart aborts durable owner-prepared when Campaign global commit never happened",async()=>{
  const {adapter,preflight}=await configuredAdapter();
  const store=new MemoryConnectedLongRestHostCoordinatorStore();
  await store.write({version:1,phase:"owner-prepared",preflight,preparationId:"prep.restart.precommit"});
  setConnectedLongRestHostCoordinatorStoreForTests(adapter,store);

  await recoverConnectedLongRestHostTransactions(adapter);
  const [recovered]=await store.readAll();
  assert.equal(recovered.phase,"aborted");
  assert.equal(recovered.preparationId,"prep.restart.precommit");
  assert.match(recovered.reason??"",/restarted before.*global commit/i);
});
