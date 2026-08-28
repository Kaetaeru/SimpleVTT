import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import type { CatalogEntry } from "../../src/app/contracts";
import { installedCommonPlayActionId, parseInstalledCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { MockAdapter } from "../../src/app/mockAdapter";
import { FIGHTER_ACTION_SURGE_RESOURCE_ID, FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID } from "../../src/domain/coreClassResources";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

const ACTOR_ID="char.aelar";

function actionSurgeResources(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  return {
    feature:snapshot.activeCharacter.resources.find((resource)=>resource.id===FIGHTER_ACTION_SURGE_RESOURCE_ID)?.current,
    turn:snapshot.activeCharacter.resources.find((resource)=>resource.id===FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID)?.current,
  };
}

function projectedActionSurgeId(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  const action=snapshot.scene.actionsByActor[ACTOR_ID]?.find((candidate)=>candidate.name==="액션 서지");
  assert.ok(action,"Fighter hotbar must project Action Surge");
  assert.ok(parseInstalledCommonPlayActionId(action.id),"Action Surge hotbar must use a generic Common Play reference");
  return action.id;
}

test("Fighter hotbar Action Surge resolves through Common Play, spends both resources, and Undo restores its exact extra Action", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor(ACTOR_ID);
  let snapshot=await adapter.getSnapshot();
  const actionId=projectedActionSurgeId(snapshot);

  await adapter.resolveAction(actionId,[ACTOR_ID]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.resolution?.actionId,actionId);
  assert.equal(snapshot.scene.economyByActor[ACTOR_ID]?.extraActions?.length,1);
  assert.equal(snapshot.scene.economyByActor[ACTOR_ID]?.extraActions?.[0]?.allowsMagicAction,false);
  assert.deepEqual(actionSurgeResources(snapshot),{feature:0,turn:0});

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor[ACTOR_ID]?.extraActions,undefined);
  assert.deepEqual(actionSurgeResources(snapshot),{feature:1,turn:1});

  await adapter.resolveAction(actionId,[ACTOR_ID]);
  await adapter.dismissResolution();
  await adapter.resolveAction("action.longsword",["combatant.goblin-a"]);
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor[ACTOR_ID]?.extraActions,undefined,"the attack consumes the restricted extra Action first");
  assert.equal(snapshot.scene.economyByActor[ACTOR_ID]?.extraAttacks?.length,1,"the surged Attack action still grants Fighter Extra Attack");
  assert.equal(snapshot.scene.economyByActor[ACTOR_ID]?.action,true,"the normal Action remains available after the surged attack");

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor[ACTOR_ID]?.extraActions?.length,1,"attack Undo restores the exact Action Surge grant");
  assert.equal(snapshot.scene.economyByActor[ACTOR_ID]?.extraActions?.[0]?.allowsMagicAction,false);
});

test("builtin Common Play production semantics survive ID and name-only renames", async () => {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor(ACTOR_ID);
  await adapter.getSnapshot();

  const internal=adapter as unknown as {catalog:CatalogEntry[]};
  const entry=internal.catalog.find((candidate)=>candidate.scope==="builtin"&&candidate.contentId==="fighter.action-surge");
  const mechanic=entry?.mechanics?.find((candidate)=>candidate.kind==="common-play"&&candidate.config.id==="fighter.action-surge.activate");
  assert.ok(entry&&mechanic);

  entry.id="builtin:dnd.srd-5.2.1@0.1-draft:renamed.portable-probe";
  entry.contentId="renamed.portable-probe";
  entry.nameKo="이름 변경 프로브";
  entry.nameEn="Renamed Portable Probe";
  mechanic.id="action.renamed.portable-probe";
  mechanic.config.id="renamed.portable-probe.activate";
  mechanic.config.entryPoints[0].id="invoke";
  const renamedActionId=installedCommonPlayActionId({
    catalogId:entry.id,
    mechanicId:mechanic.config.id,
    entryPointId:"invoke",
  });

  await adapter.resolveAction(renamedActionId,[ACTOR_ID]);
  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.resolution?.actionId,renamedActionId);
  assert.equal(snapshot.scene.economyByActor[ACTOR_ID]?.extraActions?.length,1);
  assert.equal(snapshot.scene.economyByActor[ACTOR_ID]?.extraActions?.[0]?.allowsMagicAction,false);
  assert.deepEqual(actionSurgeResources(snapshot),{feature:0,turn:0});
});

test("connected Action Surge converges both resources and the restricted extra Action grant", async () => {
  const sessionId="session.fighter.action-surge";
  const host=new MockAdapter();
  await host.startInitiative();
  await host.setCurrentActor(ACTOR_ID);
  const actionId=projectedActionSurgeId(await host.getSnapshot());
  const hostState=connectedStateFor(host);
  hostState.mode="host";
  hostState.sessionId=sessionId;
  hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const wires:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try {
    await host.resolveAction(actionId,[ACTOR_ID]);
  } finally {
    tauriSessionTransport.send=originalSend;
  }
  const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;
  assert.ok(batch);

  const client=new MockAdapter();
  await client.startInitiative();
  await client.setCurrentActor(ACTOR_ID);
  const clientState=connectedStateFor(client);
  clientState.mode="client";
  clientState.sessionId=sessionId;
  clientState.replica=new ClientSessionReplica(sessionId);
  const applied=await applyConnectedClientEvents(client,batch.events);
  assert.equal(applied.status,"applied");
  const snapshot=await client.getSnapshot();
  assert.equal(snapshot.scene.economyByActor[ACTOR_ID]?.extraActions?.length,1);
  assert.equal(snapshot.scene.economyByActor[ACTOR_ID]?.extraActions?.[0]?.allowsMagicAction,false);
  assert.deepEqual(actionSurgeResources(snapshot),{feature:0,turn:0});
});
