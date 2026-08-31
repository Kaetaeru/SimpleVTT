import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";

const MODULE_ID="homebrew.family-x-item-payment-probe";
const CONTENT_ID="option.family-x-item-payment-probe";
const MECHANIC_ID="external.unknown.family-x-item-payment-probe";
const ENTRY_POINT_ID="consume";

function packagePayload(definitionId:string) {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:MODULE_ID,
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"Family X Portable Item Payment Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:CONTENT_ID,
      category:"option",
      presentation:{
        defaultLocale:"en",
        originalName:"Family X Portable Item Payment Probe",
        locales:{en:{name:"Family X Portable Item Payment Probe",description:"Unknown external item quantity payment probe"}},
      },
      mechanics:[{
        kind:"common-play",
        config:{
          schemaVersion:"0.2-draft",
          id:MECHANIC_ID,
          payments:[{
            kind:"item",
            selector:{from:"items",definitionId},
            quantity:{value:1},
            consumed:true,
            consumeAt:"commit",
            refundOnCancel:true,
          }],
          entryPoints:[{id:ENTRY_POINT_ID,invocation:"manual",operations:[]}],
        },
      }],
    }],
  });
}

function matchingItemQuantity(adapter:MockAdapter,definitionId:string) {
  return adapter.getSnapshot().then((snapshot)=>snapshot.activeCharacter.items.find((item)=>item.definitionId===definitionId)?.quantity);
}

async function restartedItemQuantity(store:MemoryCharacterLibraryStore,definitionId:string) {
  const restarted=new MockAdapter();
  setCharacterLibraryStoreForTests(restarted,store);
  return matchingItemQuantity(restarted,definitionId);
}

test("unknown installed Common Play item quantity payment persists through restart and Undo without named item dispatch",async()=>{
  const characterStore=new MemoryCharacterLibraryStore();
  const adapter=new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,characterStore);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());

  let snapshot=await adapter.getSnapshot();
  const item=snapshot.activeCharacter.items.find((candidate)=>
    candidate.quantity>0
    &&snapshot.activeCharacter.items.filter((other)=>other.definitionId===candidate.definitionId).length===1,
  );
  assert.ok(item,"fixture must expose one uniquely addressable positive-quantity item stack");
  const before=item.quantity;

  const preview=await adapter.previewContentImport(packagePayload(item.definitionId));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor(snapshot.activeCharacter.id);

  snapshot=await adapter.getSnapshot();
  const characterId=snapshot.activeCharacter.id;
  const actionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(CONTENT_ID,MODULE_ID,"1"),
    mechanicId:MECHANIC_ID,
    entryPointId:ENTRY_POINT_ID,
  });

  await adapter.resolveAction(actionId,[characterId]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.activeCharacter.items.find((entry)=>entry.definitionId===item.definitionId)?.quantity,before-1);
  assert.equal(await restartedItemQuantity(characterStore,item.definitionId),before-1);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.items.find((entry)=>entry.definitionId===item.definitionId)?.quantity,before);
  assert.equal(await restartedItemQuantity(characterStore,item.definitionId),before);
});
