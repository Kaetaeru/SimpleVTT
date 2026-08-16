import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/installedContentRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import {
  getInstalledContentPersistenceStateForTests,
  setInstalledContentStoreForTests,
} from "../../src/app/installedContentRuntimeAdapter";

function payload(overrides:Record<string,unknown>={}) {
  return JSON.stringify({
    id:"subclass.stoneguard",
    category:"subclass",
    nameKo:"석벽 수호자",
    nameEn:"Stoneguard",
    sourceId:"homebrew.stone-pack",
    source:"Stone Pack",
    version:"0.1",
    description:"durable local subclass",
    relationships:[{label:"기본 클래스",targetId:"dnd.srd521.class.fighter",targetName:"파이터"}],
    capabilities:["content"],
    ...overrides,
  });
}

async function previewAndActivate(adapter:MockAdapter,json:string) {
  const preview=await adapter.previewContentImport(json);
  assert.ok(preview.contentImport?.entry);
  assert.ok(!preview.contentImport.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport.validation));
  return adapter.activateContentImport();
}

test("canonical builtin catalog composes before durable local content and reloads", async () => {
  const store=new MemoryInstalledContentStore();
  const writer=new MockAdapter();
  setInstalledContentStoreForTests(writer,store);
  const initial=await writer.getSnapshot();
  const builtin=initial.catalog.filter((entry)=>entry.scope==="builtin");
  assert.ok(builtin.every((entry)=>entry.id.startsWith("content:")));
  assert.equal(builtin.filter((entry)=>entry.category==="class").length,12);
  assert.equal(builtin.filter((entry)=>entry.category==="species").length,9);
  assert.equal(builtin.filter((entry)=>entry.category==="background").length,4);
  assert.equal(builtin.filter((entry)=>entry.category==="spell").length,339);
  assert.equal(builtin.filter((entry)=>entry.category==="feat").length,17);
  assert.equal(builtin.filter((entry)=>entry.category==="item").length,114);
  assert.equal(initial.catalog.length,495);
  assert.ok(builtin.some((entry)=>entry.contentId==="dnd.srd521.class.fighter" && entry.nameKo==="파이터" && entry.nameEn==="Fighter" && entry.sourceId==="dnd.srd-5.2.1" && entry.version==="0.1-draft"));
  assert.ok(!builtin.some((entry)=>entry.contentId==="class.fighter"));
  assert.ok(builtin.some((entry)=>entry.contentId==="dnd.srd521.item.weapon.longsword" && entry.category==="item"));
  assert.ok(builtin.some((entry)=>entry.contentId==="dnd.srd521.spell.healing-word" && entry.description.length>0 && !entry.description.includes("DEMO")));
  assert.equal(new Set(builtin.map((entry)=>entry.id)).size,builtin.length);
  assert.equal(getInstalledContentPersistenceStateForTests(writer)?.document?.entries.length,0,"builtin product content must not be copied into the installed-content document");

  const committed=await previewAndActivate(writer,payload());
  const local=committed.catalog.find((entry)=>entry.scope==="local" && entry.contentId==="subclass.stoneguard");
  assert.ok(local);
  assert.equal(local.sourceId,"homebrew.stone-pack");
  assert.match(local.id,/^content:/);
  assert.equal(committed.contentImport,null);
  assert.equal(committed.contentCatalogPersistence?.storageRevision,1);

  const reader=new MockAdapter();
  setInstalledContentStoreForTests(reader,store);
  const restored=await reader.getSnapshot();
  assert.ok(restored.catalog.some((entry)=>entry.id===local.id));
  assert.ok(restored.catalog.some((entry)=>entry.scope==="builtin" && entry.contentId==="dnd.srd521.class.fighter"));
  assert.equal(restored.contentCatalogPersistence?.storageRevision,1);
});

