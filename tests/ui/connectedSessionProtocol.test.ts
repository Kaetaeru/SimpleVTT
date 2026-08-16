import assert from "node:assert/strict";
import test from "node:test";
import {
  CONNECTED_SESSION_PROTOCOL_VERSION,
  ClientSessionReplica,
  HostSessionLedger,
  compareSessionCompatibility,
  type ConnectedActionRequest,
  type ConnectedEventPayload,
  type SessionCompatibilityManifest,
} from "../../src/app/connectedSessionProtocol";

const hostManifest:SessionCompatibilityManifest={
  protocolVersion:CONNECTED_SESSION_PROTOCOL_VERSION,
  rulesProfileId:"dnd.srd521",
  capabilities:["resolution-event-v1","character-projection-v1"],
};

function request(overrides:Partial<ConnectedActionRequest>={}):ConnectedActionRequest {
  return {
    sessionId:"session.test",
    requestId:"request.1",
    actorId:"char.aelar",
    actionId:"action.shortbow",
    targetIds:["combatant.goblin-a"],
    knownEventCursor:0,
    character:{ characterId:"char.aelar",sourceRevision:4,runtimeRevision:9 },
    capabilities:["resolution-event-v1","character-projection-v1"],
    ...overrides,
  };
}

function payload(label:string):ConnectedEventPayload {
  return { kind:"resolution",resolutionId:`resolution.${label}`,stateChanges:[label],provenance:["host authoritative test"] };
}

test("connected session handshake rejects protocol/rules/capability drift explicitly", () => {
  assert.equal(compareSessionCompatibility(hostManifest,{...hostManifest}).status,"compatible");
  assert.equal(compareSessionCompatibility(hostManifest,{...hostManifest,protocolVersion:99}).status,"incompatible");
  assert.equal(compareSessionCompatibility(hostManifest,{...hostManifest,rulesProfileId:"other.profile"}).status,"incompatible");
  assert.equal(compareSessionCompatibility(hostManifest,{...hostManifest,capabilities:["resolution-event-v1"]}).status,"incompatible");
  assert.equal(compareSessionCompatibility(hostManifest,{...hostManifest,capabilities:[...hostManifest.capabilities,"future-client-feature"]}).status,"warning");
});

test("host allocates ordered events once and duplicate ActionRequest is idempotent", () => {
  const host=new HostSessionLedger("session.test",hostManifest);
  const first=host.commitActionRequest(request(),{actorId:"char.aelar",payload:payload("hp 31 -> 25")});
  assert.equal(first.status,"committed");
  if (first.status !== "committed") return;
  assert.equal(first.event.sequence,1);
  assert.equal(first.event.eventId,"session.test:event:1");
  assert.equal(host.cursor,1);

  const duplicate=host.commitActionRequest(request(),{actorId:"char.aelar",payload:payload("must not commit")});
  assert.equal(duplicate.status,"duplicate");
  if (duplicate.status !== "duplicate") return;
  assert.deepEqual(duplicate.event,first.event);
  assert.equal(host.cursor,1);
});

test("host rejects stale client cursor rather than resolving against guessed shared state", () => {
  const host=new HostSessionLedger("session.test",hostManifest);
  host.commitHostEvent({payload:payload("mode freeform -> initiative")});
  const stale=host.commitActionRequest(request({knownEventCursor:0}),{payload:payload("must reject")});
  assert.equal(stale.status,"rejected");
  if (stale.status !== "rejected") return;
  assert.equal(stale.hostCursor,1);
  assert.match(stale.error,/stale event cursor/);
  assert.equal(host.cursor,1);
});

test("client applies host events exactly once and rejects gaps/conflicting history", () => {
  const host=new HostSessionLedger("session.test",hostManifest);
  const first=host.commitHostEvent({payload:payload("first")});
  const second=host.commitHostEvent({payload:payload("second")});
  const client=new ClientSessionReplica("session.test");
  const applied:string[]=[];
  const apply=(entry:ConnectedEventPayload)=>applied.push(...entry.stateChanges);

  const gap=client.apply(second,apply);
  assert.equal(gap.status,"rejected");
  assert.equal(client.cursor,0);
  assert.deepEqual(applied,[]);

  assert.equal(client.apply(first,apply).status,"applied");
  assert.equal(client.apply(first,apply).status,"duplicate");
  assert.equal(client.apply(second,apply).status,"applied");
  assert.equal(client.cursor,2);
  assert.deepEqual(applied,["first","second"]);

  const conflict={...first,eventId:"session.test:event:conflict"};
  assert.equal(client.apply(conflict,apply).status,"rejected");
  assert.deepEqual(applied,["first","second"]);
});

test("reconnect catch-up returns only missing host events and replays them once", () => {
  const host=new HostSessionLedger("session.test",hostManifest);
  host.commitHostEvent({payload:payload("one")});
  host.commitHostEvent({payload:payload("two")});
  host.commitHostEvent({payload:payload("three")});

  const client=new ClientSessionReplica("session.test");
  const applied:string[]=[];
  const apply=(entry:ConnectedEventPayload)=>applied.push(...entry.stateChanges);
  assert.equal(client.apply(host.eventsAfter(0)[0],apply).status,"applied");
  assert.equal(client.cursor,1);

  const missing=host.eventsAfter(client.cursor);
  assert.deepEqual(missing.map((event)=>event.sequence),[2,3]);
  assert.equal(client.applyBatch(missing,apply).status,"applied");
  assert.equal(client.cursor,3);
  assert.deepEqual(applied,["one","two","three"]);

  assert.equal(client.applyBatch(host.eventsAfter(1),apply).status,"duplicate");
  assert.deepEqual(applied,["one","two","three"]);
});
