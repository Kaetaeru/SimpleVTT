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
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

function packageJson(prefix:string) {
  const moduleId=`${prefix}.module`;
  const effectId=`${prefix}.effect`;
  const actionId=`${prefix}.action`;
  const effect={
    schemaVersion:"0.2-draft",id:effectId,
    entryPoints:[{id:"arm",invocation:"manual",operations:[{kind:"effect.apply",template:"rider",target:"actor"}]}],
    artifactTemplates:[{
      id:"rider",artifactKind:"effect",duration:{kind:"elapsed",amount:{value:60},unit:"seconds"},instancePolicy:"stack",
      rules:[{id:"per-resolution",event:"damage.dealt",frequency:"once-per-resolution",operations:[
        {kind:"damage.apply",amount:{value:3},damageType:"force",target:"event.actor"},
      ]}],
      lifetime:{kind:"until-duration",onEnd:"destroy"},
    }],
  };
  const action={
    schemaVersion:"0.2-draft",id:actionId,
    entryPoints:[{id:"double-strike",invocation:"manual",targeting:{from:"targets",min:1,max:1},operations:[
      {kind:"damage.apply",amount:{value:2},damageType:"force",target:"target"},
      {kind:"damage.apply",amount:{value:2},damageType:"force",target:"target"},
    ]}],
  };
  return {
    moduleId,effectId,actionId,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Unknown per-resolution trigger module",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],
      content:[
        {id:`${prefix}.feat`,category:"feat",presentation:{defaultLocale:"en",originalName:"Unknown Resolution Rider",locales:{en:{name:"Unknown Resolution Rider"}}},mechanics:[{kind:"common-play",config:effect}]},
        {id:`${prefix}.option`,category:"option",presentation:{defaultLocale:"en",originalName:"Unknown Double Strike",locales:{en:{name:"Unknown Double Strike"}}},mechanics:[{kind:"common-play",config:action}]},
      ],
    }),
  };
}

