import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/productionSessionLifecycleAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { connectedInternal, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { tauriSessionTransport, type SessionTransportPeerLifecycle } from "../../src/app/tauriSessionTransport";
import type { ConnectedWireMessage } from "../../src/app/connectedSessionWire";

function installFakeDesktopTransport() {
  const original={
    available:tauriSessionTransport.available,
    startHost:tauriSessionTransport.startHost,
    send:tauriSessionTransport.send,
    sendTo:tauriSessionTransport.sendTo,
    stop:tauriSessionTransport.stop,
    onMessage:tauriSessionTransport.onMessage,
    onState:tauriSessionTransport.onState,
    onPeerLifecycle:tauriSessionTransport.onPeerLifecycle,
  };
  const sent:string[]=[];
  const peerHandlers:Array<(event:SessionTransportPeerLifecycle)=>void>=[];
  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>({role:"host",state:"connected",address:"127.0.0.1:3210",peerCount:0});
  tauriSessionTransport.send=async(message)=>{sent.push(message);return 1;};
  tauriSessionTransport.sendTo=async()=>1;
  tauriSessionTransport.stop=async()=>({role:null,state:"disconnected",address:"",peerCount:0});
  tauriSessionTransport.onMessage=async()=>()=>{};
  tauriSessionTransport.onState=async()=>()=>{};
  tauriSessionTransport.onPeerLifecycle=async(handler)=>{peerHandlers.push(handler);return()=>{};};
  return {
    sent:()=>sent.map((raw)=>JSON.parse(raw) as ConnectedWireMessage),
    emitPeer(event:SessionTransportPeerLifecycle) {
      for (const handler of peerHandlers) handler(event);
    },
    restore() {
      tauriSessionTransport.available=original.available;
      tauriSessionTransport.startHost=original.startHost;
      tauriSessionTransport.send=original.send;
      tauriSessionTransport.sendTo=original.sendTo;
      tauriSessionTransport.stop=original.stop;
      tauriSessionTransport.onMessage=original.onMessage;
      tauriSessionTransport.onState=original.onState;
      tauriSessionTransport.onPeerLifecycle=original.onPeerLifecycle;
    },
  };
}

async function prepareReadyHost(adapter:MockAdapter) {
  await adapter.hostSession();
  const state=connectedStateFor(adapter);
  const app=connectedInternal(adapter);
  assert.ok(state.sessionId);
  state.peerManifests.set("peer.player",connectedManifest(adapter));
  state.peerParticipants.set("peer.player","client:char.phase14.player");
  app.session.participants=[
    {id:"host",name:"DM Host",state:"connected",ready:false},
    {id:"client:char.phase14.player",name:"Phase14 Player",characterName:"Phase14 Player",state:"connected",ready:true},
  ];
  return {state,app};
}

test("Host exact peer disconnect resets only that participant Ready through authoritative events and blocks Start",async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const adapter=new MockAdapter();
    const {state}=await prepareReadyHost(adapter);

    transport.emitPeer({peer:"peer.player",state:"disconnected"});
    await new Promise<void>((resolve)=>setImmediate(resolve));
    const dropped=await adapter.getSnapshot();
    const player=dropped.session.participants.find((participant)=>participant.id==="client:char.phase14.player");
    assert.equal(player?.state,"disconnected");
    assert.equal(player?.ready,false);
    assert.match(dropped.session.compatibilityMessage,/Host runtime is preserved for reconnect/);
    assert.equal(state.peerParticipants.get("peer.player"),"client:char.phase14.player","disconnect must preserve the accepted mapping for reconnect identity");
    assert.ok(state.ledger?.eventsAfter(0).some((event)=>event.payload.kind==="participant"&&event.payload.state==="disconnected"&&event.payload.ready===false&&event.payload.provenance.some((entry)=>entry.includes("exact transport disconnect: peer.player"))));
    assert.ok(transport.sent().some((message)=>message.type==="event-batch"&&message.events.some((event)=>event.payload.kind==="participant"&&event.payload.state==="disconnected"&&event.payload.ready===false)));

    const blocked=await adapter.startPreparedSession("initiative");
    assert.equal(blocked.session.lifecycle,"preparing");
    assert.equal(state.sessionStarted,false);
    assert.match(blocked.session.compatibilityMessage,/not connected/);
  } finally {
    transport.restore();
  }
});

test("Host starts a fully Ready prepared participant set into Freeform through the authoritative mode event",async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const adapter=new MockAdapter();
    const {state}=await prepareReadyHost(adapter);
    const live=await adapter.startPreparedSession("freeform");

    assert.equal(live.session.lifecycle,"live");
    assert.equal(live.sessionMode,"freeform");
    assert.equal(state.sessionStarted,true);
    assert.ok(state.ledger?.eventsAfter(0).some((event)=>event.payload.kind==="mode-transition"&&event.payload.sessionMode==="freeform"));
    assert.ok(transport.sent().some((message)=>message.type==="event-batch"&&message.events.some((event)=>event.payload.kind==="mode-transition"&&event.payload.sessionMode==="freeform")));
  } finally {
    transport.restore();
  }
});
