import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedActionRoutingAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

async function ready(adapter:MockAdapter) {
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  await adapter.selectDmActor("char.aelar");
}

async function finish(adapter:MockAdapter) {
  let snapshot=await adapter.getSnapshot();
  for(let step=0;step<6&&snapshot.resolution?.stage!=="complete";step+=1) snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"complete");
  return snapshot;
}

test("Unarmed Strike damage is a zero-die flat hit and participates in Extra Attack", async () => {
  const adapter=new MockAdapter();
  await ready(adapter);
  let snapshot=await adapter.getSnapshot();
  const action=snapshot.scene.actionsByActor["char.aelar"]?.find((entry)=>entry.id==="action.unarmed-strike.damage");
  assert.equal(action?.runtimeAttack?.sourceKind,"unarmed");
  assert.equal(action?.damage?.[0].dice,"0d2");
  const before=snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!.hp;
  await adapter.setQueuedD20(20);
  await adapter.resolveAction("action.unarmed-strike.damage",["combatant.goblin-a"]);
  snapshot=await finish(adapter);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!.hp,before-(action?.damage?.[0].flat??0));
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraAttacks?.length,1);
});

test("Unarmed grapple uses the target's better STR/DEX save, publishes condition, and Undo removes it", async () => {
  const adapter=new MockAdapter();
  await ready(adapter);
  await adapter.setQueuedD20(1);
  await adapter.resolveAction("action.unarmed-strike.grapple",["combatant.goblin-a"]);
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.saveResults[0]?.total,3,"Goblin chooses DEX +2 instead of STR -1");
  assert.ok(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.status.some((status)=>status.includes("붙잡힘")&&status.includes("맨손 타격")));
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraAttacks?.length,1);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.status.some((status)=>status.includes("붙잡힘")),false);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);
});

test("Unarmed shove applies public Prone without a spatial-module distance gate", async () => {
  const adapter=new MockAdapter();
  await ready(adapter);
  await adapter.setQueuedD20(1);
  await adapter.resolveAction("action.unarmed-strike.shove-prone",["combatant.goblin-b"]);
  const snapshot=await adapter.getSnapshot();
  assert.ok(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-b")?.status.some((status)=>status.includes("넘어짐")));
  assert.equal(snapshot.resolution?.finalOutcome,"넘어짐 적용");
});

test("connected unarmed condition converges once on every client", async () => {
  const sessionId="session.unarmed-condition";
  const host=new MockAdapter();
  await ready(host);
  const hostState=connectedStateFor(host);
  hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const wires:string[]=[];
  const send=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try { await host.setQueuedD20(1);await host.resolveAction("action.unarmed-strike.grapple",["combatant.goblin-a"]); }
  finally { tauriSessionTransport.send=send; }
  const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;
  assert.ok(batch);

  const client=new MockAdapter();
  await ready(client);
  const clientState=connectedStateFor(client);
  clientState.mode="client";clientState.sessionId=sessionId;clientState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"applied");
  assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"duplicate");
  const snapshot=await client.getSnapshot();
  assert.ok(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.status.some((status)=>status.includes("붙잡힘")));
});
