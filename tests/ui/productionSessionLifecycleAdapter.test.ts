import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/productionSessionLifecycleAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import type { CharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { mountCharacterSessionProjection, projectedCharacterIds } from "../../src/app/characterSessionProjectionRegistry";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

function installFakeDesktopTransport() {
  const original={
    available:tauriSessionTransport.available,
    startHost:tauriSessionTransport.startHost,
    stop:tauriSessionTransport.stop,
    onMessage:tauriSessionTransport.onMessage,
    onState:tauriSessionTransport.onState,
  };
  let startCount=0;
  let listenerCount=0;
  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>({role:"host",state:"connected",address:`127.0.0.1:${3210+startCount++}`,peerCount:0});
  tauriSessionTransport.stop=async()=>({role:null,state:"disconnected",address:"",peerCount:0});
  tauriSessionTransport.onMessage=async()=>{listenerCount+=1;return()=>{};};
  tauriSessionTransport.onState=async()=>()=>{};
  return {
    listenerCount:()=>listenerCount,
    restore() {
      tauriSessionTransport.available=original.available;
      tauriSessionTransport.startHost=original.startHost;
      tauriSessionTransport.stop=original.stop;
      tauriSessionTransport.onMessage=original.onMessage;
      tauriSessionTransport.onState=original.onState;
    },
  };
}

test("Host start enters preparation, stop clears transient authority, and restart creates fresh authority", async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const adapter=new MockAdapter();
    const first=await adapter.hostSession();
    assert.equal(first.session.role,"host");
    assert.equal(first.session.lifecycle,"preparing");
    assert.equal(first.connectionState,"connected");
    assert.match(first.session.compatibilityMessage,/preparation lobby open/);
    assert.deepEqual(first.session.participants.map((participant)=>participant.id),["host"]);

    const firstState=connectedStateFor(adapter);
    const firstLedger=firstState.ledger;
    assert.ok(firstState.sessionId);
    assert.ok(firstLedger);
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
    assert.equal(stoppedState.publishedResolutionIds.size,0);

    const restarted=await adapter.hostSession();
    const restartedState=connectedStateFor(adapter);
    assert.equal(restarted.session.role,"host");
    assert.equal(restarted.session.lifecycle,"preparing");
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
