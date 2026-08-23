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

const presentation={
  schemaId:"simplevtt.connected-resolution-presentation" as const,
  schemaVersion:1 as const,
  resolutionId:"resolution.test",
  presentationSequence:1,
  delivery:"catchup" as const,
  audience:{scope:"public" as const},
  actor:{id:"char.aelar",label:"Aelar"},
  targets:[{id:"combatant.goblin-a",label:"Goblin A"}],
  resolution:{
    id:"resolution.test",actorId:"char.aelar",targetIds:["combatant.goblin-a"],actionId:"action.shortbow",actionName:"Shortbow",
    rollKind:"damage" as const,stage:"complete" as const,authoritativeDice:[3],saveResults:[],damageComponents:[],compact:"3 damage",detail:[],
    provenance:[],calculatedOutcome:"3 damage",finalOutcome:"3 damage",stateChanges:["Goblin HP 7 → 4"],adjudicated:false,canAdvance:false,
  },
  action:{
    id:"action.shortbow",actorId:"char.aelar",name:"Shortbow",category:"weapon" as const,target:"enemy" as const,
    resolutionKind:"attack" as const,summary:"+5 · 1d6+2 piercing",attackBonus:5,damage:[{type:"piercing",dice:"1d6",flat:2,average:6}],
  },
  dice:{faces:[3],selectedIndices:[0],discardedIndices:[],selection:"all" as const,total:3,modifier:0},
  timeline:[{key:"complete" as const,label:"3 damage",terminal:true}],
  activityLink:{resolutionId:"resolution.test"},
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
    presentation,
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

const readyActionEvent:ConnectedSessionEvent={
  sessionId:"session.test",
  eventId:"session.test:event:3",
  sequence:3,
  actorId:"char.aelar",
  payload:{
    kind:"ready-action",
    actorId:"char.aelar",
    transition:"armed",
    configuration:{actorId:"char.aelar",actionId:"action.shortbow",trigger:"고블린이 문을 통과하면"},
    economy:{action:false,bonusAction:true,reaction:true,movement:30,movementMax:30},
    stateChanges:["Aelar 상태 추가: 준비 행동"],
    provenance:["host-authoritative ready-action lifecycle"],
  },
};

const undoEvent:ConnectedSessionEvent={
  sessionId:"session.test",eventId:"session.test:event:4",sequence:4,actorId:"dm",
  payload:{kind:"resolution-undo",undoId:"undo.resolution.test",undoOf:"resolution.test",inverseResolutionEvents:[{
    id:"undo.resolution.test:event:1",resolutionId:"undo.resolution.test",operationId:"undo:operation.damage",kind:"damage",actorId:"char.aelar",targetId:"combatant.goblin-a",summary:"Undo · 3 piercing damage",provenance:[],
    stateChanges:[{kind:"hp",targetId:"combatant.goblin-a",field:"current",before:4,after:7,provenance:[],lifetime:"character-durable",writeBack:"character"}],result:{undoOf:"domain.event.1"},
  }],stateChanges:["Goblin HP 4 → 7"],provenance:["Host-authoritative compensating Undo"]},
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
      readyConfiguration:{actorId:"char.aelar",actionId:"action.shortbow",trigger:"고블린이 문을 통과하면"},
    },
  });
  roundTrip({ type:"catchup-request",sessionId:"session.test",afterCursor:1 });
  roundTrip({ type:"event-batch",sessionId:"session.test",afterCursor:1,events:[readyEvent] });
  roundTrip({ type:"event-batch",sessionId:"session.test",afterCursor:2,events:[readyActionEvent] });
  roundTrip({ type:"event-batch",sessionId:"session.test",afterCursor:3,events:[undoEvent] });
  roundTrip({ type:"resolution-presentation",sessionId:"session.test",presentation:{...presentation,delivery:"live"} });
  roundTrip({type:"resolution-interrupt-prompt",sessionId:"session.test",resolutionId:"resolution.test",presentationSequence:2,interrupt:{id:"reaction.shield",responderId:"char.aelar",responderName:"Aelar",trigger:"hit",optionName:"Shield",cost:"reaction",effect:"AC +5",source:"spell"}});
  roundTrip({type:"resolution-interrupt-response",response:{sessionId:"session.test",resolutionId:"resolution.test",promptId:"reaction.shield",accept:true}});
  roundTrip({ type:"session-ended",sessionId:"session.test",reason:"Host ended live play." });
  roundTrip({ type:"error",code:"stale-cursor",message:"client is behind",hostCursor:3 });
});

