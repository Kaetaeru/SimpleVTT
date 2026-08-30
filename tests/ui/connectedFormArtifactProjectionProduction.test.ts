import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
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
  const contentId=`${prefix}.option`;
  const mechanicId=`${prefix}.form`;
  return {
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Unknown connected form proof",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],
      content:[{
        id:contentId,category:"option",
        presentation:{defaultLocale:"en",originalName:"Unknown Connected Form",locales:{en:{name:"Unknown Connected Form"}}},
        mechanics:[{kind:"common-play",config:{
          schemaVersion:"0.2-draft",id:mechanicId,
          entryPoints:[{id:"transform",invocation:"manual",operations:[{kind:"artifact.spawn",template:"form"}]}],
          artifactTemplates:[{
            id:"form",artifactKind:"form",duration:{kind:"durable"},lifetime:{kind:"durable"},
            initialState:{
              targetActorId:"actor",controllerId:"actor",
              propertyOverlay:{"defense.ac":19,"movement.walk":45,"hp.maximum":37,"hp.current":23,"hp.temporary":6},
              retainedProperties:[],replacementProperties:["defense.ac","movement.walk","hp.maximum","hp.current","hp.temporary"],
              hpPolicy:"replace",actionPolicy:"retain",spellcasting:"retain",actionDefinitionIds:[],resources:[],
            },
          }],
        }}],
      }],
    }),
    actionId:installedCommonPlayActionId({catalogId:catalogQualifiedId(contentId,moduleId,"1"),mechanicId,entryPointId:"transform"}),
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

async function withoutDesktopTransport<T>(operation:()=>Promise<T>) {
  const previous=tauriSessionTransport.send;
  tauriSessionTransport.send=async()=>1;
  try { return await operation(); }
  finally { tauriSessionTransport.send=previous; }
}

function shape(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  const entity=snapshot.scene.entities.find((candidate)=>candidate.id==="char.aelar")!;
  return {
    ac:snapshot.activeCharacter.ac,
    speed:snapshot.activeCharacter.speed,
    hp:snapshot.activeCharacter.hp,
    maxHp:snapshot.activeCharacter.maxHp,
    tempHp:snapshot.activeCharacter.tempHp,
    entityAc:entity.ac,
    formCount:snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.artifacts?.filter((artifact)=>artifact.artifactKind==="form").length??0,
  };
}

async function reconnectFrom(host:MockAdapter,prefix:string,sessionId:string) {
  const client=new MockAdapter();
  await install(client,prefix);
  const state=connectedStateFor(client);
  state.mode="client";state.sessionId=sessionId;state.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(client,connectedStateFor(host).ledger!.eventsAfter(0))).status,"applied");
  return client;
}

test("unknown form projection converges through connected replay, reconnect, and Undo",async()=>{
  const prefix="unknown-connected-form",sessionId="session.form-artifact-projection";
  const host=new MockAdapter(),client=new MockAdapter();
  const pack=await install(host,prefix);
  await install(client,prefix);
  const base=shape(host,await host.getSnapshot());

  const hostState=connectedStateFor(host);
  hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const clientState=connectedStateFor(client);
  clientState.mode="client";clientState.sessionId=sessionId;clientState.replica=new ClientSessionReplica(sessionId);

  await withoutDesktopTransport(()=>host.resolveAction(pack.actionId,["char.aelar"]));
  assert.equal((await applyConnectedClientEvents(client,hostState.ledger.eventsAfter(0))).status,"applied");
  const transformed={ac:19,speed:45,hp:23,maxHp:37,tempHp:6,entityAc:19,formCount:1};
  assert.deepEqual(shape(host,await host.getSnapshot()),transformed);
  assert.deepEqual(shape(client,await client.getSnapshot()),transformed);

  const reconnected=await reconnectFrom(host,prefix,sessionId);
  assert.deepEqual(shape(reconnected,await reconnected.getSnapshot()),transformed);

  await withoutDesktopTransport(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,hostState.ledger.eventsAfter(0))).status,"applied");
  assert.deepEqual(shape(host,await host.getSnapshot()),base);
  assert.deepEqual(shape(client,await client.getSnapshot()),base);

  const afterUndo=await reconnectFrom(host,prefix,sessionId);
  assert.deepEqual(shape(afterUndo,await afterUndo.getSnapshot()),base);
});
