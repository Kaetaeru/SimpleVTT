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
  const moduleId=`${prefix}.module`,contentId=`${prefix}.option`,mechanicId=`${prefix}.artifacts`,combatantId=`${prefix}.summoned`;
  return {moduleId,contentId,mechanicId,combatantId,json:JSON.stringify({
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
  })};
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
    combatantId:pack.combatantId,
    action:installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId:"summon"}),
  };
}

function connectClient(adapter:MockAdapter,sessionId:string) {
  const state=connectedStateFor(adapter);
  state.mode="client";state.sessionId=sessionId;state.replica=new ClientSessionReplica(sessionId);
}

async function captureHostBatch(operation:()=>Promise<unknown>) {
  const wires:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try { await operation(); }
  finally { tauriSessionTransport.send=originalSend; }
  const batch=wires.map((wire)=>JSON.parse(wire) as {type:string;events?:ConnectedSessionEvent[]}).filter((wire)=>wire.type==="event-batch"&&Array.isArray(wire.events)).at(-1) as {events:ConnectedSessionEvent[]}|undefined;
  assert.ok(batch,JSON.stringify(wires));
  return batch;
}

async function advanceOneRound(adapter:MockAdapter,onBatch?:(batch:{events:ConnectedSessionEvent[]})=>Promise<void>) {
  const initialRound=(await adapter.getSnapshot()).scene.round;
  let finalBatch:{events:ConnectedSessionEvent[]}|undefined;
  for(let guard=0;guard<20&&(await adapter.getSnapshot()).scene.round===initialRound;guard+=1) {
    finalBatch=await captureHostBatch(()=>adapter.endTurn());
    if(onBatch) await onBatch(finalBatch);
  }
  assert.ok(finalBatch);
  assert.ok((await adapter.getSnapshot()).scene.round>initialRound,"initiative must wrap within guard");
  return finalBatch;
}

async function identityOutcome(prefix:string) {
  const adapter=new MockAdapter();
  const {action,combatantId}=await install(adapter,prefix);
  await adapter.resolveAction(action,["char.aelar"]);
  const spawned=await adapter.getSnapshot();
  assert.equal(spawned.scene.entities.some((entity)=>entity.id===combatantId),true);
  await advanceOneRound(adapter);
  const expired=await adapter.getSnapshot();
  return {
    artifactPresent:snapshotAdapterTurnRuntimeState(adapter,expired.scene)?.artifacts?.some((artifact)=>artifact.actor?.combatantId===combatantId)??false,
    combatantPresent:expired.scene.entities.some((entity)=>entity.id===combatantId),
  };
}

test("elapsed actor artifact lifecycle is identity invariant",async()=>{
  const expected={artifactPresent:false,combatantPresent:false};
  assert.deepEqual(await identityOutcome("unknown-actor-lifetime-a"),expected);
  assert.deepEqual(await identityOutcome("fully-renamed-actor-lifetime-b"),expected);
});

test("elapsed actor artifact despawn converges through connected replay, reconnect, duplicate replay, and Undo",async()=>{
  const prefix="unknown-connected-actor-lifetime",sessionId="session.actor-lifetime";
  const host=new MockAdapter();
  const {action,combatantId}=await install(host,prefix);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";hostConnected.sessionId=sessionId;hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const client=new MockAdapter();
  await install(client,prefix);
  connectClient(client,sessionId);

  const createBatch=await captureHostBatch(()=>host.resolveAction(action,["char.aelar"]));
  assert.equal((await applyConnectedClientEvents(client,createBatch.events)).status,"applied");
  assert.equal((await host.getSnapshot()).scene.entities.some((entity)=>entity.id===combatantId),true);
  assert.equal((await client.getSnapshot()).scene.entities.some((entity)=>entity.id===combatantId),true);

  const finalTurnBatch=await advanceOneRound(host,async(batch)=>{
    assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"applied");
  });
  let hostSnapshot=await host.getSnapshot(),clientSnapshot=await client.getSnapshot();
  assert.equal(hostSnapshot.scene.entities.some((entity)=>entity.id===combatantId),false);
  assert.equal(clientSnapshot.scene.entities.some((entity)=>entity.id===combatantId),false);
  assert.equal(snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)?.artifacts?.some((artifact)=>artifact.actor?.combatantId===combatantId),false);
  assert.deepEqual(snapshotAdapterTurnRuntimeState(client,clientSnapshot.scene)?.artifacts,snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)?.artifacts);
  assert.equal((await applyConnectedClientEvents(client,finalTurnBatch.events)).status,"duplicate");

  const reconnect=new MockAdapter();
  await install(reconnect,prefix);
  connectClient(reconnect,sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  const reconnectSnapshot=await reconnect.getSnapshot();
  assert.equal(reconnectSnapshot.scene.entities.some((entity)=>entity.id===combatantId),false);
  assert.deepEqual(snapshotAdapterTurnRuntimeState(reconnect,reconnectSnapshot.scene)?.artifacts,snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)?.artifacts);

  const undoBatch=await captureHostBatch(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  hostSnapshot=await host.getSnapshot();clientSnapshot=await client.getSnapshot();
  assert.equal(hostSnapshot.scene.entities.some((entity)=>entity.id===combatantId),true);
  assert.equal(clientSnapshot.scene.entities.some((entity)=>entity.id===combatantId),true);
  assert.equal(snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)?.artifacts?.some((artifact)=>artifact.actor?.combatantId===combatantId),true);
  assert.deepEqual(snapshotAdapterTurnRuntimeState(client,clientSnapshot.scene)?.artifacts,snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)?.artifacts);
});
