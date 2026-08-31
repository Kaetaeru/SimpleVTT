import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { MemoryTurnRuntimeStateStore, setTurnRuntimeStateStoreForTests, snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

function packagePayload(prefix:string){
  const moduleId=`${prefix}.module`,contentId=`${prefix}.option`,mechanicId=`${prefix}.conditions`;
  return {moduleId,contentId,mechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Portable Condition Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],content:[{
      id:contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:"Portable Conditions",locales:{en:{name:"Portable Conditions"}}},
      mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[
        {id:"poison",invocation:"manual",operations:[{kind:"condition.apply",condition:"poisoned",target:"self"}]},
        {id:"exhaust",invocation:"manual",operations:[{kind:"condition.apply",condition:"exhaustion",target:"self"}]},
        {id:"recover",invocation:"manual",operations:[{kind:"condition.remove",condition:"exhaustion",target:"self"}]},
      ]}}],
    }],
  })};
}

async function install(
  adapter:MockAdapter,
  prefix:string,
  installedStore=new MemoryInstalledContentStore(),
  runtimeStore?:MemoryTurnRuntimeStateStore,
){
  const pack=packagePayload(prefix);
  setInstalledContentStoreForTests(adapter,installedStore);
  if(runtimeStore)setTurnRuntimeStateStoreForTests(adapter,runtimeStore);
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const action=(entryPointId:string)=>installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId,
  });
  return {pack,action};
}

function conditionCount(adapter:MockAdapter,conditionId:string){
  const internal=adapter as unknown as {scene:Awaited<ReturnType<MockAdapter["getSnapshot"]>>["scene"]};
  return (snapshotAdapterTurnRuntimeState(adapter,internal.scene)?.effects??[])
    .filter((effect)=>effect.targetId==="char.aelar"&&effect.conditionId===conditionId).length;
}

async function executePoison(prefix:string){
  const adapter=new MockAdapter(),{action}=await install(adapter,prefix);
  let snapshot=await adapter.resolveAction(action("poison"),["char.aelar"]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(conditionCount(adapter,"poisoned"),1);
  snapshot=await adapter.undoLastResolution();
  assert.equal(conditionCount(adapter,"poisoned"),0,JSON.stringify(snapshot.resolution));
}

test("unknown installed condition.apply is identity invariant and event-native Undo removes it",async()=>{
  await executePoison("external.conditions-original");
  await executePoison("completely.renamed-conditions");
});

test("portable condition stacking and remove survive a fresh offline adapter restart",async()=>{
  const prefix="external.conditions-restart";
  const installedStore=new MemoryInstalledContentStore(),runtimeStore=new MemoryTurnRuntimeStateStore();
  const first=new MockAdapter(),{action}=await install(first,prefix,installedStore,runtimeStore);
  await first.resolveAction(action("exhaust"),["char.aelar"]);
  await first.resolveAction(action("exhaust"),["char.aelar"]);
  assert.equal(conditionCount(first,"exhaustion"),2);

  const restarted=new MockAdapter();
  setInstalledContentStoreForTests(restarted,installedStore);
  setTurnRuntimeStateStoreForTests(restarted,runtimeStore);
  await restarted.startInitiative();
  await restarted.setCurrentActor("char.aelar");
  assert.equal(conditionCount(restarted,"exhaustion"),2);

  let snapshot=await restarted.resolveAction(action("recover"),["char.aelar"]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(conditionCount(restarted,"exhaustion"),1);
  snapshot=await restarted.undoLastResolution();
  assert.equal(conditionCount(restarted,"exhaustion"),2,JSON.stringify(snapshot.resolution));
});

test("portable condition state converges through connected replay, Undo, and fresh reconnect",async()=>{
  const prefix="external.conditions-connected",sessionId="session.c9-family-m-conditions";
  const host=new MockAdapter(),{action}=await install(host,prefix);
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

  const applyBatch=await runHost(()=>host.resolveAction(action("poison"),["char.aelar"]));
  assert.equal((await applyConnectedClientEvents(client,applyBatch.events)).status,"applied");
  assert.equal(conditionCount(host,"poisoned"),1);
  assert.equal(conditionCount(client,"poisoned"),1);

  const undoBatch=await runHost(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  assert.equal(conditionCount(host,"poisoned"),0);
  assert.equal(conditionCount(client,"poisoned"),0);

  const reconnect=new MockAdapter();await install(reconnect,prefix);
  const reconnectState=connectedStateFor(reconnect);reconnectState.mode="client";reconnectState.sessionId=sessionId;reconnectState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostState.ledger!.eventsAfter(0))).status,"applied");
  assert.equal(conditionCount(reconnect,"poisoned"),0);
});
