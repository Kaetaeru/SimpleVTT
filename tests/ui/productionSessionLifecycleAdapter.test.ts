import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/productionSessionLifecycleAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { connectedInternal, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { HostSessionLedger } from "../../src/app/connectedSessionProtocol";
import type { CharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { mountCharacterSessionProjection, projectedCharacterIds } from "../../src/app/characterSessionProjectionRegistry";
import { tauriSessionTransport, type SessionTransportMessage } from "../../src/app/tauriSessionTransport";
import { encodeConnectedWireMessage, type ConnectedWireMessage } from "../../src/app/connectedSessionWire";

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
  let startCount=0;
  let connectCount=0;
  let listenerCount=0;
  const sent:string[]=[];
  const sentTo:Array<{peer:string;message:string}>=[];
  let messageHandler:((message:SessionTransportMessage)=>void)|undefined;
  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>({role:"host",state:"connected",address:`127.0.0.1:${3210+startCount++}`,peerCount:0});
  tauriSessionTransport.connectClient=async(address)=>{connectCount+=1;return {role:"client",state:"connected",address,peerCount:1};};
  tauriSessionTransport.send=async(message)=>{sent.push(message);return 1;};
  tauriSessionTransport.sendTo=async(peer,message)=>{sentTo.push({peer,message});return 1;};
  tauriSessionTransport.stop=async()=>({role:null,state:"disconnected",address:"",peerCount:0});
  tauriSessionTransport.onMessage=async(handler)=>{listenerCount+=1;messageHandler=handler;return()=>{};};
  tauriSessionTransport.onState=async()=>()=>{};
  tauriSessionTransport.onPeerLifecycle=async()=>()=>{};
  return {
    listenerCount:()=>listenerCount,
    connectCount:()=>connectCount,
    sent:()=>[...sent],
    sentTo:()=>[...sentTo],
    emit(message:ConnectedWireMessage) {
      messageHandler?.({peer:"host",message:encodeConnectedWireMessage(message)});
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

async function savedProductionPlayerAdapter() {
  const adapter=new MockAdapter();
  const template=await adapter.getSnapshot();
  const saved={
    ...structuredClone(template.activeCharacter),
    id:"char.phase14.persisted-player",
    name:"Phase14 Persisted Player",
    saveState:"saved" as const,
  };
  const app=connectedInternal(adapter);
  app.activeCharacter=structuredClone(saved);
  app.characters=[...app.characters.filter((character)=>character.id!==saved.id),structuredClone(saved)];
  return adapter;
}

test("Host Open becomes live Freeform with zero Players, stop clears authority, and restart creates fresh live authority", async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const adapter=new MockAdapter();
    const first=await adapter.hostSession();
    assert.equal(first.session.role,"host");
    assert.equal(first.session.lifecycle,"live");
    assert.equal(first.sessionMode,"freeform");
    assert.equal(first.connectionState,"connected");
    assert.match(first.session.compatibilityMessage,/live Freeform play opened/);
    assert.deepEqual(first.session.participants.map((participant)=>participant.id),["host"]);

    const firstState=connectedStateFor(adapter);
    const firstLedger=firstState.ledger;
    assert.equal(firstState.sessionStarted,true);
    assert.ok(firstState.sessionId);
    assert.ok(firstLedger);
    assert.ok(firstLedger.eventsAfter(0).some((event)=>event.payload.kind==="mode-transition"&&event.payload.sessionMode==="freeform"));
    assert.ok(transport.sent().map((raw)=>JSON.parse(raw) as ConnectedWireMessage).some((message)=>message.type==="event-batch"));
    firstState.peerManifests.set("peer.remote",connectedManifest(adapter));
    firstState.publishedResolutionIds.add("resolution.transient");

    const remoteSheet={...structuredClone(first.activeCharacter),id:"char.phase14.remote",name:"Phase14 Remote"};
    const projection={
      characterId:remoteSheet.id,
      sourceRevision:remoteSheet.sourceRevision??0,
      runtimeRevision:remoteSheet.runtimeRevision??0,
    } as CharacterSessionProjectionV1;
    mountCharacterSessionProjection(adapter,{
      peerId:"peer.remote",
      characterId:remoteSheet.id,
      sourceRevision:projection.sourceRevision,
      runtimeRevision:projection.runtimeRevision,
      projection,
      sheet:remoteSheet,
    });
    assert.deepEqual(projectedCharacterIds(adapter),[remoteSheet.id]);

    const stopped=await adapter.stopSession();
    assert.equal(stopped.session.role,"offline");
    assert.equal(stopped.session.lifecycle,"offline");
    assert.equal(stopped.connectionState,"disconnected");
    assert.equal(stopped.session.address,"");
    assert.deepEqual(stopped.session.participants,[]);
    assert.ok(stopped.characters.some((character)=>character.id===first.activeCharacter.id));
    assert.deepEqual(projectedCharacterIds(adapter),[]);
    const stoppedState=connectedStateFor(adapter);
    assert.equal(stoppedState.mode,null);
    assert.equal(stoppedState.sessionId,null);
    assert.equal(stoppedState.ledger,null);
    assert.equal(stoppedState.peerManifests.size,0);
    assert.equal(stoppedState.peerParticipants.size,0);
    assert.equal(stoppedState.sessionStarted,false);
    assert.equal(stoppedState.publishedResolutionIds.size,0);

    const restarted=await adapter.hostSession();
    const restartedState=connectedStateFor(adapter);
    assert.equal(restarted.session.role,"host");
    assert.equal(restarted.session.lifecycle,"live");
    assert.equal(restarted.sessionMode,"freeform");
    assert.ok(restartedState.ledger);
    assert.notEqual(restartedState.ledger,firstLedger);
    assert.deepEqual(restarted.session.participants.map((participant)=>participant.id),["host"]);
    assert.deepEqual(projectedCharacterIds(adapter),[]);
    assert.equal(transport.listenerCount(),1,"restart must reuse the installed listeners instead of duplicating them");
  } finally {
    transport.restore();
  }
});

test("Host bind failure returns an actionable offline snapshot instead of a rejected UI operation", async()=>{
  const transport=installFakeDesktopTransport();
  const originalStart=tauriSessionTransport.startHost;
  tauriSessionTransport.startHost=async()=>{throw new Error("address already in use");};
  try {
    const adapter=new MockAdapter();
    const snapshot=await adapter.hostSession();
    assert.equal(snapshot.session.role,"offline");
    assert.equal(snapshot.session.lifecycle,"offline");
    assert.equal(snapshot.connectionState,"disconnected");
    assert.equal(snapshot.session.compatibility,"incompatible");
    assert.match(snapshot.session.compatibilityMessage,/Host start failed: address already in use/);
  } finally {
    tauriSessionTransport.startHost=originalStart;
    transport.restore();
  }
});

test("reference Character cannot enter a production connected session",async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const adapter=new MockAdapter();
    const blocked=await adapter.joinSession("127.0.0.1:3210");
    assert.equal(blocked.session.lifecycle,"offline");
    assert.equal(blocked.session.role,"offline");
    assert.equal(blocked.session.compatibility,"incompatible");
    assert.match(blocked.session.compatibilityMessage,/saved production Character/);
    assert.equal(transport.connectCount(),0);
  } finally {
    transport.restore();
  }
});

