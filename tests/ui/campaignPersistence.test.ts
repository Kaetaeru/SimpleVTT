import assert from "node:assert/strict";
import test from "node:test";
import { CampaignApplicationService } from "../../src/app/campaignApplicationService";
import { CampaignLibraryRepository } from "../../src/app/campaignPersistence";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";

const now = "2026-08-22T10:00:00.000Z";

test("Campaign lifecycle create/read/update/archive/restore/duplicate/delete is durable", async () => {
  const store=new MemoryCampaignLibraryStore();
  const repository=new CampaignLibraryRepository(store);
  const service=new CampaignApplicationService(repository);
  await service.hydrate();

  const created=await service.createCampaign({campaignId:"campaign.alpha",name:"Alpha",description:"first",now});
  assert.equal(created.revision,1);
  assert.equal(created.calendar.capability.enabled,false);
  assert.equal(created.rations.ledger.balances.ration,0);

  const renamed=await service.updateCampaign({
    requestId:"request.rename.alpha",campaignId:created.campaignId,expectedCampaignRevision:1,
    initiatedByParticipantId:"dm.local",now,payload:{name:"Alpha Revised",description:"updated"},
  });
  assert.equal(renamed.name,"Alpha Revised");
  assert.equal(renamed.revision,2);

  const archived=await service.archiveCampaign({requestId:"request.archive.alpha",campaignId:created.campaignId,expectedCampaignRevision:2,initiatedByParticipantId:"dm.local",now});
  assert.equal(archived.status,"archived");
  const restored=await service.restoreCampaign({requestId:"request.restore.alpha",campaignId:created.campaignId,expectedCampaignRevision:3,initiatedByParticipantId:"dm.local",now});
  assert.equal(restored.status,"active");

  const duplicate=await service.duplicateCampaign({
    requestId:"request.duplicate.alpha",campaignId:created.campaignId,expectedCampaignRevision:4,
    initiatedByParticipantId:"dm.local",now,newCampaignId:"campaign.beta",newName:"Beta",
  });
  assert.equal(duplicate.campaignId,"campaign.beta");
  assert.equal(duplicate.revision,1);

  await service.deleteCampaign({requestId:"request.delete.beta",campaignId:"campaign.beta",expectedCampaignRevision:1,initiatedByParticipantId:"dm.local"});
  assert.equal(service.getCampaign("campaign.beta"),null);

  const reloaded=new CampaignApplicationService(new CampaignLibraryRepository(store));
  await reloaded.hydrate();
  assert.equal(reloaded.getCampaign("campaign.alpha")?.name,"Alpha Revised");
  assert.equal(reloaded.getCampaign("campaign.alpha")?.status,"active");
  assert.equal(reloaded.getCampaign("campaign.beta"),null);
});

test("Campaign mutation request ids are idempotent and stale revisions reject", async () => {
  const repository=new CampaignLibraryRepository(new MemoryCampaignLibraryStore());
  const service=new CampaignApplicationService(repository);
  await service.hydrate();
  await service.createCampaign({campaignId:"campaign.alpha",name:"Alpha",now});
  const command={requestId:"request.once",campaignId:"campaign.alpha",expectedCampaignRevision:1,initiatedByParticipantId:"dm.local",now,payload:{name:"Once"}};
  const first=await service.updateCampaign(command);
  const replay=await service.updateCampaign(command);
  assert.deepEqual(replay,first);
  await assert.rejects(
    ()=>service.updateCampaign({...command,requestId:"request.stale",payload:{name:"Stale"}}),
    /stale Campaign revision/,
  );
});
