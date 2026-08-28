import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/installedContentRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { decodeInstalledContent, InstalledContentRepository } from "../../src/app/installedContentPersistence";
import {
  getInstalledContentPersistenceStateForTests,
  installSessionInstalledContent,
  requiredSessionInstalledContent,
  setInstalledContentStoreForTests,
} from "../../src/app/installedContentRuntimeAdapter";

function packagePayload(overrides:Record<string,unknown>={}) {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:"homebrew.atomic-pack",
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"ko",
    source:{document:"Atomic Pack",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[
      {
        id:"option.atomic-parent",category:"option",
        presentation:{defaultLocale:"ko",originalName:"Atomic Parent",locales:{ko:{name:"원자 부모",description:"parent"}}},
        extensionPoints:[{id:"children",acceptsCategories:["option"]}],
      },
      {
        id:"option.atomic-child",category:"option",
        presentation:{defaultLocale:"ko",originalName:"Atomic Child",locales:{ko:{name:"원자 자식",description:"child"}}},
        relationships:[{kind:"extends",target:"option.atomic-parent",targetVersion:"1",extensionPoint:"children"}],
      },
    ],
    ...overrides,
  });
}

function portableCommonPlayMechanic() {
  return {
    kind:"common-play",
    config:{
      schemaVersion:"0.2-draft",
      id:"external.unknown.resource-economy-action",
      payments:[
        {kind:"resource",resource:"resource.external.primary",amount:{value:1},consumeAt:"commit"},
        {kind:"resource",resource:"resource.external.same-turn",amount:{value:1},consumeAt:"commit"},
      ],
      entryPoints:[{
        id:"activate",
        invocation:"manual",
        operations:[{kind:"economy.modify",bucket:"action.extra.non-magic",amount:{value:1}}],
      }],
    },
  };
}

function portableCommonPlayD20Mechanic() {
  return {
    kind:"common-play",
    config:{
      schemaVersion:"0.2-draft",
      id:"external.unknown.generic-d20-action",
      entryPoints:[{
        id:"attempt",
        invocation:"manual",
        test:{kind:"ability-check",roller:"actor",dc:{value:15}},
        operations:[],
      }],
    },
  };
}

test("multi-entry RuleModule preview writes nothing and activation commits one generation", async () => {
  const store=new MemoryInstalledContentStore();
  const writer=new MockAdapter();
  setInstalledContentStoreForTests(writer,store);
  const preview=await writer.previewContentImport(packagePayload());
  assert.equal(preview.contentImport?.package?.moduleId,"homebrew.atomic-pack");
  assert.equal(preview.contentImport?.package?.entries.length,2);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  assert.equal((await store.readGenerations()).length,0,"preview must remain transient");

  const committed=await writer.activateContentImport();
  assert.equal(committed.contentImport,null);
  assert.equal(committed.contentCatalogPersistence?.storageRevision,1);
  assert.equal(committed.catalog.filter((entry)=>entry.scope==="local" && entry.sourceId==="homebrew.atomic-pack").length,2);
  const generations=await store.readGenerations();
  assert.equal(generations.length,1);
  assert.equal(generations[0].generation,1);

  const reader=new MockAdapter();
  setInstalledContentStoreForTests(reader,store);
  const restored=await reader.getSnapshot();
  assert.ok(restored.catalog.some((entry)=>entry.contentId==="option.atomic-parent"));
  assert.ok(restored.catalog.some((entry)=>entry.contentId==="option.atomic-child"));
  assert.equal(restored.contentCatalogPersistence?.storageRevision,1);
});

test("package member validation is visible per entry and blocks the whole package", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  const raw=JSON.parse(packagePayload()) as {content:Array<Record<string,unknown>>};
  raw.content[1].relationships=[{kind:"extends",target:"option.missing",targetVersion:"1",extensionPoint:"children"}];
  const preview=await adapter.previewContentImport(JSON.stringify(raw));
  assert.ok(preview.contentImport?.validation.some((entry)=>entry.severity==="blocking" && /relationship.target.missing/.test(entry.message)));
  const child=preview.contentImport?.package?.entries.find((entry)=>entry.contentId==="option.atomic-child");
  assert.ok(child?.validation.some((entry)=>entry.severity==="blocking" && /relationship.target.missing/.test(entry.message)));
  await adapter.activateContentImport();
  assert.equal((await store.readGenerations()).length,0);
});

