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
  submitAuthoritativeSpatialZoneStayFact,
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

async function installSpatialZone(adapter:MockAdapter,prefix:string) {
  const moduleId=`${prefix}.module`,contentId=`${prefix}.condition`,mechanicId=`${prefix}.zone`;
  const config=structuredClone(ZONE);
  config.id=mechanicId;
  config.artifactTemplates[0].rules.push({
    id:"stay",
    event:"zone.stay",
    frequency:"once-per-turn",
    operations:[
      {kind:"damage.apply",amount:{value:1},damageType:"force",target:"event.subject"},
      {kind:"effect.apply",template:"stay-effect",target:"event.subject"},
    ],
  });
  config.artifactTemplates.push({
    id:"stay-effect",
    artifactKind:"effect",
    duration:{kind:"durable"},
    rules:[{
      id:"consume-on-damage",
      event:"damage.taken",
      frequency:"once",
      operations:[{kind:"damage.apply",amount:{value:1},damageType:"psychic",target:"event.actor"}],
    }],
    lifetime:{kind:"until-event",event:"damage.taken",onEnd:"destroy"},
    instancePolicy:"stack",
  });
  const json=JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Unknown spatial Zone module",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:contentId,category:"condition",
      presentation:{defaultLocale:"en",originalName:"Unknown Spatial Zone",locales:{en:{name:"Unknown Spatial Zone"}}},
      mechanics:[{kind:"common-play",config}],
    }],
  });
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  registerAuthoritativeSpatialZoneMembershipProvider(adapter);
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

function hasStayEffect(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,actorId:string) {
  const runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  return runtime.effects.some((effect)=>effect.targetId===actorId&&effect.metadata?.commonPlayTemplateId==="stay-effect");
}

