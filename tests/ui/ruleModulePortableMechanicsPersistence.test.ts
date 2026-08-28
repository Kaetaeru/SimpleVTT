import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/installedContentRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import {
  getInstalledContentPersistenceStateForTests,
  setInstalledContentStoreForTests,
} from "../../src/app/installedContentRuntimeAdapter";

const commonPlayDefinition={
  schemaVersion:"0.2-draft",
  id:"external.portable.extra-action",
  payments:[{
    kind:"resource",
    resource:"resource.external.primary",
    amount:{value:1},
    consumeAt:"commit",
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

const portableMechanic={kind:"common-play",config:commonPlayDefinition};
type PersistedPortableEntry={contentId:string;mechanics?:unknown[]};

function packagePayload() {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:"homebrew.portable-mechanics",
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"Portable Mechanics",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:"option.portable-action",
      category:"option",
      presentation:{defaultLocale:"en",originalName:"Portable Action",locales:{en:{name:"Portable Action",description:"generic Common Play"}}},
      mechanics:[portableMechanic],
    }],
  });
}

function persistedEntry(adapter:MockAdapter) {
  return getInstalledContentPersistenceStateForTests(adapter)?.document?.entries
    .map((entry)=>entry as unknown as PersistedPortableEntry)
    .find((entry)=>entry.contentId==="option.portable-action");
}

test("supported Common Play mechanics survive RuleModule preview, install, and hydration unchanged", async () => {
  const store=new MemoryInstalledContentStore();
  const writer=new MockAdapter();
  setInstalledContentStoreForTests(writer,store);

  const preview=await writer.previewContentImport(packagePayload());
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));

  await writer.activateContentImport();
  assert.deepEqual(persistedEntry(writer)?.mechanics,[portableMechanic]);

  const reader=new MockAdapter();
  setInstalledContentStoreForTests(reader,store);
  await reader.getSnapshot();
  assert.deepEqual(persistedEntry(reader)?.mechanics,[portableMechanic]);
});
