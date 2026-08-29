import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId, parseZoneMembershipCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import {
  registerAuthoritativeSpatialZoneMembershipProvider,
  submitAuthoritativeSpatialZoneMembershipFact,
} from "../../src/app/spatialZoneMembershipRuntimeAdapter";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

const ZONE=JSON.parse(readFileSync(new URL("../fixtures/play-contract/persistent-zone-trigger.json",import.meta.url),"utf8"));

function batches(wires:string[]) {
  return wires
    .map((wire)=>JSON.parse(wire) as {type:string;events?:ConnectedSessionEvent[]})
    .filter((wire):wire is {type:"event-batch";events:ConnectedSessionEvent[]}=>wire.type==="event-batch"&&Array.isArray(wire.events));
}

function connectClient(adapter:MockAdapter,sessionId:string) {
  const state=connectedStateFor(adapter);
  state.mode="client";
  state.sessionId=sessionId;
  state.replica=new ClientSessionReplica(sessionId);
}

async function installSpatialZone(adapter:MockAdapter,prefix:string,placementRef?:string) {
  const moduleId=`${prefix}.module`,contentId=`${prefix}.condition`,mechanicId=`${prefix}.zone`;
  const config=structuredClone(ZONE);
  config.id=mechanicId;
  const displayName=`Unknown Spatial Zone ${prefix}`;
  const json=JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:`Unknown spatial Zone module ${prefix}`,version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:contentId,category:"condition",
      presentation:{defaultLocale:"en",originalName:displayName,locales:{en:{name:displayName}}},
      mechanics:[{kind:"common-play",config}],
    }],
  });
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  registerAuthoritativeSpatialZoneMembershipProvider(adapter,placementRef?{
    placementRefForActivation:()=>placementRef,
  }:{});
  return installedCommonPlayActionId({
    catalogId:catalogQualifiedId(contentId,moduleId,"1"),mechanicId,entryPointId:"create-zone",
  });
}

async function captureHostBatch(operation:()=>Promise<unknown>) {
  const wires:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try { await operation(); }
  finally { tauriSessionTransport.send=originalSend; }
  const batch=batches(wires).at(-1);
  assert.ok(batch,JSON.stringify(wires));
  return batch;
}

function totalHp(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,actorId:string) {
  const entity=snapshot.scene.entities.find((candidate)=>candidate.id===actorId);
  assert.ok(entity);
  return entity.hp+entity.tempHp;
}

