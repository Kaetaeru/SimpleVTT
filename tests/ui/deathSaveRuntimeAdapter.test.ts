import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedActionRoutingAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import type { CharacterSheet, SceneVm } from "../../src/app/contracts";

function knockOut(adapter:MockAdapter) {
  const internal=adapter as unknown as {scene:SceneVm;activeCharacter:CharacterSheet};
  const actor=internal.scene.entities.find((entry)=>entry.id==="char.aelar")!;
  actor.hp=0;
  actor.runtimeLife={deathSaves:{successes:0,failures:0},stable:false,unconscious:true,dead:false};
  internal.activeCharacter.hp=0;
  internal.activeCharacter.durableLifeFlags={stable:false,unconscious:true,dead:false,deathSaves:{successes:0,failures:0}};
}

test("0 HP Character gets an authoritative death-save action with durable event-native Undo", async () => {
  const adapter=new MockAdapter();
  knockOut(adapter);
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  let snapshot=await adapter.getSnapshot();
  assert.ok(snapshot.scene.actionsByActor["char.aelar"]?.some((action)=>action.id==="action.death-save"));

  await adapter.setQueuedD20(12);
  await adapter.resolveAction("action.death-save",["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.compact,"d20 12 · 성공");
  assert.deepEqual(snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")?.runtimeLife?.deathSaves,{successes:1,failures:0});
  assert.deepEqual(snapshot.activeCharacter.durableLifeFlags?.deathSaves,{successes:1,failures:0});

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.deepEqual(snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")?.runtimeLife?.deathSaves,{successes:0,failures:0});
  assert.deepEqual(snapshot.activeCharacter.durableLifeFlags?.deathSaves,{successes:0,failures:0});
});

test("natural 20 death save restores 1 HP and removes the death-save action", async () => {
  const adapter=new MockAdapter();
  knockOut(adapter);
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  await adapter.setQueuedD20(20);
  await adapter.resolveAction("action.death-save",["char.aelar"]);
  const snapshot=await adapter.getSnapshot();
  const actor=snapshot.scene.entities.find((entry)=>entry.id==="char.aelar");
  assert.equal(actor?.hp,1);
  assert.equal(actor?.runtimeLife?.unconscious,false);
  assert.equal(snapshot.scene.actionsByActor["char.aelar"]?.some((action)=>action.id==="action.death-save"),false);
});

test("connected death save reaches every client exactly once", async () => {
  const sessionId="session.death-save";
  const host=new MockAdapter();
  knockOut(host);
  await host.startInitiative();
  await host.setCurrentActor("char.aelar");
  const hostState=connectedStateFor(host);
  hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const wires:string[]=[];
  const send=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try { await host.setQueuedD20(12);await host.resolveAction("action.death-save",["char.aelar"]); }
  finally { tauriSessionTransport.send=send; }
  const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;
  assert.ok(batch);

  const client=new MockAdapter();
  knockOut(client);
  await client.startInitiative();
  await client.setCurrentActor("char.aelar");
  const clientState=connectedStateFor(client);
  clientState.mode="client";clientState.sessionId=sessionId;clientState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"applied");
  assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"duplicate");
  const snapshot=await client.getSnapshot();
  assert.deepEqual(snapshot.scene.entities.find((entry)=>entry.id==="char.aelar")?.runtimeLife?.deathSaves,{successes:1,failures:0});
});
