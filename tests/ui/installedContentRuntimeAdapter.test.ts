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
  assert.equal(builtin.filter((entry)=>entry.category==="item").length,115);
  assert.equal(initial.catalog.length,builtin.length,"initial catalog must contain only canonical builtin content");
  assert.ok(builtin.some((entry)=>entry.contentId==="dnd.srd521.item.gear.rations"));
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
  assert.ok(matches.some((entry)=>entry.sourceId==="homebrew.stone-pack" && entry.version==="0.1"));
  assert.ok(matches.some((entry)=>entry.sourceId==="homebrew.other-pack" && entry.version==="2.0"));
});

test("identical exact activation is idempotent but different payload under the same qualified identity is rejected", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  await adapter.getSnapshot();
  await previewAndActivate(adapter,payload());
  const idempotent=await previewAndActivate(adapter,payload());
  assert.equal(idempotent.catalog.filter((entry)=>entry.scope==="local" && entry.contentId==="subclass.stoneguard").length,1);
  const preview=await adapter.previewContentImport(payload({description:"changed payload"}));
  assert.ok(preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"));
});

test("local import requires stable sourceId separate from display source", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  await adapter.getSnapshot();
  const preview=await adapter.previewContentImport(payload({sourceId:undefined}));
  assert.ok(preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"));
});

test("a local install cannot claim an existing builtin qualified identity", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  await adapter.getSnapshot();
  const preview=await adapter.previewContentImport(payload({
    id:"dnd.srd521.class.fighter",
    category:"class",
    sourceId:"dnd.srd-5.2.1",
    source:"System Reference Document",
    version:"0.1-draft",
  }));
  assert.ok(preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"));
});

test("storage failure keeps the reviewed preview and previous composed catalog authoritative", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  const initial=await adapter.getSnapshot();
  const preview=await adapter.previewContentImport(payload());
  assert.ok(preview.contentImport?.entry);
  store.failNextWrite=true;
  const failed=await adapter.activateContentImport();
  assert.ok(failed.contentImport?.entry);
  assert.equal(failed.catalog.length,initial.catalog.length);
});

test("session-only content remains session-only and is absent from the installed document", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  await adapter.getSnapshot();
  const sessionPayload=payload({sourceId:"session.pack",source:"Session Pack",version:"1.0"});
  const preview=await adapter.previewContentImport(sessionPayload);
  assert.ok(preview.contentImport?.entry);
  const committed=await adapter.activateContentImport("session");
  assert.ok(committed.catalog.some((entry)=>entry.scope==="session" && entry.contentId==="subclass.stoneguard"));
  assert.equal(getInstalledContentPersistenceStateForTests(adapter)?.document?.entries.length,0);
});
