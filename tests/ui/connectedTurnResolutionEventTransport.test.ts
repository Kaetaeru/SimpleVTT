import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedTurnRoutingAdapter";
import "../../src/app/installedContentRuntimeAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId, parseZoneMembershipCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { snapshotAdapterTurnRuntimeState, turnRuntimeSessions } from "../../src/app/turnRuntimeSessionRegistry";

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

async function installTurnZone(adapter:MockAdapter,prefix:string) {
  const moduleId=`${prefix}.module`,contentId=`${prefix}.condition`,mechanicId=`${prefix}.zone`;
  const config=structuredClone(ZONE);
  config.id=mechanicId;
  config.artifactTemplates[0].rules.push({
    id:"turn-end",event:"zone.turn-end",frequency:"once-per-turn",
    operations:[{kind:"damage.apply",amount:{value:4},damageType:"force",target:"event.subject"}],
  });
  const json=JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Unknown turn Zone module",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:contentId,category:"condition",
      presentation:{defaultLocale:"en",originalName:"Unknown Turn Zone",locales:{en:{name:"Unknown Turn Zone"}}},
      mechanics:[{kind:"common-play",config}],
    }],
  });
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
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

test("connected turn projection carries and replays the exact authoritative lifecycle ResolutionEvents",async()=>{
  const host=new MockAdapter();
  await host.startInitiative();
  const state=connectedStateFor(host);
  const sessionId="session.turn-resolution-events";
  state.mode="host";
  state.sessionId=sessionId;
  state.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const wires:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try {
    await host.endTurn();
  } finally {
    tauriSessionTransport.send=originalSend;
  }

  const batch=batches(wires).at(-1);
  assert.ok(batch,JSON.stringify(wires));
  const transition=batch.events.find((event)=>event.payload.kind==="mode-transition");
  assert.ok(transition);
  assert.equal(transition.payload.kind,"mode-transition");
  const resolutionEvents=transition.payload.resolutionEvents??[];
  assert.ok(resolutionEvents.length>0,"turn-end mode transition must retain authoritative lifecycle events");
  assert.ok(
    resolutionEvents.some((event)=>event.stateChanges.some((change)=>change.kind==="turn-clock")),
    "turn lifecycle transport must include the canonical reversible clock change",
  );

  const hostSnapshot=await host.getSnapshot();
  assert.equal(transition.payload.round,hostSnapshot.scene.round);
  assert.equal(transition.payload.currentActorId,hostSnapshot.scene.currentActorId);

  const authoritativeHistory=state.ledger.eventsAfter(0);
  const client=new MockAdapter();
  await client.startInitiative();
  connectClient(client,sessionId);
  const clientApplied=await applyConnectedClientEvents(client,authoritativeHistory);
  assert.equal(clientApplied.status,"applied",JSON.stringify(clientApplied));
  const clientSnapshot=await client.getSnapshot();
  assert.equal(clientSnapshot.scene.round,hostSnapshot.scene.round);
  assert.equal(clientSnapshot.scene.currentActorId,hostSnapshot.scene.currentActorId);
  assert.deepEqual(
    snapshotAdapterTurnRuntimeState(client,clientSnapshot.scene)?.clock,
    snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)?.clock,
    "Client must apply the Host turn clock instead of only copying presentation fields",
  );
  assert.equal((await applyConnectedClientEvents(client,authoritativeHistory)).status,"duplicate");

  const reconnect=new MockAdapter();
  await reconnect.startInitiative();
  connectClient(reconnect,sessionId);
  const reconnectApplied=await applyConnectedClientEvents(reconnect,authoritativeHistory);
  assert.equal(reconnectApplied.status,"applied",JSON.stringify(reconnectApplied));
  const reconnectSnapshot=await reconnect.getSnapshot();
  assert.deepEqual(
    snapshotAdapterTurnRuntimeState(reconnect,reconnectSnapshot.scene)?.clock,
    snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)?.clock,
    "ordered reconnect replay must use the same canonical turn-event application path",
  );
});

