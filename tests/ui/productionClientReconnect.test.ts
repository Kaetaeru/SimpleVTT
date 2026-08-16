import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/productionSessionLifecycleAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { connectedInternal } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import type { ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport, type SessionTransportMessage, type SessionTransportStatus } from "../../src/app/tauriSessionTransport";
import { encodeConnectedWireMessage, type ConnectedWireMessage } from "../../src/app/connectedSessionWire";

function installFakeDesktopTransport() {
  const original={
    available:tauriSessionTransport.available,
    connectClient:tauriSessionTransport.connectClient,
    send:tauriSessionTransport.send,
    stop:tauriSessionTransport.stop,
    onMessage:tauriSessionTransport.onMessage,
    onState:tauriSessionTransport.onState,
    onPeerLifecycle:tauriSessionTransport.onPeerLifecycle,
  };
  const originalSetTimeout=globalThis.setTimeout;
  let messageHandler:((message:SessionTransportMessage)=>void)|undefined;
  let stateHandler:((status:SessionTransportStatus)=>void)|undefined;
  let scheduled:(()=>unknown)|undefined;
  let connectCount=0;
  const sent:ConnectedWireMessage[]=[];

  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.connectClient=async(address)=>{
    connectCount+=1;
    return {role:"client",state:"connected",address,peerCount:1};
  };
  tauriSessionTransport.send=async(message)=>{
    sent.push(JSON.parse(message) as ConnectedWireMessage);
    return 1;
  };
  tauriSessionTransport.stop=async()=>({role:null,state:"disconnected",address:"",peerCount:0});
  tauriSessionTransport.onMessage=async(handler)=>{messageHandler=handler;return()=>{};};
  tauriSessionTransport.onState=async(handler)=>{stateHandler=handler;return()=>{};};
  tauriSessionTransport.onPeerLifecycle=async()=>()=>{};
  globalThis.setTimeout=((handler:()=>unknown)=>{
    scheduled=handler;
    return 1 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  return {
    sent:()=>[...sent],
    connectCount:()=>connectCount,
    emit(message:ConnectedWireMessage) {
      messageHandler?.({peer:"host",message:encodeConnectedWireMessage(message)});
    },
    emitState(status:SessionTransportStatus) {
      stateHandler?.(status);
    },
    async runReconnectTimer() {
      const callback=scheduled;
      scheduled=undefined;
      assert.ok(callback,"expected reconnect timer callback");
      await callback();
      await new Promise<void>((resolve)=>setImmediate(resolve));
    },
    restore() {
      globalThis.setTimeout=originalSetTimeout;
      tauriSessionTransport.available=original.available;
      tauriSessionTransport.connectClient=original.connectClient;
      tauriSessionTransport.send=original.send;
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
    id:"char.phase14.reconnect-owner",
    name:"Phase14 Reconnect Owner",
    saveState:"saved" as const,
  };
  const app=connectedInternal(adapter);
  app.activeCharacter=structuredClone(saved);
  app.characters=[...app.characters.filter((character)=>character.id!==saved.id),structuredClone(saved)];
  return adapter;
}

function modeEvent(sessionId:string,sequence:number,round:number):ConnectedSessionEvent {
  return {
    sessionId,
    eventId:`${sessionId}:event:${sequence}`,
    sequence,
    actorId:"host",
    payload:{
      kind:"mode-transition",
      sessionMode:"freeform",
      round,
      currentActorId:`actor.round-${round}`,
      economyByActor:{},
      stateChanges:[`round ${round}`],
      provenance:["production reconnect regression"],
    },
  };
}

test("production client reconnects from the accepted cursor and applies hello-ack catch-up exactly once",async()=>{
  const transport=installFakeDesktopTransport();
  try {
    const adapter=await savedProductionPlayerAdapter();
    const target="127.0.0.1:3210";
    await adapter.joinSession(target);

    const initialHello=transport.sent().find((message)=>message.type==="hello");
    assert.equal(initialHello?.type,"hello");
    if (initialHello?.type!=="hello") throw new Error("expected initial hello");
    assert.equal(initialHello.knownEventCursor,0);
    assert.equal(transport.connectCount(),1);

    const sessionId="session.phase14.client-reconnect";
    transport.emit({
      type:"hello-ack",
      sessionId,
      compatibility:{status:"compatible",message:"connected"},
      hostCursor:1,
      events:[modeEvent(sessionId,1,0)],
    });
    await new Promise<void>((resolve)=>setImmediate(resolve));

    const state=connectedStateFor(adapter);
    const app=connectedInternal(adapter);
    assert.equal(state.replica?.cursor,1);
    assert.equal(app.connectionState,"connected");
    assert.equal(app.activity.filter((entry)=>entry.id===`connected:${sessionId}:event:1`).length,1);

    transport.emitState({role:"client",state:"disconnected",address:target,peerCount:0});
    await new Promise<void>((resolve)=>setImmediate(resolve));
    assert.equal(app.connectionState,"reconnecting");
    assert.match(app.session.compatibilityMessage,/event cursor 1/);

    await transport.runReconnectTimer();
    assert.equal(transport.connectCount(),2);
    const reconnectHello=transport.sent().filter((message)=>message.type==="hello").at(-1);
    assert.equal(reconnectHello?.type,"hello");
    if (reconnectHello?.type!=="hello") throw new Error("expected reconnect hello");
    assert.equal(reconnectHello.knownEventCursor,1,"reconnect hello must resume from the accepted replica cursor");

    const catchup=modeEvent(sessionId,2,1);
    const reconnectAck:ConnectedWireMessage={
      type:"hello-ack",
      sessionId,
      compatibility:{status:"compatible",message:"reconnected"},
      hostCursor:2,
      events:[catchup],
    };
    transport.emit(reconnectAck);
    await new Promise<void>((resolve)=>setImmediate(resolve));

    assert.equal(state.replica?.cursor,2);
    assert.equal(app.connectionState,"connected");
    assert.equal(app.activity.filter((entry)=>entry.id===`connected:${catchup.eventId}`).length,1);
    const localId=`client:${app.activeCharacter.id}`;
    assert.equal(app.session.participants.filter((participant)=>participant.id===localId).length,1);

    transport.emit(reconnectAck);
    await new Promise<void>((resolve)=>setImmediate(resolve));
    assert.equal(state.replica?.cursor,2,"replayed hello-ack must not advance the replica cursor");
    assert.equal(app.activity.filter((entry)=>entry.id===`connected:${catchup.eventId}`).length,1,"replayed catch-up event must not reapply payload mutation");
    assert.equal(app.session.participants.filter((participant)=>participant.id===localId).length,1,"replayed hello-ack must not duplicate the local participant");
  } finally {
    transport.restore();
  }
});
