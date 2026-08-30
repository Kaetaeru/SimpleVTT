import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
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

function persistedItemQuantity(adapter:MockAdapter,characterId:string) {
  return getCharacterLibraryPersistenceStateForTests(adapter)?.document?.characters
    .find((entry)=>entry.characterId===characterId)?.runtime.items
    .find((item)=>item.id===ITEM_INSTANCE_ID)?.quantity;
}

async function restartedItemQuantity(store:MemoryCharacterLibraryStore) {
  const restarted=new MockAdapter();
  setCharacterLibraryStoreForTests(restarted,store);
  const snapshot=await restarted.getSnapshot();
  return snapshot.activeCharacter.items.find((item)=>item.id===ITEM_INSTANCE_ID)?.quantity;
}

async function exercise(prefix:string) {
  const characterStore=new MemoryCharacterLibraryStore();
  const adapter=new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,characterStore);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());

  const preview=await adapter.previewContentImport(packagePayload(prefix));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  let snapshot=await adapter.getSnapshot();
  const characterId=snapshot.activeCharacter.id;
  const before=snapshot.activeCharacter.items.find((item)=>item.id===ITEM_INSTANCE_ID)?.quantity;
  assert.equal(before,2);

  const actionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(`option.${prefix}`,`homebrew.${prefix}`,"1"),
    mechanicId:`external.${prefix}`,
    entryPointId:"consume",
  });
  await adapter.resolveAction(actionId,[characterId]);

  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.activeCharacter.items.find((item)=>item.id===ITEM_INSTANCE_ID)?.quantity,1);
  assert.equal(persistedItemQuantity(adapter,characterId),1);
  assert.equal(await restartedItemQuantity(characterStore),1);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.items.find((item)=>item.id===ITEM_INSTANCE_ID)?.quantity,2);
  assert.equal(persistedItemQuantity(adapter,characterId),2);
  assert.equal(await restartedItemQuantity(characterStore),2);

  return {before,afterConsume:1,afterUndo:2};
}

test("unknown installed Common Play item payment persists through restart and Undo and is rename invariant",async()=>{
  assert.deepEqual(await exercise("family-x-item-payment-a"),{before:2,afterConsume:1,afterUndo:2});
  assert.deepEqual(await exercise("renamed-family-x-item-payment-b"),{before:2,afterConsume:1,afterUndo:2});
});