test("arbitrary installed Zone turn-end and next turn-start converge through one connected transaction, reconnect, and Undo",async()=>{
  const prefix="unknown-connected-turn-zone",sessionId="session.common-play-zone-turn";
  const host=new MockAdapter();
  const createZone=await installTurnZone(host,prefix);
  const turn=turnRuntimeSessions.get(host);
  assert.ok(turn);
  const currentActorId=(await host.getSnapshot()).scene.currentActorId;
  const currentIndex=turn.initiativeOrder.indexOf(currentActorId);
  const nextActorId=turn.initiativeOrder[(currentIndex+1)%turn.initiativeOrder.length];
  assert.ok(nextActorId&&nextActorId!==currentActorId,JSON.stringify(turn.initiativeOrder));

  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";hostConnected.sessionId=sessionId;hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const client=new MockAdapter();
  await installTurnZone(client,prefix);
  connectClient(client,sessionId);

  const createBatch=await captureHostBatch(()=>host.resolveAction(createZone,[currentActorId]));
  assert.equal((await applyConnectedClientEvents(client,createBatch.events)).status,"applied");

  let enter=(await host.getSnapshot()).scene.actionsByActor[currentActorId]?.find((candidate)=>parseZoneMembershipCommonPlayActionId(candidate.id)?.present);
  assert.ok(enter);
  const enterCurrentBatch=await captureHostBatch(()=>host.resolveAction(enter!.id,[currentActorId]));
  assert.equal((await applyConnectedClientEvents(client,enterCurrentBatch.events)).status,"applied");
  enter=(await host.getSnapshot()).scene.actionsByActor[currentActorId]?.find((candidate)=>parseZoneMembershipCommonPlayActionId(candidate.id)?.present);
  assert.ok(enter?.eligibleTargetIds.includes(nextActorId));
  const enterNextBatch=await captureHostBatch(()=>host.resolveAction(enter!.id,[nextActorId]));
  assert.equal((await applyConnectedClientEvents(client,enterNextBatch.events)).status,"applied");

  const before=await host.getSnapshot();
  const currentBefore=before.scene.entities.find((entity)=>entity.id===currentActorId)!.hp;
  const nextBefore=before.scene.entities.find((entity)=>entity.id===nextActorId)!.hp;
  const runtimeBefore=snapshotAdapterTurnRuntimeState(host,before.scene)!;
  const zoneBefore=runtimeBefore.artifacts?.find((artifact)=>artifact.artifactKind==="zone")!;
  const metadataBefore=structuredClone(zoneBefore.metadata??{});

  const turnBatch=await captureHostBatch(()=>host.endTurn());
  const transition=turnBatch.events.find((event)=>event.payload.kind==="mode-transition");
  assert.ok(transition&&transition.payload.kind==="mode-transition");
  assert.ok((transition.payload.resolutionEvents??[]).some((event)=>event.stateChanges.some((change)=>change.kind==="turn-clock")));
  assert.equal((await applyConnectedClientEvents(client,turnBatch.events)).status,"applied");

  let hostAfter=await host.getSnapshot(),clientAfter=await client.getSnapshot();
  assert.equal(hostAfter.scene.entities.find((entity)=>entity.id===currentActorId)!.hp,currentBefore-4,"zone.turn-end must damage the ending actor exactly once");
  assert.equal(hostAfter.scene.entities.find((entity)=>entity.id===nextActorId)!.hp,nextBefore-3,"zone.turn-start must damage the next actor exactly once");
  assert.equal(clientAfter.scene.entities.find((entity)=>entity.id===currentActorId)!.hp,currentBefore-4);
  assert.equal(clientAfter.scene.entities.find((entity)=>entity.id===nextActorId)!.hp,nextBefore-3);
  const hostRuntimeAfter=snapshotAdapterTurnRuntimeState(host,hostAfter.scene)!;
  const clientRuntimeAfter=snapshotAdapterTurnRuntimeState(client,clientAfter.scene)!;
  const hostZoneAfter=hostRuntimeAfter.artifacts?.find((artifact)=>artifact.artifactKind==="zone")!;
  assert.equal(Object.keys(hostZoneAfter.metadata??{}).length,Object.keys(metadataBefore).length+2,"turn-end and turn-start must each consume one once-per-turn marker");
  assert.deepEqual(clientRuntimeAfter.clock,hostRuntimeAfter.clock);
  assert.deepEqual(clientRuntimeAfter.artifacts,hostRuntimeAfter.artifacts);
  assert.equal((await applyConnectedClientEvents(client,turnBatch.events)).status,"duplicate","duplicate network replay must not consume frequency or damage twice");

  const reconnect=new MockAdapter();
  await installTurnZone(reconnect,prefix);
  connectClient(reconnect,sessionId);
  const reconnectApplied=await applyConnectedClientEvents(reconnect,hostConnected.ledger!.eventsAfter(0));
  assert.equal(reconnectApplied.status,"applied",JSON.stringify(reconnectApplied));
  const reconnectAfter=await reconnect.getSnapshot();
  assert.equal(reconnectAfter.scene.entities.find((entity)=>entity.id===currentActorId)!.hp,currentBefore-4);
  assert.equal(reconnectAfter.scene.entities.find((entity)=>entity.id===nextActorId)!.hp,nextBefore-3);
  assert.deepEqual(snapshotAdapterTurnRuntimeState(reconnect,reconnectAfter.scene)?.artifacts,hostRuntimeAfter.artifacts);
  assert.deepEqual(snapshotAdapterTurnRuntimeState(reconnect,reconnectAfter.scene)?.clock,hostRuntimeAfter.clock);

  const undoBatch=await captureHostBatch(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  hostAfter=await host.getSnapshot();clientAfter=await client.getSnapshot();
  assert.equal(hostAfter.scene.entities.find((entity)=>entity.id===currentActorId)!.hp,currentBefore);
  assert.equal(hostAfter.scene.entities.find((entity)=>entity.id===nextActorId)!.hp,nextBefore);
  assert.equal(clientAfter.scene.entities.find((entity)=>entity.id===currentActorId)!.hp,currentBefore);
  assert.equal(clientAfter.scene.entities.find((entity)=>entity.id===nextActorId)!.hp,nextBefore);
  const hostRuntimeUndo=snapshotAdapterTurnRuntimeState(host,hostAfter.scene)!;
  const clientRuntimeUndo=snapshotAdapterTurnRuntimeState(client,clientAfter.scene)!;
  assert.deepEqual(hostRuntimeUndo.artifacts?.find((artifact)=>artifact.artifactKind==="zone")?.metadata??{},metadataBefore,"Undo must restore frequency markers");
  assert.deepEqual(clientRuntimeUndo.artifacts,hostRuntimeUndo.artifacts);
  assert.deepEqual(clientRuntimeUndo.clock,hostRuntimeUndo.clock);
});