test("registered Common Play resource and d20 mechanics persist, rehydrate, and survive installed-content session sync", async () => {
  const hostStore=new MemoryInstalledContentStore();
  const host=new MockAdapter();
  setInstalledContentStoreForTests(host,hostStore);
  const raw=JSON.parse(packagePayload()) as {content:Array<Record<string,unknown>>};
  const mechanics=[portableCommonPlayMechanic(),portableCommonPlayD20Mechanic()];
  raw.content[0].mechanics=mechanics;

  const preview=await host.previewContentImport(JSON.stringify(raw));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await host.activateContentImport();

  const installed=getInstalledContentPersistenceStateForTests(host)?.document?.entries.find((entry)=>entry.contentId==="option.atomic-parent");
  assert.deepEqual(installed?.mechanics,mechanics);

  const rehydratedHost=new MockAdapter();
  setInstalledContentStoreForTests(rehydratedHost,hostStore);
  await rehydratedHost.getSnapshot();
  const rehydrated=getInstalledContentPersistenceStateForTests(rehydratedHost)?.document?.entries.find((entry)=>entry.contentId==="option.atomic-parent");
  assert.deepEqual(rehydrated?.mechanics,mechanics);

  const sessionEntries=await requiredSessionInstalledContent(rehydratedHost,[]);
  const sessionEntry=sessionEntries.find((entry)=>entry.contentId==="option.atomic-parent");
  assert.deepEqual(sessionEntry?.mechanics,mechanics);

  const peerStore=new MemoryInstalledContentStore();
  const peer=new MockAdapter();
  setInstalledContentStoreForTests(peer,peerStore);
  await peer.getSnapshot();
  await installSessionInstalledContent(peer,sessionEntries);
  const peerInstalled=getInstalledContentPersistenceStateForTests(peer)?.document?.entries.find((entry)=>entry.contentId==="option.atomic-parent");
  assert.deepEqual(peerInstalled?.mechanics,mechanics);
});

test("rehydration rejects persisted non-manual Common Play mechanics", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  const raw=JSON.parse(packagePayload()) as {content:Array<Record<string,unknown>>};
  raw.content[0].mechanics=[portableCommonPlayMechanic()];
  const preview=await adapter.previewContentImport(JSON.stringify(raw));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();

  const generation=(await store.readGenerations())[0];
  if (!generation?.payload) throw new Error("expected persisted installed-content generation");
  const persisted=JSON.parse(generation.payload) as {
    entries:Array<{mechanics?:Array<{config:{entryPoints:Array<{invocation:string}>}}>}>
  };
  const mechanic=persisted.entries.find((entry)=>entry.mechanics?.length)?.mechanics?.[0];
  assert.ok(mechanic);
  mechanic.config.entryPoints[0].invocation="triggered";
  const corruptedPayload=JSON.stringify(persisted);

  assert.throws(()=>decodeInstalledContent(corruptedPayload),/manual/);
  const corruptedStore=new MemoryInstalledContentStore([{generation:generation.generation,payload:corruptedPayload}]);
  const repository=new InstalledContentRepository(corruptedStore);
  await assert.rejects(repository.hydrate(),/no valid committed installed-content generation remains/);
});

test("portable Common Play resource targets are rejected before unsupported mechanics can be persisted", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  const raw=JSON.parse(packagePayload()) as {content:Array<Record<string,unknown>>};
  const mechanic=portableCommonPlayMechanic() as unknown as {
    config:{entryPoints:Array<{operations:Array<Record<string,unknown>>}>};
  };
  mechanic.config.entryPoints[0].operations=[{
    kind:"resource.change",
    resource:"resource.external.primary",
    amount:{value:-1},
    target:"combatant.someone-else",
  }];
  raw.content[0].mechanics=[mechanic];

  const preview=await adapter.previewContentImport(JSON.stringify(raw));
  assert.ok(preview.contentImport?.validation.some((entry)=>entry.severity==="blocking" && /target must be actor or self/.test(entry.message)),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  assert.equal((await store.readGenerations()).length,0);
});

