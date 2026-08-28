import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/installedContentRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import {
  getInstalledContentPersistenceStateForTests,
  setInstalledContentStoreForTests,
} from "../../src/app/installedContentRuntimeAdapter";

function commonPlayDefinition() {
  return {
    schemaVersion:"0.2-draft",
    id:"action.portable.extra-action",
    payments:[{
      kind:"resource",
      resource:"fighter.action-surge",
      amount:{value:1},
      consumeAt:"commit",
      refundOnCancel:true,
    }],
    entryPoints:[{
      id:"activate",
      invocation:"manual",
      operations:[{
        kind:"economy.modify",
        bucket:"action.extra.non-magic",
        amount:{value:1},
      }],
    }],
  };
}

function packagePayload(mechanics:unknown[]) {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:"homebrew.portable-common-play",
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"Portable Common Play Test",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:"option.external-extra-action",
      category:"option",
      presentation:{
        defaultLocale:"en",
        originalName:"External Extra Action",
        locales:{en:{name:"External Extra Action",description:"portable executable content"}},
      },
      mechanics,
    }],
  });
}

test("supported Common Play mechanics survive RuleModule install and rehydrate as data", async () => {
  const definition=commonPlayDefinition();
  const store=new MemoryInstalledContentStore();
  const writer=new MockAdapter();
  setInstalledContentStoreForTests(writer,store);

  const preview=await writer.previewContentImport(packagePayload([{kind:"common-play",config:definition}]));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await writer.activateContentImport();

  const written=getInstalledContentPersistenceStateForTests(writer)?.document?.entries.find((entry)=>entry.contentId==="option.external-extra-action") as ({commonPlay?:unknown[]}|undefined);
  assert.ok(written);
  assert.deepEqual(written.commonPlay,[definition]);

  const reader=new MockAdapter();
  setInstalledContentStoreForTests(reader,store);
  await reader.getSnapshot();
  const restored=getInstalledContentPersistenceStateForTests(reader)?.document?.entries.find((entry)=>entry.contentId==="option.external-extra-action") as ({commonPlay?:unknown[]}|undefined);
  assert.deepEqual(restored?.commonPlay,[definition]);
});

test("unknown executable mechanic kinds remain explicitly unsupported", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  const preview=await adapter.previewContentImport(packagePayload([{kind:"custom-rule",config:{value:1}}]));
  assert.ok(preview.contentImport?.validation.some((entry)=>entry.severity==="blocking" && /mechanics cannot be activated|unsupported mechanic/i.test(entry.message)));
  await adapter.activateContentImport();
  assert.equal((await store.readGenerations()).length,0);
});