test("saved Character joins a live Host and opens the authoritative current mode without Ready",async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const adapter=await savedProductionPlayerAdapter();
    const joining=await adapter.joinSession("127.0.0.1:3210");
    assert.equal(joining.activeCharacter.id,"char.phase14.persisted-player");
    assert.equal(joining.session.role,"client");
    assert.equal(joining.session.lifecycle,"connecting");
    assert.equal(transport.connectCount(),1);

    const ledger=new HostSessionLedger("session.phase14.live",connectedManifest(adapter));
    const modeEvent=ledger.commitHostEvent({
      payload:{
        kind:"mode-transition",
        sessionMode:"initiative",
        round:3,
        currentActorId:"char.phase14.persisted-player",
        economyByActor:{},
        stateChanges:["late join current mode"],
        provenance:["Scenario 08 test"],
      },
    });
    transport.emit({
      type:"hello-ack",
      sessionId:ledger.sessionId,
      sessionName:"Live Adventure",
      compatibility:{status:"compatible",message:"Compatible live session."},
      hostCursor:ledger.cursor,
      events:[modeEvent],
    });
    await new Promise<void>((resolve)=>setImmediate(resolve));
    const live=await adapter.getSnapshot();
    assert.equal(live.session.lifecycle,"live");
    assert.equal(live.sessionMode,"initiative");
    assert.equal(live.scene.round,3);
    assert.equal(live.session.name,"Live Adventure");
    assert.equal(live.connectionState,"connected");
    assert.ok(live.session.participants.some((participant)=>participant.id==="client:char.phase14.persisted-player"));
    assert.equal(transport.sent().map((raw)=>JSON.parse(raw) as ConnectedWireMessage).some((message)=>message.type==="ready-intent"),false);
  } finally {
    transport.restore();
  }
});

test("production Host UI exposes live share state and zero-Player validity without Ready or a second Start gate",()=>{
  const source=readFileSync(new URL("../../src/ProductionSessionLifecycleBridge.tsx",import.meta.url),"utf8");
  assert.match(source,/Host 플레이 중/);
  assert.match(source,/공유 주소/);
  assert.match(source,/snapshot\.session\.address/);
  assert.match(source,/Host 혼자서도 플레이할 수 있습니다/);
  assert.match(source,/세션 종료/);
  assert.match(source,/stopSession\(\)/);
  assert.doesNotMatch(source,/participant\.ready|startPreparedSession|플레이 시작|Ready여야/);
  assert.doesNotMatch(source,/setReferenceRole|loadReferenceScenario|Ctrl\+Shift\+D/);
});

test("production Player entry joins and syncs directly without exposing a Ready lobby action",()=>{
  const source=readFileSync(new URL("../../src/ProductionPlayerLobbyBridge.tsx",import.meta.url),"utf8");
  const css=readFileSync(new URL("../../src/production-player-lobby.css",import.meta.url),"utf8");
  assert.match(source,/productionJoinCharacters/);
  assert.match(source,/selectProductionCharacter/);
  assert.match(source,/Host 주소/);
  assert.match(source,/connecting/);
  assert.match(source,/현재 플레이 상태 동기화 중/);
  assert.match(source,/joinSession\(address\)/);
  assert.doesNotMatch(source,/setSessionReady|Ready 취소|>Ready</);
  assert.match(css,/article:nth-child\(2\)/);
  assert.match(css,/screen-head p/);
  assert.doesNotMatch(source,/setReferenceRole|loadReferenceScenario|Ctrl\+Shift\+D/);
});
