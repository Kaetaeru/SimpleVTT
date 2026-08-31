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

function packagePayload(prefix:string,definitionId:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.content`;
  const mechanicId=`${prefix}.mechanic`;
  return {
    moduleId,contentId,mechanicId,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Family X Item Payment Probe",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],
      content:[{
        id:contentId,category:"option",
        presentation:{defaultLocale:"en",originalName:"Portable Item Consumer",locales:{en:{name:"Portable Item Consumer"}}},
        mechanics:[{kind:"common-play",config:{
          schemaVersion:"0.2-draft",id:mechanicId,
          payments:[{
            kind:"item",selector:{from:"items",definitionId},quantity:{value:1},consumed:true,consumeAt:"commit",refundOnCancel:true,
          }],
          entryPoints:[{id:"activate",invocation:"manual",operations:[]}],
        }}],
      }],
    }),
  };
}

async function restartedQuantity(store:MemoryCharacterLibraryStore,itemId:string) {
  const restarted=new MockAdapter();
  setCharacterLibraryStoreForTests(restarted,store);
  const snapshot=await restarted.getSnapshot();
  return snapshot.activeCharacter.items.find((entry)=>entry.id===itemId)?.quantity;
}

async function run(prefix:string) {
  const characterStore=new MemoryCharacterLibraryStore();
  const adapter=new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,characterStore);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());

  let snapshot=await adapter.getSnapshot();
  const characterId=snapshot.activeCharacter.id;
  const items=snapshot.activeCharacter.items;
  const item=items.find((candidate)=>candidate.quantity>0&&items.filter((entry)=>entry.definitionId===candidate.definitionId).length===1);
  assert.ok(item,"fixture requires one positive-quantity item stack with a unique definitionId");
  const before=item.quantity;
  const pack=packagePayload(prefix,item.definitionId);

  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor(characterId);

  const actionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId:"activate",
  });
  await adapter.resolveAction(actionId,[characterId]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.activeCharacter.items.find((entry)=>entry.id===item.id)?.quantity,before-1);
  assert.equal(await restartedQuantity(characterStore,item.id),before-1);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.items.find((entry)=>entry.id===item.id)?.quantity,before);
  assert.equal(await restartedQuantity(characterStore,item.id),before);
  return {delta:1,definitionId:item.definitionId};
}

test("unknown installed Common Play item payment persists through restart and Undo without named item dispatch",async()=>{
  const first=await run("unknown-family-x-item-a");
  const renamed=await run("completely-renamed-family-x-item-b");
  assert.equal(first.delta,1);
  assert.equal(renamed.delta,1);
});
