import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import {
  getCharacterLibraryPersistenceStateForTests,
  setCharacterLibraryStoreForTests,
} from "../../src/app/characterLibraryRuntimeAdapter";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

const ITEM_DEFINITION_ID="item.potion-of-healing";
const ITEM_INSTANCE_ID="item.potion.aelar";

function packagePayload(prefix:string) {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:`homebrew.${prefix}`,
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"Family X Portable Item Payment Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:`option.${prefix}`,
      category:"option",
      presentation:{
        defaultLocale:"en",
        originalName:"Portable Item Payment Probe",
        locales:{en:{name:"Portable Item Payment Probe",description:"Consumes one matching inventory item through Common Play"}},
      },
      mechanics:[{
        kind:"common-play",
        config:{
          schemaVersion:"0.2-draft",
          id:`external.${prefix}`,
          payments:[{
            kind:"item",
            selector:{from:"items",definitionId:ITEM_DEFINITION_ID},
            quantity:{value:1},
            consumed:true,
            consumeAt:"commit",
            refundOnCancel:true,
          }],
          entryPoints:[{id:"consume",invocation:"manual",operations:[]}],
        },
      }],
    }],
  });
}

function actionId(prefix:string) {
  return installedCommonPlayActionId({
    catalogId:catalogQualifiedId(`option.${prefix}`,`homebrew.${prefix}`,"1"),
    mechanicId:`external.${prefix}`,
    entryPointId:"consume",
  });
}

async function installPackage(adapter:MockAdapter,prefix:string) {
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(packagePayload(prefix));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
}

function itemQuantity(adapterSnapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  return adapterSnapshot.activeCharacter.items.find((item)=>item.id===ITEM_INSTANCE_ID)?.quantity;
}

function persistedItemQuantity(adapter:MockAdapter,characterId:string) {
  return getCharacterLibraryPersistenceStateForTests(adapter)?.document?.characters
    .find((entry)=>entry.characterId===characterId)?.runtime.items
    .find((item)=>item.id===ITEM_INSTANCE_ID)?.quantity;
}

async function restartedItemQuantity(store:MemoryCharacterLibraryStore) {
  const restarted=new MockAdapter();
  setCharacterLibraryStoreForTests(restarted,store);
  const snapshot=await restarted.getSnapshot();
  return itemQuantity(snapshot);
}

async function withoutDesktopTransport<T>(operation:()=>Promise<T>) {
  const previous=tauriSessionTransport.send;
  tauriSessionTransport.send=async()=>1;
  try { return await operation(); }
  finally { tauriSessionTransport.send=previous; }
}

async function reconnectFrom(host:MockAdapter,prefix:string,sessionId:string) {
  const client=new MockAdapter();
  await installPackage(client,prefix);
  const state=connectedStateFor(client);
  state.mode="client";
  state.sessionId=sessionId;
  state.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(client,connectedStateFor(host).ledger!.eventsAfter(0))).status,"applied");
  return client;
}

async function exercise(prefix:string) {
  const characterStore=new MemoryCharacterLibraryStore();
  const adapter=new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,characterStore);
  await installPackage(adapter,prefix);

  let snapshot=await adapter.getSnapshot();
  const characterId=snapshot.activeCharacter.id;
  const before=itemQuantity(snapshot);
  assert.equal(before,2);

  await adapter.resolveAction(actionId(prefix),[characterId]);

  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(itemQuantity(snapshot),1);
  assert.equal(persistedItemQuantity(adapter,characterId),1);
  assert.equal(await restartedItemQuantity(characterStore),1);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(itemQuantity(snapshot),2);
  assert.equal(persistedItemQuantity(adapter,characterId),2);
  assert.equal(await restartedItemQuantity(characterStore),2);

  return {before,afterConsume:1,afterUndo:2};
}

test("unknown installed Common Play item payment persists through restart and Undo and is rename invariant",async()=>{
  assert.deepEqual(await exercise("family-x-item-payment-a"),{before:2,afterConsume:1,afterUndo:2});
  assert.deepEqual(await exercise("renamed-family-x-item-payment-b"),{before:2,afterConsume:1,afterUndo:2});
});

test("unknown installed Common Play item payment converges through connected replay, retry, reconnect, and Undo",async()=>{
  const prefix="family-x-connected-item-payment";
  const sessionId="session.family-x-item-payment";
  const host=new MockAdapter();
  const client=new MockAdapter();
  await installPackage(host,prefix);
  await installPackage(client,prefix);
  const characterId=(await host.getSnapshot()).activeCharacter.id;

  const hostState=connectedStateFor(host);
  hostState.mode="host";
  hostState.sessionId=sessionId;
  hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const clientState=connectedStateFor(client);
  clientState.mode="client";
  clientState.sessionId=sessionId;
  clientState.replica=new ClientSessionReplica(sessionId);

  await withoutDesktopTransport(()=>host.resolveAction(actionId(prefix),[characterId]));
  const committedEvents=hostState.ledger.eventsAfter(0);
  assert.ok(committedEvents.length>0);
  assert.equal((await applyConnectedClientEvents(client,committedEvents)).status,"applied");
  assert.equal(itemQuantity(await host.getSnapshot()),1);
  assert.equal(itemQuantity(await client.getSnapshot()),1);

  assert.equal((await applyConnectedClientEvents(client,committedEvents)).status,"applied");
  assert.equal(itemQuantity(await client.getSnapshot()),1);

  const reconnected=await reconnectFrom(host,prefix,sessionId);
  assert.equal(itemQuantity(await reconnected.getSnapshot()),1);

  await withoutDesktopTransport(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,hostState.ledger.eventsAfter(0))).status,"applied");
  assert.equal(itemQuantity(await host.getSnapshot()),2);
  assert.equal(itemQuantity(await client.getSnapshot()),2);

  const afterUndo=await reconnectFrom(host,prefix,sessionId);
  assert.equal(itemQuantity(await afterUndo.getSnapshot()),2);
});
