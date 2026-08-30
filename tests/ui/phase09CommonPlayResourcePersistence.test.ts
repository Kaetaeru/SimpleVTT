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
  requiredSessionInstalledContent,
  setInstalledContentStoreForTests,
} from "../../src/app/installedContentRuntimeAdapter";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { buildCharacterLibraryRecordV1, materializeCharacterRecordV1 } from "../../src/app/characterLibraryPersistence";
import { projectResolutionCharacterWriteBack } from "../../src/app/resolutionCharacterDurableProjection";
import type { ResolutionEvent } from "../../src/domain/resolutionTypes";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";
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

test("unknown installed Common Play materializes and spends its own durable resource pool without named registration",async()=>{
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
  const sessionEntries=await requiredSessionInstalledContent(adapter,[]);
  const sessionEntry=sessionEntries.find((entry)=>catalogQualifiedId(entry.contentId,entry.sourceId,entry.version)===catalogQualifiedId(SOURCE_CONTENT_ID,SOURCE_MODULE_ID,"1"));
  assert.equal(sessionEntry?.mechanics?.[0]?.config.id,SOURCE_MECHANIC_ID);
  assert.ok(sessionEntry?.mechanics?.[0]?.config.entryPoints?.some((entry)=>entry.id===MATERIALIZE_ENTRY_POINT_ID));

  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  let snapshot=await adapter.getSnapshot();
  const characterId=snapshot.activeCharacter.id;
  assert.equal(snapshot.activeCharacter.resources.some((entry)=>entry.id===SOURCE_RESOURCE_ID),false);
  const runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene);
  assert.equal(runtime?.clock.activeActorId,characterId);
  assert.ok(runtime?.combatants[characterId]);

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
  assert.equal(await restartedResourceCurrent(characterStore,SOURCE_RESOURCE_ID),2);
});

test("unknown installed Common Play materialization Undo removes its source-owned durable resource pool",async()=>{
  const characterStore=new MemoryCharacterLibraryStore();
  const adapter=new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,characterStore);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());

  const preview=await adapter.previewContentImport(sourceOwnedPackagePayload());
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  let snapshot=await adapter.getSnapshot();
  const characterId=snapshot.activeCharacter.id;
  const materializeActionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(SOURCE_CONTENT_ID,SOURCE_MODULE_ID,"1"),
    mechanicId:SOURCE_MECHANIC_ID,
    entryPointId:MATERIALIZE_ENTRY_POINT_ID,
  });

  await adapter.resolveAction(materializeActionId,[characterId]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===SOURCE_RESOURCE_ID)?.current,2);
  assert.equal(persistedResourceCurrent(adapter,characterId,SOURCE_RESOURCE_ID),2);
  assert.equal(await restartedResourceCurrent(characterStore,SOURCE_RESOURCE_ID),2);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.some((entry)=>entry.id===SOURCE_RESOURCE_ID),false);
  assert.equal(persistedResourceCurrent(adapter,characterId,SOURCE_RESOURCE_ID),undefined);
  assert.equal(await restartedResourceCurrent(characterStore,SOURCE_RESOURCE_ID),undefined);
});


test("temporary resource capacity overlay persists without mutating source maximum and reverses through Undo projection",async()=>{
  const adapter=new MockAdapter();
  const snapshot=await adapter.getSnapshot();
  const sheet=structuredClone(snapshot.activeCharacter);
  const resource=sheet.resources.find((entry)=>entry.id===FIGHTER_SECOND_WIND_RESOURCE_ID);
  assert.ok(resource);
  const baseMaximum=resource.max;
  const event={
    id:"family-d-capacity-persistence:event",
    resolutionId:"family-d-capacity-persistence",
    operationId:"family-d-capacity-persistence:resource",
    kind:"resource-capacity-probe",
    actorId:sheet.id,
    targetId:sheet.id,
    summary:"temporary capacity probe",
    provenance:[],
    stateChanges:[{
      kind:"resource",
      targetId:sheet.id,
      resourceId:resource.id,
      before:resource.current,
      after:resource.current,
      capacity:{
        before:{maximum:baseMaximum,maximumAfterLongRest:null},
        after:{maximum:baseMaximum+1,maximumAfterLongRest:baseMaximum},
      },
      provenance:[],
      lifetime:"character-durable",
      writeBack:"character",
    }],
    result:{},
  } satisfies ResolutionEvent;

  const forward=projectResolutionCharacterWriteBack(sheet,[event],"forward");
  assert.equal(forward.status,"committed",forward.status==="rejected"?forward.error:undefined);
  if (forward.status!=="committed") return;
  const expanded=forward.sheet.resources.find((entry)=>entry.id===resource.id);
  assert.equal(expanded?.max,baseMaximum+1);
  assert.equal(expanded?.sourceMaximum,baseMaximum);
  assert.equal(expanded?.maximumAfterLongRest,baseMaximum);

  const record=buildCharacterLibraryRecordV1(forward.sheet);
  assert.equal(record.source.resourceDefinitions?.find((entry)=>entry.id===resource.id)?.max,baseMaximum);
  const durable=record.runtime.resources.find((entry)=>entry.id===resource.id);
  assert.equal(durable?.maximum,baseMaximum+1);
  assert.equal(durable?.maximumAfterLongRest,baseMaximum);

  const restarted=materializeCharacterRecordV1(record);
  const restoredResource=restarted.resources.find((entry)=>entry.id===resource.id);
  assert.equal(restoredResource?.max,baseMaximum+1);
  assert.equal(restoredResource?.sourceMaximum,baseMaximum);
  assert.equal(restoredResource?.maximumAfterLongRest,baseMaximum);

  const inverse=projectResolutionCharacterWriteBack(restarted,[event],"inverse");
  assert.equal(inverse.status,"committed",inverse.status==="rejected"?inverse.error:undefined);
  if (inverse.status!=="committed") return;
  const normalized=inverse.sheet.resources.find((entry)=>entry.id===resource.id);
  assert.equal(normalized?.max,baseMaximum);
  assert.equal(normalized?.sourceMaximum,baseMaximum);
  assert.equal(normalized?.maximumAfterLongRest,undefined);

  const undoneRecord=buildCharacterLibraryRecordV1(inverse.sheet,record);
  assert.equal(undoneRecord.sourceRevision,record.sourceRevision);
  assert.equal(undoneRecord.source.resourceDefinitions?.find((entry)=>entry.id===resource.id)?.max,baseMaximum);
  const undoneRuntime=undoneRecord.runtime.resources.find((entry)=>entry.id===resource.id);
  assert.equal(undoneRuntime?.maximum,undefined);
  assert.equal(undoneRuntime?.maximumAfterLongRest,undefined);
});
