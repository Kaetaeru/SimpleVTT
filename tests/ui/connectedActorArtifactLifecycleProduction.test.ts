import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/connectedTurnRoutingAdapter";
import "../../src/app/installedContentRuntimeAdapter";
import { artifactLifecycleCommonPlayActionId } from "../../src/app/installedCommonPlayArtifactLifecycleAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { ClientSessionReplica, HostSessionLedger } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

function packagePayload(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.actor-content`;
  const mechanicId=`${prefix}.actors`;
  const config={
    schemaVersion:"0.2-draft",id:mechanicId,
    entryPoints:[{id:"summon",invocation:"manual",operations:[{kind:"artifact.spawn",template:"summon"}]}],
    artifactTemplates:[{
      id:"summon",artifactKind:"actor",duration:{kind:"durable"},lifetime:{kind:"durable"},
      initialState:{
        combatantId:`${prefix}.summoned`,statDefinitionId:`${prefix}.stat`,ownerId:"actor",controllerId:"actor",side:"ally",initiative:"shared",
        properties:{"presentation.name":"Unknown Summon","defense.ac":13,"hp.maximum":10,"movement.walk":30},actionDefinitionIds:[],resources:[],
      },
      grantedEntryPoints:[{id:"despawn",invocation:"granted",operations:[{kind:"artifact.remove",artifact:"summon"}]}],
    }],
  };
  return {
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Unknown actor lifecycle proof",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],
      content:[{
        id:contentId,category:"option",
        presentation:{defaultLocale:"en",originalName:"Unknown Summon Source",locales:{en:{name:"Unknown Summon Source"}}},
        mechanics:[{kind:"common-play",config}],
      }],
    }),
    summonAction:installedCommonPlayActionId({catalogId:catalogQualifiedId(contentId,moduleId,"1"),mechanicId,entryPointId:"summon"}),
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

function actorArtifact(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  return snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.artifacts?.find((artifact)=>artifact.artifactKind==="actor");
}

async function withoutDesktopTransport<T>(operation:()=>Promise<T>) {
  const previous=tauriSessionTransport.send;
  tauriSessionTransport.send=async()=>1;
  try { return await operation(); }
  finally { tauriSessionTransport.send=previous; }
}

async function reconnectFrom(host:MockAdapter,prefix:string,sessionId:string) {
  const client=new MockAdapter();
  await install(client,prefix);
  const state=connectedStateFor(client);
  state.mode="client";state.sessionId=sessionId;state.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(client,connectedStateFor(host).ledger!.eventsAfter(0))).status,"applied");
  return client;
}

async function lifecycleShape(prefix:string) {
  const adapter=new MockAdapter();
  const pack=await install(adapter,prefix);
  await adapter.resolveAction(pack.summonAction,["char.aelar"]);
  let snapshot=await adapter.getSnapshot();
  const first=actorArtifact(adapter,snapshot)!;
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id===`${prefix}.summoned`)?.name,"Unknown Summon");
  assert.ok(snapshot.scene.actionsByActor["char.aelar"]?.some((action)=>action.id===artifactLifecycleCommonPlayActionId(first.id,"despawn")));
  await adapter.resolveAction(artifactLifecycleCommonPlayActionId(first.id,"despawn"),["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(actorArtifact(adapter,snapshot),undefined);
  assert.equal(snapshot.scene.entities.some((entity)=>entity.id===`${prefix}.summoned`),false);
  await adapter.resolveAction(pack.summonAction,["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  const replacement=actorArtifact(adapter,snapshot)!;
  return {
    hp:snapshot.scene.entities.find((entity)=>entity.id===`${prefix}.summoned`)?.hp,
    armorClass:replacement.actor?.properties["defense.ac"],
    initiative:replacement.actor?.initiative,
    controller:replacement.actor?.controllerId===replacement.actor?.ownerId,
    artifactCount:snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.artifacts?.filter((artifact)=>artifact.artifactKind==="actor").length,
  };
}

test("unknown actor artifact despawns, can be replaced, and ignores external identity names",async()=>{
  assert.deepEqual(await lifecycleShape("unknown-actor-a"),await lifecycleShape("fully-renamed-actor-b"));
});

test("unknown actor artifact lifecycle converges through reconnect and Undo",async()=>{
  const prefix="unknown-connected-actor",sessionId="session.actor-artifact-lifecycle";
  const host=new MockAdapter();
  const client=new MockAdapter();
  const pack=await install(host,prefix);
  await install(client,prefix);
  const hostState=connectedStateFor(host);
  hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const clientState=connectedStateFor(client);
  clientState.mode="client";clientState.sessionId=sessionId;clientState.replica=new ClientSessionReplica(sessionId);

  await withoutDesktopTransport(()=>host.resolveAction(pack.summonAction,["char.aelar"]));
  assert.equal((await applyConnectedClientEvents(client,hostState.ledger.eventsAfter(0))).status,"applied");
  let hostSnapshot=await host.getSnapshot(),clientSnapshot=await client.getSnapshot();
  const summon=actorArtifact(host,hostSnapshot)!;
  assert.ok(summon);
  assert.equal(clientSnapshot.scene.entities.find((entity)=>entity.id===`${prefix}.summoned`)?.name,"Unknown Summon");
  const afterSpawnReconnect=await reconnectFrom(host,prefix,sessionId);
  assert.equal((await afterSpawnReconnect.getSnapshot()).scene.entities.find((entity)=>entity.id===`${prefix}.summoned`)?.name,"Unknown Summon");

  await withoutDesktopTransport(()=>host.resolveAction(artifactLifecycleCommonPlayActionId(summon.id,"despawn"),["char.aelar"]));
  assert.equal((await applyConnectedClientEvents(client,hostState.ledger.eventsAfter(0))).status,"applied");
  hostSnapshot=await host.getSnapshot();clientSnapshot=await client.getSnapshot();
  assert.equal(actorArtifact(host,hostSnapshot),undefined);
  assert.equal(actorArtifact(client,clientSnapshot),undefined);
  assert.equal(hostSnapshot.scene.entities.some((entity)=>entity.id===`${prefix}.summoned`),false);
  assert.equal(clientSnapshot.scene.entities.some((entity)=>entity.id===`${prefix}.summoned`),false);
  const afterDespawnReconnect=await reconnectFrom(host,prefix,sessionId);
  assert.equal((await afterDespawnReconnect.getSnapshot()).scene.entities.some((entity)=>entity.id===`${prefix}.summoned`),false);

  await withoutDesktopTransport(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,hostState.ledger.eventsAfter(0))).status,"applied");
  hostSnapshot=await host.getSnapshot();clientSnapshot=await client.getSnapshot();
  assert.equal(hostSnapshot.scene.entities.find((entity)=>entity.id===`${prefix}.summoned`)?.name,"Unknown Summon");
  assert.equal(clientSnapshot.scene.entities.find((entity)=>entity.id===`${prefix}.summoned`)?.name,"Unknown Summon");
  assert.ok(hostSnapshot.scene.actionsByActor["char.aelar"]?.some((action)=>action.id===artifactLifecycleCommonPlayActionId(summon.id,"despawn")));
  const afterUndoReconnect=await reconnectFrom(host,prefix,sessionId);
  const undoSnapshot=await afterUndoReconnect.getSnapshot();
  assert.equal(undoSnapshot.scene.entities.find((entity)=>entity.id===`${prefix}.summoned`)?.name,"Unknown Summon");
  assert.ok(undoSnapshot.scene.actionsByActor["char.aelar"]?.some((action)=>action.id===artifactLifecycleCommonPlayActionId(summon.id,"despawn")));
});
