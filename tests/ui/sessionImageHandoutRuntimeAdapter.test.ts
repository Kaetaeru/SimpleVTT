import assert from "node:assert/strict";
import test from "node:test";
import { tauriSessionTransport, type SessionTransportMessage } from "../../src/app/tauriSessionTransport";

function fakeTransport() {
  const original={available:tauriSessionTransport.available,startHost:tauriSessionTransport.startHost,connectClient:tauriSessionTransport.connectClient,send:tauriSessionTransport.send,sendTo:tauriSessionTransport.sendTo,stop:tauriSessionTransport.stop,onMessage:tauriSessionTransport.onMessage,onState:tauriSessionTransport.onState,onPeerLifecycle:tauriSessionTransport.onPeerLifecycle};
  const handlers:Array<(message:SessionTransportMessage)=>void>=[];
  const sent:string[]=[];
  const sentTo:Array<{peer:string;raw:string}>=[];
  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>({role:"host",state:"connected",address:"127.0.0.1:3210",peerCount:0});
  tauriSessionTransport.connectClient=async(address)=>({role:"client",state:"connected",address,peerCount:1});
  tauriSessionTransport.send=async(raw)=>{sent.push(raw);return 1;};
  tauriSessionTransport.sendTo=async(peer,raw)=>{sentTo.push({peer,raw});return 1;};
  tauriSessionTransport.stop=async()=>({role:null,state:"disconnected",address:"",peerCount:0});
  tauriSessionTransport.onMessage=async(handler)=>{handlers.push(handler);return()=>{};};
  tauriSessionTransport.onState=async()=>()=>{};
  tauriSessionTransport.onPeerLifecycle=async()=>()=>{};
  return {
    sent:()=>sent.map((raw)=>({raw,value:JSON.parse(raw) as Record<string,unknown>})),
    sentTo:()=>sentTo.map((entry)=>({...entry,value:JSON.parse(entry.raw) as Record<string,unknown>})),
    emit(index:number,peer:string,raw:string){handlers[index]?.({peer,message:raw});},
    count:()=>handlers.length,
    restore(){Object.assign(tauriSessionTransport,original);},
  };
}

async function flush() { await new Promise<void>((resolve)=>setImmediate(resolve)); await new Promise<void>((resolve)=>setImmediate(resolve)); await new Promise<void>((resolve)=>setImmediate(resolve)); }

