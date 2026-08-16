import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/installedContentRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";

function modulePayload(id:string,moduleId:string,overrides:Record<string,unknown>={}) {
  return JSON.stringify({
    id,category:"option",nameKo:id,nameEn:id,sourceId:moduleId,source:moduleId,version:"1",description:"module validation fixture",
    module:{moduleId,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},dependencies:[],conflicts:[],capabilities:[],extensionPoints:[]},
    ...overrides,
  });
}

test("missing exact dependency blocks preview/activation before any installed-content write", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  const preview=await adapter.previewContentImport(modulePayload("option.child","mod.child",{
    module:{moduleId:"mod.child",moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},dependencies:[{moduleId:"mod.base",version:"2"}],conflicts:[],capabilities:[],extensionPoints:[]},
  }));
  assert.ok(preview.contentImport?.validation.some((entry)=>entry.severity==="blocking" && /module.dependency.missing/.test(entry.message)));
  const result=await adapter.activateContentImport();
  assert.ok(result.contentImport?.entry);
  assert.equal((await store.readGenerations()).length,0);
});

test("installed exact dependency satisfies a later manifest and both module metadata survive reload", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  let preview=await adapter.previewContentImport(modulePayload("option.base","mod.base"));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"));
  await adapter.activateContentImport();

  preview=await adapter.previewContentImport(modulePayload("option.child","mod.child",{
    module:{moduleId:"mod.child",moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},dependencies:[{moduleId:"mod.base",version:"1"}],conflicts:[],capabilities:[],extensionPoints:[]},
  }));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  const committed=await adapter.activateContentImport();
  assert.equal(committed.contentImport,null);

  const reader=new MockAdapter();
  setInstalledContentStoreForTests(reader,store);
  const restored=await reader.getSnapshot();
  assert.ok(restored.catalog.some((entry)=>entry.contentId==="option.base"));
  assert.ok(restored.catalog.some((entry)=>entry.contentId==="option.child"));
});

test("semantic parent relationship can target the canonical builtin catalog without persisting builtin entries", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  const preview=await adapter.previewContentImport(modulePayload("subclass.local","mod.subclass",{
    category:"subclass",
    relationships:[{kind:"parent",target:"dnd.srd521.class.fighter"}],
  }));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  const committed=await adapter.activateContentImport();
  assert.equal(committed.contentImport,null);
  const generations=await store.readGenerations();
  assert.equal(generations.length,1);
  assert.ok(generations[0].payload?.includes("subclass.local"));
  assert.ok(!generations[0].payload?.includes('"contentId": "dnd.srd521.class.fighter"'));
});

test("RulesProfile mismatch and unsupported capability reject a reviewed manifest without storage mutation", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  const preview=await adapter.previewContentImport(modulePayload("option.bad","mod.bad",{
    requiresCapabilities:["capability.unsupported"],
    module:{moduleId:"mod.bad",moduleVersion:"1",rulesProfile:{id:"other.profile",version:"1"},dependencies:[],conflicts:[],capabilities:[],extensionPoints:[]},
  }));
  assert.ok(preview.contentImport?.validation.some((entry)=>/module.rules-profile/.test(entry.message)));
  assert.ok(preview.contentImport?.validation.some((entry)=>/content.capability.missing/.test(entry.message)));
  await adapter.activateContentImport();
  assert.equal((await store.readGenerations()).length,0);
});
