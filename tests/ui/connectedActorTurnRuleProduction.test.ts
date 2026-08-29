import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/connectedTurnRoutingAdapter";
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
  const actorRulesId=`${prefix}.actor-rules`;
  const actorContentId=`${prefix}.actor-rules-content`;
  const creatorId=`${prefix}.creator`;
  const creatorContentId=`${prefix}.creator-content`;
  const summonId=`${prefix}.summoned`;
  const resourceId=`${prefix}.charge`;
  const actorActionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(actorContentId,moduleId,"1"),mechanicId:actorRulesId,entryPointId:"use-charge",
  });
  const actorRules={
    schemaVersion:"0.2-draft",id:actorRulesId,
    entryPoints:[{id:"use-charge",invocation:"manual",operations:[
      {kind:"resource.change",resource:resourceId,amount:{value:-1},target:"actor"},
    ]}],
    rules:[
      {id:"turn-refresh",event:"turn-start",frequency:"once-per-turn",operations:[
        {kind:"resource.recharge",resource:resourceId,die:{sides:6},succeedsOn:{minimum:1,maximum:6}},
      ]},
      {id:"turn-spend",event:"turn-end",frequency:"once-per-turn",operations:[
        {kind:"resource.change",resource:resourceId,amount:{value:-1},target:"actor"},
      ]},
    ],
  };
  const creator={
    schemaVersion:"0.2-draft",id:creatorId,
    entryPoints:[{id:"summon",invocation:"manual",operations:[{kind:"artifact.spawn",template:"summon"}]}],
    artifactTemplates:[{
      id:"summon",artifactKind:"actor",duration:{kind:"durable"},lifetime:{kind:"durable"},
      initialState:{
        combatantId:summonId,statDefinitionId:`${prefix}.stat`,ownerId:"actor",controllerId:"actor",side:"ally",initiative:"independent",
        properties:{"presentation.name":"Unknown Turn Actor","defense.ac":13,"hp.maximum":10,"movement.walk":30,initiative:16},
        actionDefinitionIds:[actorActionId],resources:[{id:resourceId,current:0,maximum:1}],
      },
    }],
  };
  return {
    moduleId,actorRulesId,actorContentId,creatorId,creatorContentId,summonId,resourceId,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Unknown actor turn trigger module",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],
      content:[
        {id:actorContentId,category:"option",presentation:{defaultLocale:"en",originalName:"Unknown Turn Refresh",locales:{en:{name:"Unknown Turn Refresh"}}},mechanics:[{kind:"common-play",config:actorRules}]},
        {id:creatorContentId,category:"option",presentation:{defaultLocale:"en",originalName:"Unknown Turn Actor Creator",locales:{en:{name:"Unknown Turn Actor Creator"}}},mechanics:[{kind:"common-play",config:creator}]},
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
  return {
    ...pack,
    summonAction:installedCommonPlayActionId({
      catalogId:catalogQualifiedId(pack.creatorContentId,pack.moduleId,"1"),mechanicId:pack.creatorId,entryPointId:"summon",
    }),
  };
}

function actorState(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,summonId:string,resourceId:string) {
  const runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  const resource=runtime.combatants[summonId]?.resources.find((candidate)=>candidate.id===resourceId)?.current;
  const artifact=runtime.artifacts?.find((candidate)=>candidate.artifactKind==="actor"&&candidate.actor?.combatantId===summonId);
  const markers=Object.entries(artifact?.metadata??{}).filter(([key])=>key.startsWith("commonPlay.frequency:"));
  return {resource,markers,clock:structuredClone(runtime.clock)};
}

async function captureHostBatch(operation:()=>Promise<unknown>) {
  const wires:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try { await operation(); }
  finally { tauriSessionTransport.send=originalSend; }
  const batches=wires
    .map((wire)=>JSON.parse(wire) as {type:string;events?:ConnectedSessionEvent[]})
    .filter((wire):wire is {type:"event-batch";events:ConnectedSessionEvent[]}=>wire.type==="event-batch"&&Array.isArray(wire.events));
  const batch=batches.at(-1);
  assert.ok(batch,JSON.stringify(wires));
  return batch;
}

async function advanceUntilActor(adapter:MockAdapter,actorId:string) {
  for(let guard=0;guard<20;guard++) {
    const snapshot=await adapter.getSnapshot();
    if(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.clock.activeActorId===actorId) return snapshot;
    await adapter.endTurn();
  }
  throw new Error(`initiative did not advance to ${actorId}`);
}

async function advanceConnectedUntilActor(
  host:MockAdapter,
  client:MockAdapter,
  summonId:string,
  resourceId:string,
) {
  for(let guard=0;guard<20;guard++) {
    const before=actorState(host,await host.getSnapshot(),summonId,resourceId);
    if(before.clock.activeActorId===summonId) return {batch:undefined,before};
    const batch=await captureHostBatch(()=>host.endTurn());
    assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"applied");
    const after=actorState(host,await host.getSnapshot(),summonId,resourceId);
    if(after.clock.activeActorId===summonId) return {batch,before};
  }
  throw new Error(`initiative did not advance to ${summonId}`);
}

