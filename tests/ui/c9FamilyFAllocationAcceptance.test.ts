import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/installedContentRuntimeAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

interface Identity {
  moduleId:string;
  contentId:string;
  mechanicId:string;
  entryPointId:string;
  displayName:string;
}

const ORIGINAL:Identity={
  moduleId:"homebrew.family-f-allocation-acceptance",
  contentId:"option.family-f-allocation-acceptance",
  mechanicId:"external.unknown.family-f-allocation-acceptance",
  entryPointId:"distribute",
  displayName:"Portable Allocation Acceptance",
};

function packagePayload(identity:Identity) {
  return JSON.stringify({
    schemaVersion:"0.1-draft",moduleId:identity.moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Family F Allocation Acceptance",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],content:[{
      id:identity.contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:identity.displayName,locales:{en:{name:identity.displayName,description:"Portable allocation persistence and connected replay probe"}}},
      mechanics:[{kind:"common-play",config:{
        schemaVersion:"0.2-draft",id:identity.mechanicId,entryPoints:[{
          id:identity.entryPointId,invocation:"manual",
          allocation:{units:{value:3},targets:{from:"targets",min:1,max:3},minimumPerTarget:1,maximumPerTarget:3,totalMustMatch:true},
          operations:[{kind:"economy.modify",bucket:"action.extra.non-magic",amount:{value:1}}],
        }],
      }}],
    }],
  });
}

function actionId(identity:Identity) {
  return installedCommonPlayActionId({catalogId:catalogQualifiedId(identity.contentId,identity.moduleId,"1"),mechanicId:identity.mechanicId,entryPointId:identity.entryPointId});
}

async function install(adapter:MockAdapter,store:MemoryInstalledContentStore,identity:Identity) {
  setInstalledContentStoreForTests(adapter,store);
  const preview=await adapter.previewContentImport(packagePayload(identity));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
}

async function executeAfterRestart(identity:Identity) {
  const store=new MemoryInstalledContentStore();
  const installer=new MockAdapter();
  await install(installer,store,identity);
  const restarted=new MockAdapter();
  setInstalledContentStoreForTests(restarted,store);
  await restarted.startInitiative();
  await restarted.setCurrentActor("char.aelar");
  const id=actionId(identity);
  let snapshot=await restarted.getSnapshot();
  assert.ok(snapshot.catalog.some((entry)=>entry.contentId===identity.contentId),"fresh adapter must rehydrate installed allocation content");

  await restarted.resolveAction(id,["combatant.goblin-a","combatant.goblin-b"]);
  snapshot=await restarted.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions,undefined,"invalid partial allocation must not commit downstream state");

  await restarted.resolveAction(id,["combatant.goblin-a","combatant.goblin-a","combatant.goblin-b"]);
  snapshot=await restarted.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.deepEqual(snapshot.resolution?.targetIds,["combatant.goblin-a","combatant.goblin-b"]);
  assert.ok(snapshot.resolution?.detail.some((line)=>line.includes("combatant.goblin-a 2")&&line.includes("combatant.goblin-b 1")));
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.length,1);
  await restarted.undoLastResolution();
  snapshot=await restarted.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions,undefined);
  return {actionId:id,targetIds:["combatant.goblin-a","combatant.goblin-b"],distribution:[2,1]};
}

test("portable allocation survives installed-content restart, rejects partial commit, Undo, and external identity rename",async()=>{
  const original=await executeAfterRestart(ORIGINAL);
  const renamed=await executeAfterRestart({moduleId:"homebrew.previously-unseen.allocation-module",contentId:"option.previously-unseen.allocation-content",mechanicId:"external.previously-unseen.allocation-definition",entryPointId:"renamed-distribution",displayName:"Completely Renamed Allocation"});
  assert.notEqual(original.actionId,renamed.actionId);
  assert.deepEqual({targetIds:renamed.targetIds,distribution:renamed.distribution},{targetIds:original.targetIds,distribution:original.distribution});
});

test("portable allocation converges exactly once, reconstructs on fresh reconnect, and connected Undo reverses downstream state",async()=>{
  const sessionId="session.family-f-allocation-acceptance";
  const store=new MemoryInstalledContentStore();
  const host=new MockAdapter();
  await install(host,store,ORIGINAL);
  await host.startInitiative();
  await host.setCurrentActor("char.aelar");
  const hostState=connectedStateFor(host);
  hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const wires:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try {
    await host.resolveAction(actionId(ORIGINAL),["combatant.goblin-a","combatant.goblin-a","combatant.goblin-b"]);
    await host.undoLastResolution();
  } finally { tauriSessionTransport.send=originalSend; }
  const batches=wires.map((wire)=>JSON.parse(wire)).filter((wire)=>wire.type==="event-batch") as Array<{events:ConnectedSessionEvent[]}>;
  assert.equal(batches.length,2,JSON.stringify(wires));

  const client=new MockAdapter();
  setInstalledContentStoreForTests(client,store);
  await client.startInitiative();await client.setCurrentActor("char.aelar");
  const clientState=connectedStateFor(client);
  clientState.mode="client";clientState.sessionId=sessionId;clientState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(client,batches[0].events)).status,"applied");
  let snapshot=await client.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.length,1);
  assert.deepEqual(snapshot.resolution?.targetIds,["combatant.goblin-a","combatant.goblin-b"]);
  const afterFirstApply=structuredClone(snapshot.scene.economyByActor["char.aelar"]?.extraActions);
  await applyConnectedClientEvents(client,batches[0].events);
  snapshot=await client.getSnapshot();
  assert.deepEqual(snapshot.scene.economyByActor["char.aelar"]?.extraActions,afterFirstApply,"duplicate connected replay must not allocate downstream state twice");

  const reconnected=new MockAdapter();
  setInstalledContentStoreForTests(reconnected,store);
  await reconnected.startInitiative();await reconnected.setCurrentActor("char.aelar");
  const reconnectState=connectedStateFor(reconnected);
  reconnectState.mode="client";reconnectState.sessionId=sessionId;reconnectState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnected,batches[0].events)).status,"applied");
  const reconnectedSnapshot=await reconnected.getSnapshot();
  assert.ok(reconnectedSnapshot.catalog.some((entry)=>entry.contentId===ORIGINAL.contentId));
  assert.equal(reconnectedSnapshot.scene.economyByActor["char.aelar"]?.extraActions?.length,1);
  assert.deepEqual(reconnectedSnapshot.resolution?.targetIds,["combatant.goblin-a","combatant.goblin-b"]);

  assert.equal((await applyConnectedClientEvents(client,batches[1].events)).status,"applied");
  snapshot=await client.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions,undefined);
});
