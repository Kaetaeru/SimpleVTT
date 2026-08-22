import assert from "node:assert/strict";
import test from "node:test";
import {
  abortConnectedLongRestTransaction,
  beginConnectedLongRestTransaction,
  commitConnectedLongRestTransaction,
  connectedLongRestRecoveryAction,
  recordConnectedLongRestOwnerMaterialized,
  recordConnectedLongRestOwnerPrepared,
} from "../../src/app/connectedLongRestTransactionState";
import type { ConnectedLongRestCommitPreflight } from "../../src/app/connectedLongRestPreflight";

function preflight():ConnectedLongRestCommitPreflight {
  return {
    transactionId:"long-rest.remote.1",
    sessionId:"session.connected",
    campaignId:"campaign.live",
    expectedCampaignRevision:11,
    ownerParticipantId:"player.remote",
    character:{characterId:"char.remote",sourceRevision:3,runtimeRevision:7},
    options:{advanceMinutes:480,consumeRations:true},
  };
}

const prepared={
  transactionId:"long-rest.remote.1",
  ownerParticipantId:"player.remote",
  character:{characterId:"char.remote",sourceRevision:3,runtimeRevision:7},
  preparationId:"character-stage.12",
};

test("connected Long Rest cannot globally commit before the owner has durably prepared the exact Character revision", () => {
  const approved=beginConnectedLongRestTransaction(preflight());
  assert.equal(connectedLongRestRecoveryAction(approved),"request-owner-prepare");
  assert.throws(
    ()=>commitConnectedLongRestTransaction(approved,{transactionId:"long-rest.remote.1",campaignCommitId:"campaign.commit.12"}),
    /owner-prepared/,
  );

  const wrongRevision=structuredClone(prepared);
  wrongRevision.character.runtimeRevision=8;
  assert.throws(()=>recordConnectedLongRestOwnerPrepared(approved,wrongRevision),/Character revision mismatch/);
});

test("connected Long Rest may abort before global commit but never compensates after global commit", () => {
  const approved=beginConnectedLongRestTransaction(preflight());
  const ownerPrepared=recordConnectedLongRestOwnerPrepared(approved,prepared);
  assert.equal(connectedLongRestRecoveryAction(ownerPrepared),"resume-or-abort-precommit");
  const aborted=abortConnectedLongRestTransaction(ownerPrepared,"Host cancelled before commit");
  assert.equal(aborted.phase,"aborted");
  assert.equal(connectedLongRestRecoveryAction(aborted),"none");

  const preparedAgain=recordConnectedLongRestOwnerPrepared(beginConnectedLongRestTransaction(preflight()),prepared);
  const committed=commitConnectedLongRestTransaction(preparedAgain,{
    transactionId:"long-rest.remote.1",
    campaignCommitId:"campaign.commit.12",
  });
  assert.equal(committed.phase,"committed");
  assert.equal(connectedLongRestRecoveryAction(committed),"resend-global-commit");
  assert.throws(()=>abortConnectedLongRestTransaction(committed,"disk error"),/cannot be aborted/);
});

test("connected Long Rest completes only after the same prepared owner materializes the committed Character generation", () => {
  const ownerPrepared=recordConnectedLongRestOwnerPrepared(beginConnectedLongRestTransaction(preflight()),prepared);
  const committed=commitConnectedLongRestTransaction(ownerPrepared,{
    transactionId:"long-rest.remote.1",
    campaignCommitId:"campaign.commit.12",
  });
  const wrongPreparation=structuredClone(prepared);
  wrongPreparation.preparationId="character-stage.other";
  assert.throws(()=>recordConnectedLongRestOwnerMaterialized(committed,wrongPreparation),/preparation mismatch/);

  const complete=recordConnectedLongRestOwnerMaterialized(committed,prepared);
  assert.equal(complete.phase,"complete");
  assert.equal(connectedLongRestRecoveryAction(complete),"none");
  assert.equal(complete.campaignCommitId,"campaign.commit.12");
});
