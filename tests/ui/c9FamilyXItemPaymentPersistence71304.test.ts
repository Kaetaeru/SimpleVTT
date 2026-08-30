import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import {
  setCharacterLibraryStoreForTests,
} from "../../src/app/characterLibraryRuntimeAdapter";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";

const ITEM_ID="item.potion.aelar";

type Identity={
  moduleId:string;
  contentId:string;
  mechanicId:string;
  entryPointId:string;
};

const ORIGINAL:Identity={
  moduleId:"homebrew.family-x-item-payment",
  contentId:"option.family-x-item-payment",
  mechanicId:"external.unknown.family-x-item-payment",
  entryPointId:"consume",
};

const RENAMED:Identity={
  moduleId:"homebrew.renamed-inventory-probe",
  contentId:"option.completely-renamed-inventory-probe",
  mechanicId:"external.renamed.inventory-probe",
  entryPointId:"spend-alpha",
};

function packagePayload(identity:Identity) {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:identity.moduleId,
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"Family X portable item payment probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:identity.contentId,
      category:"option",
      presentation:{defaultLocale:"en",originalName:"Portable Item Payment",locales:{en:{name:"Portable Item Payment"}}},
      mechanics:[{kind:"common-play",config:{
        schemaVersion:"0.2-draft",
        id:identity.mechanicId,
        payments:[{
          kind:"resource",
          resource:`item:${ITEM_ID}`,
          amount:{value:1},
          consumeAt:"commit",
          refundOnCancel:true,
        }],
        entryPoints:[{id:identity.entryPointId,invocation:"manual",operations:[]}],
      }}],
    }],
  });
}

async function restartedItemQuantity(store:MemoryCharacterLibraryStore) {
  const restarted=new MockAdapter();
  setCharacterLibraryStoreForTests(restarted,store);
  const snapshot=await restarted.getSnapshot();
  return snapshot.activeCharacter.items.find((entry)=>entry.id===ITEM_ID)?.quantity;
}

async function exercise(identity:Identity) {
  const characterStore=new MemoryCharacterLibraryStore();
  const adapter=new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,characterStore);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());

  const preview=await adapter.previewContentImport(packagePayload(identity));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  let snapshot=await adapter.getSnapshot();
  const characterId=snapshot.activeCharacter.id;
  assert.equal(snapshot.activeCharacter.items.find((entry)=>entry.id===ITEM_ID)?.quantity,2);

  const actionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(identity.contentId,identity.moduleId,"1"),
    mechanicId:identity.mechanicId,
    entryPointId:identity.entryPointId,
  });

  snapshot=await adapter.resolveAction(actionId,[characterId]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.activeCharacter.items.find((entry)=>entry.id===ITEM_ID)?.quantity,1);
  assert.equal(await restartedItemQuantity(characterStore),1);

  snapshot=await adapter.resolveAction(actionId,[characterId]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.activeCharacter.items.some((entry)=>entry.id===ITEM_ID),false);
  assert.equal(await restartedItemQuantity(characterStore),undefined);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.items.find((entry)=>entry.id===ITEM_ID)?.quantity,1);
  assert.equal(await restartedItemQuantity(characterStore),1);

  return {consumed:true,destroyedLastCopy:true,undoRestored:true,restartPersisted:true};
}

test("unknown source-owned Common Play item payment persists quantity and last-copy destruction through restart and Undo",async()=>{
  assert.deepEqual(await exercise(ORIGINAL),{consumed:true,destroyedLastCopy:true,undoRestored:true,restartPersisted:true});
});

test("portable item payment execution is invariant to unrelated module content mechanic and entry-point identity rename",async()=>{
  assert.deepEqual(await exercise(RENAMED),{consumed:true,destroyedLastCopy:true,undoRestored:true,restartPersisted:true});
});