test("authoritative external spatial Zone membership converges through canonical connected events and Undo",async()=>{
  const prefix="unknown-provider-spatial-zone",sessionId="session.common-play-spatial-zone";
  const host=new MockAdapter();
  const createZone=await installSpatialZone(host,prefix);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";
  hostConnected.sessionId=sessionId;
  hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const client=new MockAdapter();
  await installSpatialZone(client,prefix);
  connectClient(client,sessionId);

  const currentActorId=(await host.getSnapshot()).scene.currentActorId;
  const hpBefore=totalHp(await host.getSnapshot(),currentActorId);
  const createBatch=await captureHostBatch(()=>host.resolveAction(createZone,[currentActorId]));
  assert.equal((await applyConnectedClientEvents(client,createBatch.events)).status,"applied");

  let hostSnapshot=await host.getSnapshot();
  let hostRuntime=snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)!;
  const zone=hostRuntime.artifacts?.find((artifact)=>artifact.artifactKind==="zone");
  assert.ok(zone);
  const membership=hostRuntime.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id);
  assert.equal(membership?.authority,"spatial","provider-backed Zone activation must record spatial authority");
  assert.ok(!Object.values(hostSnapshot.scene.actionsByActor).flat().some((action)=>parseZoneMembershipCommonPlayActionId(action.id)?.artifactId===zone.id),"spatial-authority Zone must not project manual enter/leave controls");

  const providerProvenance="provider:unknown-grid-engine:membership-fact";
  const factBatch=await captureHostBatch(()=>submitAuthoritativeSpatialZoneMembershipFact(host,{
    artifactId:zone.id,subjectId:currentActorId,present:true,provenance:providerProvenance,
  }));
  const resolution=factBatch.events.find((event)=>event.payload.kind==="resolution");
  assert.ok(resolution&&resolution.payload.kind==="resolution");
  assert.ok(resolution.payload.provenance.includes(providerProvenance),"provider provenance must survive the standard connected resolution payload");
  assert.ok(resolution.payload.resolutionEvents.some((event)=>event.stateChanges.some((change)=>change.kind==="zone-membership")),"spatial fact must commit canonical zone-membership state change");
  assert.equal((await applyConnectedClientEvents(client,factBatch.events)).status,"applied");

  hostSnapshot=await host.getSnapshot();
  let clientSnapshot=await client.getSnapshot();
  hostRuntime=snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)!;
  let clientRuntime=snapshotAdapterTurnRuntimeState(client,clientSnapshot.scene)!;
  assert.ok(hostRuntime.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.memberIds.includes(currentActorId));
  assert.ok(clientRuntime.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.memberIds.includes(currentActorId));
  assert.equal(totalHp(hostSnapshot,currentActorId),hpBefore-2,"zone.entered must run in the same authoritative spatial membership transaction");
  assert.equal(totalHp(clientSnapshot,currentActorId),hpBefore-2);
  assert.equal((await applyConnectedClientEvents(client,factBatch.events)).status,"duplicate","duplicate network replay must not reapply spatial membership or damage");
  clientSnapshot=await client.getSnapshot();
  assert.equal(totalHp(clientSnapshot,currentActorId),hpBefore-2);

  const reconnect=new MockAdapter();
  await installSpatialZone(reconnect,prefix);
  connectClient(reconnect,sessionId);
  const reconnectApplied=await applyConnectedClientEvents(reconnect,hostConnected.ledger!.eventsAfter(0));
  assert.equal(reconnectApplied.status,"applied",JSON.stringify(reconnectApplied));
  const reconnectSnapshot=await reconnect.getSnapshot();
  const reconnectRuntime=snapshotAdapterTurnRuntimeState(reconnect,reconnectSnapshot.scene)!;
  assert.equal(reconnectRuntime.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.authority,"spatial");
  assert.ok(reconnectRuntime.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.memberIds.includes(currentActorId));
  assert.equal(totalHp(reconnectSnapshot,currentActorId),hpBefore-2);

  const undoBatch=await captureHostBatch(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  hostSnapshot=await host.getSnapshot();
  clientSnapshot=await client.getSnapshot();
  hostRuntime=snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)!;
  clientRuntime=snapshotAdapterTurnRuntimeState(client,clientSnapshot.scene)!;
  assert.ok(!hostRuntime.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.memberIds.includes(currentActorId));
  assert.ok(!clientRuntime.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.memberIds.includes(currentActorId));
  assert.equal(totalHp(hostSnapshot,currentActorId),hpBefore);
  assert.equal(totalHp(clientSnapshot,currentActorId),hpBefore);
});

