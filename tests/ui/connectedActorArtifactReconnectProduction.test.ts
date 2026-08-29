import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
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

function packagePayload(prefix:string) {
  const moduleId=`${prefix}.module`;
  const actorActionMechanicId=`${prefix}.actor-action`;
  const actorActionContentId=`${prefix}.actor-action-content`;
  const actorActionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(actorActionContentId,moduleId,"1"),
    mechanicId:actorActionMechanicId,
    entryPointId:"poke",
  });
  const artifactMechanicId=`${prefix}.artifacts`;
  const artifactContentId=`${prefix}.artifact-content`;
  const content=[
    {
      id:artifactContentId,category:"option",name:"Unknown Summon Source",
      config:{
        schemaVersion:"0.2-draft",id:artifactMechanicId,
        entryPoints:[{id:"summon",invocation:"manual",operations:[{kind:"artifact.spawn",template:"summon"}]}],
        artifactTemplates:[{
          id:"summon",artifactKind:"actor",duration:{kind:"durable"},lifetime:{kind:"durable"},
          initialState:{
            combatantId:`${prefix}.summoned`,statDefinitionId:`${prefix}.stat`,ownerId:"actor",controllerId:"actor",
            side:"ally",initiative:"shared",
            properties:{"presentation.name":"Unknown Summon","defense.ac":13,"hp.maximum":10,"movement.walk":30},
            actionDefinitionIds:[actorActionId],resources:[],
          },
        }],
      },
    },
    {
      id:actorActionContentId,category:"option",name:"Unknown Summon Poke",
      config:{
        schemaVersion:"0.2-draft",id:actorActionMechanicId,
        entryPoints:[{id:"poke",invocation:"manual",targeting:{from:"targets",min:1,max:1},operations:[
          {kind:"damage.apply",amount:{value:1},damageType:"force",target:"target"},
        ]}],
      },
    },
  ];
  return {
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Unknown actor artifact reconnect proof",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],
      content:content.map((entry)=>({
        id:entry.id,category:entry.category,
        presentation:{defaultLocale:"en",originalName:entry.name,locales:{en:{name:entry.name}}},
        mechanics:[{kind:"common-play",config:entry.config}],
      })),
    }),
    summonAction:installedCommonPlayActionId({
      catalogId:catalogQualifiedId(artifactContentId,moduleId,"1"),mechanicId:artifactMechanicId,entryPointId:"summon",
    }),
    combatantId:`${prefix}.summoned`,
  };
}

async function install(adapter:MockAdapter,prefix:string) {
  const pack=packagePayload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  return pack;
}

async function captureBatch(operation:()=>Promise<unknown>) {
  const wires:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try { await operation(); }
  finally { tauriSessionTransport.send=originalSend; }
  const batch=wires.map((wire)=>JSON.parse(wire) as {type:string;events?:ConnectedSessionEvent[]})
    .find((wire):wire is {type:"event-batch";events:ConnectedSessionEvent[]}=>wire.type==="event-batch"&&Array.isArray(wire.events));
  assert.ok(batch,JSON.stringify(wires));
  return batch;
}

function actorProjection(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,combatantId:string) {
  const runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene);
  return {
    artifact:runtime?.artifacts?.find((artifact)=>artifact.actor?.combatantId===combatantId),
    entity:snapshot.scene.entities.find((entity)=>entity.id===combatantId),
    actions:snapshot.scene.actionsByActor[combatantId],
  };
}

test("actor artifact reconstructs on fresh connected replay and stays removed after replaying Undo",async()=>{
  const prefix="unknown-actor-reconnect",sessionId="session.actor-artifact-reconnect";
  const host=new MockAdapter();
  const pack=await install(host,prefix);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";hostConnected.sessionId=sessionId;hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const spawnBatch=await captureBatch(()=>host.resolveAction(pack.summonAction,["char.aelar"]));
  const hostAfterSpawn=await host.getSnapshot();
  const expected=actorProjection(host,hostAfterSpawn,pack.combatantId);
  assert.ok(expected.artifact&&expected.entity&&expected.actions?.length,JSON.stringify(expected));

  const reconnect=new MockAdapter();
  await install(reconnect,prefix);
  const reconnectState=connectedStateFor(reconnect);
  reconnectState.mode="client";reconnectState.sessionId=sessionId;reconnectState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostConnected.ledger.eventsAfter(0))).status,"applied");
  assert.equal((await applyConnectedClientEvents(reconnect,spawnBatch.events)).status,"duplicate");
  const reconnected=actorProjection(reconnect,await reconnect.getSnapshot(),pack.combatantId);
  assert.deepEqual(reconnected,expected);

  const undoBatch=await captureBatch(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(reconnect,undoBatch.events)).status,"applied");
  const afterUndo=actorProjection(reconnect,await reconnect.getSnapshot(),pack.combatantId);
  assert.equal(afterUndo.artifact,undefined);
  assert.equal(afterUndo.entity,undefined);
  assert.equal(afterUndo.actions,undefined);

  const restarted=new MockAdapter();
  await install(restarted,prefix);
  const restartedState=connectedStateFor(restarted);
  restartedState.mode="client";restartedState.sessionId=sessionId;restartedState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(restarted,hostConnected.ledger.eventsAfter(0))).status,"applied");
  const reconstructedAfterUndo=actorProjection(restarted,await restarted.getSnapshot(),pack.combatantId);
  assert.equal(reconstructedAfterUndo.artifact,undefined);
  assert.equal(reconstructedAfterUndo.entity,undefined);
  assert.equal(reconstructedAfterUndo.actions,undefined);
});
