import assert from "node:assert/strict";
import test from "node:test";
import {
  CampaignCorruptError,
  CampaignLibraryRepository,
  CampaignMigrationRequiredError,
  encodeCampaignDocumentV1,
} from "../../src/app/campaignPersistence";
import { CampaignApplicationService } from "../../src/app/campaignApplicationService";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import type { CampaignDocumentV1 } from "../../src/app/campaignPersistenceContracts";

const now="2026-08-22T10:00:00.000Z";

test("failed Campaign write rolls back memory and restart recovers the last commit", async () => {
  const store=new MemoryCampaignLibraryStore();
  const service=new CampaignApplicationService(new CampaignLibraryRepository(store));
  await service.hydrate();
  await service.createCampaign({campaignId:"campaign.atomic",name:"Stable",now});
  store.failNextWrite("simulated Campaign write failure");
  await assert.rejects(()=>service.updateCampaign({
    requestId:"request.fail",campaignId:"campaign.atomic",expectedCampaignRevision:1,
    initiatedByParticipantId:"dm.local",now,payload:{name:"Unsaved"},
  }),/simulated Campaign write failure/);
  assert.equal(service.getCampaign("campaign.atomic")?.name,"Stable");

  const restarted=new CampaignApplicationService(new CampaignLibraryRepository(store));
  await restarted.hydrate();
  assert.equal(restarted.getCampaign("campaign.atomic")?.name,"Stable");
});

test("stale Campaign writers cannot overwrite a newer generation", async () => {
  const store=new MemoryCampaignLibraryStore();
  const first=new CampaignApplicationService(new CampaignLibraryRepository(store));
  const stale=new CampaignApplicationService(new CampaignLibraryRepository(store));
  await first.hydrate();
  await stale.hydrate();
  await first.createCampaign({campaignId:"campaign.first",name:"First",now});
  await assert.rejects(()=>stale.createCampaign({campaignId:"campaign.stale",name:"Stale",now}),/stale Campaign library generation/);
});

test("corrupt newest Campaign generation recovers but newer schema blocks fallback", async () => {
  const seed=new MemoryCampaignLibraryStore();
  const writer=new CampaignApplicationService(new CampaignLibraryRepository(seed));
  await writer.hydrate();
  await writer.createCampaign({campaignId:"campaign.valid",name:"Valid",now});
  seed.seed(2,"{broken");
  const recovered=await new CampaignLibraryRepository(seed).hydrate();
  assert.equal(recovered.recoveredFromOlderGeneration,true);
  assert.equal(recovered.loadedGeneration,1);
  assert.equal(recovered.physicalGeneration,2);

  const valid=recovered.document;
  const newer=JSON.stringify({...valid,schemaVersion:2,storageRevision:3});
  const migrationStore=new MemoryCampaignLibraryStore([
    {generation:3,payload:newer},
    {generation:1,payload:encodeCampaignDocumentV1(valid)},
  ]);
  await assert.rejects(()=>new CampaignLibraryRepository(migrationStore).hydrate(),CampaignMigrationRequiredError);
});

test("all corrupt Campaign generations are an explicit blocker", async () => {
  const store=new MemoryCampaignLibraryStore([{generation:1,payload:"not-json"}]);
  await assert.rejects(()=>new CampaignLibraryRepository(store).hydrate(),CampaignCorruptError);
});

test("Campaign document excludes transient Session state and Character payloads", () => {
  const document:CampaignDocumentV1={schemaId:"simplevtt.campaign-library",schemaVersion:1,storageRevision:0,activeCampaignId:null,campaigns:[]};
  const payload=encodeCampaignDocumentV1(document);
  for (const forbidden of ["participants","ready","resolution","queuedD20","activeCharacter","characters"]) assert.equal(payload.includes(forbidden),false,forbidden);
});
