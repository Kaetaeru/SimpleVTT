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

const resultResourceId=(prefix:string)=>`resource.${prefix}.item-result`;

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
          entryPoints:[{
            id:"consume",invocation:"manual",
            operations:[{
              kind:"resource.change",
              resource:resultResourceId(prefix),
              amount:{value:1},
              target:"actor",
              createIfMissing:{label:"Portable Item Result",maximum:{value:1}},
            }],
          }],
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

function itemQuantity(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  return snapshot.activeCharacter.items.find((item)=>item.id===ITEM_INSTANCE_ID)?.quantity;
}

function resultResourceCurrent(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,prefix:string) {
  return snapshot.activeCharacter.resources.find((resource)=>resource.id===resultResourceId(prefix))?.current;
}

function persistedItemQuantity(adapter:MockAdapter,characterId:string) {
  return getCharacterLibraryPersistenceStateForTests(adapter)?.document?.characters
    .find((entry)=>entry.characterId===characterId)?.runtime.items
    .find((item)=>item.id===ITEM_INSTANCE_ID)?.quantity;
}

async function restartedSnapshot(store:MemoryCharacterLibraryStore) {
  const restarted=new MockAdapter();
  setCharacterLibraryStoreForTests(restarted,store);
  return restarted.getSnapshot();
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
  assert.equal(resultResourceCurrent(snapshot,prefix),undefined);

  await adapter.resolveAction(actionId(prefix),[characterId]);

  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(itemQuantity(snapshot),1);
  assert.equal(resultResourceCurrent(snapshot,prefix),1);
  assert.equal(persistedItemQuantity(adapter,characterId),1);
  let restarted=await restartedSnapshot(characterStore);
  assert.equal(itemQuantity(restarted),1);
  assert.equal(resultResourceCurrent(restarted,prefix),1);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(itemQuantity(snapshot),2);
  assert.equal(resultResourceCurrent(snapshot,prefix),undefined);
  assert.equal(persistedItemQuantity(adapter,characterId),2);
  restarted=await restartedSnapshot(characterStore);
  assert.equal(itemQuantity(restarted),2);
  assert.equal(resultResourceCurrent(restarted,prefix),undefined);

  return {before,afterConsume:1,afterUndo:2};
}

test("unknown installed Common Play item payment and result commit atomically through restart and Undo and are rename invariant",async()=>{
  assert.deepEqual(await exercise("family-x-item-payment-a"),{before:2,afterConsume:1,afterUndo:2});
  assert.deepEqual(await exercise("renamed-family-x-item-payment-b"),{before:2,afterConsume:1,afterUndo:2});
});
