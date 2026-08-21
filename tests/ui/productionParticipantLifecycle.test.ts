import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { projectedCharacterForPeer, projectedCharacterIds } from "../../src/app/characterSessionProjectionRegistry";
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

function assertNoRejectedPeerGhost(adapter:MockAdapter,peer:string,participantId:string,characterId:string,cursorBefore:number) {
  const state=connectedStateFor(adapter);
  const app=connectedInternal(adapter);
  assert.ok(state.ledger);
  assert.equal(state.ledger.cursor,cursorBefore,"rejected hello must not advance Host ledger cursor");
  assert.equal(state.peerParticipants.has(peer),false,"rejected peer must not gain participant binding");
  assert.equal(state.peerManifests.has(peer),false,"rejected peer must not gain accepted manifest state");
  assert.equal(app.session.participants.some((participant)=>participant.id===participantId),false,"rejected participant must not enter Host roster");
  assert.equal(projectedCharacterForPeer(adapter,peer),undefined,"rejected peer must not gain SessionProjection registry state");
  assert.equal(projectedCharacterIds(adapter).includes(characterId),false,"rejected Character must not remain in projection registry");
  assert.equal(app.scene.entities.some((entity)=>entity.id===characterId),false,"rejected Character must not remain in Host Scene");
  assert.equal(Boolean(app.scene.actionsByActor[characterId]),false,"rejected Character must not leave Host actions");
  assert.equal(Boolean(app.scene.economyByActor[characterId]),false,"rejected Character must not leave Host economy");
}

test("Host rejects incompatible hello without ghost participant, peer, ledger, or projection state",async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const adapter=new MockAdapter();
    await adapter.hostSession();
    const state=connectedStateFor(adapter);
    assert.ok(state.ledger);
    const cursorBefore=state.ledger.cursor;
    const participantId="client:char.phase14.incompatible";
    const characterId="char.phase14.incompatible";
    const manifest=connectedManifest(adapter);
    manifest.protocolVersion+=1;
    manifest.character={characterId,sourceRevision:1,runtimeRevision:1};

    transport.emitFrom("peer.incompatible",{
      type:"hello",
      manifest,
      participantId,
      participantName:"Incompatible Player",
      knownEventCursor:0,
    });
    await new Promise<void>((resolve)=>setImmediate(resolve));

    assertNoRejectedPeerGhost(adapter,"peer.incompatible",participantId,characterId,cursorBefore);
    const ack=transport.sentTo().find((entry)=>entry.peer==="peer.incompatible")?.message;
    assert.equal(ack?.type,"hello-ack");
    if (ack?.type!=="hello-ack") throw new Error("expected incompatible hello-ack rejection");
    assert.equal(ack.compatibility.status,"incompatible");
    assert.deepEqual(ack.events,[]);
  } finally {
    transport.restore();
  }
});

test("Host rejects invalid SessionProjection before creating ghost state",async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const adapter=new MockAdapter();
    await adapter.hostSession();
    const state=connectedStateFor(adapter);
    const app=connectedInternal(adapter);
    assert.ok(state.ledger);
    const cursorBefore=state.ledger.cursor;
    const participantId="client:char.phase14.invalid-projection";
    const characterId="char.phase14.invalid-projection";
    const sheet=structuredClone(app.activeCharacter);
    const classEntry=app.catalog.find((entry)=>entry.category==="class");
    const speciesEntry=app.catalog.find((entry)=>entry.category==="species");
    const backgroundEntry=app.catalog.find((entry)=>entry.category==="background");
    assert.ok(classEntry&&speciesEntry&&backgroundEntry,"generated Host catalog must contain canonical build identities");
    sheet.id=characterId;
    sheet.name="Invalid Projection Player";
    sheet.className=classEntry.nameKo;
    sheet.species=speciesEntry.nameKo;
    sheet.background=backgroundEntry.nameKo;
    sheet.classLevels=[{classId:classEntry.id,level:sheet.level}];
    sheet.items=[];
    sheet.equipment=[];
    sheet.attacks=[];
    sheet.sourceRevision=17;
    sheet.runtimeRevision=19;
    const optional=sheet as typeof sheet & {
      subclassName?:string;
      cantrips?:string[];
      preparedSpells?:string[];
      spellbookSpells?:string[];
      masteryWeapons?:string[];
    };
    delete optional.subclassName;
    optional.cantrips=[];
    optional.preparedSpells=[];
    optional.spellbookSpells=[];
    optional.masteryWeapons=[];
    const manifest=connectedManifest(adapter);
    manifest.character={characterId,sourceRevision:17,runtimeRevision:19};
    const projection=buildCharacterSessionProjectionV1(sheet,app.catalog);
    projection.characterId="char.phase14.mismatched-projection";

    transport.emitFrom("peer.invalid-projection",{
      type:"hello",
      manifest,
      participantId,
      participantName:sheet.name,
      knownEventCursor:0,
      projection,
    });
    await new Promise<void>((resolve)=>setImmediate(resolve));

    assertNoRejectedPeerGhost(adapter,"peer.invalid-projection",participantId,characterId,cursorBefore);
    assert.equal(projectedCharacterIds(adapter).includes(projection.characterId),false,"mismatched projection id must not mount either");
    assert.equal(app.scene.entities.some((entity)=>entity.id===projection.characterId),false,"mismatched projection entity must not appear in Scene");
    const ack=transport.sentTo().find((entry)=>entry.peer==="peer.invalid-projection")?.message;
    assert.equal(ack?.type,"hello-ack");
    if (ack?.type!=="hello-ack") throw new Error("expected invalid projection hello-ack rejection");
    assert.equal(ack.compatibility.status,"incompatible");
    assert.match(ack.compatibility.message,/SessionProjection rejected/);
    assert.deepEqual(ack.events,[]);
  } finally {
    transport.restore();
  }
});

test("live Host accepts a genuinely new participant and returns current authoritative history",async()=>{
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
    const modeEvent=state.ledger.commitHostEvent({
      payload:{
        kind:"mode-transition",
        sessionMode:"initiative",
        round:4,
        currentActorId:characterId,
        economyByActor:{},
        stateChanges:["live late-join baseline"],
        provenance:["Scenario 08 live join test"],
      },
    });
    const cursorBefore=state.ledger.cursor;

    transport.emitFrom("peer.late",{
      type:"hello",
      manifest,
      participantId,
      participantName:"Late Player",
      knownEventCursor:0,
    });
    await new Promise<void>((resolve)=>setImmediate(resolve));

    assert.equal(state.ledger.cursor,cursorBefore+1,"accepted live join commits a participant event");
    assert.equal(state.peerParticipants.get("peer.late"),participantId);
    assert.equal(state.peerManifests.get("peer.late")?.character?.characterId,characterId);
    assert.equal(app.session.participants.find((participant)=>participant.id===participantId)?.state,"connected");
    const ack=transport.sentTo().find((entry)=>entry.peer==="peer.late"&&entry.message.type==="hello-ack")?.message;
    assert.equal(ack?.type,"hello-ack");
    if (ack?.type!=="hello-ack") throw new Error("expected live late-join hello-ack");
    assert.notEqual(ack.compatibility.status,"incompatible");
    assert.equal(ack.hostCursor,state.ledger.cursor);
    assert.ok(ack.events.some((event)=>event.eventId===modeEvent.eventId&&event.payload.kind==="mode-transition"));
    assert.ok(ack.events.some((event)=>event.payload.kind==="participant"&&event.payload.participantId===participantId));
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
