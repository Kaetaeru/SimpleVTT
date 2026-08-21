import assert from "node:assert/strict";
import test from "node:test";
import {
  CONNECTED_SESSION_PROTOCOL_VERSION,
  type ConnectedSessionEvent,
  type SessionCompatibilityManifest,
} from "../../src/app/connectedSessionProtocol";
import {
  decodeConnectedWireMessage,
  encodeConnectedWireMessage,
  type ConnectedWireMessage,
} from "../../src/app/connectedSessionWire";

const manifest:SessionCompatibilityManifest={
  protocolVersion:CONNECTED_SESSION_PROTOCOL_VERSION,
  rulesProfileId:"dnd.srd521",
  capabilities:["resolution-event-v1","character-projection-v1"],
};

const event:ConnectedSessionEvent={
  sessionId:"session.test",
  eventId:"session.test:event:1",
  sequence:1,
  requestId:"request.1",
  actorId:"char.aelar",
  payload:{
    kind:"resolution",
    resolutionId:"resolution.test",
    resolutionEvents:[{
      id:"domain.event.1",
      resolutionId:"resolution.test",
      operationId:"operation.damage",
      kind:"damage",
      actorId:"char.aelar",
      targetId:"combatant.goblin-a",
      summary:"3 piercing damage",
      provenance:[],
      stateChanges:[{
        kind:"hp",
        targetId:"combatant.goblin-a",
        field:"current",
        before:7,
        after:4,
        provenance:[],
        lifetime:"character-durable",
        writeBack:"character",
      }],
      result:{ damage:3 },
    }],
    stateChanges:["Goblin HP 7 → 4"],
    provenance:["host authoritative test"],
  },
};

const readyEvent:ConnectedSessionEvent={
  sessionId:"session.test",
  eventId:"session.test:event:2",
  sequence:2,
  actorId:"client:char.saved",
  payload:{
    kind:"participant",
    participantId:"client:char.saved",
    participantName:"Saved Hero",
    characterName:"Saved Hero",
    state:"connected",
    ready:true,
    stateChanges:["Saved Hero Ready = true"],
    provenance:["host-authoritative ready intent"],
  },
};

function roundTrip(message:ConnectedWireMessage) {
  const decoded=decodeConnectedWireMessage(encodeConnectedWireMessage(message));
  assert.equal(decoded.status,"ok");
  if (decoded.status==="ok") assert.deepEqual(decoded.message,message);
}

test("connected wire round-trips handshake, readiness, action request, catch-up, event batch, and session end envelopes", () => {
  roundTrip({ type:"hello",manifest,participantId:"player.aelar",participantName:"Aelar",knownEventCursor:0 });
  roundTrip({
    type:"hello-ack",sessionId:"session.test",compatibility:{status:"compatible",message:"ok"},hostCursor:1,events:[event],
  });
  roundTrip({ type:"ready-intent",sessionId:"session.test",ready:true });
  roundTrip({
    type:"action-request",
    request:{
      sessionId:"session.test",requestId:"request.1",actorId:"char.aelar",actionId:"action.shortbow",
      targetIds:["combatant.goblin-a"],knownEventCursor:0,capabilities:["resolution-event-v1"],
      character:{characterId:"char.aelar",sourceRevision:2,runtimeRevision:5},
    },
  });
  roundTrip({ type:"catchup-request",sessionId:"session.test",afterCursor:1 });
  roundTrip({ type:"event-batch",sessionId:"session.test",afterCursor:1,events:[readyEvent] });
  roundTrip({ type:"session-ended",sessionId:"session.test",reason:"Host ended live play." });
  roundTrip({ type:"error",code:"stale-cursor",message:"client is behind",hostCursor:3 });
});

test("connected wire rejects malformed JSON, unknown message types, invalid cursors, malformed readiness, and malformed session end", () => {
  assert.equal(decodeConnectedWireMessage("{").status,"rejected");
  assert.equal(decodeConnectedWireMessage(JSON.stringify({type:"mystery"})).status,"rejected");
  assert.equal(decodeConnectedWireMessage(JSON.stringify({type:"catchup-request",sessionId:"session.test",afterCursor:-1})).status,"rejected");
  assert.equal(decodeConnectedWireMessage(JSON.stringify({type:"ready-intent",sessionId:"session.test",ready:"yes"})).status,"rejected");
  assert.equal(decodeConnectedWireMessage(JSON.stringify({type:"session-ended",sessionId:"session.test",reason:""})).status,"rejected");
  const malformedParticipant=structuredClone(readyEvent) as unknown as {payload:{ready:unknown}};
  malformedParticipant.payload.ready="yes";
  assert.equal(decodeConnectedWireMessage(JSON.stringify({type:"event-batch",sessionId:"session.test",afterCursor:1,events:[malformedParticipant]})).status,"rejected");
});

test("connected wire rejects a malformed authoritative ResolutionEvent before state application", () => {
  const malformed=structuredClone(event) as unknown as { payload:{ resolutionEvents:Array<{ stateChanges:Array<Record<string,unknown>> }> } };
  malformed.payload.resolutionEvents[0].stateChanges[0].after="not-a-number";
  const decoded=decodeConnectedWireMessage(JSON.stringify({type:"event-batch",sessionId:"session.test",afterCursor:0,events:[malformed]}));
  assert.equal(decoded.status,"rejected");
});
