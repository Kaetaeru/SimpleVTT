import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

function packagePayload(prefix:string){
  const moduleId=`${prefix}.module`,contentId=`${prefix}.option`,mechanicId=`${prefix}.temp-hp`;
  return {moduleId,contentId,mechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Portable Temporary HP Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],content:[{
      id:contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:"Portable Temporary HP",locales:{en:{name:"Portable Temporary HP"}}},
      mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[{
        id:"grant",invocation:"manual",operations:[{kind:"temp-hp.grant",amount:{value:7},target:"self",choice:"take-new"}],
      }]}}],
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
  return installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId:"grant"});
}

function temporaryHp(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>){
  return snapshot.scene.entities.find((entity)=>entity.id===snapshot.activeCharacter.id)?.tempHp;
}

async function execute(prefix:string){
  const adapter=new MockAdapter(),action=await install(adapter,prefix);
  let snapshot=await adapter.getSnapshot();
  const before=temporaryHp(snapshot)??0;
  assert.equal(before,5);
  snapshot=await adapter.resolveAction(action,[snapshot.activeCharacter.id]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(temporaryHp(snapshot),7);
  snapshot=await adapter.undoLastResolution();
  assert.equal(temporaryHp(snapshot),before);
  return 7;
}

test("unknown installed temp-hp.grant lowers through Resolver Temporary HP with rename invariance and Undo",async()=>{
  assert.equal(await execute("external.temp-hp-original"),await execute("completely.renamed-temp-hp"));
});

test("portable Temporary HP converges through Host replay, Undo, and reconnect",async()=>{
  const prefix="external.connected-temp-hp",sessionId="session.c9-family-l-temp-hp";
  const host=new MockAdapter(),action=await install(host,prefix);
  const hostActorId=(await host.getSnapshot()).activeCharacter.id;
  assert.equal(temporaryHp(await host.getSnapshot()),5);
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

  const grantBatch=await runHost(()=>host.resolveAction(action,[hostActorId]));
  assert.equal((await applyConnectedClientEvents(client,grantBatch.events)).status,"applied");
  assert.equal(temporaryHp(await host.getSnapshot()),7);
  assert.equal(temporaryHp(await client.getSnapshot()),7);

  const undoBatch=await runHost(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  assert.equal(temporaryHp(await host.getSnapshot()),5);
  assert.equal(temporaryHp(await client.getSnapshot()),5);

  const reconnect=new MockAdapter();await install(reconnect,prefix);
  const reconnectState=connectedStateFor(reconnect);reconnectState.mode="client";reconnectState.sessionId=sessionId;reconnectState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostState.ledger!.eventsAfter(0))).status,"applied");
  assert.equal(temporaryHp(await reconnect.getSnapshot()),5);
});
