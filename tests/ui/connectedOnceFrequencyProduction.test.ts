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
  const actionId=`${prefix}.action-mechanic`;
  return {
    moduleId,effectId,actionId,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Unknown once frequency proof",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],
      content:[
        {id:`${prefix}.feat`,category:"feat",presentation:{defaultLocale:"en",originalName:"Unknown Once Rider",locales:{en:{name:"Unknown Once Rider"}}},mechanics:[{kind:"common-play",config:{
          schemaVersion:"0.2-draft",id:effectId,
          entryPoints:[{id:"arm",invocation:"manual",operations:[{kind:"effect.apply",template:"rider",target:"actor"}]}],
          artifactTemplates:[{
            id:"rider",artifactKind:"effect",duration:{kind:"elapsed",amount:{value:60},unit:"seconds"},instancePolicy:"stack",
            rules:[{id:"once-ever",event:"damage.dealt",frequency:"once",operations:[
              {kind:"damage.apply",amount:{value:3},damageType:"force",target:"event.actor"},
            ]}],
            lifetime:{kind:"until-duration",onEnd:"destroy"},
          }],
        }}]},
        {id:`${prefix}.action`,category:"option",presentation:{defaultLocale:"en",originalName:"Unknown Damage Action",locales:{en:{name:"Unknown Damage Action"}}},mechanics:[{kind:"common-play",config:{
          schemaVersion:"0.2-draft",id:actionId,
          entryPoints:[{id:"strike",invocation:"manual",targeting:{from:"targets",min:1,max:1},operations:[
            {kind:"damage.apply",amount:{value:2},damageType:"force",target:"target"},
          ]}],
        }}]},
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
    strike:action(`${prefix}.action`,pack.actionId,"strike"),
  };
}

function totalHealth(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,id:string) {
  const entity=snapshot.scene.entities.find((candidate)=>candidate.id===id)!;
  return entity.hp+entity.tempHp;
}

function frequencyMarkers(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  const effect=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.effects[0];
  return Object.entries(effect?.metadata??{}).filter(([key])=>key.startsWith("commonPlay.frequency:"));
}

async function runIdentity(prefix:string) {
  const adapter=new MockAdapter();
  const actions=await install(adapter,prefix);
  await adapter.resolveAction(actions.arm,["char.aelar"]);
  const before=await adapter.getSnapshot();
  await adapter.resolveAction(actions.strike,["combatant.goblin-a"]);
  const first=await adapter.getSnapshot();
  await adapter.resolveAction(actions.strike,["combatant.goblin-a"]);
  const second=await adapter.getSnapshot();
  return {
    firstSourceDelta:totalHealth(before,"char.aelar")-totalHealth(first,"char.aelar"),
    firstTargetDelta:totalHealth(before,"combatant.goblin-a")-totalHealth(first,"combatant.goblin-a"),
    secondSourceDelta:totalHealth(before,"char.aelar")-totalHealth(second,"char.aelar"),
    secondTargetDelta:totalHealth(before,"combatant.goblin-a")-totalHealth(second,"combatant.goblin-a"),
    markerCount:frequencyMarkers(adapter,second).length,
    effectCount:snapshotAdapterTurnRuntimeState(adapter,second.scene)?.effects.length,
  };
}

async function captureBatch(operation:()=>Promise<unknown>) {
  const wires:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try { await operation(); }
  finally { tauriSessionTransport.send=originalSend; }
  const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;
  assert.ok(batch,JSON.stringify(wires));
  return batch;
}

test("once automatic frequency fires once while its persistent effect remains active",async()=>{
  const expected={firstSourceDelta:3,firstTargetDelta:2,secondSourceDelta:3,secondTargetDelta:4,markerCount:1,effectCount:1};
  assert.deepEqual(await runIdentity("unknown-once-a"),expected);
  assert.deepEqual(await runIdentity("fully-renamed-once-b"),expected);
});

