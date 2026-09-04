import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import { recoverClientFromHostRestart } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

type Wire={type:string;knownEventCursor?:number;participantId?:string};

// Reproduced on real Windows H+P1+P2 (W9-02 family H, MP-H04/H05): after the Host process was killed and
// restarted on its durable Campaign, both Clients reconnected and sent their old cursor (35) to a Host whose
// ledger had started over; the Host answered "invalid-event-cursor: invalid event cursor 35; host cursor is 1"
// and the Clients stayed connected but never rejoined.
test("a Client whose cursor the restarted Host rejects drops the stale session view and joins again from cursor 0",async()=>{
  const client=new MockAdapter();
  await client.startInitiative();
  const app=client as unknown as {session:{address:string;role:string;participants:unknown[]};connectionState:string;sessionMode:string;scene:{currentActorId:string}};
  const state=connectedStateFor(client);
  state.mode="client";state.sessionId="session.before-restart";state.replica=new ClientSessionReplica("session.before-restart");
  app.session.address="127.0.0.1:3210";app.session.role="client";app.connectionState="connected";
  const sent:Wire[]=[];const send=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{sent.push(JSON.parse(message) as Wire);return 1;};
  try{
    assert.equal(await recoverClientFromHostRestart(client),true);
    const hello=sent.find((wire)=>wire.type==="hello");
    assert.ok(hello,"the Client must send a fresh hello to the restarted Host");
    assert.equal(hello.knownEventCursor,0,"the fresh hello must start from cursor 0");
    assert.equal(hello.participantId,`client:${(await client.getSnapshot()).activeCharacter.id}`);
    const next=connectedStateFor(client);
    assert.equal(next.mode,"client");
    assert.equal(next.sessionId,null,"the stale session id is dropped until the restarted Host acknowledges");
    assert.equal(next.replica,null,"the stale replica is dropped");
    assert.equal(app.session.role,"client");
    assert.equal(app.session.address,"127.0.0.1:3210","the live transport address is kept");
    assert.equal(app.connectionState,"reconnecting","the Client is not connected again until the restarted Host accepts its hello");
    assert.equal(app.sessionMode,"freeform","the stale Initiative view is cleared until the Host's scene topology arrives");
    const snapshot=await client.getSnapshot();
    assert.match(snapshot.session.compatibilityMessage,/Host restarted/);
  }finally{tauriSessionTransport.send=send;}
});

test("a Host or an idle peer never runs the Host-restart recovery",async()=>{
  const host=new MockAdapter();
  connectedStateFor(host).mode="host";
  assert.equal(await recoverClientFromHostRestart(host),false);
  const idle=new MockAdapter();
  assert.equal(await recoverClientFromHostRestart(idle),false);
});
