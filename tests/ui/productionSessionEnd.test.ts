import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/productionSessionLifecycleAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { connectedInternal } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import type { CharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { mountCharacterSessionProjection, projectedCharacterIds } from "../../src/app/characterSessionProjectionRegistry";
import { tauriSessionTransport, type SessionTransportMessage, type SessionTransportStatus } from "../../src/app/tauriSessionTransport";
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
  let messageHandler:((message:SessionTransportMessage)=>void)|undefined;
  let stateHandler:((status:SessionTransportStatus)=>void)|undefined;
  let hostStarts=0;
  let clientConnects=0;
  const operations:string[]=[];
  const sent:ConnectedWireMessage[]=[];

  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>{
    operations.push("start-host");
    hostStarts+=1;
    return {role:"host",state:"connected",address:`127.0.0.1:${3209+hostStarts}`,peerCount:0};
  };
  tauriSessionTransport.connectClient=async(address)=>{
    operations.push("connect-client");
    clientConnects+=1;
    return {role:"client",state:"connected",address,peerCount:1};
  };
  tauriSessionTransport.send=async(message)=>{
    const wire=JSON.parse(message) as ConnectedWireMessage;
    sent.push(wire);
    operations.push(`send:${wire.type}`);
    return 1;
  };
  tauriSessionTransport.sendTo=async()=>1;
  tauriSessionTransport.stop=async()=>{
    operations.push("stop");
    const status={role:null,state:"disconnected",address:"",peerCount:0} as const;
    stateHandler?.(status);
    return status;
  };
  tauriSessionTransport.onMessage=async(handler)=>{messageHandler=handler;return()=>{};};
  tauriSessionTransport.onState=async(handler)=>{stateHandler=handler;return()=>{};};
  tauriSessionTransport.onPeerLifecycle=async()=>()=>{};

  return {
    hostStarts:()=>hostStarts,
    clientConnects:()=>clientConnects,
    operations:()=>[...operations],
    sent:()=>[...sent],
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

function pendingResolution(actorId:string) {
  return {
    id:"resolution.phase14.pending",
    actorId,
    targetIds:[],
    actionId:"action.phase14.pending",
    actionName:"Pending Action",
    rollKind:"effect" as const,
    stage:"effect-preview" as const,
    authoritativeDice:[],
    saveResults:[],
    damageComponents:[],
    compact:"pending",
    detail:[],
    provenance:["session-end regression"],
    calculatedOutcome:"pending",
    finalOutcome:"pending",
    stateChanges:[],
    adjudicated:false,
    canAdvance:true,
  };
}

async function savedProductionPlayerAdapter() {
  const adapter=new MockAdapter();
  const template=await adapter.getSnapshot();
  const saved={
    ...structuredClone(template.activeCharacter),
    id:"char.phase14.session-end-player",
    name:"Session End Player",
    saveState:"saved" as const,
  };
  const app=connectedInternal(adapter);
  app.activeCharacter=structuredClone(saved);
  app.characters=[...app.characters.filter((character)=>character.id!==saved.id),structuredClone(saved)];
  return adapter;
}

test("Host ends live play by notifying clients before teardown, clears transient authority, and restarts fresh",async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const adapter=new MockAdapter();
    const first=await adapter.hostSession();
    const state=connectedStateFor(adapter);
    const app=connectedInternal(adapter);
    assert.ok(state.sessionId);
    const firstSessionId=state.sessionId;
    state.sessionStarted=true;
    app.sessionMode="initiative";
    app.scene.round=4;
    app.scene.currentActorId="combatant.goblin-a";
    app.scene.selectedActorId="combatant.goblin-a";
    app.resolution=pendingResolution(app.activeCharacter.id);
    app.activeCharacter.resources[0].current=0;

    const remoteSheet={...structuredClone(first.activeCharacter),id:"char.phase14.session-end-remote",name:"Remote Session Character"};
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

    const ended=await adapter.stopSession();
    const endWire=transport.sent().find((message)=>message.type==="session-ended");
    assert.deepEqual(endWire,{type:"session-ended",sessionId:firstSessionId,reason:"Host ended live play."});
    const operations=transport.operations();
    assert.ok(operations.indexOf("send:session-ended")>=0);
    assert.ok(operations.indexOf("send:session-ended")<operations.indexOf("stop"),"Host must notify clients before transport teardown");
    assert.equal(ended.session.role,"offline");
    assert.equal(ended.session.lifecycle,"offline");
    assert.equal(ended.connectionState,"disconnected");
    assert.equal(ended.sessionMode,"freeform");
    assert.equal(ended.scene.round,0);
    assert.deepEqual(ended.scene.economyByActor,{});
    assert.equal(ended.resolution,null);
    assert.deepEqual(ended.session.participants,[]);
    assert.deepEqual(projectedCharacterIds(adapter),[]);
    assert.equal(ended.activeCharacter.resources[0].current,0,"committed durable Character resource state must survive session end");
    const endedState=connectedStateFor(adapter);
    assert.equal(endedState.mode,null);
    assert.equal(endedState.sessionId,null);
    assert.equal(endedState.sessionStarted,false);

    const restarted=await adapter.hostSession();
    const restartedState=connectedStateFor(adapter);
    assert.equal(restarted.session.role,"host");
    assert.equal(restarted.session.lifecycle,"preparing");
    assert.ok(restartedState.sessionId);
    assert.notEqual(restartedState.sessionId,firstSessionId);
    assert.deepEqual(restarted.session.participants.map((participant)=>participant.id),["host"]);
    assert.deepEqual(projectedCharacterIds(adapter),[]);
    assert.equal(restarted.sessionMode,"freeform");
    assert.equal(restarted.scene.round,0);
    assert.equal(restarted.activeCharacter.resources[0].current,0);
    assert.equal(transport.hostStarts(),2);
  } finally {
    transport.restore();
  }
});