test("once marker converges, reconnects, stays consumed across later resolutions, and restores through Undo",async()=>{
  const prefix="unknown-connected-once",sessionId="session.once-frequency";
  const host=new MockAdapter();
  const actions=await install(host,prefix);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";hostConnected.sessionId=sessionId;hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const armBatch=await captureBatch(()=>host.resolveAction(actions.arm,["char.aelar"]));
  const client=new MockAdapter();
  await install(client,prefix);
  const clientConnected=connectedStateFor(client);
  clientConnected.mode="client";clientConnected.sessionId=sessionId;clientConnected.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(client,armBatch.events)).status,"applied");
  const before=await host.getSnapshot();

  const firstBatch=await captureBatch(()=>host.resolveAction(actions.strike,["combatant.goblin-a"]));
  assert.equal((await applyConnectedClientEvents(client,firstBatch.events)).status,"applied");
  assert.equal((await applyConnectedClientEvents(client,firstBatch.events)).status,"duplicate");
  const first=await host.getSnapshot();
  const firstMarkers=frequencyMarkers(host,first);
  assert.equal(totalHealth(first,"char.aelar"),totalHealth(before,"char.aelar")-3);
  assert.equal(totalHealth(first,"combatant.goblin-a"),totalHealth(before,"combatant.goblin-a")-2);
  assert.equal(firstMarkers.length,1);

  const secondBatch=await captureBatch(()=>host.resolveAction(actions.strike,["combatant.goblin-a"]));
  assert.equal((await applyConnectedClientEvents(client,secondBatch.events)).status,"applied");
  let hostSnapshot=await host.getSnapshot(),clientSnapshot=await client.getSnapshot();
  assert.equal(totalHealth(hostSnapshot,"char.aelar"),totalHealth(first,"char.aelar"));
  assert.equal(totalHealth(hostSnapshot,"combatant.goblin-a"),totalHealth(before,"combatant.goblin-a")-4);
  assert.deepEqual(frequencyMarkers(host,hostSnapshot),firstMarkers);
  assert.deepEqual(frequencyMarkers(client,clientSnapshot),firstMarkers);

  const reconnect=new MockAdapter();
  await install(reconnect,prefix);
  const reconnectConnected=connectedStateFor(reconnect);
  reconnectConnected.mode="client";reconnectConnected.sessionId=sessionId;reconnectConnected.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  const reconnectSnapshot=await reconnect.getSnapshot();
  assert.equal(totalHealth(reconnectSnapshot,"char.aelar"),totalHealth(hostSnapshot,"char.aelar"));
  assert.equal(totalHealth(reconnectSnapshot,"combatant.goblin-a"),totalHealth(hostSnapshot,"combatant.goblin-a"));
  assert.deepEqual(frequencyMarkers(reconnect,reconnectSnapshot),firstMarkers);

  const undoBatch=await captureBatch(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  hostSnapshot=await host.getSnapshot();clientSnapshot=await client.getSnapshot();
  assert.equal(totalHealth(hostSnapshot,"char.aelar"),totalHealth(first,"char.aelar"));
  assert.equal(totalHealth(hostSnapshot,"combatant.goblin-a"),totalHealth(first,"combatant.goblin-a"));
  assert.deepEqual(frequencyMarkers(host,hostSnapshot),firstMarkers);
  assert.equal(totalHealth(clientSnapshot,"char.aelar"),totalHealth(hostSnapshot,"char.aelar"));
  assert.equal(totalHealth(clientSnapshot,"combatant.goblin-a"),totalHealth(hostSnapshot,"combatant.goblin-a"));
  assert.deepEqual(frequencyMarkers(client,clientSnapshot),firstMarkers);
});

