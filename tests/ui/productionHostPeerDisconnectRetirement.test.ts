import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/productionSessionLifecycleAdapter";
import "../../src/app/connectedOwnerInventoryConnectionGuardAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { connectedInternal, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import {
  tauriSessionTransport,
  type SessionTransportMessage,
  type SessionTransportPeerLifecycle,
} from "../../src/app/tauriSessionTransport";

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
  let peerLifecycleHandler:((event:SessionTransportPeerLifecycle)=>void)|undefined;

  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>({role:"host",state:"connected",address:"127.0.0.1:3210",peerCount:1});
  tauriSessionTransport.send=async()=>1;
  tauriSessionTransport.sendTo=async()=>1;
  tauriSessionTransport.stop=async()=>({role:null,state:"disconnected",address:"",peerCount:0});
  tauriSessionTransport.onMessage=async(_handler:(message:SessionTransportMessage)=>void)=>()=>{};
  tauriSessionTransport.onState=async()=>()=>{};
  tauriSessionTransport.onPeerLifecycle=async(handler)=>{peerLifecycleHandler=handler;return()=>{};};

  return {
    emitPeerLifecycle(event:SessionTransportPeerLifecycle) {
      peerLifecycleHandler?.(event);
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

test("production Host retires a disconnected transport peer while retaining reconnect identity",async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const adapter=new MockAdapter();
    await adapter.hostSession();
    const state=connectedStateFor(adapter);
    const app=connectedInternal(adapter);
    assert.ok(state.ledger);

    const peer="127.0.0.1:53899";
    const participantId="client:char.w704.reconnect";
    const manifest=connectedManifest(adapter);
    manifest.character={characterId:"char.w704.reconnect",sourceRevision:7,runtimeRevision:9};
    state.peerParticipants.set(peer,participantId);
    state.peerManifests.set(peer,structuredClone(manifest));
    app.session.participants=[
      {id:"host",name:"DM Host",state:"connected",ready:false},
      {id:participantId,name:"Reconnect Owner",characterName:"Reconnect Owner",state:"connected",ready:true},
    ];

    transport.emitPeerLifecycle({peer,state:"disconnected"});
    await new Promise<void>((resolve)=>setImmediate(resolve));

    const retainedPeer=`disconnected:${participantId}`;
    assert.equal(state.peerParticipants.has(peer),false,"dead transport peer must leave live participant routing");
    assert.equal(state.peerManifests.has(peer),false,"dead transport peer must leave live manifest routing");
    assert.equal(state.peerParticipants.get(retainedPeer),participantId,"participant identity must remain available for live reconnect validation");
    assert.equal(state.peerManifests.get(retainedPeer)?.character?.characterId,"char.w704.reconnect","accepted Character identity must survive the physical disconnect");
    const participant=app.session.participants.find((entry)=>entry.id===participantId);
    assert.equal(participant?.state,"disconnected");
    assert.equal(participant?.ready,false);
  } finally {
    transport.restore();
  }
});

test("production Host rejects a remote owner inventory write while that owner is disconnected",async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const adapter=new MockAdapter();
    await adapter.hostSession();
    const state=connectedStateFor(adapter);
    const app=connectedInternal(adapter);
    const peer="127.0.0.1:53900";
    const actorId="char.w704.offline-owner";
    const participantId=`client:${actorId}`;
    const manifest=connectedManifest(adapter);
    manifest.character={characterId:actorId,sourceRevision:3,runtimeRevision:4};
    state.peerParticipants.set(peer,participantId);
    state.peerManifests.set(peer,structuredClone(manifest));
    app.session.participants=[
      {id:"host",name:"DM Host",state:"connected",ready:false},
      {id:participantId,name:"Offline Owner",characterName:"Offline Owner",state:"connected",ready:true},
    ];

    transport.emitPeerLifecycle({peer,state:"disconnected"});
    await new Promise<void>((resolve)=>setImmediate(resolve));

    await assert.rejects(
      ()=>adapter.adjustDmInventory({requestId:"w7-04.offline-owner",actorId,operation:"grant-currency",amount:5}),
      /Remote Character owner is offline/,
    );
    assert.equal(state.peerManifests.get(`disconnected:${participantId}`)?.character?.characterId,actorId,"rejected write must preserve the retained reconnect identity");
  } finally {
    transport.restore();
  }
});