test("authoritative external spatial Zone membership converges through canonical connected events, reconnect, outside facts, and Undo",async()=>{
  const prefix="unknown-provider-spatial-zone",sessionId="session.common-play-spatial-zone";
  const placementRef="provider:unknown-grid-engine:zone-slot-17";
  const host=new MockAdapter();
  const createZone=await installSpatialZone(host,prefix,placementRef);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";
  hostConnected.sessionId=sessionId;
  hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const client=new MockAdapter();
  await installSpatialZone(client,prefix);
  connectClient(client,sessionId);

  const currentActorId=(await host.getSnapshot()).scene.currentActorId;
  assert.ok(currentActorId);
  const hpBefore=totalHp(await host.getSnapshot(),currentActorId);
  const createBatch=await captureHostBatch(()=>host.resolveAction(createZone,[currentActorId]));
  assert.equal((await applyConnectedClientEvents(client,createBatch.events)).status,"applied");

  let hostSnapshot=await host.getSnapshot();
  let hostRuntime=snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)!;
  const zone=hostRuntime.artifacts?.find((artifact)=>artifact.artifactKind==="zone");
  assert.ok(zone);
  assert.equal(zone.placementRef,placementRef,"provider-backed Zone activation must retain the opaque authoritative placement reference");
  const clientAfterCreate=await client.getSnapshot();
  assert.equal(snapshotAdapterTurnRuntimeState(client,clientAfterCreate.scene)!.artifacts?.find((artifact)=>artifact.id===zone.id)?.placementRef,placementRef);
  const membership=hostRuntime.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id);
  assert.equal(membership?.authority,"spatial");
  assert.ok(!Object.values(hostSnapshot.scene.actionsByActor).flat().some((action)=>parseZoneMembershipCommonPlayActionId(action.id)?.artifactId===zone.id),"spatial-authority Zone must not project manual enter/leave controls");

  const providerProvenance="provider:unknown-grid-engine:membership-fact";
  const factBatch=await captureHostBatch(()=>submitAuthoritativeSpatialZoneMembershipFact(host,{
    artifactId:zone.id,subjectId:currentActorId,present:true,provenance:providerProvenance,
  }));
  const resolution=factBatch.events.find((event)=>event.payload.kind==="resolution");
  assert.ok(resolution&&resolution.payload.kind==="resolution");
  assert.ok(resolution.payload.provenance.includes(providerProvenance));
  assert.ok(resolution.payload.resolutionEvents.some((event)=>event.stateChanges.some((change)=>change.kind==="zone-membership")));
  assert.equal((await applyConnectedClientEvents(client,factBatch.events)).status,"applied");

  hostSnapshot=await host.getSnapshot();
  let clientSnapshot=await client.getSnapshot();
  hostRuntime=snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)!;
  let clientRuntime=snapshotAdapterTurnRuntimeState(client,clientSnapshot.scene)!;
  assert.ok(hostRuntime.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.memberIds.includes(currentActorId));
  assert.ok(clientRuntime.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.memberIds.includes(currentActorId));
  assert.equal(totalHp(hostSnapshot,currentActorId),hpBefore-2,"zone.entered must run in the same authoritative spatial membership transaction");
  assert.equal(totalHp(clientSnapshot,currentActorId),hpBefore-2);
  assert.equal((await applyConnectedClientEvents(client,factBatch.events)).status,"duplicate");
  assert.equal(totalHp(await client.getSnapshot(),currentActorId),hpBefore-2);

  const reconnect=new MockAdapter();
  await installSpatialZone(reconnect,prefix);
  connectClient(reconnect,sessionId);
  const reconnectApplied=await applyConnectedClientEvents(reconnect,hostConnected.ledger!.eventsAfter(0));
  assert.equal(reconnectApplied.status,"applied",JSON.stringify(reconnectApplied));
  const reconnectSnapshot=await reconnect.getSnapshot();
  const reconnectRuntime=snapshotAdapterTurnRuntimeState(reconnect,reconnectSnapshot.scene)!;
  assert.equal(reconnectRuntime.artifacts?.find((artifact)=>artifact.id===zone.id)?.placementRef,placementRef);
  assert.equal(reconnectRuntime.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.authority,"spatial");
  assert.ok(reconnectRuntime.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.memberIds.includes(currentActorId));
  assert.equal(totalHp(reconnectSnapshot,currentActorId),hpBefore-2);

  const leaveBatch=await captureHostBatch(()=>submitAuthoritativeSpatialZoneMembershipFact(host,{
    artifactId:zone.id,subjectId:currentActorId,present:false,provenance:"provider:unknown-grid-engine:outside-fact",
  }));
  assert.equal((await applyConnectedClientEvents(client,leaveBatch.events)).status,"applied");
  hostSnapshot=await host.getSnapshot();
  clientSnapshot=await client.getSnapshot();
  hostRuntime=snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)!;
  clientRuntime=snapshotAdapterTurnRuntimeState(client,clientSnapshot.scene)!;
  assert.ok(!hostRuntime.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.memberIds.includes(currentActorId));
  assert.ok(!clientRuntime.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.memberIds.includes(currentActorId));

  const undoBatch=await captureHostBatch(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  hostSnapshot=await host.getSnapshot();
  clientSnapshot=await client.getSnapshot();
  hostRuntime=snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)!;
  clientRuntime=snapshotAdapterTurnRuntimeState(client,clientSnapshot.scene)!;
  assert.ok(hostRuntime.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.memberIds.includes(currentActorId),"Undo of authoritative outside fact must restore membership");
  assert.ok(clientRuntime.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.memberIds.includes(currentActorId));
  assert.equal(totalHp(hostSnapshot,currentActorId),hpBefore-2);
  assert.equal(totalHp(clientSnapshot,currentActorId),hpBefore-2);
});

async function spatialMembershipOutcome(prefix:string) {
  const adapter=new MockAdapter();
  const createZone=await installSpatialZone(adapter,prefix,`provider:${prefix}:opaque-zone`);
  const actorId=(await adapter.getSnapshot()).scene.currentActorId;
  assert.ok(actorId);
  const before=totalHp(await adapter.getSnapshot(),actorId);
  await adapter.resolveAction(createZone,[actorId]);
  let snapshot=await adapter.getSnapshot();
  const runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  const zone=runtime.artifacts?.find((artifact)=>artifact.artifactKind==="zone");
  assert.ok(zone);
  await submitAuthoritativeSpatialZoneMembershipFact(adapter,{
    artifactId:zone.id,subjectId:actorId,present:true,provenance:`provider:${prefix}:inside`,
  });
  snapshot=await adapter.getSnapshot();
  const after=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  return {
    damage:before-totalHp(snapshot,actorId),
    authority:after.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.authority,
    present:after.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.memberIds.includes(actorId),
    manualControls:Object.values(snapshot.scene.actionsByActor).flat().filter((action)=>parseZoneMembershipCommonPlayActionId(action.id)?.artifactId===zone.id).length,
  };
}

test("renaming external spatial Zone identities preserves provider-backed mechanics",async()=>{
  assert.deepEqual(
    await spatialMembershipOutcome("unknown-spatial-identity-a"),
    await spatialMembershipOutcome("completely-renamed-spatial-identity-b"),
  );
});