test("Client receiving session-ended becomes explicitly offline without reconnect and preserves durable Character state",async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const adapter=await savedProductionPlayerAdapter();
    await adapter.joinSession("127.0.0.1:3210");
    transport.emit({
      type:"hello-ack",
      sessionId:"session.phase14.explicit-end",
      compatibility:{status:"compatible",message:"Connected."},
      hostCursor:0,
      events:[],
    });
    await new Promise<void>((resolve)=>setImmediate(resolve));

    const state=connectedStateFor(adapter);
    const app=connectedInternal(adapter);
    assert.equal(state.sessionId,"session.phase14.explicit-end");
    state.sessionStarted=true;
    app.sessionMode="initiative";
    app.scene.round=3;
    app.scene.currentActorId="combatant.goblin-a";
    app.scene.selectedActorId="combatant.goblin-a";
    app.resolution=pendingResolution(app.activeCharacter.id);
    app.activeCharacter.resources[0].current=0;

    transport.emit({
      type:"session-ended",
      sessionId:"session.phase14.explicit-end",
      reason:"Host ended live play.",
    });
    await new Promise<void>((resolve)=>setImmediate(resolve));
    await new Promise<void>((resolve)=>setImmediate(resolve));

    const ended=await adapter.getSnapshot();
    const endedState=connectedStateFor(adapter);
    assert.equal(ended.session.role,"offline");
    assert.equal(ended.session.lifecycle,"offline");
    assert.equal(ended.connectionState,"disconnected");
    assert.equal(ended.session.address,"");
    assert.deepEqual(ended.session.participants,[]);
    assert.equal(ended.sessionMode,"freeform");
    assert.equal(ended.scene.round,0);
    assert.deepEqual(ended.scene.economyByActor,{});
    assert.equal(ended.resolution,null);
    assert.match(ended.session.compatibilityMessage,/Session ended by Host/);
    assert.equal(ended.activeCharacter.resources[0].current,0,"owner durable Character state must survive Host end");
    assert.equal(endedState.mode,null);
    assert.equal(endedState.sessionId,null);
    assert.equal(endedState.replica,null);
    assert.equal(endedState.reconnectTimer,null);
    assert.equal(endedState.reconnectInFlight,false);
    assert.equal(transport.clientConnects(),1,"explicit Host end must not schedule a reconnect attempt");
    assert.ok(transport.operations().includes("stop"));
  } finally {
    transport.restore();
  }
});

test("production Host live UI exposes explicit session end control without debug path",()=>{
  const source=readFileSync(new URL("../../src/ProductionSessionLifecycleBridge.tsx",import.meta.url),"utf8");
  assert.match(source,/snapshot\.session\.lifecycle==="live" \? "세션 종료" : "Host 중지"/);
  assert.match(source,/stopSession\(\)/);
  assert.doesNotMatch(source,/setReferenceRole|loadReferenceScenario|Ctrl\+Shift\+D/);
});
