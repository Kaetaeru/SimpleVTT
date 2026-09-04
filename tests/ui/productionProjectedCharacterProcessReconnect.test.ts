import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/productionSessionLifecycleAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { buildCharacterLibraryRecordV1, materializeCharacterRecordV1 } from "../../src/app/characterLibraryPersistence";
import { projectedCharacterById } from "../../src/app/characterSessionProjectionRegistry";
import { connectedInternal, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { tauriSessionTransport, type SessionTransportMessage, type SessionTransportPeerLifecycle } from "../../src/app/tauriSessionTransport";
import { encodeConnectedWireMessage, type ConnectedWireMessage } from "../../src/app/connectedSessionWire";

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
  let messageHandler:((message:SessionTransportMessage)=>void)|undefined;
  let peerLifecycleHandler:((event:SessionTransportPeerLifecycle)=>void)|undefined;
  const sentTo:Array<{peer:string;message:ConnectedWireMessage}>=[];

  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>({role:"host",state:"connected",address:"127.0.0.1:3210",peerCount:0});
  tauriSessionTransport.send=async()=>1;
  tauriSessionTransport.sendTo=async(peer,message)=>{sentTo.push({peer,message:JSON.parse(message) as ConnectedWireMessage});return 1;};
  tauriSessionTransport.stop=async()=>({role:null,state:"disconnected",address:"",peerCount:0});
  tauriSessionTransport.onMessage=async(handler)=>{messageHandler=handler;return()=>{};};
  tauriSessionTransport.onState=async()=>()=>{};
  tauriSessionTransport.onPeerLifecycle=async(handler)=>{peerLifecycleHandler=handler;return()=>{};};

  return {
    sentTo:()=>[...sentTo],
    emitFrom(peer:string,message:ConnectedWireMessage){messageHandler?.({peer,message:encodeConnectedWireMessage(message)});},
    disconnect(peer:string){peerLifecycleHandler?.({peer,state:"disconnected"});},
    restore(){
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

test("live Host accepts a durable-rehydrated projected Character after physical process reconnect",async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const host=new MockAdapter();
    await host.hostSession();
    const state=connectedStateFor(host);
    const app=connectedInternal(host);
    assert.ok(state.ledger);
    state.sessionStarted=true;

    const remoteSheet=structuredClone(app.activeCharacter);
    remoteSheet.id="char.w704.process-reconnect";
    remoteSheet.name="W7-04 Process Reconnect";
    remoteSheet.saveState="saved";
    remoteSheet.sourceRevision=1;
    remoteSheet.runtimeRevision=1;
    const manifest=connectedManifest(host);
    manifest.character={characterId:remoteSheet.id,sourceRevision:1,runtimeRevision:1};
    const initialProjection=buildCharacterSessionProjectionV1(remoteSheet,app.catalog);
    const participantId=`client:${remoteSheet.id}`;

    transport.emitFrom("peer.old",{
      type:"hello",
      manifest,
      participantId,
      participantName:remoteSheet.name,
      knownEventCursor:0,
      projection:initialProjection,
    });
    await new Promise<void>((resolve)=>setImmediate(resolve));
    const initialAck=transport.sentTo().find((entry)=>entry.peer==="peer.old"&&entry.message.type==="hello-ack")?.message;
    assert.equal(initialAck?.type,"hello-ack");
    if(initialAck?.type!=="hello-ack")throw new Error("expected initial hello-ack");
    assert.notEqual(initialAck.compatibility.status,"incompatible",initialAck.compatibility.message);
    assert.equal(projectedCharacterById(host,remoteSheet.id)?.peerId,"peer.old");

    transport.disconnect("peer.old");
    await new Promise<void>((resolve)=>setImmediate(resolve));
    assert.equal(state.peerParticipants.has("peer.old"),false);
    assert.equal(state.acceptedParticipantManifests.get(participantId)?.character?.characterId,remoteSheet.id);

    const rehydrated=materializeCharacterRecordV1(buildCharacterLibraryRecordV1(remoteSheet));
    const reconnectManifest=structuredClone(manifest);
    reconnectManifest.character={
      characterId:rehydrated.id,
      sourceRevision:rehydrated.sourceRevision??0,
      runtimeRevision:rehydrated.runtimeRevision??0,
    };
    const reconnectProjection=buildCharacterSessionProjectionV1(rehydrated,app.catalog);
    transport.emitFrom("peer.new",{
      type:"hello",
      manifest:reconnectManifest,
      participantId,
      participantName:rehydrated.name,
      knownEventCursor:0,
      projection:reconnectProjection,
    });
    await new Promise<void>((resolve)=>setImmediate(resolve));

    const reconnectAck=transport.sentTo().filter((entry)=>entry.peer==="peer.new"&&entry.message.type==="hello-ack").at(-1)?.message;
    assert.equal(reconnectAck?.type,"hello-ack");
    if(reconnectAck?.type!=="hello-ack")throw new Error("expected reconnect hello-ack");
    assert.notEqual(reconnectAck.compatibility.status,"incompatible",reconnectAck.compatibility.message);
    assert.equal(state.peerParticipants.get("peer.new"),participantId);
    assert.equal(state.peerManifests.get("peer.new")?.character?.characterId,remoteSheet.id);
    assert.equal(projectedCharacterById(host,remoteSheet.id)?.peerId,"peer.new");
    assert.ok(reconnectAck.events.some((event)=>event.payload.kind==="participant"&&event.payload.state==="disconnected"));
    assert.ok(reconnectAck.events.some((event)=>event.payload.kind==="participant"&&event.payload.state==="connected"));
  } finally {
    transport.restore();
  }
});
