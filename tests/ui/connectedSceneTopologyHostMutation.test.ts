import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedSceneTopologyRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { tauriSessionTransport, type SessionTransportMessage } from "../../src/app/tauriSessionTransport";
import type { ConnectedWireMessage } from "../../src/app/connectedSessionWire";

function installFakeDesktopTransport() {
  const original={
    available:tauriSessionTransport.available,startHost:tauriSessionTransport.startHost,
    send:tauriSessionTransport.send,sendTo:tauriSessionTransport.sendTo,stop:tauriSessionTransport.stop,
    onMessage:tauriSessionTransport.onMessage,onState:tauriSessionTransport.onState,
    onPeerLifecycle:tauriSessionTransport.onPeerLifecycle,
  };
  const broadcasts:ConnectedWireMessage[]=[];
  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>({role:"host",state:"connected",address:"127.0.0.1:3210",peerCount:0});
  tauriSessionTransport.send=async(message)=>{broadcasts.push(JSON.parse(message) as ConnectedWireMessage);return 1;};
  tauriSessionTransport.sendTo=async()=>1;
  tauriSessionTransport.stop=async()=>({role:null,state:"disconnected",address:"",peerCount:0});
  tauriSessionTransport.onMessage=async(_handler:(message:SessionTransportMessage)=>void)=>()=>{};
  tauriSessionTransport.onState=async()=>()=>{};
  tauriSessionTransport.onPeerLifecycle=async()=>()=>{};
  return {
    broadcasts,
    restore(){
      tauriSessionTransport.available=original.available;tauriSessionTransport.startHost=original.startHost;
      tauriSessionTransport.send=original.send;tauriSessionTransport.sendTo=original.sendTo;tauriSessionTransport.stop=original.stop;
      tauriSessionTransport.onMessage=original.onMessage;tauriSessionTransport.onState=original.onState;
      tauriSessionTransport.onPeerLifecycle=original.onPeerLifecycle;
    },
  };
}

test("Host Combatant add and remove publish ordered authoritative Scene topology events", async () => {
  const transport=installFakeDesktopTransport();
  try {
    const adapter=new MockAdapter();
    await adapter.hostSession();
    const state=connectedStateFor(adapter);
    assert.ok(state.ledger);
    const before=state.ledger.cursor;

    let snapshot=await adapter.instantiateCombatant("combatant.goblin");
    const added=snapshot.scene.entities.find((entity)=>entity.id.startsWith("combatant.goblin.instance-"));
    assert.ok(added);
    assert.equal(state.ledger.cursor,before+1);
    const addedBatch=transport.broadcasts.at(-1);
    assert.equal(addedBatch?.type,"event-batch");
    if (addedBatch?.type!=="event-batch") throw new Error("expected topology event batch");
    assert.equal(addedBatch.events[0]?.payload.kind,"scene-topology");
    if (addedBatch.events[0]?.payload.kind!=="scene-topology") throw new Error("expected topology payload");
    assert.ok(addedBatch.events[0].payload.topology.entities.some((entity)=>entity.id===added.id));

    snapshot=await adapter.removeCombatant(added.id);
    assert.equal(snapshot.scene.entities.some((entity)=>entity.id===added.id),false);
    assert.equal(state.ledger.cursor,before+2);
    const removedBatch=transport.broadcasts.at(-1);
    assert.equal(removedBatch?.type,"event-batch");
    if (removedBatch?.type!=="event-batch"||removedBatch.events[0]?.payload.kind!=="scene-topology") throw new Error("expected removal topology payload");
    assert.equal(removedBatch.events[0].payload.topology.entities.some((entity)=>entity.id===added.id),false);
  } finally {
    transport.restore();
  }
});
