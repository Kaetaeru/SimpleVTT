import assert from "node:assert/strict";
import test from "node:test";
import {
  CONNECTED_SESSION_PROTOCOL_VERSION,
  HostSessionLedger,
  type ConnectedActionRequest,
} from "../../src/app/connectedSessionProtocol";

function request(id="request.remote.1",cursor=0):ConnectedActionRequest {
  return {
    sessionId:"session.remote",
    requestId:id,
    actorId:"char.aelar",
    actionId:"action.second-wind",
    targetIds:["char.aelar"],
    knownEventCursor:cursor,
    character:{characterId:"char.aelar",sourceRevision:3,runtimeRevision:7},
    capabilities:["resolution-event-v1","character-projection-v1","event-cursor-v1"],
  };
}

const ledger=()=>new HostSessionLedger("session.remote",{
  protocolVersion:CONNECTED_SESSION_PROTOCOL_VERSION,
  rulesProfileId:"dnd.srd-5.2.1",
  capabilities:["resolution-event-v1","character-projection-v1","event-cursor-v1"],
});

const candidate={
  actorId:"char.aelar",
  payload:{
    kind:"resolution" as const,
    resolutionId:"resolution.remote.1",
    resolutionEvents:[],
    stateChanges:["char.aelar HP 31 → 38"],
    provenance:["host authoritative test"],
  },
};

test("reserving a remote action does not advance host history until commit", () => {
  const host=ledger();
  assert.equal(host.reserveActionRequest(request()).status,"reserved");
  assert.equal(host.cursor,0);
  const committed=host.commitReservedActionRequest("request.remote.1",candidate);
  assert.equal(committed.status,"committed");
  assert.equal(host.cursor,1);
  if (committed.status==="committed") assert.equal(committed.event.requestId,"request.remote.1");
});

test("duplicate reservation is idempotent and a committed retry returns the original event", () => {
  const host=ledger();
  assert.equal(host.reserveActionRequest(request()).status,"reserved");
  assert.equal(host.reserveActionRequest(request()).status,"reserved");
  const first=host.commitReservedActionRequest("request.remote.1",candidate);
  assert.equal(first.status,"committed");
  const duplicate=host.reserveActionRequest(request("request.remote.1",1));
  assert.equal(duplicate.status,"duplicate");
  if (first.status==="committed"&&duplicate.status==="duplicate") assert.deepEqual(duplicate.event,first.event);
  assert.equal(host.cursor,1);
});

test("pending request cannot commit across an intervening host event", () => {
  const host=ledger();
  assert.equal(host.reserveActionRequest(request()).status,"reserved");
  host.commitHostEvent({payload:{kind:"correction",stateChanges:["DM correction"],provenance:["host"]}});
  const rejected=host.commitReservedActionRequest("request.remote.1",candidate);
  assert.equal(rejected.status,"rejected");
  if (rejected.status==="rejected") assert.match(rejected.error,/host history advanced/);
  assert.equal(host.cursor,1);
});
