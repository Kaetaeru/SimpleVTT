import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import type { CatalogEntry } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { FIGHTER_ACTION_SURGE_RESOURCE_ID, FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID } from "../../src/domain/coreClassResources";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

const ACTION_SURGE_ACTION_ID="action.fighter.action-surge";

function actionSurgeResources(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  return {
    feature:snapshot.activeCharacter.resources.find((resource)=>resource.id===FIGHTER_ACTION_SURGE_RESOURCE_ID)?.current,
    turn:snapshot.activeCharacter.resources.find((resource)=>resource.id===FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID)?.current,
  };
}

test("Fighter hotbar Action Surge resolves through Common Play, spends both resources, and Undo restores its exact extra Action", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  let snapshot=await adapter.getSnapshot();
  assert.ok(snapshot.scene.actionsByActor["char.aelar"]?.some((action)=>action.id===ACTION_SURGE_ACTION_ID));

  await adapter.resolveAction(ACTION_SURGE_ACTION_ID,["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.resolution?.actionId,ACTION_SURGE_ACTION_ID);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.length,1);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.[0]?.allowsMagicAction,false);
  assert.deepEqual(actionSurgeResources(snapshot),{feature:0,turn:0});

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions,undefined);
  assert.deepEqual(actionSurgeResources(snapshot),{feature:1,turn:1});

  await adapter.resolveAction(ACTION_SURGE_ACTION_ID,["char.aelar"]);
  await adapter.dismissResolution();
  await adapter.resolveAction("action.longsword",["combatant.goblin-a"]);
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions,undefined,"the attack consumes the restricted extra Action first");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraAttacks?.length,1,"the surged Attack action still grants Fighter Extra Attack");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true,"the normal Action remains available after the surged attack");

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.length,1,"attack Undo restores the exact Action Surge grant");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.[0]?.allowsMagicAction,false);
});

test("builtin Common Play production semantics survive ID and name-only renames", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  await adapter.getSnapshot();

  const internal=adapter as unknown as {catalog:CatalogEntry[]};
  const entry=internal.catalog.find((candidate)=>candidate.scope==="builtin"&&candidate.contentId==="fighter.action-surge");
  const mechanic=entry?.mechanics?.find((candidate)=>candidate.kind==="common-play"&&candidate.id===ACTION_SURGE_ACTION_ID);
  assert.ok(entry&&mechanic);

  const renamedActionId="action.renamed.portable-probe";
  entry.contentId="renamed.portable-probe";
  entry.nameKo="이름 변경 프로브";
  entry.nameEn="Renamed Portable Probe";
  mechanic.id=renamedActionId;
  mechanic.config.id="renamed.portable-probe.activate";

  await adapter.resolveAction(renamedActionId,["char.aelar"]);
  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.resolution?.actionId,renamedActionId);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.length,1);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.[0]?.allowsMagicAction,false);
  assert.deepEqual(actionSurgeResources(snapshot),{feature:0,turn:0});
});

test("connected Action Surge converges both resources and the restricted extra Action grant", async () => {
  const sessionId="session.fighter.action-surge";
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
    await host.resolveAction(ACTION_SURGE_ACTION_ID,["char.aelar"]);
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
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.length,1);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.[0]?.allowsMagicAction,false);
  assert.deepEqual(actionSurgeResources(snapshot),{feature:0,turn:0});
});
