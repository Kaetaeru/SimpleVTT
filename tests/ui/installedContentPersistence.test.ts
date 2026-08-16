import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeInstalledContent,
  encodeInstalledContentV1,
  InstalledContentCorruptError,
  InstalledContentMigrationRequiredError,
  InstalledContentRepository,
} from "../../src/app/installedContentPersistence";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import type { InstalledCatalogEntryV1, InstalledContentDocumentV1 } from "../../src/app/installedContentContracts";

const entry=(overrides:Partial<InstalledCatalogEntryV1>={}):InstalledCatalogEntryV1 => ({
  contentId:"subclass.stoneguard",
  category:"subclass",
  nameKo:"석벽 수호자",
  nameEn:"Stoneguard",
  sourceId:"homebrew.stone-pack",
  source:"Stone Pack",
  version:"0.1",
  description:"local content",
  relationships:[],
  capabilities:["content"],
  ...overrides,
});

function document(storageRevision:number,entries:InstalledCatalogEntryV1[]):InstalledContentDocumentV1 {
  return {schemaId:"simplevtt.installed-content",schemaVersion:1,storageRevision,entries};
}

test("installed content repository keeps qualified identities distinct and exact identical installs idempotent", async () => {
  const store=new MemoryInstalledContentStore();
  const repository=new InstalledContentRepository(store);
  await repository.hydrate();

  const first=await repository.install(entry());
  assert.equal(first.status,"committed");
  if (first.status!=="committed") return;
  assert.equal(first.hydration.changed,true);
  assert.equal(first.hydration.document.storageRevision,1);

  const identical=await repository.install(entry());
  assert.equal(identical.status,"committed");
  if (identical.status!=="committed") return;
  assert.equal(identical.hydration.changed,false);
  assert.equal(identical.hydration.document.storageRevision,1);

  const secondSource=await repository.install(entry({sourceId:"homebrew.other-pack",source:"Other Pack"}));
  assert.equal(secondSource.status,"committed");
  if (secondSource.status!=="committed") return;
  assert.equal(secondSource.hydration.document.entries.length,2);
  assert.equal(secondSource.hydration.document.storageRevision,2);
});

test("same qualified identity with different payload is an explicit conflict and does not write", async () => {
  const store=new MemoryInstalledContentStore();
  const repository=new InstalledContentRepository(store);
  await repository.hydrate();
  await repository.install(entry());
  const before=await store.readGenerations();

  const conflict=await repository.install(entry({description:"different payload"}));
  assert.equal(conflict.status,"conflict");
  if (conflict.status!=="conflict") return;
  assert.match(conflict.error,/same qualified identity has a different payload/);
  assert.deepEqual(await store.readGenerations(),before);
  assert.equal(repository.snapshot()?.entries[0].description,"local content");
});

test("stale installed-content writers cannot overwrite a newer physical generation", async () => {
  const store=new MemoryInstalledContentStore();
  const first=new InstalledContentRepository(store);
  const stale=new InstalledContentRepository(store);
  await first.hydrate();
  await stale.hydrate();
  await first.install(entry());

  await assert.rejects(
    ()=>stale.install(entry({sourceId:"homebrew.stale-writer",source:"Stale Writer"})),
    /stale Installed content generation/,
  );
  assert.equal(stale.snapshot()?.storageRevision,0);
  const reloaded=new InstalledContentRepository(store);
  const hydration=await reloaded.hydrate();
  assert.equal(hydration.document.storageRevision,1);
  assert.equal(hydration.document.entries.length,1);
  assert.equal(hydration.document.entries[0].sourceId,"homebrew.stone-pack");
});

test("corrupt newest installed-content generation recovers from the previous valid commit", async () => {
  const valid=encodeInstalledContentV1(document(1,[entry()]));
  const store=new MemoryInstalledContentStore([
    {generation:2,payload:"{broken"},
    {generation:1,payload:valid},
  ]);
  const repository=new InstalledContentRepository(store);
  const hydration=await repository.hydrate();
  assert.equal(hydration.recoveredFromOlderGeneration,true);
  assert.equal(hydration.loadedGeneration,1);
  assert.equal(hydration.physicalGeneration,2);
  const committed=await repository.install(entry({sourceId:"homebrew.second"}));
  assert.equal(committed.status,"committed");
  if (committed.status!=="committed") return;
  assert.equal(committed.hydration.document.storageRevision,3);
});

test("all corrupt installed-content generations are an explicit blocker", async () => {
  const repository=new InstalledContentRepository(new MemoryInstalledContentStore([{generation:1,payload:"not-json"}]));
  await assert.rejects(()=>repository.hydrate(),InstalledContentCorruptError);
});

test("newer installed-content schema is a migration blocker instead of older-generation fallback", async () => {
  const newer=JSON.stringify({schemaId:"simplevtt.installed-content",schemaVersion:2,storageRevision:2,entries:[]});
  const older=encodeInstalledContentV1(document(1,[entry()]));
  const repository=new InstalledContentRepository(new MemoryInstalledContentStore([
    {generation:2,payload:newer},
    {generation:1,payload:older},
  ]));
  await assert.rejects(()=>repository.hydrate(),InstalledContentMigrationRequiredError);
});

test("installed content document contains only normalized local entries, not preview or session state", () => {
  const payload=encodeInstalledContentV1(document(7,[entry()]));
  const decoded=decodeInstalledContent(payload);
  assert.deepEqual(Object.keys(decoded).sort(),["entries","schemaId","schemaVersion","storageRevision"]);
  assert.equal(decoded.entries[0].contentId,"subclass.stoneguard");
  assert.ok(!payload.includes("contentImport"));
  assert.ok(!payload.includes("sessionContent"));
});