async function runIdentity(prefix:string) {
  const adapter=new MockAdapter();
  const pack=await install(adapter,prefix);
  await adapter.resolveAction(pack.summonAction,["char.aelar"]);
  const before=actorState(adapter,await adapter.getSnapshot(),pack.summonId,pack.resourceId);
  const after=actorState(adapter,await advanceUntilActor(adapter,pack.summonId),pack.summonId,pack.resourceId);
  return {beforeResource:before.resource,afterResource:after.resource,markers:after.markers.length,activeActorId:after.clock.activeActorId};
}

async function runTurnEndIdentity(prefix:string) {
  const adapter=new MockAdapter();
  const pack=await install(adapter,prefix);
  await adapter.resolveAction(pack.summonAction,["char.aelar"]);
  const before=actorState(adapter,await advanceUntilActor(adapter,pack.summonId),pack.summonId,pack.resourceId);
  await adapter.endTurn();
  const after=actorState(adapter,await adapter.getSnapshot(),pack.summonId,pack.resourceId);
  return {beforeResource:before.resource,afterResource:after.resource,markerDelta:after.markers.length-before.markers.length};
}

test("actor-owned turn-start Recharge Common Play rule is invariant under every external identity rename",async()=>{
  const first=await runIdentity("unknown-actor-turn-a");
  const renamed=await runIdentity("fully-renamed-actor-turn-b");
  assert.deepEqual(
    {...first,activeActorId:first.activeActorId?.replace("unknown-actor-turn-a","prefix")},
    {...renamed,activeActorId:renamed.activeActorId?.replace("fully-renamed-actor-turn-b","prefix")},
  );
  assert.equal(first.beforeResource,0);
  assert.equal(first.afterResource,1);
  assert.equal(first.markers,1);
});

test("actor-owned turn-end Common Play rule is invariant under every external identity rename",async()=>{
  const first=await runTurnEndIdentity("unknown-actor-turn-end-a");
  const renamed=await runTurnEndIdentity("fully-renamed-actor-turn-end-b");
  assert.deepEqual(first,renamed);
  assert.equal(first.beforeResource,1);
  assert.equal(first.afterResource,0);
  assert.equal(first.markerDelta,1);
});

