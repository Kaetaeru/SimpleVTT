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
import { FIGHTER_SECOND_WIND_RESOURCE_ID } from "../../src/domain/coreClassResources";

const MODULE_ID="homebrew.family-d-persistence-probe";
const CONTENT_ID="option.family-d-persistence-probe";
const MECHANIC_ID="external.unknown.family-d-persistence-probe";
const ENTRY_POINT_ID="activate";

function packagePayload() {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:MODULE_ID,
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"Family D Persistence Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:CONTENT_ID,
      category:"option",
      presentation:{
        defaultLocale:"en",
        originalName:"Family D Persistence Probe",
        locales:{en:{name:"Family D Persistence Probe",description:"Portable resource persistence probe"}},
      },
      mechanics:[{
        kind:"common-play",
        config:{
          schemaVersion:"0.2-draft",
          id:MECHANIC_ID,
          payments:[
            {kind:"economy",bucket:"action",amount:{value:1},consumeAt:"commit",refundOnCancel:true},
            {kind:"resource",resource:FIGHTER_SECOND_WIND_RESOURCE_ID,amount:{value:1},consumeAt:"commit"},
          ],
          entryPoints:[{
            id:ENTRY_POINT_ID,
            invocation:"manual",
            operations:[],
          }],
        },
      }],
    }],
  });
}

function persistedResourceCurrent(adapter:MockAdapter,characterId:string,resourceId:string) {
  const persistence=getCharacterLibraryPersistenceStateForTests(adapter);
  const character=persistence?.document?.characters.find((entry)=>entry.characterId===characterId);
  return character?.runtime.resources.find((entry)=>entry.id===resourceId)?.current;
}

async function restartedResourceCurrent(store:MemoryCharacterLibraryStore,resourceId:string) {
  const restarted=new MockAdapter();
  setCharacterLibraryStoreForTests(restarted,store);
  const snapshot=await restarted.getSnapshot();
  return snapshot.activeCharacter.resources.find((entry)=>entry.id===resourceId)?.current;
}

test("unknown installed Common Play resource payment persists through restart and Undo",async()=>{
  const characterStore=new MemoryCharacterLibraryStore();
  const adapter=new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,characterStore);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());

  const preview=await adapter.previewContentImport(packagePayload());
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  let snapshot=await adapter.getSnapshot();
  const characterId=snapshot.activeCharacter.id;
  const before=snapshot.activeCharacter.resources.find((entry)=>entry.id===FIGHTER_SECOND_WIND_RESOURCE_ID)?.current;
  assert.ok(before!==undefined&&before>0);

  const actionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(CONTENT_ID,MODULE_ID,"1"),
    mechanicId:MECHANIC_ID,
    entryPointId:ENTRY_POINT_ID,
  });
  await adapter.resolveAction(actionId,[characterId]);

  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===FIGHTER_SECOND_WIND_RESOURCE_ID)?.current,before-1);
  assert.equal(persistedResourceCurrent(adapter,characterId,FIGHTER_SECOND_WIND_RESOURCE_ID),before-1);
  assert.equal(await restartedResourceCurrent(characterStore,FIGHTER_SECOND_WIND_RESOURCE_ID),before-1);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===FIGHTER_SECOND_WIND_RESOURCE_ID)?.current,before);
  assert.equal(persistedResourceCurrent(adapter,characterId,FIGHTER_SECOND_WIND_RESOURCE_ID),before);
  assert.equal(await restartedResourceCurrent(characterStore,FIGHTER_SECOND_WIND_RESOURCE_ID),before);
});
