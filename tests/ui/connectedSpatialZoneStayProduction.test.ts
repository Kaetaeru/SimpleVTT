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
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
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

async function installSpatialStayZone(adapter:MockAdapter,prefix:string) {
  const moduleId=`${prefix}.module`,contentId=`${prefix}.condition`,mechanicId=`${prefix}.zone`;
  const config=structuredClone(ZONE);
  config.id=mechanicId;
  config.artifactTemplates[0].rules.push({
    id:"stay",
    event:"zone.stay",
    frequency:"once-per-turn",
    operations:[{
      kind:"damage.apply",
      amount:{value:1},
      damageType:"psychic",
      target:"event.subject",
    }],
  });
  const displayName=`Unknown Spatial Stay Zone ${prefix}`;
  const json=JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:`Unknown spatial stay Zone module ${prefix}`,version:"1",license:"CC0",srdDerived:false},
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
  registerAuthoritativeSpatialZoneMembershipProvider(adapter,{});
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

test("authoritative spatial Zone stay converges through canonical events, reconnect, duplicate replay, and Undo",async()=>{
  const prefix="unknown-provider-spatial-stay",sessionId="session.common-play-spatial-zone-stay";
  const host=new MockAdapter();
  const createZone=await installSpatialStayZone(host,prefix);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";
  hostConnected.sessionId=sessionId;
  hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const client=new MockAdapter();
  await installSpatialStayZone(client,prefix);
  connectClient(client,sessionId);

  const actorId=(await host.getSnapshot()).scene.currentActorId;
  assert.ok(actorId);
  const createBatch=await captureHostBatch(()=>host.resolveAction(createZone,[actorId]));
  assert.equal((await applyConnectedClientEvents(client,createBatch.events)).status,"applied");

  let runtime=snapshotAdapterTurnRuntimeState(host,(await host.getSnapshot()).scene)!;
  const zone=runtime.artifacts?.find((artifact)=>artifact.artifactKind==="zone");
  assert.ok(zone);
  const enterBatch=await captureHostBatch(()=>submitAuthoritativeSpatialZoneMembershipFact(host,{
    artifactId:zone.id,subjectId:actorId,present:true,provenance:"provider:unknown-grid-engine:inside",
  }));
  assert.equal((await applyConnectedClientEvents(client,enterBatch.events)).status,"applied");
  const hpBeforeStay=totalHp(await host.getSnapshot(),actorId);

  const stayProvenance="provider:unknown-grid-engine:stay";
  const stayBatch=await captureHostBatch(()=>submitAuthoritativeSpatialZoneStayFact(host,{
    artifactId:zone.id,subjectId:actorId,provenance:stayProvenance,
  }));
  const stayResolution=stayBatch.events.find((event)=>event.payload.kind==="resolution");
  assert.ok(stayResolution&&stayResolution.payload.kind==="resolution");
  assert.ok(stayResolution.payload.provenance.includes(stayProvenance));
  assert.equal((await applyConnectedClientEvents(client,stayBatch.events)).status,"applied");

  let hostSnapshot=await host.getSnapshot();
  let clientSnapshot=await client.getSnapshot();
  assert.equal(totalHp(hostSnapshot,actorId),hpBeforeStay-1);
  assert.equal(totalHp(clientSnapshot,actorId),hpBeforeStay-1);
  runtime=snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)!;
  assert.ok(runtime.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.memberIds.includes(actorId),"stay must not change membership");

  assert.equal((await applyConnectedClientEvents(client,stayBatch.events)).status,"duplicate");
  assert.equal(totalHp(await client.getSnapshot(),actorId),hpBeforeStay-1);

  const reconnect=new MockAdapter();
  await installSpatialStayZone(reconnect,prefix);
  connectClient(reconnect,sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  const reconnectSnapshot=await reconnect.getSnapshot();
  assert.equal(totalHp(reconnectSnapshot,actorId),hpBeforeStay-1);
  assert.ok(snapshotAdapterTurnRuntimeState(reconnect,reconnectSnapshot.scene)!.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.memberIds.includes(actorId));

  const undoBatch=await captureHostBatch(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  hostSnapshot=await host.getSnapshot();
  clientSnapshot=await client.getSnapshot();
  assert.equal(totalHp(hostSnapshot,actorId),hpBeforeStay);
  assert.equal(totalHp(clientSnapshot,actorId),hpBeforeStay);
  assert.ok(snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)!.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.memberIds.includes(actorId));
  assert.ok(snapshotAdapterTurnRuntimeState(client,clientSnapshot.scene)!.zoneMemberships?.find((candidate)=>candidate.artifactId===zone.id)?.memberIds.includes(actorId));
});
