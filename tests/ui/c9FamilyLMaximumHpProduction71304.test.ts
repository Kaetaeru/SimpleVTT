import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import { getCharacterLibraryPersistenceStateForTests, setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

function packagePayload(prefix:string){
  const moduleId=`${prefix}.module`,contentId=`${prefix}.option`,mechanicId=`${prefix}.maximum-hp`;
  return {moduleId,contentId,mechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Portable Maximum HP Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],content:[{
      id:contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:"Portable Maximum HP",locales:{en:{name:"Portable Maximum HP"}}},
      mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[
        {id:"increase",invocation:"manual",operations:[{kind:"hp.maximum.change",amount:{value:5},target:"self"}]},
        {id:"decrease",invocation:"manual",operations:[{kind:"hp.maximum.change",amount:{value:-1},target:"self"}]},
      ]}}],
    }],
  })};
}

async function install(adapter:MockAdapter,prefix:string){
  const pack=packagePayload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const catalogId=catalogQualifiedId(pack.contentId,pack.moduleId,"1");
  return {
    increase:installedCommonPlayActionId({catalogId,mechanicId:pack.mechanicId,entryPointId:"increase"}),
    decrease:installedCommonPlayActionId({catalogId,mechanicId:pack.mechanicId,entryPointId:"decrease"}),
  };
}

function durableMaximums(adapter:MockAdapter,characterId:string){
  const record=getCharacterLibraryPersistenceStateForTests(adapter)?.document?.characters.find((entry)=>entry.characterId===characterId);
  return {source:record?.source.build.maxHp,runtime:record?.runtime.maxHp};
}

async function restartedMaximum(store:MemoryCharacterLibraryStore){
  const restarted=new MockAdapter();
  setCharacterLibraryStoreForTests(restarted,store);
  const snapshot=await restarted.getSnapshot();
  return {maximum:snapshot.activeCharacter.maxHp,sourceMaximum:snapshot.activeCharacter.sourceMaxHp};
}

function sceneMaximum(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>){
  return snapshot.scene.entities.find((entry)=>entry.id===snapshot.activeCharacter.id)?.maxHp;
}

async function executePortable(prefix:string){
  const characterStore=new MemoryCharacterLibraryStore();
  const adapter=new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,characterStore);
  const actions=await install(adapter,prefix);
  let snapshot=await adapter.getSnapshot();
  const characterId=snapshot.activeCharacter.id;
  const baseMaximum=snapshot.activeCharacter.maxHp;
  const baseHp=snapshot.activeCharacter.hp;
  assert.equal(durableMaximums(adapter,characterId).source,baseMaximum);

  snapshot=await adapter.resolveAction(actions.increase,[characterId]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.activeCharacter.maxHp,baseMaximum+5);
  assert.equal(sceneMaximum(snapshot),baseMaximum+5);
  assert.deepEqual(durableMaximums(adapter,characterId),{source:baseMaximum,runtime:baseMaximum+5});
  assert.deepEqual(await restartedMaximum(characterStore),{maximum:baseMaximum+5,sourceMaximum:baseMaximum});

  snapshot=await adapter.undoLastResolution();
  assert.equal(snapshot.activeCharacter.maxHp,baseMaximum);
  assert.deepEqual(durableMaximums(adapter,characterId),{source:baseMaximum,runtime:undefined});
  assert.deepEqual(await restartedMaximum(characterStore),{maximum:baseMaximum,sourceMaximum:baseMaximum});

  snapshot=await adapter.resolveAction(actions.decrease,[characterId]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.activeCharacter.maxHp,baseMaximum-1);
  assert.equal(snapshot.activeCharacter.hp,Math.min(baseHp,baseMaximum-1));
  assert.deepEqual(durableMaximums(adapter,characterId),{source:baseMaximum,runtime:baseMaximum-1});
  snapshot=await adapter.undoLastResolution();
  assert.equal(snapshot.activeCharacter.maxHp,baseMaximum);
  assert.equal(snapshot.activeCharacter.hp,baseHp);
  assert.deepEqual(durableMaximums(adapter,characterId),{source:baseMaximum,runtime:undefined});
  return {baseMaximum,baseHp};
}

test("unknown installed hp.maximum.change preserves source/runtime authority, restart, Undo, and rename invariance",async()=>{
  assert.deepEqual(await executePortable("external.maximum-hp-original"),await executePortable("renamed.unrelated-maximum-hp"));
});

test("portable maximum HP converges through Host replay, Undo, and reconnect",async()=>{
  const prefix="external.connected-maximum-hp",sessionId="session.c9-family-l-maximum-hp";
  const host=new MockAdapter(),actions=await install(host,prefix);
  const hostActorId=(await host.getSnapshot()).activeCharacter.id;
  const baseMaximum=sceneMaximum(await host.getSnapshot());
  assert.ok(baseMaximum!==undefined);
  const hostState=connectedStateFor(host);
  hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const originalSend=tauriSessionTransport.send;
  const runHost=async(operation:()=>Promise<unknown>)=>{
    const wires:string[]=[];tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
    try { await operation(); } finally { tauriSessionTransport.send=originalSend; }
    const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;
    assert.ok(batch,JSON.stringify(wires));return batch!;
  };

  const client=new MockAdapter();await install(client,prefix);
  const clientState=connectedStateFor(client);clientState.mode="client";clientState.sessionId=sessionId;clientState.replica=new ClientSessionReplica(sessionId);

  const increaseBatch=await runHost(()=>host.resolveAction(actions.increase,[hostActorId]));
  assert.equal((await applyConnectedClientEvents(client,increaseBatch.events)).status,"applied");
  assert.equal(sceneMaximum(await host.getSnapshot()),baseMaximum+5);
  assert.equal(sceneMaximum(await client.getSnapshot()),baseMaximum+5);

  const undoBatch=await runHost(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  assert.equal(sceneMaximum(await host.getSnapshot()),baseMaximum);
  assert.equal(sceneMaximum(await client.getSnapshot()),baseMaximum);

  const reconnect=new MockAdapter();await install(reconnect,prefix);
  const reconnectState=connectedStateFor(reconnect);reconnectState.mode="client";reconnectState.sessionId=sessionId;reconnectState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostState.ledger!.eventsAfter(0))).status,"applied");
  assert.equal(sceneMaximum(await reconnect.getSnapshot()),baseMaximum);
});