async function install(adapter:MockAdapter,prefix:string) {
  const pack=packageJson(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const action=(contentId:string,mechanicId:string,entryPointId:string)=>installedCommonPlayActionId({
    catalogId:catalogQualifiedId(contentId,pack.moduleId,"1"),mechanicId,entryPointId,
  });
  return {
    arm:action(`${prefix}.feat`,pack.effectId,"arm"),
    strike:action(`${prefix}.option`,pack.actionId,"double-strike"),
  };
}

function health(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,id:string) {
  const entity=snapshot.scene.entities.find((candidate)=>candidate.id===id)!;
  return entity.hp+entity.tempHp;
}

function marker(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  const effect=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.effects[0];
  return Object.entries(effect?.metadata??{}).find(([key])=>key.startsWith("commonPlay.frequency:"));
}

async function runIdentity(prefix:string) {
  const adapter=new MockAdapter();
  const actions=await install(adapter,prefix);
  await adapter.resolveAction(actions.arm,["char.aelar"]);
  const before=await adapter.getSnapshot();
  await adapter.resolveAction(actions.strike,["combatant.goblin-a"]);
  const first=await adapter.getSnapshot();
  const firstMarker=marker(adapter,first);
  await adapter.resolveAction(actions.strike,["combatant.goblin-a"]);
  const second=await adapter.getSnapshot();
  const secondMarker=marker(adapter,second);
  return {
    firstSourceDelta:health(before,"char.aelar")-health(first,"char.aelar"),
    firstTargetDelta:health(before,"combatant.goblin-a")-health(first,"combatant.goblin-a"),
    secondSourceDelta:health(before,"char.aelar")-health(second,"char.aelar"),
    secondTargetDelta:health(before,"combatant.goblin-a")-health(second,"combatant.goblin-a"),
    markerChanged:firstMarker?.[1]!==secondMarker?.[1],
    markerCount:secondMarker?1:0,
  };
}

test("once-per-resolution trigger fires once inside one resolution and re-arms for the next resolution independent of identity",async()=>{
  const expected={firstSourceDelta:3,firstTargetDelta:4,secondSourceDelta:6,secondTargetDelta:8,markerChanged:true,markerCount:1};
  assert.deepEqual(await runIdentity("unknown-per-resolution-a"),expected);
  assert.deepEqual(await runIdentity("fully-renamed-per-resolution-b"),expected);
});

test("once-per-resolution marker converges, reconnects, deduplicates, and restores through event-native Undo",async()=>{
  const prefix="unknown-connected-per-resolution",sessionId="session.common-play-per-resolution";
  const host=new MockAdapter();
  const actions=await install(host,prefix);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";hostConnected.sessionId=sessionId;hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const originalSend=tauriSessionTransport.send;
  const runHost=async(operation:()=>Promise<unknown>)=>{
    const wires:string[]=[];tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
    try { await operation(); } finally { tauriSessionTransport.send=originalSend; }
    const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;
    assert.ok(batch,JSON.stringify(wires));
    return batch;
  };

  const armBatch=await runHost(()=>host.resolveAction(actions.arm,["char.aelar"]));
  const client=new MockAdapter();await install(client,prefix);
  const clientConnected=connectedStateFor(client);clientConnected.mode="client";clientConnected.sessionId=sessionId;clientConnected.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(client,armBatch.events)).status,"applied");
  const before=await host.getSnapshot();

  const firstBatch=await runHost(()=>host.resolveAction(actions.strike,["combatant.goblin-a"]));
  assert.equal((await applyConnectedClientEvents(client,firstBatch.events)).status,"applied");
  let hostSnapshot=await host.getSnapshot(),clientSnapshot=await client.getSnapshot();
  const firstMarker=marker(host,hostSnapshot);
  assert.equal(health(hostSnapshot,"char.aelar"),health(before,"char.aelar")-3);
  assert.equal(health(hostSnapshot,"combatant.goblin-a"),health(before,"combatant.goblin-a")-4);
  assert.deepEqual(marker(client,clientSnapshot),firstMarker);

  const secondBatch=await runHost(()=>host.resolveAction(actions.strike,["combatant.goblin-a"]));
  assert.equal((await applyConnectedClientEvents(client,secondBatch.events)).status,"applied");
  assert.equal((await applyConnectedClientEvents(client,secondBatch.events)).status,"duplicate");
  hostSnapshot=await host.getSnapshot();clientSnapshot=await client.getSnapshot();
  const secondMarker=marker(host,hostSnapshot);
  assert.notEqual(secondMarker?.[1],firstMarker?.[1]);
  assert.equal(health(hostSnapshot,"char.aelar"),health(before,"char.aelar")-6);
  assert.equal(health(hostSnapshot,"combatant.goblin-a"),health(before,"combatant.goblin-a")-8);
  assert.equal(health(clientSnapshot,"char.aelar"),health(hostSnapshot,"char.aelar"));
  assert.deepEqual(marker(client,clientSnapshot),secondMarker);

  const reconnect=new MockAdapter();await install(reconnect,prefix);
  const reconnectConnected=connectedStateFor(reconnect);reconnectConnected.mode="client";reconnectConnected.sessionId=sessionId;reconnectConnected.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  const reconnectSnapshot=await reconnect.getSnapshot();
  assert.equal(health(reconnectSnapshot,"char.aelar"),health(hostSnapshot,"char.aelar"));
  assert.equal(health(reconnectSnapshot,"combatant.goblin-a"),health(hostSnapshot,"combatant.goblin-a"));
  assert.deepEqual(marker(reconnect,reconnectSnapshot),secondMarker);

  const undoBatch=await runHost(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  hostSnapshot=await host.getSnapshot();clientSnapshot=await client.getSnapshot();
  assert.equal(health(hostSnapshot,"char.aelar"),health(before,"char.aelar")-3);
  assert.equal(health(hostSnapshot,"combatant.goblin-a"),health(before,"combatant.goblin-a")-4);
  assert.deepEqual(marker(host,hostSnapshot),firstMarker);
  assert.equal(health(clientSnapshot,"char.aelar"),health(hostSnapshot,"char.aelar"));
  assert.deepEqual(marker(client,clientSnapshot),firstMarker);
});