test("DM handout reveal is presentation-only, fans out to P1/P2, and restores safely on reconnect",async()=>{
  const transport=fakeTransport();
  try {
    await import("../../src/app/offlineRuntimeAdapters");
    const { MockAdapter }=await import("../../src/app/mockAdapter");
    const { connectedInternal }=await import("../../src/app/connectedSessionRuntimeAdapter");
    const { connectedStateFor }=await import("../../src/app/connectedSessionState");
    await import("../../src/app/connectedParticipantIdempotencyAdapter");
    await import("../../src/app/productionSessionLifecycleAdapter");
    const handout=await import("../../src/app/sessionImageHandoutRuntimeAdapter");
    await import("../../src/app/sessionContentParityRuntimeAdapter");
    const { parseLocalImageDataUrl,HANDOUT_IMAGE_MAX_BYTES }=await import("../../src/app/localImageAsset");

    const host=new MockAdapter();
    const client=new MockAdapter();
    const client2=new MockAdapter();
    const hostTemplate=await host.getSnapshot();
    const clientTemplate=await client.getSnapshot();
    const client2Template=await client2.getSnapshot();
    const hostCharacter={...structuredClone(hostTemplate.activeCharacter),id:"char.handout.host",name:"Handout Host",saveState:"saved" as const};
    const clientCharacter={
      ...structuredClone(clientTemplate.activeCharacter),
      id:"char.handout.client",
      name:"Handout Client",
      saveState:"saved" as const,
      equipment:[],
      items:[],
      attacks:[],
    };
    const client2Character={
      ...structuredClone(client2Template.activeCharacter),
      id:"char.handout.client2",
      name:"Handout Observer",
      saveState:"saved" as const,
      equipment:[],
      items:[],
      attacks:[],
    };
    const hostApp=connectedInternal(host);
    hostApp.activeCharacter=structuredClone(hostCharacter);
    hostApp.characters=[...hostApp.characters.filter((entry)=>![hostCharacter.id,clientCharacter.id,client2Character.id].includes(entry.id)),structuredClone(hostCharacter),structuredClone(clientCharacter),structuredClone(client2Character)];
    const clientApp=connectedInternal(client);
    clientApp.activeCharacter=structuredClone(clientCharacter);
    clientApp.characters=[...clientApp.characters.filter((entry)=>entry.id!==clientCharacter.id),structuredClone(clientCharacter)];
    const client2App=connectedInternal(client2);
    client2App.activeCharacter=structuredClone(client2Character);
    client2App.characters=[...client2App.characters.filter((entry)=>entry.id!==client2Character.id),structuredClone(client2Character)];

    await host.hostSession();
    await client.joinSession("127.0.0.1:3210");
    assert.equal(transport.count(),2,"handout layer must reuse the existing connected listener registration");
    const firstHello=transport.sent().find((entry)=>entry.value.type==="hello");
    assert.ok(firstHello);
    transport.emit(0,"peer.client",firstHello.raw);
    await flush();
    const firstAck=transport.sentTo().find((entry)=>entry.peer==="peer.client"&&entry.value.type==="hello-ack");
    assert.ok(firstAck);
    assert.equal((firstAck.value.compatibility as {status?:string}).status,"compatible");
    transport.emit(1,"host",firstAck.raw);
    await flush();
    const reconnectHello=transport.sent().filter((entry)=>entry.value.type==="hello").at(-1);
    assert.ok(reconnectHello,"content parity must leave a current hello that can be used for reconnect");

    await client2.joinSession("127.0.0.1:3210");
    assert.equal(transport.count(),3,"H+P1+P2 must each retain the existing connected listener path");
    const secondHello=transport.sent().filter((entry)=>entry.value.type==="hello").at(-1);
    assert.ok(secondHello);
    transport.emit(0,"peer.client2",secondHello.raw);
    await flush();
    const secondAck=transport.sentTo().find((entry)=>entry.peer==="peer.client2"&&entry.value.type==="hello-ack");
    assert.ok(secondAck);
    assert.equal((secondAck.value.compatibility as {status?:string}).status,"compatible");
    transport.emit(2,"host",secondAck.raw);
    await flush();

    const ledgerCursorBefore=connectedStateFor(host).ledger?.cursor;
    const asset=parseLocalImageDataUrl("data:image/webp;base64,UklGRg==","clue.webp",HANDOUT_IMAGE_MAX_BYTES);
    assert.equal(transport.sent().filter((entry)=>entry.value.type==="presentation-handout").length,0,"local DM preview must not broadcast before explicit reveal");
    await handout.revealSessionImageHandout(host,asset);
    assert.equal(connectedStateFor(host).ledger?.cursor,ledgerCursorBefore,"presentation reveal must not create a ResolutionEvent/participant ledger event");
    const reveal=transport.sent().filter((entry)=>entry.value.type==="presentation-handout").at(-1);
    assert.ok(reveal);
    assert.deepEqual(Object.keys(reveal.value).sort(),["asset","revision","sessionId","type"],"handout fan-out must stay on the presentation envelope without Library metadata");
    transport.emit(1,"host",reveal.raw);
    transport.emit(2,"host",reveal.raw);
    await flush();
    assert.equal(handout.getSessionImageHandoutState(client).asset?.fileName,"clue.webp");
    assert.equal(handout.getSessionImageHandoutState(client2).asset?.fileName,"clue.webp");
    handout.dismissSessionImageHandout(client);
    assert.equal(handout.getSessionImageHandoutState(client).dismissed,true);

    const reconnectPeer="peer.client.reconnect";
    transport.emit(0,reconnectPeer,reconnectHello.raw);
    await flush();
    const restored=transport.sentTo().filter((entry)=>entry.peer===reconnectPeer&&entry.value.type==="presentation-handout").at(-1);
    assert.ok(restored,"compatible reconnect hello-ack must be followed by the active Host presentation");
    transport.emit(1,"host",restored.raw);
    await flush();
    const clientState=handout.getSessionImageHandoutState(client);
    assert.equal(clientState.asset?.fileName,"clue.webp");
    assert.equal(clientState.dismissed,false,"reconnect restoration should reopen the current Host reveal");

    await handout.withdrawSessionImageHandout(host);
    const withdrawn=transport.sent().filter((entry)=>entry.value.type==="presentation-handout").at(-1);
    assert.ok(withdrawn);
    transport.emit(1,"host",withdrawn.raw);
    transport.emit(2,"host",withdrawn.raw);
    await flush();
    assert.equal(handout.getSessionImageHandoutState(client).asset,null);
    assert.equal(handout.getSessionImageHandoutState(client2).asset,null);

    const withdrawnReconnectPeer="peer.client.reconnect-withdrawn";
    transport.emit(0,withdrawnReconnectPeer,reconnectHello.raw);
    await flush();
    const restoredWithdrawal=transport.sentTo().filter((entry)=>entry.peer===withdrawnReconnectPeer&&entry.value.type==="presentation-handout").at(-1);
    assert.ok(restoredWithdrawal,"reconnecting Clients must receive the current withdrawn handout state");
    assert.equal(restoredWithdrawal.value.asset,null,"withdrawn handout restoration must not leak the previously revealed asset");
    transport.emit(1,"host",restoredWithdrawal.raw);
    await flush();
    assert.equal(handout.getSessionImageHandoutState(client).asset,null);

    await handout.dismissSessionLastRoll(host,"resolution.last-roll.1");
    const dismissed=transport.sent().filter((entry)=>entry.value.type==="presentation-last-roll-dismiss").at(-1);
    assert.ok(dismissed);
    transport.emit(1,"host",dismissed.raw);
    await flush();
    assert.equal(handout.getSessionLastRollPresentationState(client).dismissedResolutionId,"resolution.last-roll.1");

    const lastRollReconnectPeer="peer.client.reconnect-last-roll";
    transport.emit(0,lastRollReconnectPeer,reconnectHello.raw);
    await flush();
    const restoredDismissal=transport.sentTo().filter((entry)=>entry.peer===lastRollReconnectPeer&&entry.value.type==="presentation-last-roll-dismiss").at(-1);
    assert.ok(restoredDismissal,"reconnecting Clients must keep the current Last Roll hidden until a new resolution arrives");
  } finally { transport.restore(); }
});