test("connected wire accepts canonical recovery lockout metadata and rejects malformed lockouts", () => {
  const lockoutEvent=structuredClone(event) as unknown as {
    payload:{resolutionEvents:Array<{stateChanges:Array<Record<string,unknown>>}>};
  };
  lockoutEvent.payload.resolutionEvents[0].stateChanges=[{
    kind:"resource",
    targetId:"char.aelar",
    resourceId:"feature.locked",
    before:0,
    after:0,
    recoveryLockouts:{before:{longRest:2},after:{longRest:1}},
    provenance:[],
    lifetime:"character-durable",
    writeBack:"character",
  }];
  assert.equal(decodeConnectedWireMessage(JSON.stringify({type:"event-batch",sessionId:"session.test",afterCursor:0,events:[lockoutEvent]})).status,"ok");

  const negative=structuredClone(lockoutEvent);
  (negative.payload.resolutionEvents[0].stateChanges[0].recoveryLockouts as {after:{longRest:number}}).after.longRest=-1;
  assert.equal(decodeConnectedWireMessage(JSON.stringify({type:"event-batch",sessionId:"session.test",afterCursor:0,events:[negative]})).status,"rejected");

  const malformed=structuredClone(lockoutEvent);
  malformed.payload.resolutionEvents[0].stateChanges[0].recoveryLockouts={before:{longRest:2},after:{rests:"one"}};
  assert.equal(decodeConnectedWireMessage(JSON.stringify({type:"event-batch",sessionId:"session.test",afterCursor:0,events:[malformed]})).status,"rejected");
});

test("connected wire rejects malformed JSON, unknown message types, invalid cursors, malformed readiness, and malformed session end", () => {
  assert.equal(decodeConnectedWireMessage("{").status,"rejected");
  assert.equal(decodeConnectedWireMessage(JSON.stringify({type:"mystery"})).status,"rejected");
  assert.equal(decodeConnectedWireMessage(JSON.stringify({type:"catchup-request",sessionId:"session.test",afterCursor:-1})).status,"rejected");
  assert.equal(decodeConnectedWireMessage(JSON.stringify({type:"ready-intent",sessionId:"session.test",ready:"yes"})).status,"rejected");
  assert.equal(decodeConnectedWireMessage(JSON.stringify({type:"session-ended",sessionId:"session.test",reason:""})).status,"rejected");
  assert.equal(decodeConnectedWireMessage(JSON.stringify({type:"action-request",request:{
    sessionId:"session.test",requestId:"request.1",actorId:"char.aelar",actionId:"action.standard.ready",
    targetIds:["char.aelar"],knownEventCursor:0,capabilities:[],readyConfiguration:{actorId:"char.aelar",actionId:"action.shortbow",trigger:42},
  }})).status,"rejected");
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

test("connected session wire round-trips Long Rest distributed transaction envelopes and rejects malformed input", () => {
  roundTrip({
    type:"long-rest-offer",
    offer:{
      transactionId:"long-rest.remote.1",
      sessionId:"session.test",
      campaignId:"campaign.live",
      campaignRevision:11,
      ownerParticipantId:"player.aelar",
      character:{characterId:"char.aelar",sourceRevision:2,runtimeRevision:5},
      options:{advanceMinutes:480,consumeRations:true},
    },
  });
  roundTrip({
    type:"long-rest-global-commit",
    commit:{transactionId:"long-rest.remote.1",campaignCommitId:"campaign.commit.12"},
  });
  const malformed=decodeConnectedWireMessage(JSON.stringify({
    type:"long-rest-decision",
    decision:{
      transactionId:"long-rest.remote.1",
      sessionId:"session.test",
      ownerParticipantId:"player.aelar",
      character:{characterId:"char.aelar",sourceRevision:2,runtimeRevision:-1},
      accepted:true,
    },
  }));
  assert.equal(malformed.status,"rejected");
});
