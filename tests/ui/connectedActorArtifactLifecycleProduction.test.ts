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
  const moduleId=`${prefix}.module`,contentId=`${prefix}.summon`,mechanicId=`${prefix}.mechanic`,combatantId=`${prefix}.combatant`;
  return {
    moduleId,contentId,mechanicId,combatantId,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Unknown actor lifetime proof",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],
      content:[{
        id:contentId,category:"option",
        presentation:{defaultLocale:"en",originalName:"Unknown Timed Summon",locales:{en:{name:"Unknown Timed Summon"}}},
        mechanics:[{kind:"common-play",config:{
          schemaVersion:"0.2-draft",id:mechanicId,
          entryPoints:[{id:"summon",invocation:"manual",operations:[{kind:"artifact.spawn",template:"summon"}]}],
          artifactTemplates:[{
            id:"summon",artifactKind:"actor",
            duration:{kind:"elapsed",amount:{value:6},unit:"seconds"},
            lifetime:{kind:"until-duration",onEnd:"destroy"},
            initialState:{
              combatantId,statDefinitionId:`${prefix}.stat`,ownerId:"actor",controllerId:"actor",side:"ally",initiative:"shared",
              properties:{"presentation.name":"Unknown Timed Summon","defense.ac":13,"hp.maximum":10,"movement.walk":30},
              actionDefinitionIds:[],resources:[],
            },
          }],
        }}],
      }],
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
    actionId:installedCommonPlayActionId({
      catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId:"summon",
    }),
  };
}

function connectClient(adapter:MockAdapter,sessionId:string) {
  const state=connectedStateFor(adapter);
  state.mode="client";state.sessionId=sessionId;state.replica=new ClientSessionReplica(sessionId);
}

async function captureHostBatch(operation:()=>Promise<unknown>) {
  const wires:string[]=[];
  const send=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try { await operation(); }
  finally { tauriSessionTransport.send=send; }
  const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;
  assert.ok(batch,JSON.stringify(wires));
  return batch;
}

function actorArtifactCount(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  return snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.artifacts?.filter((artifact)=>artifact.artifactKind==="actor").length??0;
}

test("elapsed actor artifact expiry removes its combatant, reconnects, and restores through event-native Undo",async()=>{
  const prefix="unknown-connected-actor-lifetime",sessionId="session.actor-artifact-lifetime";
  const host=new MockAdapter();
  const pack=await install(host,prefix);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";hostConnected.sessionId=sessionId;hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const client=new MockAdapter();
  await install(client,prefix);
  connectClient(client,sessionId);

  const spawnBatch=await captureHostBatch(()=>host.resolveAction(pack.actionId,["char.aelar"]));
  assert.equal((await applyConnectedClientEvents(client,spawnBatch.events)).status,"applied");
  assert.equal((await applyConnectedClientEvents(client,spawnBatch.events)).status,"duplicate");
  let hostSnapshot=await host.getSnapshot(),clientSnapshot=await client.getSnapshot();
  assert.equal(actorArtifactCount(host,hostSnapshot),1);
  assert.equal(actorArtifactCount(client,clientSnapshot),1);
  assert.ok(hostSnapshot.scene.entities.some((entity)=>entity.id===pack.combatantId));
  assert.ok(clientSnapshot.scene.entities.some((entity)=>entity.id===pack.combatantId));

  const reconnectSpawned=new MockAdapter();
  await install(reconnectSpawned,prefix);
  connectClient(reconnectSpawned,sessionId);
  assert.equal((await applyConnectedClientEvents(reconnectSpawned,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  const reconnectSpawnedSnapshot=await reconnectSpawned.getSnapshot();
  assert.equal(actorArtifactCount(reconnectSpawned,reconnectSpawnedSnapshot),1);
  assert.ok(reconnectSpawnedSnapshot.scene.entities.some((entity)=>entity.id===pack.combatantId));

  const initialRound=hostSnapshot.scene.round;
  let expiryBatch:Awaited<ReturnType<typeof captureHostBatch>>|undefined;
  for(let guard=0;guard<20&&(await host.getSnapshot()).scene.round===initialRound;guard+=1) {
    expiryBatch=await captureHostBatch(()=>host.endTurn());
    assert.equal((await applyConnectedClientEvents(client,expiryBatch.events)).status,"applied");
  }
  assert.ok(expiryBatch,"initiative must wrap within the bounded test loop");

  hostSnapshot=await host.getSnapshot();clientSnapshot=await client.getSnapshot();
  assert.equal(actorArtifactCount(host,hostSnapshot),0);
  assert.equal(actorArtifactCount(client,clientSnapshot),0);
  assert.equal(hostSnapshot.scene.entities.some((entity)=>entity.id===pack.combatantId),false);
  assert.equal(clientSnapshot.scene.entities.some((entity)=>entity.id===pack.combatantId),false);
  assert.equal((await applyConnectedClientEvents(client,expiryBatch.events)).status,"duplicate");

  const reconnectExpired=new MockAdapter();
  await install(reconnectExpired,prefix);
  connectClient(reconnectExpired,sessionId);
  assert.equal((await applyConnectedClientEvents(reconnectExpired,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  const reconnectExpiredSnapshot=await reconnectExpired.getSnapshot();
  assert.equal(actorArtifactCount(reconnectExpired,reconnectExpiredSnapshot),0);
  assert.equal(reconnectExpiredSnapshot.scene.entities.some((entity)=>entity.id===pack.combatantId),false);

  const undoBatch=await captureHostBatch(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  hostSnapshot=await host.getSnapshot();clientSnapshot=await client.getSnapshot();
  assert.equal(actorArtifactCount(host,hostSnapshot),1);
  assert.equal(actorArtifactCount(client,clientSnapshot),1);
  assert.ok(hostSnapshot.scene.entities.some((entity)=>entity.id===pack.combatantId));
  assert.ok(clientSnapshot.scene.entities.some((entity)=>entity.id===pack.combatantId));

  const reconnectUndo=new MockAdapter();
  await install(reconnectUndo,prefix);
  connectClient(reconnectUndo,sessionId);
  assert.equal((await applyConnectedClientEvents(reconnectUndo,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  const reconnectUndoSnapshot=await reconnectUndo.getSnapshot();
  assert.equal(actorArtifactCount(reconnectUndo,reconnectUndoSnapshot),1);
  assert.ok(reconnectUndoSnapshot.scene.entities.some((entity)=>entity.id===pack.combatantId));
});
