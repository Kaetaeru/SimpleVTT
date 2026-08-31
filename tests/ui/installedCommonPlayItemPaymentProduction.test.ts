import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { getCharacterLibraryPersistenceStateForTests, setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";

const ITEM_ID="item.potion.aelar";
const ITEM_DEFINITION_ID="item.potion-of-healing";
type Identity={moduleId:string;contentId:string;mechanicId:string;entryPointId:string;displayName:string};
const BASE:Identity={moduleId:"homebrew.family-x-item-payment",contentId:"option.family-x-item-payment",mechanicId:"external.unknown.family-x-item-payment",entryPointId:"consume",displayName:"Portable Item Payment"};
const RENAMED:Identity={moduleId:"homebrew.renamed-family-x",contentId:"option.renamed-family-x",mechanicId:"external.renamed.family-x",entryPointId:"pay",displayName:"Renamed Portable Item Payment"};

function payload(identity:Identity) {
  return JSON.stringify({schemaVersion:"0.1-draft",moduleId:identity.moduleId,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",source:{document:"Family X Item Payment Probe",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],content:[{id:identity.contentId,category:"option",presentation:{defaultLocale:"en",originalName:identity.displayName,locales:{en:{name:identity.displayName,description:"Portable item quantity payment probe"}}},mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:identity.mechanicId,payments:[{kind:"item",selector:{from:"items",where:{op:"eq",left:{ref:"item.definitionId"},right:{value:ITEM_DEFINITION_ID}},min:1,max:1},quantity:{value:1},consumed:true,consumeAt:"commit",refundOnCancel:true}],entryPoints:[{id:identity.entryPointId,invocation:"manual",operations:[]}]}}]}]});
}
async function install(adapter:MockAdapter,identity:Identity) {
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(payload(identity));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  return installedCommonPlayActionId({catalogId:catalogQualifiedId(identity.contentId,identity.moduleId,"1"),mechanicId:identity.mechanicId,entryPointId:identity.entryPointId});
}
function persisted(adapter:MockAdapter,characterId:string) {
  return getCharacterLibraryPersistenceStateForTests(adapter)?.document?.characters.find((entry)=>entry.characterId===characterId)?.runtime.items.find((item)=>item.id===ITEM_ID)?.quantity;
}
async function restarted(store:MemoryCharacterLibraryStore) {
  const adapter=new MockAdapter();setCharacterLibraryStoreForTests(adapter,store);return (await adapter.getSnapshot()).activeCharacter.items.find((item)=>item.id===ITEM_ID)?.quantity;
}

test("unknown installed Common Play item payment persists through restart and event-native Undo",async()=>{
  const store=new MemoryCharacterLibraryStore();
  const adapter=new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,store);
  const actionId=await install(adapter,BASE);
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  let snapshot=await adapter.getSnapshot();
  const characterId=snapshot.activeCharacter.id;
  assert.equal(snapshot.activeCharacter.items.find((item)=>item.id===ITEM_ID)?.quantity,2);
  await adapter.resolveAction(actionId,[characterId]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.activeCharacter.items.find((item)=>item.id===ITEM_ID)?.quantity,1);
  assert.equal(persisted(adapter,characterId),1);
  assert.equal(await restarted(store),1);
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.items.find((item)=>item.id===ITEM_ID)?.quantity,2);
  assert.equal(persisted(adapter,characterId),2);
  assert.equal(await restarted(store),2);
});

test("portable item payment is invariant to external package and mechanic identity",async()=>{
  const adapter=new MockAdapter();
  const actionId=await install(adapter,RENAMED);
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const characterId=(await adapter.getSnapshot()).activeCharacter.id;
  await adapter.resolveAction(actionId,[characterId]);
  assert.equal((await adapter.getSnapshot()).activeCharacter.items.find((item)=>item.id===ITEM_ID)?.quantity,1);
});