test("actor-owned turn-start Recharge rule converges, reconnects, deduplicates, and rolls back through turn event-native Undo",async()=>{
  const prefix="unknown-connected-actor-turn",sessionId="session.common-play-actor-turn";
  const host=new MockAdapter();
  const pack=await install(host,prefix);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";hostConnected.sessionId=sessionId;hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const client=new MockAdapter();
  await install(client,prefix);
  const clientConnected=connectedStateFor(client);
  clientConnected.mode="client";clientConnected.sessionId=sessionId;clientConnected.replica=new ClientSessionReplica(sessionId);

  const spawnBatch=await captureHostBatch(()=>host.resolveAction(pack.summonAction,["char.aelar"]));
  assert.equal((await applyConnectedClientEvents(client,spawnBatch.events)).status,"applied");
  const before=actorState(host,await host.getSnapshot(),pack.summonId,pack.resourceId);
  assert.equal(before.resource,0);
  assert.equal(before.markers.length,0);

  const reached=await advanceConnectedUntilActor(host,client,pack.summonId,pack.resourceId);
  assert.ok(reached.batch,"summoned actor should begin through an authoritative turn transition");
  assert.equal((await applyConnectedClientEvents(client,reached.batch.events)).status,"duplicate");
  let hostState=actorState(host,await host.getSnapshot(),pack.summonId,pack.resourceId);
  let clientState=actorState(client,await client.getSnapshot(),pack.summonId,pack.resourceId);
  assert.equal(hostState.resource,1);
  assert.equal(hostState.markers.length,1);
  assert.deepEqual(clientState,hostState);

  const reconnect=new MockAdapter();
  await install(reconnect,prefix);
  const reconnectConnected=connectedStateFor(reconnect);
  reconnectConnected.mode="client";reconnectConnected.sessionId=sessionId;reconnectConnected.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  assert.deepEqual(actorState(reconnect,await reconnect.getSnapshot(),pack.summonId,pack.resourceId),hostState);

  const undoBatch=await captureHostBatch(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  hostState=actorState(host,await host.getSnapshot(),pack.summonId,pack.resourceId);
  clientState=actorState(client,await client.getSnapshot(),pack.summonId,pack.resourceId);
  assert.equal(hostState.resource,0);
  assert.equal(hostState.markers.length,0);
  assert.deepEqual(hostState.clock,reached.before.clock);
  assert.deepEqual(clientState,hostState);
});

test("actor-owned turn-end rule converges, reconnects, deduplicates, and rolls back through turn event-native Undo",async()=>{
  const prefix="unknown-connected-actor-turn-end",sessionId="session.common-play-actor-turn-end";
  const host=new MockAdapter();
  const pack=await install(host,prefix);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";hostConnected.sessionId=sessionId;hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const client=new MockAdapter();
  await install(client,prefix);
  const clientConnected=connectedStateFor(client);
  clientConnected.mode="client";clientConnected.sessionId=sessionId;clientConnected.replica=new ClientSessionReplica(sessionId);

  const spawnBatch=await captureHostBatch(()=>host.resolveAction(pack.summonAction,["char.aelar"]));
  assert.equal((await applyConnectedClientEvents(client,spawnBatch.events)).status,"applied");
  const reached=await advanceConnectedUntilActor(host,client,pack.summonId,pack.resourceId);
  assert.ok(reached.batch,"summoned actor should begin through an authoritative turn transition");
  const before=actorState(host,await host.getSnapshot(),pack.summonId,pack.resourceId);
  assert.equal(before.resource,1);
  assert.equal(before.markers.length,1);
  assert.equal(before.clock.activeActorId,pack.summonId);

  const endBatch=await captureHostBatch(()=>host.endTurn());
  assert.equal((await applyConnectedClientEvents(client,endBatch.events)).status,"applied");
  assert.equal((await applyConnectedClientEvents(client,endBatch.events)).status,"duplicate");
  let hostState=actorState(host,await host.getSnapshot(),pack.summonId,pack.resourceId);
  let clientState=actorState(client,await client.getSnapshot(),pack.summonId,pack.resourceId);
  assert.equal(hostState.resource,0);
  assert.equal(hostState.markers.length,2);
  assert.deepEqual(clientState,hostState);

  const reconnect=new MockAdapter();
  await install(reconnect,prefix);
  const reconnectConnected=connectedStateFor(reconnect);
  reconnectConnected.mode="client";reconnectConnected.sessionId=sessionId;reconnectConnected.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  assert.deepEqual(actorState(reconnect,await reconnect.getSnapshot(),pack.summonId,pack.resourceId),hostState);

  const undoBatch=await captureHostBatch(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  hostState=actorState(host,await host.getSnapshot(),pack.summonId,pack.resourceId);
  clientState=actorState(client,await client.getSnapshot(),pack.summonId,pack.resourceId);
  assert.equal(hostState.resource,1);
  assert.equal(hostState.markers.length,1);
  assert.deepEqual(hostState.clock,before.clock);
  assert.deepEqual(clientState,hostState);
});
