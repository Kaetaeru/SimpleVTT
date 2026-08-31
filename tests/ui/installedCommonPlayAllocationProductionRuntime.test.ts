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

interface ProbeIds {
  moduleId:string;
  contentId:string;
  mechanicId:string;
  entryPointId:string;
}

const DEFAULT_IDS:ProbeIds={
  moduleId:"homebrew.family-f-allocation-probe",
  contentId:"option.external-family-f-allocation-probe",
  mechanicId:"external.unknown.family-f-allocation-probe",
  entryPointId:"distribute",
};

function probeIds(prefix:string):ProbeIds {
  return {
    moduleId:`${prefix}.module`,
    contentId:`${prefix}.content`,
    mechanicId:`${prefix}.mechanic`,
    entryPointId:"distribute",
  };
}

function payload(ids:ProbeIds=DEFAULT_IDS) {
  return JSON.stringify({
    schemaVersion:"0.1-draft",moduleId:ids.moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"External Allocation Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],content:[{
      id:ids.contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:"External Allocation Probe",locales:{en:{name:"External Allocation Probe",description:"Portable fixed-pool allocation probe"}}},
      mechanics:[{kind:"common-play",config:{
        schemaVersion:"0.2-draft",id:ids.mechanicId,entryPoints:[{
          id:ids.entryPointId,invocation:"manual",
          allocation:{units:{value:3},targets:{from:"targets",min:1,max:3},minimumPerTarget:1,maximumPerTarget:3,totalMustMatch:true},
          operations:[{kind:"economy.modify",bucket:"action.extra.non-magic",amount:{value:1}}],
        }],
      }}],
    }],
  });
}

function actionId(ids:ProbeIds=DEFAULT_IDS) {
  return installedCommonPlayActionId({
    catalogId:catalogQualifiedId(ids.contentId,ids.moduleId,"1"),mechanicId:ids.mechanicId,entryPointId:ids.entryPointId,
  });
}

async function install(adapter:MockAdapter,store:MemoryInstalledContentStore,ids:ProbeIds=DEFAULT_IDS) {
  setInstalledContentStoreForTests(adapter,store);
  const preview=await adapter.previewContentImport(payload(ids));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
}

async function ready(adapter:MockAdapter) {
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
}

const ALLOCATION_TARGETS=["combatant.goblin-a","combatant.goblin-a","combatant.goblin-b"];

test("unknown installed Common Play validates fixed-pool allocation before downstream production commit",async()=>{
  const store=new MemoryInstalledContentStore();
  const installer=new MockAdapter();
  await install(installer,store);

  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  await ready(adapter);

  await adapter.resolveAction(actionId(),["combatant.goblin-a","combatant.goblin-b"]);
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions,undefined,"under-allocation must not partially commit downstream operations");

  await adapter.resolveAction(actionId(),ALLOCATION_TARGETS);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.resolution?.actionId,actionId());
  assert.deepEqual(snapshot.resolution?.targetIds,["combatant.goblin-a","combatant.goblin-b"]);
  assert.match(snapshot.resolution?.compact??"",/분배 3/);
  assert.ok(snapshot.resolution?.detail.some((line)=>line.includes("combatant.goblin-a 2")&&line.includes("combatant.goblin-b 1")));
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.length,1);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions,undefined);
});

test("portable allocation semantics are invariant under external identity rename",async()=>{
  const execute=async(prefix:string)=>{
    const ids=probeIds(prefix);
    const adapter=new MockAdapter();
    await install(adapter,new MemoryInstalledContentStore(),ids);
    await ready(adapter);
    await adapter.resolveAction(actionId(ids),ALLOCATION_TARGETS);
    const snapshot=await adapter.getSnapshot();
    return {
      stage:snapshot.resolution?.stage,
      targetIds:snapshot.resolution?.targetIds,
      compact:snapshot.resolution?.compact?.replaceAll(prefix,"<renamed>"),
      extraActions:snapshot.scene.economyByActor["char.aelar"]?.extraActions?.length,
    };
  };
  assert.deepEqual(await execute("external-allocation-a"),await execute("totally-renamed-allocation-b"));
});

test("portable allocation remains executable after installed-content persistence rehydration",async()=>{
  const ids=probeIds("persisted-allocation");
  const store=new MemoryInstalledContentStore();
  const installer=new MockAdapter();
  await install(installer,store,ids);

  const restarted=new MockAdapter();
  setInstalledContentStoreForTests(restarted,store);
  await ready(restarted);
  await restarted.resolveAction(actionId(ids),ALLOCATION_TARGETS);
  let snapshot=await restarted.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.deepEqual(snapshot.resolution?.targetIds,["combatant.goblin-a","combatant.goblin-b"]);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.length,1);

  await restarted.undoLastResolution();
  snapshot=await restarted.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions,undefined);
});

test("portable allocation downstream commit converges once through Host Client event transport",async()=>{
  const ids=probeIds("connected-allocation");
  const sessionId="session.family-f-allocation";
  const host=new MockAdapter();
  await install(host,new MemoryInstalledContentStore(),ids);
  await ready(host);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";
  hostConnected.sessionId=sessionId;
  hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const wires:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try {
    await host.resolveAction(actionId(ids),ALLOCATION_TARGETS);
  } finally {
    tauriSessionTransport.send=originalSend;
  }
  const batches=wires.map((wire)=>JSON.parse(wire)).filter((wire)=>wire.type==="event-batch") as Array<{events:ConnectedSessionEvent[]}>;
  assert.equal(batches.length,1,JSON.stringify(wires));
  const hostSnapshot=await host.getSnapshot();
  assert.equal(hostSnapshot.scene.economyByActor["char.aelar"]?.extraActions?.length,1);

  const client=new MockAdapter();
  await install(client,new MemoryInstalledContentStore(),ids);
  await ready(client);
  const clientConnected=connectedStateFor(client);
  clientConnected.mode="client";
  clientConnected.sessionId=sessionId;
  clientConnected.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(client,batches[0].events)).status,"applied");
  assert.equal((await applyConnectedClientEvents(client,batches[0].events)).status,"duplicate");
  const clientSnapshot=await client.getSnapshot();
  assert.equal(clientSnapshot.scene.economyByActor["char.aelar"]?.extraActions?.length,1);
});
