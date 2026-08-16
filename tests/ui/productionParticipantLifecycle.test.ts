import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { connectedInternal, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { tauriSessionTransport, type SessionTransportMessage } from "../../src/app/tauriSessionTransport";
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
  };
  let messageHandler:((message:SessionTransportMessage)=>void)|undefined;
  const sentTo:Array<{peer:string;message:ConnectedWireMessage}>=[];
  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>({role:"host",state:"connected",address:"127.0.0.1:3210",peerCount:0});
  tauriSessionTransport.send=async()=>1;
  tauriSessionTransport.sendTo=async(peer,message)=>{sentTo.push({peer,message:JSON.parse(message) as ConnectedWireMessage});return 1;};
  tauriSessionTransport.stop=async()=>({role:null,state:"disconnected",address:"",peerCount:0});
  tauriSessionTransport.onMessage=async(handler)=>{messageHandler=handler;return()=>{};};
  tauriSessionTransport.onState=async()=>()=>{};
  return {
    sentTo:()=>[...sentTo],
    emitFrom(peer:string,message:ConnectedWireMessage) {
      messageHandler?.({peer,message:encodeConnectedWireMessage(message)});
    },
    restore() {
      tauriSessionTransport.available=original.available;
      tauriSessionTransport.startHost=original.startHost;
      tauriSessionTransport.send=original.send;
      tauriSessionTransport.sendTo=original.sendTo;
      tauriSessionTransport.stop=original.stop;
      tauriSessionTransport.onMessage=original.onMessage;
      tauriSessionTransport.onState=original.onState;
    },
  };
}

test("live Host rejects genuinely new participant before mutating accepted participant or ledger state",async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const adapter=new MockAdapter();
    await adapter.hostSession();
    const state=connectedStateFor(adapter);
    const app=connectedInternal(adapter);
    assert.ok(state.ledger);
    state.sessionStarted=true;
    const cursorBefore=state.ledger.cursor;

    transport.emitFrom("peer.late",{
      type:"hello",
      manifest:connectedManifest(adapter),
      participantId:"client:char.phase14.late",
      participantName:"Late Player",
      knownEventCursor:0,
    });
    await new Promise<void>((resolve)=>setImmediate(resolve));

    assert.equal(state.ledger.cursor,cursorBefore,"live late join must not commit participant state");
    assert.equal(state.peerParticipants.has("peer.late"),false);
    assert.equal(app.session.participants.some((participant)=>participant.id==="client:char.phase14.late"),false);
    const ack=transport.sentTo().find((entry)=>entry.peer==="peer.late")?.message;
    assert.equal(ack?.type,"hello-ack");
    if (ack?.type!=="hello-ack") throw new Error("expected live late-join hello-ack rejection");
    assert.equal(ack.compatibility.status,"incompatible");
    assert.match(ack.compatibility.message,/already live/);
    assert.deepEqual(ack.events,[]);
  } finally {
    transport.restore();
  }
});

test("live Host rebinds a previously accepted participant and returns ordered catch-up without replacing Host runtime authority",async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const adapter=new MockAdapter();
    await adapter.hostSession();
    const state=connectedStateFor(adapter);
    const app=connectedInternal(adapter);
    assert.ok(state.ledger);
    state.sessionStarted=true;
    const manifest=connectedManifest(adapter);
    const characterId=manifest.character?.characterId;
    assert.ok(characterId);
    const participantId=`client:${characterId}`;
    state.peerManifests.set("peer.old",structuredClone(manifest));
    state.peerParticipants.set("peer.old",participantId);
    app.session.participants=[
      {id:"host",name:"DM Host",state:"connected",ready:false},
      {id:participantId,name:"Returning Player",characterName:"Returning Player",state:"disconnected",ready:false},
    ];
    state.ledger.commitHostEvent({
      actorId:participantId,
      payload:{
        kind:"participant",
        participantId,
        participantName:"Returning Player",
        characterName:"Returning Player",
        state:"disconnected",
        ready:false,
        stateChanges:["Returning Player disconnected"],
        provenance:["test accepted disconnect baseline"],
      },
    });

    transport.emitFrom("peer.new",{
      type:"hello",
      manifest,
      participantId,
      participantName:"Returning Player",
      knownEventCursor:0,
    });
    await new Promise<void>((resolve)=>setImmediate(resolve));

    assert.equal(state.peerParticipants.has("peer.old"),false,"old transport peer binding must be retired on reconnect");
    assert.equal(state.peerParticipants.get("peer.new"),participantId);
    assert.equal(state.peerManifests.get("peer.new")?.character?.characterId,characterId);
    const participant=app.session.participants.find((entry)=>entry.id===participantId);
    assert.equal(participant?.state,"connected");
    assert.equal(participant?.ready,false);
    const reconnectEvent=state.ledger.eventsAfter(0).find((event)=>event.payload.kind==="participant"&&event.payload.state==="connected");
    assert.ok(reconnectEvent);
    if (reconnectEvent?.payload.kind!=="participant") throw new Error("expected connected participant event");
    assert.ok(reconnectEvent.payload.provenance.includes("host-authoritative participant reconnect"));

    const ack=transport.sentTo().filter((entry)=>entry.peer==="peer.new"&&entry.message.type==="hello-ack").at(-1)?.message;
    assert.equal(ack?.type,"hello-ack");
    if (ack?.type!=="hello-ack") throw new Error("expected reconnect hello-ack");
    assert.notEqual(ack.compatibility.status,"incompatible");
    assert.equal(ack.hostCursor,state.ledger.cursor);
    assert.ok(ack.events.some((event)=>event.payload.kind==="participant"&&event.payload.state==="disconnected"));
    assert.ok(ack.events.some((event)=>event.payload.kind==="participant"&&event.payload.state==="connected"));
  } finally {
    transport.restore();
  }
});