test("once marker creation is reverted by connected event-native Undo",async()=>{
  const prefix="unknown-connected-once-undo",sessionId="session.once-frequency-undo";
  const host=new MockAdapter();
  const actions=await install(host,prefix);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";hostConnected.sessionId=sessionId;hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const armBatch=await captureBatch(()=>host.resolveAction(actions.arm,["char.aelar"]));
  const client=new MockAdapter();
  await install(client,prefix);
  const clientConnected=connectedStateFor(client);
  clientConnected.mode="client";clientConnected.sessionId=sessionId;clientConnected.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(client,armBatch.events)).status,"applied");
  const before=await host.getSnapshot();

  const firstBatch=await captureBatch(()=>host.resolveAction(actions.strike,["combatant.goblin-a"]));
  assert.equal((await applyConnectedClientEvents(client,firstBatch.events)).status,"applied");
  assert.equal(frequencyMarkers(host,await host.getSnapshot()).length,1);
  assert.equal(frequencyMarkers(client,await client.getSnapshot()).length,1);

  const undoBatch=await captureBatch(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  const hostSnapshot=await host.getSnapshot(),clientSnapshot=await client.getSnapshot();
  assert.equal(totalHealth(hostSnapshot,"char.aelar"),totalHealth(before,"char.aelar"));
  assert.equal(totalHealth(hostSnapshot,"combatant.goblin-a"),totalHealth(before,"combatant.goblin-a"));
  assert.equal(frequencyMarkers(host,hostSnapshot).length,0);
  assert.equal(totalHealth(clientSnapshot,"char.aelar"),totalHealth(hostSnapshot,"char.aelar"));
  assert.equal(totalHealth(clientSnapshot,"combatant.goblin-a"),totalHealth(hostSnapshot,"combatant.goblin-a"));
  assert.equal(frequencyMarkers(client,clientSnapshot).length,0);

  const reconnect=new MockAdapter();
  await install(reconnect,prefix);
  const reconnectConnected=connectedStateFor(reconnect);
  reconnectConnected.mode="client";reconnectConnected.sessionId=sessionId;reconnectConnected.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  const reconnectSnapshot=await reconnect.getSnapshot();
  assert.equal(totalHealth(reconnectSnapshot,"char.aelar"),totalHealth(hostSnapshot,"char.aelar"));
  assert.equal(totalHealth(reconnectSnapshot,"combatant.goblin-a"),totalHealth(hostSnapshot,"combatant.goblin-a"));
  assert.equal(frequencyMarkers(reconnect,reconnectSnapshot).length,0);
});

test("once frequency is scoped independently to each persistent source instance",async()=>{
  for(const prefix of ["unknown-source-once-a","fully-renamed-source-once-b"]) {
    const adapter=new MockAdapter();
    const actions=await install(adapter,prefix);
    await adapter.resolveAction(actions.arm,["char.aelar"]);
    await adapter.resolveAction(actions.arm,["char.aelar"]);
    const before=await adapter.getSnapshot();
    const armedEffects=snapshotAdapterTurnRuntimeState(adapter,before.scene)?.effects??[];
    assert.equal(armedEffects.length,2);

    await adapter.resolveAction(actions.strike,["combatant.goblin-a"]);
    const first=await adapter.getSnapshot();
    const firstEffects=snapshotAdapterTurnRuntimeState(adapter,first.scene)?.effects??[];
    assert.equal(totalHealth(before,"char.aelar")-totalHealth(first,"char.aelar"),6);
    assert.equal(totalHealth(before,"combatant.goblin-a")-totalHealth(first,"combatant.goblin-a"),2);
    assert.equal(firstEffects.length,2);
    assert.ok(firstEffects.every((effect)=>Object.entries(effect.metadata??{}).some(([key,value])=>key.startsWith("commonPlay.frequency:")&&value==="consumed")));

    await adapter.resolveAction(actions.strike,["combatant.goblin-a"]);
    const second=await adapter.getSnapshot();
    assert.equal(totalHealth(before,"char.aelar")-totalHealth(second,"char.aelar"),6);
    assert.equal(totalHealth(before,"combatant.goblin-a")-totalHealth(second,"combatant.goblin-a"),4);
  }
});
