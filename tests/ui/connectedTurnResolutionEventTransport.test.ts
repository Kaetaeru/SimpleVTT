import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedTurnRoutingAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { MockAdapter } from "../../src/app/mockAdapter";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

function batches(wires:string[]) {
  return wires
    .map((wire)=>JSON.parse(wire) as {type:string;events?:ConnectedSessionEvent[]})
    .filter((wire):wire is {type:"event-batch";events:ConnectedSessionEvent[]}=>wire.type==="event-batch"&&Array.isArray(wire.events));
}

function connectClient(adapter:MockAdapter,sessionId:string) {
  const state=connectedStateFor(adapter);
  state.mode="client";
  state.sessionId=sessionId;
  state.replica=new ClientSessionReplica(sessionId);
}

test("connected turn projection carries and replays the exact authoritative lifecycle ResolutionEvents",async()=>{
  const host=new MockAdapter();
  const state=connectedStateFor(host);
  const sessionId="session.turn-resolution-events";
  state.mode="host";
  state.sessionId=sessionId;
  state.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const wires:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try {
    await host.startInitiative();
    wires.length=0;
    await host.endTurn();
  } finally {
    tauriSessionTransport.send=originalSend;
  }

  const batch=batches(wires).at(-1);
  assert.ok(batch,JSON.stringify(wires));
  const transition=batch.events.find((event)=>event.payload.kind==="mode-transition");
  assert.ok(transition);
  assert.equal(transition.payload.kind,"mode-transition");
  const resolutionEvents=transition.payload.resolutionEvents??[];
  assert.ok(resolutionEvents.length>0,"turn-end mode transition must retain authoritative lifecycle events");
  assert.ok(
    resolutionEvents.some((event)=>event.stateChanges.some((change)=>change.kind==="turn-clock")),
    "turn lifecycle transport must include the canonical reversible clock change",
  );

  const hostSnapshot=await host.getSnapshot();
  assert.equal(transition.payload.round,hostSnapshot.scene.round);
  assert.equal(transition.payload.currentActorId,hostSnapshot.scene.currentActorId);

  const authoritativeHistory=state.ledger.eventsAfter(0);
  const client=new MockAdapter();
  connectClient(client,sessionId);
  assert.equal((await applyConnectedClientEvents(client,authoritativeHistory)).status,"applied");
  const clientSnapshot=await client.getSnapshot();
  assert.equal(clientSnapshot.scene.round,hostSnapshot.scene.round);
  assert.equal(clientSnapshot.scene.currentActorId,hostSnapshot.scene.currentActorId);
  assert.deepEqual(
    snapshotAdapterTurnRuntimeState(client,clientSnapshot.scene)?.clock,
    snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)?.clock,
    "Client must apply the Host turn clock instead of only copying presentation fields",
  );
  assert.equal((await applyConnectedClientEvents(client,authoritativeHistory)).status,"duplicate");

  const reconnect=new MockAdapter();
  connectClient(reconnect,sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,authoritativeHistory)).status,"applied");
  const reconnectSnapshot=await reconnect.getSnapshot();
  assert.deepEqual(
    snapshotAdapterTurnRuntimeState(reconnect,reconnectSnapshot.scene)?.clock,
    snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)?.clock,
    "ordered reconnect replay must use the same canonical turn-event application path",
  );
});
