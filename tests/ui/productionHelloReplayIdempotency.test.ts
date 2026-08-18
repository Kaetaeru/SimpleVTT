import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedParticipantIdempotencyAdapter";
import "../../src/app/sessionContentParityRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { connectedInternal, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import {
  getInstalledContentPersistenceStateForTests,
  setInstalledContentStoreForTests,
} from "../../src/app/installedContentRuntimeAdapter";
import { getSessionContentParityStateForTests } from "../../src/app/sessionContentParityRuntimeAdapter";
import { tauriSessionTransport, type SessionTransportMessage } from "../../src/app/tauriSessionTransport";
import { encodeConnectedWireMessage, type ConnectedWireMessage } from "../../src/app/connectedSessionWire";

type RawRecord=Record<string,unknown>;

function rawObject(raw:string):RawRecord {
  return JSON.parse(raw) as RawRecord;
}

function installFakeDesktopTransport() {
  const original={
    available:tauriSessionTransport.available,
    startHost:tauriSessionTransport.startHost,
    connectClient:tauriSessionTransport.connectClient,
    send:tauriSessionTransport.send,
    sendTo:tauriSessionTransport.sendTo,
    stop:tauriSessionTransport.stop,
    onMessage:tauriSessionTransport.onMessage,
    onState:tauriSessionTransport.onState,
    onPeerLifecycle:tauriSessionTransport.onPeerLifecycle,
  };
  const messageHandlers:Array<(message:SessionTransportMessage)=>void>=[];
  const sent:string[]=[];
  const sentTo:Array<{peer:string;raw:string}>=[];
  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>({role:"host",state:"connected",address:"127.0.0.1:3210",peerCount:0});
  tauriSessionTransport.connectClient=async(address)=>({role:"client",state:"connected",address,peerCount:1});
  tauriSessionTransport.send=async(message)=>{sent.push(message);return 1;};
  tauriSessionTransport.sendTo=async(peer,message)=>{sentTo.push({peer,raw:message});return 1;};
  tauriSessionTransport.stop=async()=>({role:null,state:"disconnected",address:"",peerCount:0});
  tauriSessionTransport.onMessage=async(handler)=>{messageHandlers.push(handler);return()=>{};};
  tauriSessionTransport.onState=async()=>()=>{};
  tauriSessionTransport.onPeerLifecycle=async()=>()=>{};
  return {
    sent:()=>sent.map((raw)=>({raw,message:rawObject(raw)})),
    sentTo:()=>sentTo.map((entry)=>({...entry,message:rawObject(entry.raw)})),
    handlerCount:()=>messageHandlers.length,
    emitRaw(handlerIndex:number,peer:string,raw:string) {
      messageHandlers[handlerIndex]?.({peer,message:raw});
    },
    emitFrom(handlerIndex:number,peer:string,message:ConnectedWireMessage) {
      messageHandlers[handlerIndex]?.({peer,message:encodeConnectedWireMessage(message)});
    },
    restore() {
      tauriSessionTransport.available=original.available;
      tauriSessionTransport.startHost=original.startHost;
      tauriSessionTransport.connectClient=original.connectClient;
      tauriSessionTransport.send=original.send;
      tauriSessionTransport.sendTo=original.sendTo;
      tauriSessionTransport.stop=original.stop;
      tauriSessionTransport.onMessage=original.onMessage;
      tauriSessionTransport.onState=original.onState;
      tauriSessionTransport.onPeerLifecycle=original.onPeerLifecycle;
    },
  };
}

async function flushAsync() {
  await new Promise<void>((resolve)=>setImmediate(resolve));
  await new Promise<void>((resolve)=>setImmediate(resolve));
}

function parityPayload(description="session parity content") {
  return JSON.stringify({
    id:"subclass.session-parity",
    category:"subclass",
    nameKo:"세션 패리티",
    nameEn:"Session Parity",
    sourceId:"homebrew.session-parity",
    source:"Session Parity Pack",
    version:"1.0",
    description,
  });
}

async function previewAndActivate(adapter:MockAdapter,payload:string) {
  const preview=await adapter.previewContentImport(payload);
  assert.ok(preview.contentImport?.entry);
  assert.ok(!preview.contentImport.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport.validation));
  return adapter.activateContentImport();
}

