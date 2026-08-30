import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import {
  getCharacterLibraryPersistenceStateForTests,
  setCharacterLibraryStoreForTests,
} from "../../src/app/characterLibraryRuntimeAdapter";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import {
  getInstalledContentPersistenceStateForTests,
  setInstalledContentStoreForTests,
} from "../../src/app/installedContentRuntimeAdapter";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { FIGHTER_SECOND_WIND_RESOURCE_ID } from "../../src/domain/coreClassResources";

const MODULE_ID="homebrew.family-d-persistence-probe";
const CONTENT_ID="option.family-d-persistence-probe";
const MECHANIC_ID="external.unknown.family-d-persistence-probe";
const ENTRY_POINT_ID="activate";

const SOURCE_MODULE_ID="homebrew.family-d-source-owned-probe";
const SOURCE_CONTENT_ID="option.family-d-source-owned-probe";
const SOURCE_MECHANIC_ID="external.unknown.family-d-source-owned-probe";
const SOURCE_RESOURCE_ID="resource.external.family-d-source-owned-probe";
const MATERIALIZE_ENTRY_POINT_ID="materialize";
const SPEND_ENTRY_POINT_ID="spend";

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

function sourceOwnedPackagePayload() {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:SOURCE_MODULE_ID,
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"Family D Source-Owned Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:SOURCE_CONTENT_ID,
      category:"option",
      presentation:{
        defaultLocale:"en",
        originalName:"Family D Source-Owned Probe",
        locales:{en:{name:"Family D Source-Owned Probe",description:"Portable source-owned resource probe"}},
      },
      mechanics:[{
        kind:"common-play",
        config:{
          schemaVersion:"0.2-draft",
          id:SOURCE_MECHANIC_ID,
          entryPoints:[
            {
              id:MATERIALIZE_ENTRY_POINT_ID,
              invocation:"manual",
              operations:[{
                kind:"resource.change",
                resource:SOURCE_RESOURCE_ID,
                amount:{value:2},
                target:"actor",
                createIfMissing:{
                  label:"Portable Momentum",
                  maximum:{value:2},
                  recovery:{shortRest:"all",longRest:"all"},
                },
              }],
            },
            {
              id:SPEND_ENTRY_POINT_ID,
              invocation:"manual",
              operations:[{
                kind:"resource.change",
                resource:SOURCE_RESOURCE_ID,
                amount:{value:-1},
                target:"actor",
              }],
            },
          ],
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

test("unknown installed Common Play materializes and removes its own durable resource pool without named registration",async()=>{
  const characterStore=new MemoryCharacterLibraryStore();
  const adapter=new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,characterStore);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());

  const preview=await adapter.previewContentImport(sourceOwnedPackagePayload());
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  const activation=await adapter.activateContentImport();
  assert.equal(activation.contentImport,null,JSON.stringify(activation.contentImport?.validation));
  const installed=getInstalledContentPersistenceStateForTests(adapter)?.document?.entries.find((entry)=>entry.contentId===SOURCE_CONTENT_ID&&entry.sourceId===SOURCE_MODULE_ID);
  assert.equal(installed?.mechanics?.[0]?.config.id,SOURCE_MECHANIC_ID,JSON.stringify(getInstalledContentPersistenceStateForTests(adapter)?.document));
  assert.equal(installed?.mechanics?.[0]?.config.entryPoints?.length,2);

  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  let snapshot=await adapter.getSnapshot();
  const characterId=snapshot.activeCharacter.id;
  assert.equal(snapshot.activeCharacter.resources.some((entry)=>entry.id===SOURCE_RESOURCE_ID),false);

  const catalogId=catalogQualifiedId(SOURCE_CONTENT_ID,SOURCE_MODULE_ID,"1");
  const materializeActionId=installedCommonPlayActionId({
    catalogId,
    mechanicId:SOURCE_MECHANIC_ID,
    entryPointId:MATERIALIZE_ENTRY_POINT_ID,
  });
  const spendActionId=installedCommonPlayActionId({
    catalogId,
    mechanicId:SOURCE_MECHANIC_ID,
    entryPointId:SPEND_ENTRY_POINT_ID,
  });

  await adapter.resolveAction(materializeActionId,[characterId]);
  snapshot=await adapter.getSnapshot();
  const created=snapshot.activeCharacter.resources.find((entry)=>entry.id===SOURCE_RESOURCE_ID);
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(created?.current,2);
  assert.equal(created?.max,2);
  assert.equal(created?.label,"Portable Momentum");
  assert.equal(created?.source,SOURCE_MECHANIC_ID);
  assert.deepEqual(created?.recovery,{shortRest:"all",longRest:"all"});
  assert.equal(persistedResourceCurrent(adapter,characterId,SOURCE_RESOURCE_ID),2);
  assert.equal(await restartedResourceCurrent(characterStore,SOURCE_RESOURCE_ID),2);

  await adapter.resolveAction(spendActionId,[characterId]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===SOURCE_RESOURCE_ID)?.current,1);
  assert.equal(persistedResourceCurrent(adapter,characterId,SOURCE_RESOURCE_ID),1);
  assert.equal(await restartedResourceCurrent(characterStore,SOURCE_RESOURCE_ID),1);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===SOURCE_RESOURCE_ID)?.current,2);
  assert.equal(persistedResourceCurrent(adapter,characterId,SOURCE_RESOURCE_ID),2);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.some((entry)=>entry.id===SOURCE_RESOURCE_ID),false);
  assert.equal(persistedResourceCurrent(adapter,characterId,SOURCE_RESOURCE_ID),undefined);
  assert.equal(await restartedResourceCurrent(characterStore,SOURCE_RESOURCE_ID),undefined);
});
