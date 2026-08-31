import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import { sendConnectedTurnSimultaneousOrderingResponse } from "../../src/app/connectedTurnRoutingAdapter";
import "../../src/app/installedContentRuntimeAdapter";
import { applyConnectedClientEvents, applyConnectedTurnSimultaneousOrderingPrompt, connectedManifest, resumeConnectedTurnSimultaneousOrderingPromptForCharacter } from "../../src/app/connectedSessionRuntimeAdapter";
import { decodeConnectedWireMessage } from "../../src/app/connectedSessionWire";
import { routeConnectedTurnSimultaneousOrderingResponse } from "../../src/app/connectedTurnSimultaneousOrderingResponsePort";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { peekAdapterTurnSimultaneousOrdering, respondToAdapterTurnSimultaneousOrdering } from "../../src/app/phase09EffectAwareTurnAdapter";
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
    payments:[
      {kind:"economy",bucket:"action",amount:{value:1},consumeAt:"commit",refundOnCancel:true},
      {kind:"resource",resource:resourceId,amount:{value:1},consumeAt:"commit"},
    ],
    entryPoints:[{id:"use-charge",invocation:"manual",operations:[]}],
    rules:[
      {id:"turn-refresh",event:"turn-start",frequency:"once-per-turn",operations:[
        {kind:"resource.recharge",resource:resourceId,die:{sides:6},succeedsOn:{minimum:5,maximum:6}},
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

async function install(adapter:MockAdapter,prefix:string,pack=packageJson(prefix)) {
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
  const combatant=runtime.combatants[summonId];
  const resource=combatant?.resources.find((candidate)=>candidate.id===resourceId)?.current;
  const artifact=runtime.artifacts?.find((candidate)=>candidate.artifactKind==="actor"&&candidate.actor?.combatantId===summonId);
  const markers=Object.entries(artifact?.metadata??{}).filter(([key])=>key.startsWith("commonPlay.frequency:"));
  return {resource,markers,clock:structuredClone(runtime.clock),economyAction:combatant?.economy.action};
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
  await adapter.setQueuedD20(6);
  const after=actorState(adapter,await advanceUntilActor(adapter,pack.summonId),pack.summonId,pack.resourceId);
  return {beforeResource:before.resource,afterResource:after.resource,markers:after.markers.length,activeActorId:after.clock.activeActorId};
}

async function runRechargeFace(prefix:string,face:number) {
  const adapter=new MockAdapter();
  const pack=await install(adapter,prefix);
  await adapter.resolveAction(pack.summonAction,["char.aelar"]);
  await adapter.setQueuedD20(face);
  const snapshot=await advanceUntilActor(adapter,pack.summonId);
  const state=actorState(adapter,snapshot,pack.summonId,pack.resourceId);
  const action=snapshot.scene.actionsByActor[pack.summonId]?.[0];
  return {resource:state.resource,markers:state.markers.length,available:action?.available,economy:action?.economy,disabledReason:action?.disabledReason};
}

async function runTurnEndIdentity(prefix:string) {
  const adapter=new MockAdapter();
  const pack=await install(adapter,prefix);
  await adapter.resolveAction(pack.summonAction,["char.aelar"]);
  await adapter.setQueuedD20(6);
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

test("actor-owned turn-start Recharge uses the authoritative die and gates its projected Action by charge availability",async()=>{
  const failed=await runRechargeFace("unknown-recharge-fail",4);
  const succeeded=await runRechargeFace("unknown-recharge-success",5);
  assert.equal(failed.resource,0);
  assert.equal(failed.markers,1);
  assert.equal(failed.available,false);
  assert.equal(failed.disabledReason,"자원 부족");
  assert.equal(succeeded.resource,1);
  assert.equal(succeeded.markers,1);
  assert.equal(succeeded.available,true);
  assert.equal(succeeded.economy,"행동");
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
  await client.setQueuedD20(1);
  const clientConnected=connectedStateFor(client);
  clientConnected.mode="client";clientConnected.sessionId=sessionId;clientConnected.replica=new ClientSessionReplica(sessionId);

  const spawnBatch=await captureHostBatch(()=>host.resolveAction(pack.summonAction,["char.aelar"]));
  assert.equal((await applyConnectedClientEvents(client,spawnBatch.events)).status,"applied");
  const before=actorState(host,await host.getSnapshot(),pack.summonId,pack.resourceId);
  assert.equal(before.resource,0);
  assert.equal(before.markers.length,0);

  await host.setQueuedD20(6);
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

test("recharged actor Action spends its Action and charge atomically through connected replay, reconnect, and Undo",async()=>{
  const prefix="unknown-connected-recharge-action",sessionId="session.common-play-recharge-action";
  const host=new MockAdapter();
  const pack=await install(host,prefix);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";hostConnected.sessionId=sessionId;hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const client=new MockAdapter();
  await install(client,prefix);
  await client.setQueuedD20(1);
  const clientConnected=connectedStateFor(client);
  clientConnected.mode="client";clientConnected.sessionId=sessionId;clientConnected.replica=new ClientSessionReplica(sessionId);

  const spawnBatch=await captureHostBatch(()=>host.resolveAction(pack.summonAction,["char.aelar"]));
  assert.equal((await applyConnectedClientEvents(client,spawnBatch.events)).status,"applied");
  await host.setQueuedD20(6);
  await advanceConnectedUntilActor(host,client,pack.summonId,pack.resourceId);

  const readySnapshot=await host.getSnapshot();
  const action=readySnapshot.scene.actionsByActor[pack.summonId]?.[0];
  assert.ok(action,"recharged actor must project its portable action");
  assert.equal(action.available,true);
  assert.equal(action.economy,"행동");
  let hostState=actorState(host,readySnapshot,pack.summonId,pack.resourceId);
  assert.equal(hostState.resource,1);
  assert.equal(hostState.economyAction,true);

  const useBatch=await captureHostBatch(()=>host.resolveAction(action.id,[pack.summonId]));
  assert.equal((await applyConnectedClientEvents(client,useBatch.events)).status,"applied");
  assert.equal((await applyConnectedClientEvents(client,useBatch.events)).status,"duplicate");
  hostState=actorState(host,await host.getSnapshot(),pack.summonId,pack.resourceId);
  let clientState=actorState(client,await client.getSnapshot(),pack.summonId,pack.resourceId);
  assert.equal(hostState.resource,0);
  assert.equal(hostState.economyAction,false);
  assert.deepEqual(clientState,hostState);
  assert.equal((await host.getSnapshot()).scene.actionsByActor[pack.summonId]?.[0]?.available,false);

  const reconnect=new MockAdapter();
  await install(reconnect,prefix);
  const reconnectConnected=connectedStateFor(reconnect);
  reconnectConnected.mode="client";reconnectConnected.sessionId=sessionId;reconnectConnected.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  assert.deepEqual(actorState(reconnect,await reconnect.getSnapshot(),pack.summonId,pack.resourceId),hostState);
  assert.equal((await reconnect.getSnapshot()).scene.actionsByActor[pack.summonId]?.[0]?.available,false);

  const undoBatch=await captureHostBatch(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  hostState=actorState(host,await host.getSnapshot(),pack.summonId,pack.resourceId);
  clientState=actorState(client,await client.getSnapshot(),pack.summonId,pack.resourceId);
  assert.equal(hostState.resource,1);
  assert.equal(hostState.economyAction,true);
  assert.deepEqual(clientState,hostState);
  assert.equal((await host.getSnapshot()).scene.actionsByActor[pack.summonId]?.[0]?.available,true);
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
  await host.setQueuedD20(6);
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


function simultaneousPackageJson(prefix:string) {
  const pack=packageJson(prefix);
  const seededJson=pack.json.replace(`"id":"${pack.resourceId}","current":0,"maximum":1`,`"id":"${pack.resourceId}","current":1,"maximum":1`);
  if(seededJson===pack.json) throw new Error("simultaneous ordering seed resource was not found");
  const payload=JSON.parse(seededJson) as {
    content:Array<{mechanics:Array<{config:{rules?:unknown[]}}>}>;
  };
  payload.content[0].mechanics[0].config.rules=[
    {id:"turn-gain",event:"turn-start",frequency:"once-per-turn",operations:[
      {kind:"resource.change",resource:pack.resourceId,amount:{value:1},target:"actor"},
    ]},
    {id:"turn-spend",event:"turn-start",frequency:"once-per-turn",operations:[
      {kind:"resource.change",resource:pack.resourceId,amount:{value:-1},target:"actor"},
    ]},
  ];
  return {...pack,json:JSON.stringify(payload)};
}

async function runSimultaneousOrdering(prefix:string) {
  const adapter=new MockAdapter();
  const source=simultaneousPackageJson(prefix);
  const pack=await install(adapter,prefix,source);
  await adapter.resolveAction(pack.summonAction,["char.aelar"]);
  let pending=peekAdapterTurnSimultaneousOrdering(adapter);
  for(let guard=0;guard<20&&!pending;guard++) {
    await adapter.endTurn();
    pending=peekAdapterTurnSimultaneousOrdering(adapter);
  }
  assert.ok(pending,"turn-start with two eligible external rules must pause for simultaneous ordering");
  if(!pending||pending.status!=="pending") throw new Error("simultaneous ordering did not remain pending");
  assert.equal(pending.request.timing,"turn-start");
  assert.equal(pending.request.authority.kind,"actor-controller");
  assert.equal(pending.request.authority.responderId,"char.aelar");
  assert.equal(pending.request.candidates.length,2);
  const spend=pending.request.candidates.find((candidate)=>candidate.id.endsWith(":turn-spend"))?.id;
  const gain=pending.request.candidates.find((candidate)=>candidate.id.endsWith(":turn-gain"))?.id;
  assert.ok(spend&&gain,JSON.stringify(pending.request.candidates));
  const response=respondToAdapterTurnSimultaneousOrdering(adapter,{
    decisionId:pending.request.id,
    revision:pending.request.revision,
    responderId:pending.request.authority.responderId,
    orderedCandidateIds:[spend!,gain!],
  });
  assert.equal(response?.status,"resolved");
  const snapshot=await adapter.endTurn();
  const state=actorState(adapter,snapshot,pack.summonId,pack.resourceId);
  assert.equal(state.clock.activeActorId,pack.summonId);
  return {
    resource:state.resource,
    markers:state.markers.length,
    timing:pending.request.timing,
    authority:pending.request.authority.kind,
    candidateCount:pending.request.candidates.length,
  };
}

test("production simultaneous turn rules pause before mutation and execute in the authorized external order",async()=>{
  const original=await runSimultaneousOrdering("unknown-simultaneous-a");
  const renamed=await runSimultaneousOrdering("fully-renamed-simultaneous-b");
  assert.deepEqual(renamed,original);
  assert.equal(original.resource,1,"spend-at-one then gain must end at one; natural gain-at-maximum then spend would end at zero");
  assert.equal(original.markers,2);
});


test("connected simultaneous turn ordering routes only to the owning peer, survives reconnect, rejects stale/replay responses, and converges through authoritative turn events",async()=>{
  const prefix="unknown-connected-simultaneous",sessionId="session.common-play-simultaneous",ownerPeer="peer.owner",reconnectPeer="peer.owner.reconnect";
  const source=simultaneousPackageJson(prefix);
  const host=new MockAdapter();
  const pack=await install(host,prefix,source);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";hostConnected.sessionId=sessionId;hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const client=new MockAdapter();
  await install(client,prefix,source);
  const clientConnected=connectedStateFor(client);
  clientConnected.mode="client";clientConnected.sessionId=sessionId;clientConnected.replica=new ClientSessionReplica(sessionId);
  hostConnected.peerManifests.set(ownerPeer,structuredClone(connectedManifest(client)));

  const broadcasts:string[]=[];
  const targeted:{peer:string;message:string}[]=[];
  const originalSend=tauriSessionTransport.send;
  const originalSendTo=tauriSessionTransport.sendTo;
  tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 1;};
  tauriSessionTransport.sendTo=async(peer,message)=>{targeted.push({peer,message});return 1;};
  try {
    let broadcastIndex=0;
    await host.resolveAction(pack.summonAction,["char.aelar"]);
    while(broadcastIndex<broadcasts.length){
      const decoded=decodeConnectedWireMessage(broadcasts[broadcastIndex++]);
      assert.equal(decoded.status,"ok");
      if(decoded.status==="ok"&&decoded.message.type==="event-batch") assert.notEqual((await applyConnectedClientEvents(client,decoded.message.events)).status,"rejected");
    }

    let promptWire:{peer:string;message:string}|undefined;
    for(let guard=0;guard<20&&!promptWire;guard++){
      const cursorBeforeTurn=hostConnected.ledger.cursor;
      const targetedBefore=targeted.length;
      await host.endTurn();
      promptWire=targeted.slice(targetedBefore).find((entry)=>{
        const decoded=decodeConnectedWireMessage(entry.message);
        return decoded.status==="ok"&&decoded.message.type==="turn-simultaneous-ordering-prompt";
      });
      if(promptWire) assert.equal(hostConnected.ledger.cursor,cursorBeforeTurn,"pending ordering must not append a no-op authoritative turn event");
      while(broadcastIndex<broadcasts.length){
        const decoded=decodeConnectedWireMessage(broadcasts[broadcastIndex++]);
        assert.equal(decoded.status,"ok");
        if(decoded.status==="ok"&&decoded.message.type==="event-batch") assert.notEqual((await applyConnectedClientEvents(client,decoded.message.events)).status,"rejected");
      }
    }

    assert.ok(promptWire,"Host must route the pending simultaneous-ordering prompt to the owning peer");
    assert.equal(promptWire.peer,ownerPeer);
    const decodedPrompt=decodeConnectedWireMessage(promptWire.message);
    assert.equal(decodedPrompt.status,"ok");
    if(decodedPrompt.status!=="ok"||decodedPrompt.message.type!=="turn-simultaneous-ordering-prompt") throw new Error("connected ordering prompt did not decode");
    assert.equal((applyConnectedTurnSimultaneousOrderingPrompt(client,decodedPrompt.message)).status,"applied");
    const clientPending=peekAdapterTurnSimultaneousOrdering(client);
    assert.ok(clientPending&&clientPending.status==="pending");

    const reconnect=new MockAdapter();
    await install(reconnect,prefix,source);
    const reconnectConnected=connectedStateFor(reconnect);
    reconnectConnected.mode="client";reconnectConnected.sessionId=sessionId;reconnectConnected.replica=new ClientSessionReplica(sessionId);
    assert.notEqual((await applyConnectedClientEvents(reconnect,hostConnected.ledger.eventsAfter(0))).status,"rejected");
    hostConnected.peerManifests.delete(ownerPeer);
    hostConnected.peerManifests.set(reconnectPeer,structuredClone(connectedManifest(reconnect)));
    const beforeResumeTargets=targeted.length;
    assert.equal((await resumeConnectedTurnSimultaneousOrderingPromptForCharacter(host,reconnectPeer,"char.aelar")).status,"sent");
    const resumedRaw=targeted.slice(beforeResumeTargets).find((entry)=>entry.peer===reconnectPeer)?.message;
    assert.ok(resumedRaw,"reconnect must resend the transient pending decision");
    const resumed=decodeConnectedWireMessage(resumedRaw!);
    assert.equal(resumed.status,"ok");
    if(resumed.status!=="ok"||resumed.message.type!=="turn-simultaneous-ordering-prompt") throw new Error("resumed ordering prompt did not decode");
    assert.equal((applyConnectedTurnSimultaneousOrderingPrompt(reconnect,resumed.message)).status,"applied");
    const hostPending=peekAdapterTurnSimultaneousOrdering(host);
    assert.ok(hostPending&&hostPending.status==="pending");
    if(!hostPending||hostPending.status!=="pending") throw new Error("Host ordering disappeared before response");
    const spend=hostPending.request.candidates.find((candidate)=>candidate.id.endsWith(":turn-spend"))?.id;
    const gain=hostPending.request.candidates.find((candidate)=>candidate.id.endsWith(":turn-gain"))?.id;
    assert.ok(spend&&gain);

    const cursorBeforeStale=hostConnected.ledger.cursor;
    assert.equal(await routeConnectedTurnSimultaneousOrderingResponse(host,{peer:reconnectPeer,message:"stale"},{
      sessionId,
      response:{decisionId:hostPending.request.id,revision:hostPending.request.revision+1,responderId:"char.aelar",orderedCandidateIds:[spend!,gain!]},
    }),true);
    assert.equal(hostConnected.ledger.cursor,cursorBeforeStale,"stale ordering response must not commit authoritative history");
    assert.equal(peekAdapterTurnSimultaneousOrdering(host)?.status,"pending");

    const outboundBefore=broadcasts.length;
    assert.equal((await sendConnectedTurnSimultaneousOrderingResponse(reconnect,[spend!,gain!])).status,"sent");
    const responseRaw=broadcasts.slice(outboundBefore).find((raw)=>{
      const decoded=decodeConnectedWireMessage(raw);
      return decoded.status==="ok"&&decoded.message.type==="turn-simultaneous-ordering-response";
    });
    assert.ok(responseRaw,"Client must send a typed simultaneous-ordering response");
    const decodedResponse=decodeConnectedWireMessage(responseRaw!);
    assert.equal(decodedResponse.status,"ok");
    if(decodedResponse.status!=="ok"||decodedResponse.message.type!=="turn-simultaneous-ordering-response") throw new Error("connected ordering response did not decode");
    const cursorBeforeCommit=hostConnected.ledger.cursor;
    assert.equal(await routeConnectedTurnSimultaneousOrderingResponse(host,{peer:reconnectPeer,message:responseRaw!},{sessionId:decodedResponse.message.sessionId,response:decodedResponse.message.response}),true);
    assert.ok(hostConnected.ledger.cursor>cursorBeforeCommit,"accepted ordering must commit the retried authoritative turn transition");
    assert.equal(peekAdapterTurnSimultaneousOrdering(host),undefined);

    const committedBatchRaw=broadcasts.slice(outboundBefore).find((raw)=>{
      const decoded=decodeConnectedWireMessage(raw);
      return decoded.status==="ok"&&decoded.message.type==="event-batch";
    });
    assert.ok(committedBatchRaw,"resolved ordering must publish the authoritative turn event batch");
    const committedBatch=decodeConnectedWireMessage(committedBatchRaw!);
    assert.equal(committedBatch.status,"ok");
    if(committedBatch.status!=="ok"||committedBatch.message.type!=="event-batch") throw new Error("resolved ordering event batch did not decode");
    assert.notEqual((await applyConnectedClientEvents(reconnect,committedBatch.message.events)).status,"rejected");
    assert.notEqual((await applyConnectedClientEvents(client,committedBatch.message.events)).status,"rejected");
    const hostState=actorState(host,await host.getSnapshot(),pack.summonId,pack.resourceId);
    assert.equal(hostState.resource,1);
    assert.deepEqual(actorState(reconnect,await reconnect.getSnapshot(),pack.summonId,pack.resourceId),hostState);
    assert.deepEqual(actorState(client,await client.getSnapshot(),pack.summonId,pack.resourceId),hostState);

    const postReplay=new MockAdapter();
    await install(postReplay,prefix,source);
    const postState=connectedStateFor(postReplay);
    postState.mode="client";postState.sessionId=sessionId;postState.replica=new ClientSessionReplica(sessionId);
    assert.notEqual((await applyConnectedClientEvents(postReplay,hostConnected.ledger.eventsAfter(0))).status,"rejected");
    assert.deepEqual(actorState(postReplay,await postReplay.getSnapshot(),pack.summonId,pack.resourceId),hostState);

    const cursorBeforeReplay=hostConnected.ledger.cursor;
    assert.equal(await routeConnectedTurnSimultaneousOrderingResponse(host,{peer:reconnectPeer,message:responseRaw!},{sessionId:decodedResponse.message.sessionId,response:decodedResponse.message.response}),true);
    assert.equal(hostConnected.ledger.cursor,cursorBeforeReplay,"replayed response after commit must not execute the turn twice");
  } finally {
    tauriSessionTransport.send=originalSend;
    tauriSessionTransport.sendTo=originalSendTo;
  }
});
