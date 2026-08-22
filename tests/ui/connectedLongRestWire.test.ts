import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeConnectedLongRestWireMessage,
  encodeConnectedLongRestWireMessage,
  type ConnectedLongRestWireMessage,
} from "../../src/app/connectedLongRestWire";

const character={characterId:"char.remote",sourceRevision:3,runtimeRevision:7};

function roundTrip(message:ConnectedLongRestWireMessage) {
  const decoded=decodeConnectedLongRestWireMessage(encodeConnectedLongRestWireMessage(message));
  assert.equal(decoded.status,"ok");
  if (decoded.status==="ok") assert.deepEqual(decoded.message,message);
}

test("connected Long Rest wire round-trips offer, owner decision, Host prepare authorization, prepare, global commit, materialization, and abort", () => {
  roundTrip({
    type:"long-rest-offer",
    offer:{
      transactionId:"long-rest.remote.1",
      sessionId:"session.connected",
      campaignId:"campaign.live",
      campaignRevision:11,
      ownerParticipantId:"player.remote",
      character,
      options:{advanceMinutes:480,consumeRations:true},
    },
  });
  roundTrip({
    type:"long-rest-decision",
    decision:{
      transactionId:"long-rest.remote.1",
      sessionId:"session.connected",
      ownerParticipantId:"player.remote",
      character,
      accepted:true,
    },
  });
  roundTrip({
    type:"long-rest-prepare-authorized",
    preflight:{
      transactionId:"long-rest.remote.1",
      sessionId:"session.connected",
      campaignId:"campaign.live",
      expectedCampaignRevision:11,
      ownerParticipantId:"player.remote",
      character,
      options:{advanceMinutes:480,consumeRations:true},
    },
  });
  roundTrip({
    type:"long-rest-owner-prepared",
    prepared:{
      transactionId:"long-rest.remote.1",
      ownerParticipantId:"player.remote",
      character,
      preparationId:"character-stage.12",
    },
  });
  roundTrip({
    type:"long-rest-global-commit",
    commit:{transactionId:"long-rest.remote.1",campaignCommitId:"campaign.commit.12"},
  });
  roundTrip({
    type:"long-rest-owner-materialized",
    materialized:{
      transactionId:"long-rest.remote.1",
      ownerParticipantId:"player.remote",
      character,
      preparationId:"character-stage.12",
    },
  });
  roundTrip({type:"long-rest-abort",transactionId:"long-rest.remote.1",reason:"Host cancelled before commit"});
});

test("connected Long Rest wire rejects malformed distributed-transaction inputs before runtime handling", () => {
  assert.equal(decodeConnectedLongRestWireMessage("{").status,"rejected");
  assert.equal(decodeConnectedLongRestWireMessage(JSON.stringify({type:"long-rest-offer",offer:{}})).status,"rejected");
  assert.equal(decodeConnectedLongRestWireMessage(JSON.stringify({
    type:"long-rest-offer",
    offer:{
      transactionId:"long-rest.remote.1",
      sessionId:"session.connected",
      campaignId:"campaign.live",
      campaignRevision:11,
      ownerParticipantId:"player.remote",
      character,
      options:{advanceMinutes:-1,consumeRations:true},
    },
  })).status,"rejected");
  assert.equal(decodeConnectedLongRestWireMessage(JSON.stringify({
    type:"long-rest-decision",
    decision:{
      transactionId:"long-rest.remote.1",
      sessionId:"session.connected",
      ownerParticipantId:"player.remote",
      character,
      accepted:"yes",
    },
  })).status,"rejected");
  assert.equal(decodeConnectedLongRestWireMessage(JSON.stringify({
    type:"long-rest-prepare-authorized",
    preflight:{
      transactionId:"long-rest.remote.1",
      sessionId:"session.connected",
      campaignId:"campaign.live",
      expectedCampaignRevision:-1,
      ownerParticipantId:"player.remote",
      character,
      options:{advanceMinutes:480,consumeRations:true},
    },
  })).status,"rejected");
  assert.equal(decodeConnectedLongRestWireMessage(JSON.stringify({type:"long-rest-abort",transactionId:"long-rest.remote.1",reason:""})).status,"rejected");
});
