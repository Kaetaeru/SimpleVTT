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
  const effectId=`${prefix}.damage-dealt-effect`;
  const actionId=`${prefix}.damage-action`;
  const effect={
    schemaVersion:"0.2-draft",id:effectId,
    entryPoints:[{id:"arm",invocation:"manual",operations:[{kind:"effect.apply",template:"recoil",target:"actor"}]}],
    artifactTemplates:[{
      id:"recoil",artifactKind:"effect",duration:{kind:"durable"},instancePolicy:"stack",
      rules:[{id:"after-damage",event:"damage.dealt",frequency:"once",operations:[
        {kind:"damage.apply",amount:{value:3},damageType:"force",target:"event.actor"},
      ]}],
      lifetime:{kind:"until-event",event:"damage.dealt",onEnd:"destroy"},
    }],
  };
  const action={
    schemaVersion:"0.2-draft",id:actionId,
    entryPoints:[{id:"strike",invocation:"manual",targeting:{from:"targets",min:1,max:1},operations:[
      {kind:"damage.apply",amount:{value:2},damageType:"force",target:"target"},
    ]}],
  };
  return {
    moduleId,effectId,actionId,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Unknown automatic trigger module",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],
      content:[
        {id:`${prefix}.feat`,category:"feat",presentation:{defaultLocale:"en",originalName:"Unknown Damage Rider",locales:{en:{name:"Unknown Damage Rider"}}},mechanics:[{kind:"common-play",config:effect}]},
        {id:`${prefix}.action`,category:"option",presentation:{defaultLocale:"en",originalName:"Unknown Damage Action",locales:{en:{name:"Unknown Damage Action"}}},mechanics:[{kind:"common-play",config:action}]},
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

async function run(prefix:string) {
  const adapter=new MockAdapter();
  const actions=await install(adapter,prefix);
  await adapter.resolveAction(actions.arm,["char.aelar"]);
  const before=await adapter.getSnapshot();
  await adapter.resolveAction(actions.strike,["combatant.goblin-a"]);
  const after=await adapter.getSnapshot();
  return {
    sourceDelta:totalHealth(before,"char.aelar")-totalHealth(after,"char.aelar"),
    targetDelta:totalHealth(before,"combatant.goblin-a")-totalHealth(after,"combatant.goblin-a"),
    effects:snapshotAdapterTurnRuntimeState(adapter,after.scene)?.effects.length,
  };
}

test("damage.dealt automatic effect is identity-invariant through installed production",async()=>{
  assert.deepEqual(await run("unknown-damage-dealt-a"),{sourceDelta:3,targetDelta:2,effects:0});
  assert.deepEqual(await run("fully-renamed-damage-dealt-b"),{sourceDelta:3,targetDelta:2,effects:0});
});

test("damage.dealt trigger is atomic, connected, reconnectable, duplicate-idempotent, and undoable",async()=>{
  const prefix="unknown-connected-damage-dealt",sessionId="session.common-play-damage-dealt";
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

  const strikeBatch=await runHost(()=>host.resolveAction(actions.strike,["combatant.goblin-a"]));
  assert.equal((await applyConnectedClientEvents(client,strikeBatch.events)).status,"applied");
  assert.equal((await applyConnectedClientEvents(client,strikeBatch.events)).status,"duplicate");
  let hostSnapshot=await host.getSnapshot(),clientSnapshot=await client.getSnapshot();
  assert.equal(totalHealth(hostSnapshot,"char.aelar"),totalHealth(before,"char.aelar")-3);
  assert.equal(totalHealth(hostSnapshot,"combatant.goblin-a"),totalHealth(before,"combatant.goblin-a")-2);
  assert.equal(totalHealth(clientSnapshot,"char.aelar"),totalHealth(hostSnapshot,"char.aelar"));
  assert.equal(totalHealth(clientSnapshot,"combatant.goblin-a"),totalHealth(hostSnapshot,"combatant.goblin-a"));
  assert.equal(snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)?.effects.length,0);
  assert.equal(snapshotAdapterTurnRuntimeState(client,clientSnapshot.scene)?.effects.length,0);

  const reconnect=new MockAdapter();await install(reconnect,prefix);
  const reconnectConnected=connectedStateFor(reconnect);reconnectConnected.mode="client";reconnectConnected.sessionId=sessionId;reconnectConnected.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  const reconnectSnapshot=await reconnect.getSnapshot();
  assert.equal(totalHealth(reconnectSnapshot,"char.aelar"),totalHealth(hostSnapshot,"char.aelar"));
  assert.equal(totalHealth(reconnectSnapshot,"combatant.goblin-a"),totalHealth(hostSnapshot,"combatant.goblin-a"));
  assert.equal(snapshotAdapterTurnRuntimeState(reconnect,reconnectSnapshot.scene)?.effects.length,0);

  const undoBatch=await runHost(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  hostSnapshot=await host.getSnapshot();clientSnapshot=await client.getSnapshot();
  assert.equal(totalHealth(hostSnapshot,"char.aelar"),totalHealth(before,"char.aelar"));
  assert.equal(totalHealth(hostSnapshot,"combatant.goblin-a"),totalHealth(before,"combatant.goblin-a"));
  assert.equal(totalHealth(clientSnapshot,"char.aelar"),totalHealth(hostSnapshot,"char.aelar"));
  assert.equal(totalHealth(clientSnapshot,"combatant.goblin-a"),totalHealth(hostSnapshot,"combatant.goblin-a"));
  assert.equal(snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)?.effects.length,1);
  assert.equal(snapshotAdapterTurnRuntimeState(client,clientSnapshot.scene)?.effects.length,1);
});
