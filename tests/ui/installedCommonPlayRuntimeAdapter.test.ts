import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import {
  getInstalledContentPersistenceStateForTests,
  setInstalledContentStoreForTests,
} from "../../src/app/installedContentRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import {
  FIGHTER_ACTION_SURGE_RESOURCE_ID,
  FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID,
} from "../../src/domain/coreClassResources";

const MODULE_ID="homebrew.portable-common-play";
const MODULE_VERSION="1";
const CONTENT_ID="external.action.quickstep";

function packagePayload(contentId=CONTENT_ID) {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:MODULE_ID,
    moduleVersion:MODULE_VERSION,
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"ko",
    source:{document:"Portable Common Play Test",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:contentId,
      category:"option",
      presentation:{
        defaultLocale:"ko",
        originalName:"Quickstep",
        locales:{ko:{name:"퀵스텝",description:"portable Common Play action"}},
      },
      mechanics:[{
        kind:"common-play",
        config:{
          schemaVersion:"0.2-draft",
          id:contentId,
          payments:[
            {kind:"resource",resource:FIGHTER_ACTION_SURGE_RESOURCE_ID,amount:{value:1},consumeAt:"commit"},
            {kind:"resource",resource:FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID,amount:{value:1},consumeAt:"commit"},
          ],
          entryPoints:[{
            id:"activate",
            invocation:"manual",
            operations:[
              {kind:"economy.modify",bucket:"action.extra.non-magic",amount:{value:1}},
            ],
          }],
        },
      }],
    }],
  });
}

test("installed external Common Play mechanics persist and execute through the production action boundary", async () => {
  const store=new MemoryInstalledContentStore();
  const writer=new MockAdapter();
  setInstalledContentStoreForTests(writer,store);

  const preview=await writer.previewContentImport(packagePayload());
  assert.ok(preview.contentImport?.package);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await writer.activateContentImport();

  const persisted=getInstalledContentPersistenceStateForTests(writer)?.document;
  const installed=persisted?.entries.find((entry)=>entry.contentId===CONTENT_ID);
  assert.ok(installed);
  assert.equal(installed.mechanics?.length,1);
  assert.equal(installed.mechanics?.[0]?.kind,"common-play");

  const reader=new MockAdapter();
  setInstalledContentStoreForTests(reader,store);
  await reader.getSnapshot();
  await reader.startInitiative();
  await reader.setCurrentActor("char.aelar");

  const actionId=catalogQualifiedId(CONTENT_ID,MODULE_ID,MODULE_VERSION);
  await reader.resolveAction(actionId,["char.aelar"]);
  const snapshot=await reader.getSnapshot();

  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraActions?.[0]?.allowsMagicAction,false);
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id===FIGHTER_ACTION_SURGE_RESOURCE_ID)?.current,0);
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id===FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID)?.current,0);
});
