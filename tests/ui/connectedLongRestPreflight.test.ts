import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import {
  preflightConnectedLongRest,
  type ConnectedLongRestCurrentAuthority,
  type ConnectedLongRestOffer,
  type ConnectedLongRestOwnerDecision,
} from "../../src/app/connectedLongRestPreflight";

function projection(sourceRevision=3,runtimeRevision=7):CharacterSessionProjectionV1 {
  return {characterId:"char.remote",sourceRevision,runtimeRevision} as CharacterSessionProjectionV1;
}

function offer():ConnectedLongRestOffer {
  return {
    transactionId:"long-rest.remote.1",
    sessionId:"session.connected",
    campaignId:"campaign.live",
    campaignRevision:11,
    ownerParticipantId:"player.remote",
    character:{characterId:"char.remote",sourceRevision:3,runtimeRevision:7},
    options:{advanceMinutes:480,consumeRations:true},
  };
}

function decision(accepted=true):ConnectedLongRestOwnerDecision {
  const source=offer();
  return {
    transactionId:source.transactionId,
    sessionId:source.sessionId,
    ownerParticipantId:source.ownerParticipantId,
    character:structuredClone(source.character),
    accepted,
  };
}

function current():ConnectedLongRestCurrentAuthority {
  const source=offer();
  return {
    sessionId:source.sessionId,
    campaignId:source.campaignId,
    campaignRevision:source.campaignRevision,
    registeredOwnerParticipantId:source.ownerParticipantId,
    projection:projection(),
  };
}

test("connected Long Rest preflight requires the owner decision on the exact Character and Campaign revisions", () => {
  const result=preflightConnectedLongRest(offer(),decision(),current());
  assert.equal(result.status,"ready");
  if (result.status!=="ready") return;
  assert.deepEqual(result.preflight,{
    transactionId:"long-rest.remote.1",
    sessionId:"session.connected",
    campaignId:"campaign.live",
    expectedCampaignRevision:11,
    ownerParticipantId:"player.remote",
    character:{characterId:"char.remote",sourceRevision:3,runtimeRevision:7},
    options:{advanceMinutes:480,consumeRations:true},
  });
});

test("connected Long Rest owner may decline without creating a commit preflight", () => {
  const result=preflightConnectedLongRest(offer(),decision(false),current());
  assert.deepEqual(result,{status:"declined",transactionId:"long-rest.remote.1"});
});

test("connected Long Rest rejects a decision from another owner or revision", () => {
  const wrongOwner=decision();
  wrongOwner.ownerParticipantId="player.other";
  const ownerResult=preflightConnectedLongRest(offer(),wrongOwner,current());
  assert.equal(ownerResult.status,"rejected");
  if (ownerResult.status==="rejected") assert.match(ownerResult.error,/owner mismatch/);

  const wrongRevision=decision();
  wrongRevision.character.runtimeRevision=8;
  const revisionResult=preflightConnectedLongRest(offer(),wrongRevision,current());
  assert.equal(revisionResult.status,"rejected");
  if (revisionResult.status==="rejected") assert.match(revisionResult.error,/Character revision mismatch/);
});

test("connected Long Rest rejects stale Campaign, projection, and owner authority after acceptance", () => {
  const staleCampaign=current();
  staleCampaign.campaignRevision=12;
  const campaignResult=preflightConnectedLongRest(offer(),decision(),staleCampaign);
  assert.equal(campaignResult.status,"rejected");
  if (campaignResult.status==="rejected") assert.match(campaignResult.error,/Campaign revision is stale/);

  const staleCharacter=current();
  staleCharacter.projection=projection(3,8);
  const characterResult=preflightConnectedLongRest(offer(),decision(),staleCharacter);
  assert.equal(characterResult.status,"rejected");
  if (characterResult.status==="rejected") assert.match(characterResult.error,/Character projection revision is stale/);

  const changedOwner=current();
  changedOwner.registeredOwnerParticipantId="player.reconnected-other";
  const ownerResult=preflightConnectedLongRest(offer(),decision(),changedOwner);
  assert.equal(ownerResult.status,"rejected");
  if (ownerResult.status==="rejected") assert.match(ownerResult.error,/owner changed/);
});

test("connected Long Rest rejects invalid optional-effect input before any distributed prepare", () => {
  const invalid=offer();
  invalid.options.advanceMinutes=-1;
  const result=preflightConnectedLongRest(invalid,decision(),current());
  assert.equal(result.status,"rejected");
  if (result.status==="rejected") assert.match(result.error,/advanceMinutes/);
});