async function nonFixtureAdapter(id:string,name:string,store=new MemoryInstalledContentStore()) {
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  const template=await adapter.getSnapshot();
  const canonicalClass=template.catalog.find((entry)=>entry.scope==="builtin"&&entry.category==="class");
  const canonicalSpecies=template.catalog.find((entry)=>entry.scope==="builtin"&&entry.category==="species");
  const canonicalBackground=template.catalog.find((entry)=>entry.scope==="builtin"&&entry.category==="background");
  if (!canonicalClass?.contentId||!canonicalSpecies?.contentId||!canonicalBackground?.contentId) {
    throw new Error("canonical projection fixture requires builtin class/species/background identities");
  }
  const character={
    ...structuredClone(template.activeCharacter),
    id,
    name,
    className:canonicalClass.contentId,
    subclassName:"",
    species:canonicalSpecies.contentId,
    background:canonicalBackground.contentId,
    classLevels:undefined,
    items:[],
    equipment:[],
    cantrips:[],
    preparedSpells:[],
    spellbookSpells:[],
    masteryWeapons:[],
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
    const adapter=await nonFixtureAdapter("char.phase14.hello-replay","Hello Replay Character");
    await adapter.hostSession();
    const state=connectedStateFor(adapter);
    const app=connectedInternal(adapter);
    assert.ok(state.ledger);
    assert.equal(transport.handlerCount(),1);

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

    transport.emitFrom(0,peer,hello(0));
    await flushAsync();
    assert.equal(state.ledger.cursor,1);
    assert.equal(app.session.participants.filter((participant)=>participant.id===participantId).length,1);
    assert.equal(state.peerParticipants.get(peer),participantId);
    assert.equal(state.peerManifests.size,1);

    transport.emitFrom(0,peer,hello(1));
    await flushAsync();
    assert.equal(state.ledger.cursor,1,"same accepted hello must not create another participant ledger event");
    assert.equal(app.session.participants.filter((participant)=>participant.id===participantId).length,1);
    assert.equal(state.peerManifests.size,1);
    const currentAck=transport.sentTo().filter((entry)=>entry.peer===peer&&entry.message.type==="hello-ack").at(-1)?.message;
    assert.equal(currentAck?.type,"hello-ack");
    assert.equal(currentAck?.hostCursor,1);
    assert.deepEqual(currentAck?.events,[],"up-to-date replay must not synthesize a new connected event");

    transport.emitFrom(0,peer,hello(0));
    await flushAsync();
    assert.equal(state.ledger.cursor,1,"stale replay must still leave Host history unchanged");
    const staleAck=transport.sentTo().filter((entry)=>entry.peer===peer&&entry.message.type==="hello-ack").at(-1)?.message;
    assert.equal(staleAck?.type,"hello-ack");
    assert.equal(staleAck?.hostCursor,1);
    assert.equal(Array.isArray(staleAck?.events)?staleAck.events.length:0,1,"stale replay should receive the existing catch-up event only");
  } finally {
    transport.restore();
  }
});

test("Host-required declarative content transfers before participant acceptance, validates through installed-content authority, and becomes Ready-idempotent",async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const hostStore=new MemoryInstalledContentStore();
    const clientStore=new MemoryInstalledContentStore();
    const host=await nonFixtureAdapter("char.phase14.parity-host","Parity Host",hostStore);
    const client=await nonFixtureAdapter("char.phase14.parity-client","Parity Client",clientStore);
    await previewAndActivate(host,parityPayload());

    await host.hostSession();
    await client.joinSession("127.0.0.1:3210");
    assert.equal(transport.handlerCount(),2);

    const firstHello=transport.sent().filter((entry)=>entry.message.type==="hello").at(-1);
    assert.ok(firstHello);
    assert.deepEqual(firstHello.message.installedContent,[],"empty Client should advertise an empty installed-content inventory");

    transport.emitRaw(0,"peer.client",firstHello.raw);
    await flushAsync();
    const syncAck=transport.sentTo().filter((entry)=>entry.peer==="peer.client"&&entry.message.type==="hello-ack").at(-1);
    assert.ok(syncAck);
    assert.equal(Array.isArray(syncAck.message.requiredContent)?syncAck.message.requiredContent.length:0,1);
    assert.equal(connectedStateFor(host).peerParticipants.has("peer.client"),false,"Host must not accept the participant before content parity completes");

    transport.emitRaw(1,"host",syncAck.raw);
    await flushAsync();
    const clientPersistence=getInstalledContentPersistenceStateForTests(client);
    assert.equal(clientPersistence?.storageRevision,1);
    assert.equal(clientPersistence?.document?.entries.length,1);
    assert.equal(clientPersistence?.document?.entries[0]?.description,"session parity content");

    const secondHello=transport.sent().filter((entry)=>entry.message.type==="hello").at(-1);
    assert.ok(secondHello);
    assert.equal(Array.isArray(secondHello.message.installedContent)?secondHello.message.installedContent.length:0,1,"re-handshake must advertise the newly validated content revision");

    transport.emitRaw(0,"peer.client",secondHello.raw);
    await flushAsync();
    const finalAck=transport.sentTo().filter((entry)=>entry.peer==="peer.client"&&entry.message.type==="hello-ack").at(-1);
    assert.ok(finalAck);
    assert.equal(finalAck.message.requiredContent,undefined,"matching reconnect/rehydration must not re-transfer content");
    assert.equal(connectedStateFor(host).peerParticipants.get("peer.client"),"client:char.phase14.parity-client");

    transport.emitRaw(1,"host",finalAck.raw);
    await flushAsync();
    const joined=await client.getSnapshot();
    assert.equal(getSessionContentParityStateForTests(client).status,"ready");
    assert.match(joined.session.compatibilityMessage,/콘텐츠 확인.*준비 완료/);

    const readyBefore=transport.sent().filter((entry)=>entry.message.type==="ready-intent").length;
    await client.setSessionReady(true);
    const readyAfter=transport.sent().filter((entry)=>entry.message.type==="ready-intent").length;
    assert.equal(readyAfter,readyBefore+1,"Ready should reach the existing lifecycle only after content parity is ready");

    const reconnectHello={...secondHello.message,knownEventCursor:connectedStateFor(client).replica?.cursor ?? 0};
    const revisionBefore=getInstalledContentPersistenceStateForTests(client)?.storageRevision;
    transport.emitRaw(0,"peer.client",JSON.stringify(reconnectHello));
    await flushAsync();
    const reconnectAck=transport.sentTo().filter((entry)=>entry.peer==="peer.client"&&entry.message.type==="hello-ack").at(-1);
    assert.ok(reconnectAck);
    assert.equal(reconnectAck.message.requiredContent,undefined,"already-matching content must remain transfer-free on reconnect");
    assert.equal(getInstalledContentPersistenceStateForTests(client)?.storageRevision,revisionBefore);
  } finally {
    transport.restore();
  }
});

