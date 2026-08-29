import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedTurnRoutingAdapter";
import { connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { MockAdapter } from "../../src/app/mockAdapter";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

function batches(wires:string[]) {
  return wires
    .map((wire)=>JSON.parse(wire) as {type:string;events?:ConnectedSessionEvent[]})
    .filter((wire):wire is {type:"event-batch";events:ConnectedSessionEvent[]}=>wire.type==="event-batch"&&Array.isArray(wire.events));
}

test("connected turn projection carries the exact authoritative lifecycle ResolutionEvents",async()=>{
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
});