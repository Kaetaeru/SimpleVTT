import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import { ClientSessionReplica } from "../../src/app/connectedSessionProtocol";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { scheduleClientReconnectForTests } from "../../src/app/connectedSessionRuntimeAdapter";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

type Wire={type:string;knownEventCursor?:number};
const sleep=(ms:number)=>new Promise((resolve)=>setTimeout(resolve,ms));

// Reproduced on real Windows H+P1+P2 (W9-02 family H, MP-H04): after the Host restarted, the Clients' transport
// reconnect flipped them to "connected" before the restarted Host had answered the hello (it still had to reject the
// stale cursor and accept the rejoin from cursor 0), so a "connected" Client was not yet a participant on the Host.
test("a Client whose transport reconnected stays reconnecting until the Host accepts its hello",async()=>{
  const client=new MockAdapter();
  const app=client as unknown as {session:{address:string;role:string;participants:Array<{state:string}>};connectionState:string};
  const state=connectedStateFor(client);
  state.mode="client";state.sessionId="session.reconnect-pending";state.replica=new ClientSessionReplica("session.reconnect-pending");
  app.session.address="127.0.0.1:3210";app.session.role="client";app.connectionState="connected";
  app.session.participants=[{state:"connected"},{state:"connected"}];
  const sent:Wire[]=[];
  const connectClient=tauriSessionTransport.connectClient,send=tauriSessionTransport.send;
  let connects=0;
  tauriSessionTransport.connectClient=async(address)=>{connects+=1;return {role:"client",state:"connected",address,peerCount:1};};
  tauriSessionTransport.send=async(message)=>{sent.push(JSON.parse(message) as Wire);return 1;};
  try{
    scheduleClientReconnectForTests(client);
    assert.equal(app.connectionState,"reconnecting","a scheduled reconnect marks the Client reconnecting");
    assert.ok(app.session.participants.every((entry)=>entry.state==="reconnecting"));
    await sleep(1300);
    assert.equal(connects,1,"exactly one transport reconnect ran");
    const hello=sent.find((wire)=>wire.type==="hello");
    assert.ok(hello,"the reconnected Client sends its hello with the cursor it knows");
    assert.equal(hello.knownEventCursor,state.replica!.cursor);
    assert.equal(app.connectionState,"reconnecting","the transport-level connect alone must not report the Client as connected");
    assert.equal(state.reconnectTimer,null,"no further reconnect is armed while the hello is pending");
    assert.equal(state.reconnectInFlight,false);
  }finally{tauriSessionTransport.connectClient=connectClient;tauriSessionTransport.send=send;if(state.reconnectTimer){clearTimeout(state.reconnectTimer);state.reconnectTimer=null;}}
});