test("authoritative spatial Zone stay fact uses canonical frequency, effect lowering, reconnect, and Undo",async()=>{
  const prefix="unknown-provider-spatial-stay-zone",sessionId="session.common-play-spatial-stay-zone";
  const host=new MockAdapter();
  const createZone=await installSpatialZone(host,prefix);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";
  hostConnected.sessionId=sessionId;
  hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const client=new MockAdapter();
  await installSpatialZone(client,prefix);
  connectClient(client,sessionId);

  const currentActorId=(await host.getSnapshot()).scene.currentActorId;
  const createBatch=await captureHostBatch(()=>host.resolveAction(createZone,[currentActorId]));
  assert.equal((await applyConnectedClientEvents(client,createBatch.events)).status,"applied");
  let hostSnapshot=await host.getSnapshot();
  const hostRuntime=snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)!;
  const zone=hostRuntime.artifacts?.find((artifact)=>artifact.artifactKind==="zone");
  assert.ok(zone);

  const membershipBatch=await captureHostBatch(()=>submitAuthoritativeSpatialZoneMembershipFact(host,{
    artifactId:zone.id,subjectId:currentActorId,present:true,provenance:"provider:unknown-grid-engine:enter",
  }));
  assert.equal((await applyConnectedClientEvents(client,membershipBatch.events)).status,"applied");
  const hpAfterEnter=totalHp(await host.getSnapshot(),currentActorId);

  const stayProvenance="provider:unknown-grid-engine:stay";
  const stayBatch=await captureHostBatch(()=>submitAuthoritativeSpatialZoneStayFact(host,{
    artifactId:zone.id,subjectId:currentActorId,provenance:stayProvenance,
  }));
  const stayResolution=stayBatch.events.find((event)=>event.payload.kind==="resolution");
  assert.ok(stayResolution&&stayResolution.payload.kind==="resolution");
  assert.ok(stayResolution.payload.provenance.includes(stayProvenance));
  assert.ok(stayResolution.payload.resolutionEvents.some((event)=>event.stateChanges.some((change)=>change.kind==="hp")),"zone.stay must use canonical damage StateChanges");
  assert.ok(stayResolution.payload.resolutionEvents.some((event)=>event.stateChanges.some((change)=>change.kind==="effect"&&change.operation==="added")),"zone.stay effect.apply must use canonical Effect StateChanges");
  assert.ok(!stayResolution.payload.resolutionEvents.some((event)=>event.stateChanges.some((change)=>change.kind==="zone-membership")),"zone.stay must not mutate membership");
  assert.equal((await applyConnectedClientEvents(client,stayBatch.events)).status,"applied");

  hostSnapshot=await host.getSnapshot();
  let clientSnapshot=await client.getSnapshot();
  assert.equal(totalHp(hostSnapshot,currentActorId),hpAfterEnter-1);
  assert.equal(totalHp(clientSnapshot,currentActorId),hpAfterEnter-1);
  assert.ok(hasStayEffect(host,hostSnapshot,currentActorId));
  assert.ok(hasStayEffect(client,clientSnapshot,currentActorId));
  assert.equal((await applyConnectedClientEvents(client,stayBatch.events)).status,"duplicate","duplicate connected replay must not reapply zone.stay");

  await submitAuthoritativeSpatialZoneStayFact(host,{
    artifactId:zone.id,subjectId:currentActorId,provenance:"provider:unknown-grid-engine:stay-repeat",
  });
  hostSnapshot=await host.getSnapshot();
  assert.equal(totalHp(hostSnapshot,currentActorId),hpAfterEnter-1,"once-per-turn stay must not fire twice from repeated provider facts");
  assert.equal(snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)!.effects.filter((effect)=>effect.metadata?.commonPlayTemplateId==="stay-effect").length,1,"once-per-turn stay must not apply the effect twice");

  const reconnect=new MockAdapter();
  await installSpatialZone(reconnect,prefix);
  connectClient(reconnect,sessionId);
  const reconnectApplied=await applyConnectedClientEvents(reconnect,hostConnected.ledger!.eventsAfter(0));
  assert.equal(reconnectApplied.status,"applied",JSON.stringify(reconnectApplied));
  const reconnectSnapshot=await reconnect.getSnapshot();
  const reconnectRuntime=snapshotAdapterTurnRuntimeState(reconnect,reconnectSnapshot.scene)!;
  assert.ok(reconnectRuntime.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.memberIds.includes(currentActorId));
  assert.equal(totalHp(reconnectSnapshot,currentActorId),hpAfterEnter-1);
  assert.ok(hasStayEffect(reconnect,reconnectSnapshot,currentActorId),"fresh reconnect must reconstruct the Zone-applied effect from canonical events");

  const undoBatch=await captureHostBatch(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  hostSnapshot=await host.getSnapshot();
  clientSnapshot=await client.getSnapshot();
  const afterUndoRuntime=snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)!;
  assert.ok(afterUndoRuntime.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.memberIds.includes(currentActorId),"Undoing stay must preserve membership");
  assert.equal(totalHp(hostSnapshot,currentActorId),hpAfterEnter);
  assert.equal(totalHp(clientSnapshot,currentActorId),hpAfterEnter);
  assert.ok(!hasStayEffect(host,hostSnapshot,currentActorId),"Undo must remove the Zone-applied effect");
  assert.ok(!hasStayEffect(client,clientSnapshot,currentActorId));
});
