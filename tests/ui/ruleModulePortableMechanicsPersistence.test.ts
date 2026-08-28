import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/installedContentRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import {
  getInstalledContentPersistenceStateForTests,
  installSessionInstalledContent,
  requiredSessionInstalledContent,
  setInstalledContentStoreForTests,
  snapshotSessionInstalledContent,
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

async function installedWriter() {
  const store=new MemoryInstalledContentStore();
  const writer=new MockAdapter();
  setInstalledContentStoreForTests(writer,store);
  const preview=await writer.previewContentImport(packagePayload());
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await writer.activateContentImport();
  return {writer,store};
}

test("supported Common Play mechanics survive RuleModule preview, install, and hydration unchanged", async () => {
  const {writer,store}=await installedWriter();
  assert.deepEqual(persistedEntry(writer)?.mechanics,[portableMechanic]);

  const reader=new MockAdapter();
  setInstalledContentStoreForTests(reader,store);
  await reader.getSnapshot();
  assert.deepEqual(persistedEntry(reader)?.mechanics,[portableMechanic]);
});

test("installed portable mechanics use the existing whole-entry session synchronization path", async () => {
  const {writer}=await installedWriter();
  const peer=new MockAdapter();
  setInstalledContentStoreForTests(peer,new MemoryInstalledContentStore());
  await peer.getSnapshot();

  const required=await requiredSessionInstalledContent(writer,await snapshotSessionInstalledContent(peer));
  assert.equal(required.length,1);
  assert.deepEqual(required[0].mechanics,[portableMechanic]);

  await installSessionInstalledContent(peer,required);
  assert.deepEqual(persistedEntry(peer)?.mechanics,[portableMechanic]);
  assert.deepEqual(await requiredSessionInstalledContent(writer,await snapshotSessionInstalledContent(peer)),[]);
});

test("invalid Common Play config blocks RuleModule activation atomically", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  const raw=JSON.parse(packagePayload()) as {content:Array<Record<string,unknown>>};
  raw.content[0].mechanics=[{
    kind:"common-play",
    config:{
      schemaVersion:"0.2-draft",
      id:"external.invalid",
      entryPoints:[{
        id:"activate",
        invocation:"manual",
        operations:[{kind:"arbitrary.execute",value:"boom"}],
      }],
    },
  }];

  const preview=await adapter.previewContentImport(JSON.stringify(raw));
  assert.ok(
    preview.contentImport?.validation.some((entry)=>entry.severity==="blocking" && /unsupported Common Play operation/.test(entry.message)),
    JSON.stringify(preview.contentImport?.validation),
  );
  await adapter.activateContentImport();
  assert.equal((await store.readGenerations()).length,0);
});

test("tampered session mechanics are revalidated before peer persistence", async () => {
  const {writer}=await installedWriter();
  const required=await requiredSessionInstalledContent(writer,[]);
  assert.equal(required.length,1);
  const tampered=required as unknown as Array<{
    mechanics?:Array<{config:{entryPoints:Array<{operations:unknown[]}>}}>;
  }>;
  tampered[0].mechanics![0].config.entryPoints[0].operations=[{kind:"arbitrary.execute",value:"boom"}];

  const peerStore=new MemoryInstalledContentStore();
  const peer=new MockAdapter();
  setInstalledContentStoreForTests(peer,peerStore);
  await peer.getSnapshot();
  await assert.rejects(
    installSessionInstalledContent(peer,required),
    /unsupported Common Play operation/,
  );
  assert.equal((await peerStore.readGenerations()).length,0);
});
