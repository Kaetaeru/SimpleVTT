import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

async function finish(adapter:MockAdapter) {
  let snapshot=await adapter.getSnapshot();
  for (let step=0;step<5&&snapshot.resolution?.stage!=="complete";step+=1) snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"complete");
  return snapshot;
}

test("Extra Attack keeps weapon actions available for the exact remaining attacks and Undo restores the credit", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  let snapshot=await adapter.getSnapshot();
  const weapon=snapshot.scene.actionsByActor["char.aelar"]?.find((action)=>action.id==="action.longsword");
  assert.equal(weapon?.attacksPerAction,2);

  await adapter.resolveAction("action.longsword",["combatant.goblin-a"]);
  snapshot=await finish(adapter);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraAttacks?.length,1);
  assert.equal(snapshot.scene.actionsByActor["char.aelar"]?.find((action)=>action.id==="action.longsword")?.available,true);

  await adapter.dismissResolution();
  await adapter.resolveAction("action.longsword",["combatant.goblin-b"]);
  snapshot=await finish(adapter);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraAttacks,undefined);
  assert.equal(snapshot.scene.actionsByActor["char.aelar"]?.find((action)=>action.id==="action.longsword")?.available,false);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraAttacks?.length,1);
  assert.equal(snapshot.scene.actionsByActor["char.aelar"]?.find((action)=>action.id==="action.longsword")?.available,true);

  await adapter.dismissResolution();
  do {
    await adapter.endTurn();
    snapshot=await adapter.getSnapshot();
  } while (snapshot.scene.currentActorId!=="char.aelar");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraAttacks,undefined,"unused attack credits expire at the next turn start");
});

test("connected first attack publishes the remaining Extra Attack credit to every client", async () => {
  const sessionId="session.extra-attack";
  const host=new MockAdapter();
  await host.startInitiative();
  await host.setCurrentActor("char.aelar");
  const hostState=connectedStateFor(host);
  hostState.mode="host";
  hostState.sessionId=sessionId;
  hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const wires:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try {
    await host.resolveAction("action.longsword",["combatant.goblin-a"]);
    await finish(host);
  } finally {
    tauriSessionTransport.send=originalSend;
  }
  const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;
  assert.ok(batch);

  const client=new MockAdapter();
  await client.startInitiative();
  await client.setCurrentActor("char.aelar");
  const clientState=connectedStateFor(client);
  clientState.mode="client";
  clientState.sessionId=sessionId;
  clientState.replica=new ClientSessionReplica(sessionId);
  const applied=await applyConnectedClientEvents(client,batch.events);
  assert.equal(applied.status,"applied");
  const snapshot=await client.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraAttacks?.length,1);
});
