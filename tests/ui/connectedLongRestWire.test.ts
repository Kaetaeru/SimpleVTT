import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import {
  decodeConnectedLongRestWireMessage,
  encodeConnectedLongRestWireMessage,
  type ConnectedLongRestWireMessage,
} from "../../src/app/connectedLongRestWire";

const character={characterId:"char.remote",sourceRevision:3,runtimeRevision:7};
const projection={
  schemaId:"simplevtt.character-session-projection",
  schemaVersion:1,
  characterId:"char.remote",
  sourceRevision:3,
  runtimeRevision:8,
  rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
  source:{characterId:"char.remote"},
  sourceAuthority:{maxHp:12},
  runtime:{hp:12,tempHp:0,resources:[],items:[]},
  contentIdentities:[],
} as unknown as CharacterSessionProjectionV1;

function roundTrip(message:ConnectedLongRestWireMessage) {
  const decoded=decodeConnectedLongRestWireMessage(encodeConnectedLongRestWireMessage(message));
  assert.equal(decoded.status,"ok");
  if (decoded.status==="ok") assert.deepEqual(decoded.message,message);
}

test("connected Long Rest wire round-trips offer, owner decision, prepare, restart-safe commit/abort, and owner acknowledgements", () => {
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
    prepared:{transactionId:"long-rest.remote.1",ownerParticipantId:"player.remote",character,preparationId:"character-stage.12"},
  });
  roundTrip({
    type:"long-rest-global-commit",
    commit:{
      transactionId:"long-rest.remote.1",
      campaignCommitId:"long-rest.remote.1:campaign-commit-v1",
      ownerParticipantId:"player.remote",
      character,
      preparationId:"character-stage.12",
    },
  });
  roundTrip({
    type:"long-rest-owner-materialized",
    materialized:{transactionId:"long-rest.remote.1",ownerParticipantId:"player.remote",character,preparationId:"character-stage.12"},
    projection,
  });
  roundTrip({
    type:"long-rest-abort",
    transactionId:"long-rest.remote.1",
    reason:"Host restarted before commit",
    ownerParticipantId:"player.remote",
    character,
    preparationId:"character-stage.12",
  });
  roundTrip({
    type:"long-rest-owner-aborted",
    aborted:{transactionId:"long-rest.remote.1",ownerParticipantId:"player.remote",character,preparationId:"character-stage.12"},
  });
});

test("connected Long Rest wire rejects malformed distributed-transaction inputs before runtime handling", () => {
  assert.equal(decodeConnectedLongRestWireMessage("{").status,"rejected");
  assert.equal(decodeConnectedLongRestWireMessage(JSON.stringify({type:"long-rest-offer",offer:{}})).status,"rejected");
  assert.equal(decodeConnectedLongRestWireMessage(JSON.stringify({
    type:"long-rest-offer",
    offer:{transactionId:"long-rest.remote.1",sessionId:"session.connected",campaignId:"campaign.live",campaignRevision:11,ownerParticipantId:"player.remote",character,options:{advanceMinutes:-1,consumeRations:true}},
  })).status,"rejected");
  assert.equal(decodeConnectedLongRestWireMessage(JSON.stringify({
    type:"long-rest-decision",
    decision:{transactionId:"long-rest.remote.1",sessionId:"session.connected",ownerParticipantId:"player.remote",character,accepted:"yes"},
  })).status,"rejected");
  assert.equal(decodeConnectedLongRestWireMessage(JSON.stringify({
    type:"long-rest-prepare-authorized",
    preflight:{transactionId:"long-rest.remote.1",sessionId:"session.connected",campaignId:"campaign.live",expectedCampaignRevision:-1,ownerParticipantId:"player.remote",character,options:{advanceMinutes:480,consumeRations:true}},
  })).status,"rejected");
  assert.equal(decodeConnectedLongRestWireMessage(JSON.stringify({
    type:"long-rest-global-commit",
    commit:{transactionId:"long-rest.remote.1",campaignCommitId:"commit",ownerParticipantId:"player.remote"},
  })).status,"rejected");
  assert.equal(decodeConnectedLongRestWireMessage(JSON.stringify({
    type:"long-rest-abort",transactionId:"long-rest.remote.1",reason:"restart",ownerParticipantId:"player.remote",
  })).status,"rejected");
  assert.equal(decodeConnectedLongRestWireMessage(JSON.stringify({
    type:"long-rest-owner-aborted",aborted:{transactionId:"long-rest.remote.1",ownerParticipantId:"player.remote",character},
  })).status,"rejected");
  assert.equal(decodeConnectedLongRestWireMessage(JSON.stringify({
    type:"long-rest-owner-materialized",
    materialized:{transactionId:"long-rest.remote.1",ownerParticipantId:"player.remote",character,preparationId:"character-stage.12"},
    projection:{...projection,characterId:"char.other"},
  })).status,"rejected");
  assert.equal(decodeConnectedLongRestWireMessage(JSON.stringify({type:"long-rest-abort",transactionId:"long-rest.remote.1",reason:""})).status,"rejected");
});
