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
  const moduleId=`${prefix}.module`,contentId=`${prefix}.summon-content`,mechanicId=`${prefix}.summon-mechanic`;
  return {
    moduleId,contentId,mechanicId,combatantId:`${prefix}.summoned`,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Unknown elapsed actor artifact",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],
      content:[{
        id:contentId,category:"option",
        presentation:{defaultLocale:"en",originalName:"Unknown Timed Summon",locales:{en:{name:"Unknown Timed Summon"}}},
        mechanics:[{kind:"common-play",config:{
          schemaVersion:"0.2-draft",id:mechanicId,
          entryPoints:[{id:"summon",invocation:"manual",operations:[{kind:"artifact.spawn",template:"summon"}]}],
          artifactTemplates:[{
            id:"summon",artifactKind:"actor",
            duration:{kind:"elapsed",amount:{value:6},unit:"seconds"},lifetime:{kind:"durable"},
            initialState:{
              combatantId:`${prefix}.summoned`,statDefinitionId:`${prefix}.stat`,ownerId:"actor",controllerId:"actor",
              side:"ally",initiative:"none",properties:{"presentation.name":"Unknown Timed Summon","defense.ac":12,"hp.maximum":8,"movement.walk":30},
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
  await adapter.startProductionLocalPlay("dm");
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  return {
    ...pack,
    action:installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId:"summon"}),
  };
}

function connectClient(adapter:MockAdapter,sessionId:string) {
  const state=connectedStateFor(adapter);
  state.mode="client";
  state.sessionId=sessionId;
  state.replica=new ClientSessionReplica(sessionId);
}

function batches(wires:string[]) {
  return wires
    .map((wire)=>JSON.parse(wire) as {type:string;events?:ConnectedSessionEvent[]})
    .filter((wire):wire is {type:"event-batch";events:ConnectedSessionEvent[]}=>wire.type==="event-batch"&&Array.isArray(wire.events));
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

function actorArtifact(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,combatantId:string) {
  return snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.artifacts?.find((artifact)=>artifact.actor?.combatantId===combatantId);
}

test("elapsed arbitrary actor artifact despawns with its combatant through connected replay, reconnect, and Undo",async()=>{
  const prefix="unknown-connected-elapsed-actor",sessionId="session.elapsed-actor-artifact";
  const host=new MockAdapter();
  const installed=await install(host,prefix);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";hostConnected.sessionId=sessionId;hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const client=new MockAdapter();
  await install(client,prefix);
  connectClient(client,sessionId);

  const spawnBatch=await captureHostBatch(()=>host.resolveAction(installed.action,["char.aelar"]));
  assert.equal((await applyConnectedClientEvents(client,spawnBatch.events)).status,"applied");
  let hostSnapshot=await host.getSnapshot(),clientSnapshot=await client.getSnapshot();
  assert.ok(actorArtifact(host,hostSnapshot,installed.combatantId));
  assert.ok(actorArtifact(client,clientSnapshot,installed.combatantId));
  assert.ok(hostSnapshot.scene.entities.some((entity)=>entity.id===installed.combatantId));
  assert.ok(clientSnapshot.scene.entities.some((entity)=>entity.id===installed.combatantId));

  let expiryBatch:Awaited<ReturnType<typeof captureHostBatch>>|undefined;
  for(let guard=0;guard<20;guard++) {
    const runtime=snapshotAdapterTurnRuntimeState(host,(await host.getSnapshot()).scene);
    if((runtime?.clock.elapsedSeconds??0)>=6) break;
    expiryBatch=await captureHostBatch(()=>host.endTurn());
    assert.equal((await applyConnectedClientEvents(client,expiryBatch.events)).status,"applied");
  }
  assert.ok(expiryBatch);

  hostSnapshot=await host.getSnapshot();clientSnapshot=await client.getSnapshot();
  assert.ok((snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)?.clock.elapsedSeconds??0)>=6);
  assert.equal(actorArtifact(host,hostSnapshot,installed.combatantId),undefined);
  assert.equal(actorArtifact(client,clientSnapshot,installed.combatantId),undefined);
  assert.equal(hostSnapshot.scene.entities.some((entity)=>entity.id===installed.combatantId),false);
  assert.equal(clientSnapshot.scene.entities.some((entity)=>entity.id===installed.combatantId),false);

  const lifecycleEvents=expiryBatch.events.flatMap((event)=>event.payload.kind==="mode-transition"?(event.payload.resolutionEvents??[]):[]);
  const stateChanges=lifecycleEvents.flatMap((event)=>event.stateChanges);
  assert.ok(stateChanges.some((change)=>change.kind==="artifact"&&change.operation==="removed"&&change.before?.actor?.combatantId===installed.combatantId));
  assert.ok(stateChanges.some((change)=>change.kind==="combatant"&&change.operation==="removed"&&change.targetId===installed.combatantId));
  assert.equal((await applyConnectedClientEvents(client,expiryBatch.events)).status,"duplicate");

  const reconnect=new MockAdapter();
  await install(reconnect,prefix);
  connectClient(reconnect,sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  const reconnectSnapshot=await reconnect.getSnapshot();
  assert.equal(actorArtifact(reconnect,reconnectSnapshot,installed.combatantId),undefined);
  assert.equal(reconnectSnapshot.scene.entities.some((entity)=>entity.id===installed.combatantId),false);

  const undoBatch=await captureHostBatch(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  hostSnapshot=await host.getSnapshot();clientSnapshot=await client.getSnapshot();
  assert.ok(actorArtifact(host,hostSnapshot,installed.combatantId));
  assert.ok(actorArtifact(client,clientSnapshot,installed.combatantId));
  assert.ok(hostSnapshot.scene.entities.some((entity)=>entity.id===installed.combatantId));
  assert.ok(clientSnapshot.scene.entities.some((entity)=>entity.id===installed.combatantId));
});
