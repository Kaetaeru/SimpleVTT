import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedParticipantIdempotencyAdapter";
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
  tauriSessionTransport.sendTo=async(peer,message)=>{
    sentTo.push({peer,message:JSON.parse(message) as ConnectedWireMessage});
    return 1;
  };
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

async function nonFixtureHostAdapter() {
  const adapter=new MockAdapter();
  const template=await adapter.getSnapshot();
  const character={
    ...structuredClone(template.activeCharacter),
    id:"char.phase14.hello-replay",
    name:"Hello Replay Character",
    saveState:"saved" as const,
  };
  const app=connectedInternal(adapter);
  app.activeCharacter=structuredClone(character);
  app.characters=[...app.characters.filter((entry)=>entry.id!==character.id),structuredClone(character)];
  return adapter;
}

test("accepted participant hello replay does not advance Host ledger or duplicate participant state",async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const adapter=await nonFixtureHostAdapter();
    await adapter.hostSession();
    const state=connectedStateFor(adapter);
    const app=connectedInternal(adapter);
    assert.ok(state.ledger);

    const manifest=connectedManifest(adapter);
    const characterId=manifest.character?.characterId;
    assert.ok(characterId);
    const participantId=`client:${characterId}`;
    const peer="peer.replay";
    const hello=(knownEventCursor:number):ConnectedWireMessage=>({
      type:"hello",
      manifest,
      participantId,
      participantName:"Replay Player",
      knownEventCursor,
    });

    transport.emitFrom(peer,hello(0));
    await new Promise<void>((resolve)=>setImmediate(resolve));
    assert.equal(state.ledger.cursor,1);
    assert.equal(app.session.participants.filter((participant)=>participant.id===participantId).length,1);
    assert.equal(state.peerParticipants.get(peer),participantId);
    assert.equal(state.peerManifests.size,1);

    transport.emitFrom(peer,hello(1));
    await new Promise<void>((resolve)=>setImmediate(resolve));
    assert.equal(state.ledger.cursor,1,"same accepted hello must not create another participant ledger event");
    assert.equal(app.session.participants.filter((participant)=>participant.id===participantId).length,1);
    assert.equal(state.peerManifests.size,1);
    const currentAck=transport.sentTo().filter((entry)=>entry.peer===peer&&entry.message.type==="hello-ack").at(-1)?.message;
    assert.equal(currentAck?.type,"hello-ack");
    if (currentAck?.type!=="hello-ack") throw new Error("expected replay hello-ack");
    assert.equal(currentAck.hostCursor,1);
    assert.deepEqual(currentAck.events,[],"up-to-date replay must not synthesize a new connected event");

    transport.emitFrom(peer,hello(0));
    await new Promise<void>((resolve)=>setImmediate(resolve));
    assert.equal(state.ledger.cursor,1,"stale replay must still leave Host history unchanged");
    const staleAck=transport.sentTo().filter((entry)=>entry.peer===peer&&entry.message.type==="hello-ack").at(-1)?.message;
    assert.equal(staleAck?.type,"hello-ack");
    if (staleAck?.type!=="hello-ack") throw new Error("expected stale replay hello-ack");
    assert.equal(staleAck.hostCursor,1);
    assert.equal(staleAck.events.length,1,"stale replay should receive the existing catch-up event only");
    assert.equal(staleAck.events[0]?.sequence,1);
  } finally {
    transport.restore();
  }
});