test("same qualified identity with a different payload fails closed and blocks Ready",async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const host=await nonFixtureAdapter("char.phase14.conflict-host","Conflict Host",new MemoryInstalledContentStore());
    const client=await nonFixtureAdapter("char.phase14.conflict-client","Conflict Client",new MemoryInstalledContentStore());
    await previewAndActivate(host,parityPayload("Host authoritative payload"));
    await previewAndActivate(client,parityPayload("Client conflicting payload"));

    await host.hostSession();
    await client.joinSession("127.0.0.1:3210");
    const firstHello=transport.sent().filter((entry)=>entry.message.type==="hello").at(-1)!;
    transport.emitRaw(0,"peer.conflict",firstHello.raw);
    await flushAsync();
    const syncAck=transport.sentTo().filter((entry)=>entry.peer==="peer.conflict"&&entry.message.type==="hello-ack").at(-1)!;
    assert.equal(Array.isArray(syncAck.message.requiredContent)?syncAck.message.requiredContent.length:0,1,"revision mismatch must request the changed Host payload");

    transport.emitRaw(1,"host",syncAck.raw);
    await flushAsync();
    const parity=getSessionContentParityStateForTests(client);
    assert.equal(parity.status,"error");
    assert.match(parity.message,/Ready 불가/);
    assert.match(parity.message,/conflict|충돌|검증 실패/i);
    assert.equal(getInstalledContentPersistenceStateForTests(client)?.document?.entries[0]?.description,"Client conflicting payload","conflicting Host payload must not overwrite Client content");

    const before=transport.sent().filter((entry)=>entry.message.type==="ready-intent").length;
    const blocked=await client.setSessionReady(true);
    const after=transport.sent().filter((entry)=>entry.message.type==="ready-intent").length;
    assert.equal(after,before);
    assert.match(blocked.session.compatibilityMessage,/Ready 불가/);
  } finally {
    transport.restore();
  }
});

test("malformed Host declarative content is rejected before install and keeps Ready blocked",async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const client=await nonFixtureAdapter("char.phase14.invalid-client","Invalid Client",new MemoryInstalledContentStore());
    await client.joinSession("127.0.0.1:3210");
    assert.equal(transport.handlerCount(),1);

    transport.emitRaw(0,"host",JSON.stringify({
      type:"hello-ack",
      sessionId:"session.invalid",
      compatibility:{status:"compatible",message:"base handshake compatible"},
      hostCursor:0,
      events:[],
      requiredContent:[{contentId:"subclass.invalid"}],
    }));
    await flushAsync();

    const parity=getSessionContentParityStateForTests(client);
    assert.equal(parity.status,"error");
    assert.match(parity.message,/검증 실패.*Ready 불가/);
    assert.equal(getInstalledContentPersistenceStateForTests(client)?.storageRevision,0);
    const before=transport.sent().filter((entry)=>entry.message.type==="ready-intent").length;
    await client.setSessionReady(true);
    const after=transport.sent().filter((entry)=>entry.message.type==="ready-intent").length;
    assert.equal(after,before);
  } finally {
    transport.restore();
  }
});
