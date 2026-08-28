import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import type { SceneVm } from "../../src/app/contracts";
import { generatedBuiltinCatalogForTests } from "../../src/app/builtinCatalogRuntimeAdapter";
import { setBuiltinCommonPlayCatalogForTests } from "../../src/app/installedCommonPlayRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { FIGHTER_ACTION_SURGE_RESOURCE_ID, FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID } from "../../src/domain/coreClassResources";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

const ACTION_ID="action.fighter.action-surge";

function actionSurgeBuiltinEntry() {
  const entry=generatedBuiltinCatalogForTests().find((candidate)=>(candidate.contentId??candidate.id)===ACTION_ID);
  assert.ok(entry,"generated built-in catalog must carry Action Surge Common Play content");
  assert.equal(entry.mechanics?.length,1);
  assert.equal(entry.mechanics?.[0]?.kind,"common-play");
  return entry;
}

test("Fighter hotbar Action Surge grants, spends, and Undo restores its exact extra Action through Common Play", async () => {
  actionSurgeBuiltinEntry();
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  let snapshot=await adapter.getSnapshot();
  assert.ok(snapshot.scene.actionsByActor["char.aelar"]?.some((action)=>action.id===ACTION_ID));

  await adapter.resolveAction(ACTION_ID,["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.length,1);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.[0]?.allowsMagicAction,false);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.[0]?.source,"feature:fighter.action-surge");
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id===FIGHTER_ACTION_SURGE_RESOURCE_ID)?.current,0);
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id===FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID)?.current,0);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions,undefined);
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id===FIGHTER_ACTION_SURGE_RESOURCE_ID)?.current,1);
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id===FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID)?.current,1);

  await adapter.resolveAction(ACTION_ID,["char.aelar"]);
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
});

test("built-in Common Play Action Surge mechanics are invariant under action, content, definition, and display-name rename", async () => {
  const original=actionSurgeBuiltinEntry();
  const renamed=structuredClone(original);
  const renamedActionId="action.previously-unseen.fighter-surge";
  const renamedSourceId="feature:previously-unseen.fighter-surge";
  renamed.id=renamedActionId;
  renamed.contentId=renamedActionId;
  renamed.nameKo="이름이 바뀐 추가 행동";
  renamed.nameEn="Renamed Extra Action";
  assert.ok(renamed.mechanics?.[0]);
  renamed.mechanics[0].config.id=renamedSourceId;

  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  setBuiltinCommonPlayCatalogForTests(adapter,[renamed]);

  const internal=adapter as unknown as {scene:SceneVm};
  const projected=internal.scene.actionsByActor["char.aelar"]?.find((action)=>action.id===ACTION_ID);
  assert.ok(projected);
  projected.id=renamedActionId;
  projected.name=renamed.nameKo;

  await adapter.resolveAction(renamedActionId,["char.aelar"]);
  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.resolution?.actionId,renamedActionId);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.[0]?.allowsMagicAction,false);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.[0]?.source,renamedSourceId);
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id===FIGHTER_ACTION_SURGE_RESOURCE_ID)?.current,0);
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id===FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID)?.current,0);
});

test("connected Action Surge converges the resource and exact extra Action grant through Common Play", async () => {
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
    await host.resolveAction(ACTION_ID,["char.aelar"]);
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
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.[0]?.source,"feature:fighter.action-surge");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.[0]?.allowsMagicAction,false);
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id===FIGHTER_ACTION_SURGE_RESOURCE_ID)?.current,0);
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id===FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID)?.current,0);
});
