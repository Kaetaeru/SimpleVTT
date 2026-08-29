import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/installedContentRuntimeAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId, parseZoneMembershipCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import {
  registerInstalledCommonPlaySpatialZoneProvider,
  submitInstalledCommonPlaySpatialZoneMembership,
} from "../../src/app/installedCommonPlayRuntimeAdapter";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

const ZONE=JSON.parse(readFileSync(new URL("../fixtures/play-contract/persistent-zone-trigger.json",import.meta.url),"utf8"));

function packageFor(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.condition`;
  const definitionId=`${prefix}.zone`;
  const config={...structuredClone(ZONE),id:definitionId};
  const json=JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Unknown spatial Zone provider probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:contentId,category:"condition",
      presentation:{defaultLocale:"en",originalName:"Unknown Spatial Zone",locales:{en:{name:"Unknown Spatial Zone"}}},
      mechanics:[{kind:"common-play",config}],
    }],
  });
  const actionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(contentId,moduleId,"1"),mechanicId:definitionId,entryPointId:"create-zone",
  });
  return {json,definitionId,actionId};
}

async function install(adapter:MockAdapter,prefix:string) {
  const pack=packageFor(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.equal(preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),false,JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  return pack;
}

function runtime(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  return snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
}

function membershipFor(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,artifactId:string) {
  return runtime(adapter,snapshot).zoneMemberships?.find((entry)=>entry.artifactId===artifactId);
}

function hasManualMembershipControl(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  return Object.values(snapshot.scene.actionsByActor).flat().some((action)=>Boolean(parseZoneMembershipCommonPlayActionId(action.id)));
}

async function localOutcome(prefix:string) {
  const adapter=new MockAdapter();
  const pack=await install(adapter,prefix);
  registerInstalledCommonPlaySpatialZoneProvider(adapter,pack.definitionId);
  await adapter.resolveAction(pack.actionId,["char.aelar"]);
  let snapshot=await adapter.getSnapshot();
  const artifact=runtime(adapter,snapshot).artifacts?.find((entry)=>entry.artifactKind==="zone")!;
  const before=snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp;
  await submitInstalledCommonPlaySpatialZoneMembership(adapter,{
    artifactId:artifact.id,subjectId:"combatant.goblin-a",present:true,provenance:"authoritative-map-provider",
  });
  snapshot=await adapter.getSnapshot();
  return {
    authority:membershipFor(adapter,snapshot,artifact.id)?.authority,
    member:membershipFor(adapter,snapshot,artifact.id)?.memberIds.includes("combatant.goblin-a"),
    hpDelta:before-snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp,
    manualControls:hasManualMembershipControl(snapshot),
  };
}

test("renamed external spatial Zone identities preserve provider-driven mechanics",async()=>{
  const first=await localOutcome("unknown-spatial-zone-a");
  const renamed=await localOutcome("completely-renamed-spatial-zone-b");
  assert.deepEqual(first,{authority:"spatial",member:true,hpDelta:2,manualControls:false});
  assert.deepEqual(renamed,first);
});

test("authoritative spatial Zone membership converges through Host events, reconnect, duplicate replay, and Undo",async()=>{
  const prefix="unknown-connected-spatial-zone";
  const sessionId="session.common-play-spatial-zone";
  const host=new MockAdapter();
  const pack=await install(host,prefix);
  registerInstalledCommonPlaySpatialZoneProvider(host,pack.definitionId);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";
  hostConnected.sessionId=sessionId;
  hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const originalSend=tauriSessionTransport.send;
  const runHost=async(operation:()=>Promise<unknown>,expectBatch=true)=>{
    const wires:string[]=[];
    tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
    try { await operation(); }
    finally { tauriSessionTransport.send=originalSend; }
    const batches=wires.map((wire)=>JSON.parse(wire)).filter((wire)=>wire.type==="event-batch") as Array<{events:ConnectedSessionEvent[]}>;
    assert.equal(batches.length,expectBatch?1:0,JSON.stringify(wires));
    return batches[0];
  };

  const createBatch=await runHost(()=>host.resolveAction(pack.actionId,["char.aelar"]));
  let hostSnapshot=await host.getSnapshot();
  const artifact=runtime(host,hostSnapshot).artifacts?.find((entry)=>entry.artifactKind==="zone")!;
  assert.equal(membershipFor(host,hostSnapshot,artifact.id)?.authority,"spatial");
  assert.equal(hasManualMembershipControl(hostSnapshot),false,"spatial-authority Zones must not expose manual enter/leave controls");

  const client=new MockAdapter();
  await install(client,prefix);
  const clientConnected=connectedStateFor(client);
  clientConnected.mode="client";
  clientConnected.sessionId=sessionId;
  clientConnected.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(client,createBatch!.events)).status,"applied");
  let clientSnapshot=await client.getSnapshot();
  assert.equal(membershipFor(client,clientSnapshot,artifact.id)?.authority,"spatial");
  assert.equal(hasManualMembershipControl(clientSnapshot),false);

  const hpBefore=hostSnapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp;
  const enterBatch=await runHost(()=>submitInstalledCommonPlaySpatialZoneMembership(host,{
    artifactId:artifact.id,subjectId:"combatant.goblin-a",present:true,provenance:"authoritative-map-provider",
  }));
  assert.equal((await applyConnectedClientEvents(client,enterBatch!.events)).status,"applied");
  assert.equal((await applyConnectedClientEvents(client,enterBatch!.events)).status,"duplicate");
  hostSnapshot=await host.getSnapshot();
  clientSnapshot=await client.getSnapshot();
  assert.equal(hostSnapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp,hpBefore-2);
  assert.equal(clientSnapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp,hpBefore-2);
  assert.deepEqual(runtime(client,clientSnapshot).zoneMemberships,runtime(host,hostSnapshot).zoneMemberships);
  assert.ok(hostSnapshot.resolution?.provenance.includes("authoritative-map-provider"));

  const beforeDuplicate=structuredClone(runtime(host,hostSnapshot));
  await runHost(()=>submitInstalledCommonPlaySpatialZoneMembership(host,{
    artifactId:artifact.id,subjectId:"combatant.goblin-a",present:true,provenance:"authoritative-map-provider",
  }),false);
  hostSnapshot=await host.getSnapshot();
  assert.equal(hostSnapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp,hpBefore-2);
  assert.deepEqual(runtime(host,hostSnapshot).zoneMemberships,beforeDuplicate.zoneMemberships);
  assert.deepEqual(runtime(host,hostSnapshot).artifacts,beforeDuplicate.artifacts);

  const leaveBatch=await runHost(()=>submitInstalledCommonPlaySpatialZoneMembership(host,{
    artifactId:artifact.id,subjectId:"combatant.goblin-a",present:false,provenance:"authoritative-map-provider",
  }));
  assert.equal((await applyConnectedClientEvents(client,leaveBatch!.events)).status,"applied");
  hostSnapshot=await host.getSnapshot();
  clientSnapshot=await client.getSnapshot();
  assert.equal(membershipFor(host,hostSnapshot,artifact.id)?.memberIds.includes("combatant.goblin-a"),false);
  assert.deepEqual(runtime(client,clientSnapshot).zoneMemberships,runtime(host,hostSnapshot).zoneMemberships);

  const undoBatch=await runHost(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch!.events)).status,"applied");
  hostSnapshot=await host.getSnapshot();
  clientSnapshot=await client.getSnapshot();
  assert.equal(membershipFor(host,hostSnapshot,artifact.id)?.memberIds.includes("combatant.goblin-a"),true);
  assert.deepEqual(runtime(client,clientSnapshot).zoneMemberships,runtime(host,hostSnapshot).zoneMemberships);

  const reconnect=new MockAdapter();
  await install(reconnect,prefix);
  const reconnectState=connectedStateFor(reconnect);
  reconnectState.mode="client";
  reconnectState.sessionId=sessionId;
  reconnectState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  const reconnectSnapshot=await reconnect.getSnapshot();
  assert.equal(reconnectSnapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,hostSnapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp);
  assert.deepEqual(runtime(reconnect,reconnectSnapshot).zoneMemberships,runtime(host,hostSnapshot).zoneMemberships);
  assert.deepEqual(runtime(reconnect,reconnectSnapshot).artifacts,runtime(host,hostSnapshot).artifacts);
  assert.equal(hasManualMembershipControl(reconnectSnapshot),false);
});
