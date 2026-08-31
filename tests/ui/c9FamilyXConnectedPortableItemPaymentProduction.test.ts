import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/installedContentRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import {
  applyConnectedClientEvents,
  connectedManifest,
} from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import {
  ClientSessionReplica,
  HostSessionLedger,
  type ConnectedSessionEvent,
} from "../../src/app/connectedSessionProtocol";
import {
  getCharacterLibraryPersistenceStateForTests,
  setCharacterLibraryStoreForTests,
} from "../../src/app/characterLibraryRuntimeAdapter";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

const ITEM_DEFINITION_ID="item.potion-of-healing";
const ITEM_INSTANCE_ID="item.potion.aelar";
const PREFIX="family-x-connected-item-payment";

function packagePayload() {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:`homebrew.${PREFIX}`,
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"Family X Connected Item Payment Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:`option.${PREFIX}`,
      category:"option",
      presentation:{
        defaultLocale:"en",
        originalName:"Connected Portable Item Payment",
        locales:{en:{name:"Connected Portable Item Payment",description:"Consumes one matching inventory item through connected Common Play"}},
      },
      mechanics:[{
        kind:"common-play",
        config:{
          schemaVersion:"0.2-draft",
          id:`external.${PREFIX}`,
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

function itemQuantity(adapter:MockAdapter) {
  return adapter.getSnapshot().then((snapshot)=>snapshot.activeCharacter.items.find((item)=>item.id===ITEM_INSTANCE_ID)?.quantity);
}

function persistedItemQuantity(adapter:MockAdapter,characterId:string) {
  return getCharacterLibraryPersistenceStateForTests(adapter)?.document?.characters
    .find((entry)=>entry.characterId===characterId)?.runtime.items
    .find((item)=>item.id===ITEM_INSTANCE_ID)?.quantity;
}

async function prepareAdapter(adapter:MockAdapter,store:MemoryCharacterLibraryStore) {
  setCharacterLibraryStoreForTests(adapter,store);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(packagePayload());
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  return installedCommonPlayActionId({
    catalogId:catalogQualifiedId(`option.${PREFIX}`,`homebrew.${PREFIX}`,"1"),
    mechanicId:`external.${PREFIX}`,
    entryPointId:"consume",
  });
}

function connectClient(adapter:MockAdapter,sessionId:string) {
  const state=connectedStateFor(adapter);
  state.mode="client";
  state.sessionId=sessionId;
  state.replica=new ClientSessionReplica(sessionId);
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

async function freshReconnect(sessionId:string,events:ConnectedSessionEvent[]) {
  const store=new MemoryCharacterLibraryStore();
  const adapter=new MockAdapter();
  await prepareAdapter(adapter,store);
  connectClient(adapter,sessionId);
  const applied=await applyConnectedClientEvents(adapter,events);
  assert.equal(applied.status,"applied",JSON.stringify(applied));
  return {adapter,store};
}

test("unknown installed Common Play item payment converges through connected replay, retry, reconnect, and Undo",async()=>{
  const sessionId="session.family-x-connected-item-payment";
  const hostStore=new MemoryCharacterLibraryStore();
  const host=new MockAdapter();
  const actionId=await prepareAdapter(host,hostStore);
  const hostCharacterId=(await host.getSnapshot()).activeCharacter.id;
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";
  hostConnected.sessionId=sessionId;
  hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const clientStore=new MemoryCharacterLibraryStore();
  const client=new MockAdapter();
  await prepareAdapter(client,clientStore);
  const clientCharacterId=(await client.getSnapshot()).activeCharacter.id;
  connectClient(client,sessionId);

  const consumeBatch=await captureHostBatch(()=>host.resolveAction(actionId,[hostCharacterId]));
  const resolution=consumeBatch.events.find((event)=>event.payload.kind==="resolution");
  assert.ok(resolution&&resolution.payload.kind==="resolution");
  assert.ok(
    resolution.payload.resolutionEvents.some((event)=>event.stateChanges.some((change)=>change.kind==="resource"&&change.resourceId===`phase09:item:${ITEM_INSTANCE_ID}:quantity`)),
    "connected authority must transport the canonical item quantity resource event",
  );
  assert.equal(await itemQuantity(host),1);
  assert.equal(persistedItemQuantity(host,hostCharacterId),1);

  assert.equal((await applyConnectedClientEvents(client,consumeBatch.events)).status,"applied");
  assert.equal(await itemQuantity(client),1);
  assert.equal(persistedItemQuantity(client,clientCharacterId),1);
  assert.equal((await applyConnectedClientEvents(client,consumeBatch.events)).status,"duplicate","retrying the same authoritative batch must not spend the item twice");
  assert.equal(await itemQuantity(client),1);

  const afterConsumeReconnect=await freshReconnect(sessionId,hostConnected.ledger.eventsAfter(0));
  assert.equal(await itemQuantity(afterConsumeReconnect.adapter),1);

  const undoBatch=await captureHostBatch(()=>host.undoLastResolution());
  assert.ok(undoBatch.events.some((event)=>event.payload.kind==="resolution-undo"));
  assert.equal(await itemQuantity(host),2);
  assert.equal(persistedItemQuantity(host,hostCharacterId),2);
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  assert.equal(await itemQuantity(client),2);
  assert.equal(persistedItemQuantity(client,clientCharacterId),2);

  const afterUndoReconnect=await freshReconnect(sessionId,hostConnected.ledger.eventsAfter(0));
  assert.equal(await itemQuantity(afterUndoReconnect.adapter),2);
});