test("installed Common Play rejects non-manual entry points before persistence", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  const raw=JSON.parse(packagePayload()) as {content:Array<Record<string,unknown>>};
  const mechanic=portableCommonPlayMechanic() as unknown as {
    config:{entryPoints:Array<{invocation:string}>};
  };
  mechanic.config.entryPoints[0].invocation="triggered";
  raw.content[0].mechanics=[mechanic];

  const preview=await adapter.previewContentImport(JSON.stringify(raw));
  assert.ok(preview.contentImport?.validation.some((entry)=>entry.severity==="blocking" && /manual/.test(entry.message)),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  assert.equal((await store.readGenerations()).length,0);
});

test("installed Common Play rejects unsupported d20 authoring before persistence",async()=>{
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  const raw=JSON.parse(packagePayload()) as {content:Array<Record<string,unknown>>};
  const mechanic=portableCommonPlayD20Mechanic() as unknown as {config:{entryPoints:Array<{test:{roller:string}}>}};
  mechanic.config.entryPoints[0].test.roller="target";
  raw.content[0].mechanics=[mechanic];

  const preview=await adapter.previewContentImport(JSON.stringify(raw));
  assert.ok(preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"&&/roller must be actor/.test(entry.message)),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  assert.equal((await store.readGenerations()).length,0);
});

test("unsupported generic-catalog member data blocks package import instead of silently dropping mechanics", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  const raw=JSON.parse(packagePayload()) as {content:Array<Record<string,unknown>>};
  raw.content[0].mechanics=[{kind:"custom-rule",config:{value:1}}];
  const preview=await adapter.previewContentImport(JSON.stringify(raw));
  assert.ok(preview.contentImport?.validation.some((entry)=>entry.severity==="blocking" && /mechanics cannot be activated/.test(entry.message)));
  await adapter.activateContentImport();
  assert.equal((await store.readGenerations()).length,0);
});

test("package storage failure keeps reviewed package and installs no members", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  const preview=await adapter.previewContentImport(packagePayload());
  assert.ok(preview.contentImport?.package);
  store.failNextWrite("package disk full");
  const failed=await adapter.activateContentImport();
  assert.ok(failed.contentImport?.package);
  assert.ok(failed.contentImport?.validation.some((entry)=>/package disk full/.test(entry.message)));
  assert.equal(failed.contentCatalogPersistence?.status,"error");
  assert.equal(failed.catalog.filter((entry)=>entry.scope==="local" && entry.sourceId==="homebrew.atomic-pack").length,0);
  assert.equal((await store.readGenerations()).length,0);
});

test("existing changed qualified identity rejects the whole package without partial additions", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  const single=JSON.stringify({
    id:"option.atomic-parent",category:"option",nameKo:"기존 부모",nameEn:"Existing Parent",
    sourceId:"homebrew.atomic-pack",source:"Atomic Pack",version:"1",description:"existing different payload",relationships:[],capabilities:[],
  });
  let preview=await adapter.previewContentImport(single);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"));
  await adapter.activateContentImport();
  assert.equal((await store.readGenerations())[0].generation,1);

  preview=await adapter.previewContentImport(packagePayload());
  assert.ok(preview.contentImport?.package);
  const rejected=await adapter.activateContentImport();
  assert.ok(rejected.contentImport?.validation.some((entry)=>entry.severity==="blocking" && /Installed content conflict/.test(entry.message)));
  const generations=await store.readGenerations();
  assert.equal(generations.length,1);
  assert.equal(generations[0].generation,1);
  assert.equal(rejected.catalog.some((entry)=>entry.contentId==="option.atomic-child"),false);
});