test("same portable contentId from different source/version identities coexists in the resolved catalog", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  await adapter.getSnapshot();
  await previewAndActivate(adapter,payload());
  const second=await previewAndActivate(adapter,payload({sourceId:"homebrew.other-pack",source:"Other Pack",version:"2.0",nameKo:"다른 석벽 수호자"}));
  const matches=second.catalog.filter((entry)=>entry.scope==="local" && entry.contentId==="subclass.stoneguard");
  assert.equal(matches.length,2);
  assert.equal(new Set(matches.map((entry)=>entry.id)).size,2);
  assert.deepEqual(new Set(matches.map((entry)=>entry.sourceId)),new Set(["homebrew.stone-pack","homebrew.other-pack"]));
});

test("identical exact activation is idempotent but different payload under the same qualified identity is rejected", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  await adapter.getSnapshot();
  await previewAndActivate(adapter,payload());
  const firstState=getInstalledContentPersistenceStateForTests(adapter)!;
  assert.equal(firstState.storageRevision,1);

  const identical=await previewAndActivate(adapter,payload());
  assert.equal(identical.contentCatalogPersistence?.storageRevision,1);
  assert.equal(identical.catalog.filter((entry)=>entry.scope==="local").length,1);

  const preview=await adapter.previewContentImport(payload({description:"changed without version bump"}));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"));
  const rejected=await adapter.activateContentImport();
  assert.equal(rejected.contentCatalogPersistence?.storageRevision,1);
  assert.ok(rejected.contentImport?.validation.some((entry)=>entry.severity==="blocking" && /conflict/.test(entry.message)));
  assert.equal(rejected.catalog.find((entry)=>entry.scope==="local")?.description,"durable local subclass");
});

test("local import requires stable sourceId separate from display source", async () => {
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(payload({sourceId:undefined}));
  assert.ok(preview.contentImport?.validation.some((entry)=>entry.severity==="blocking" && /sourceId/.test(entry.message)));
});

test("a local install cannot claim an existing builtin qualified identity", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  const initial=await adapter.getSnapshot();
  const builtin=initial.catalog.find((entry)=>entry.scope==="builtin");
  assert.ok(builtin?.contentId && builtin.sourceId);

  const preview=await adapter.previewContentImport(payload({
    id:builtin.contentId,
    category:builtin.category,
    sourceId:builtin.sourceId,
    source:builtin.source,
    version:builtin.version,
  }));
  assert.ok(preview.contentImport?.validation.some((entry)=>entry.severity==="blocking" && /Builtin content qualified identity/.test(entry.message)));
  assert.ok(!preview.contentImport?.validation.some((entry)=>/module\.manifest\.drift/.test(entry.message)));
  const rejected=await adapter.activateContentImport();
  assert.ok(rejected.contentImport?.validation.some((entry)=>entry.severity==="blocking" && /Builtin content qualified identity/.test(entry.message)));
  assert.equal(rejected.contentCatalogPersistence?.storageRevision,0);
  assert.equal((await store.readGenerations()).length,0);
  assert.equal(rejected.catalog.filter((entry)=>entry.id===builtin.id).length,1);
});

test("storage failure keeps the reviewed preview and previous composed catalog authoritative", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  const before=await adapter.getSnapshot();
  const builtinIds=before.catalog.map((entry)=>entry.id);
  const preview=await adapter.previewContentImport(payload());
  assert.ok(preview.contentImport?.entry);
  store.failNextWrite("disk full");

  const failed=await adapter.activateContentImport();
  assert.deepEqual(failed.catalog.map((entry)=>entry.id),builtinIds);
  assert.ok(failed.contentImport?.entry);
  assert.ok(failed.contentImport?.validation.some((entry)=>/disk full/.test(entry.message)));
  assert.equal(failed.contentCatalogPersistence?.status,"error");
  assert.equal((await store.readGenerations()).length,0);
});

test("session-only content remains session-only and is absent from the installed document", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  const initial=await adapter.getSnapshot();
  assert.ok(initial.session.sessionContent.length>0);
  await previewAndActivate(adapter,payload());
  const state=getInstalledContentPersistenceStateForTests(adapter)!;
  const serialized=JSON.stringify(state.document);
  for (const sessionEntry of initial.session.sessionContent) assert.ok(!serialized.includes(sessionEntry));
});
