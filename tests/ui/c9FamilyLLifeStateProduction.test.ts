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

function packagePayload(prefix:string) {
  const moduleId=`${prefix}.module`,contentId=`${prefix}.option`,mechanicId=`${prefix}.life-state`;
  return { moduleId,contentId,mechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Portable Life State Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],content:[{
      id:contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:"Portable Life State",locales:{en:{name:"Portable Life State"}}},
      mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[{
        id:"down",invocation:"manual",operations:[{kind:"damage.apply",amount:{value:1},damageType:"force",target:"self"}],
      }]}}],
    }],
  })};
}

function seedOneHp(adapter:MockAdapter) {
  const internal=adapter as unknown as {
    activeCharacter:{id:string;hp:number;tempHp:number};
    scene:{entities:Array<{id:string;hp:number;tempHp:number}>};
  };
  internal.activeCharacter.hp=1;
  internal.activeCharacter.tempHp=0;
  const entity=internal.scene.entities.find((candidate)=>candidate.id===internal.activeCharacter.id)!;
  entity.hp=1;
  entity.tempHp=0;
}

async function install(adapter:MockAdapter,prefix:string) {
  seedOneHp(adapter);
  const pack=packagePayload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  return installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId:"down"});
}

function lifeState(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  const entity=snapshot.scene.entities.find((candidate)=>candidate.id===snapshot.activeCharacter.id)!;
  return {hp:entity.hp,tempHp:entity.tempHp,life:entity.runtimeLife};
}

function assertStandingAtOne(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  const state=lifeState(snapshot);
  assert.equal(state.hp,1);
  assert.equal(state.tempHp,0);
  assert.equal(state.life?.unconscious,false);
  assert.equal(state.life?.dead,false);
  assert.equal(state.life?.deathSaves.successes,0);
  assert.equal(state.life?.deathSaves.failures,0);
}

function assertDownAtZero(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  const state=lifeState(snapshot);
  assert.equal(state.hp,0);
  assert.equal(state.tempHp,0);
  assert.equal(state.life?.unconscious,true);
  assert.equal(state.life?.dead,false);
  assert.equal(state.life?.deathSaves.successes,0);
  assert.equal(state.life?.deathSaves.failures,0);
}

test("unknown installed damage drives zero-HP unconscious state through Host replay, Undo, and reconnect",async()=>{
  const prefix="external.family-l-life-state",sessionId="session.c9-family-l-life-state";
  const host=new MockAdapter(),action=await install(host,prefix);
  const hostActorId=(await host.getSnapshot()).activeCharacter.id;
  assertStandingAtOne(await host.getSnapshot());

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

  const downBatch=await runHost(()=>host.resolveAction(action,[hostActorId]));
  assert.equal((await host.getSnapshot()).resolution?.stage,"complete");
  assert.equal((await applyConnectedClientEvents(client,downBatch.events)).status,"applied");
  assertDownAtZero(await host.getSnapshot());
  assertDownAtZero(await client.getSnapshot());

  const undoBatch=await runHost(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  assertStandingAtOne(await host.getSnapshot());
  assertStandingAtOne(await client.getSnapshot());

  const reconnect=new MockAdapter();await install(reconnect,prefix);
  const reconnectState=connectedStateFor(reconnect);reconnectState.mode="client";reconnectState.sessionId=sessionId;reconnectState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostState.ledger!.eventsAfter(0))).status,"applied");
  assertStandingAtOne(await reconnect.getSnapshot());
});
