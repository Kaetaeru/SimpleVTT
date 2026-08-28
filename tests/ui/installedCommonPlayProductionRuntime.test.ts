import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/installedContentRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { FIGHTER_ACTION_SURGE_RESOURCE_ID, FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID } from "../../src/domain/coreClassResources";

const MODULE_ID="homebrew.production-probe";
const MODULE_VERSION="1";
const CONTENT_ID="option.external-production-probe";
const MECHANIC_ID="external.unknown.production-probe";
const ENTRY_POINT_ID="activate";

function packagePayload() {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:MODULE_ID,
    moduleVersion:MODULE_VERSION,
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"External Production Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:CONTENT_ID,
      category:"option",
      presentation:{defaultLocale:"en",originalName:"External Production Probe",locales:{en:{name:"External Production Probe",description:"Portable production dispatch probe"}}},
      mechanics:[{
        kind:"common-play",
        config:{
          schemaVersion:"0.2-draft",
          id:MECHANIC_ID,
          payments:[
            {kind:"resource",resource:FIGHTER_ACTION_SURGE_RESOURCE_ID,amount:{value:1},consumeAt:"commit"},
            {kind:"resource",resource:FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID,amount:{value:1},consumeAt:"commit"},
          ],
          entryPoints:[{
            id:ENTRY_POINT_ID,
            invocation:"manual",
            operations:[{kind:"economy.modify",bucket:"action.extra.non-magic",amount:{value:1}}],
          }],
        },
      }],
    }],
  });
}

test("installed portable Common Play executes through the production resolveAction authority path", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);

  const preview=await adapter.previewContentImport(packagePayload());
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  const actionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(CONTENT_ID,MODULE_ID,MODULE_VERSION),
    mechanicId:MECHANIC_ID,
    entryPointId:ENTRY_POINT_ID,
  });
  await adapter.resolveAction(actionId,["char.aelar"]);

  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.resolution?.actionId,actionId);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.length,1);
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id===FIGHTER_ACTION_SURGE_RESOURCE_ID)?.current,0);
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id===FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID)?.current,0);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions,undefined);
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id===FIGHTER_ACTION_SURGE_RESOURCE_ID)?.current,1);
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id===FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID)?.current,1);
});
