import assert from "node:assert/strict";
import test from "node:test";
import { CampaignApplicationService } from "../../src/app/campaignApplicationService";
import { CampaignLibraryRepository } from "../../src/app/campaignPersistence";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";

const now="2026-08-22T10:00:00.000Z";

test("Campaign A and B calendar rations stash and DM Library namespaces remain isolated after restart", async () => {
  const store=new MemoryCampaignLibraryStore();
  const service=new CampaignApplicationService(new CampaignLibraryRepository(store));
  await service.hydrate();
  await service.createCampaign({campaignId:"campaign.a",name:"A",now});
  await service.createCampaign({campaignId:"campaign.b",name:"B",now});

  await service.mutateCampaign({
    requestId:"request.seed.a",campaignId:"campaign.a",expectedCampaignRevision:1,
    initiatedByParticipantId:"dm.local",now,
  },(campaign)=>{
    campaign.calendar.capability.enabled=true;
    campaign.calendar.state.absoluteMinute=12345;
    campaign.rations.capability.enabled=true;
    campaign.rations.ledger.balances.ration=18;
    campaign.partyStash.wallet.gp=132;
    campaign.dmLibrary.entries.push({entryId:"dm-item.secret",kind:"custom-item",label:"Secret Key",definitionId:"item.secret-key"});
  });

  const reloaded=new CampaignApplicationService(new CampaignLibraryRepository(store));
  await reloaded.hydrate();
  const a=reloaded.getCampaign("campaign.a")!;
  const b=reloaded.getCampaign("campaign.b")!;
  assert.equal(a.calendar.state.absoluteMinute,12345);
  assert.equal(a.rations.ledger.balances.ration,18);
  assert.equal(a.partyStash.wallet.gp,132);
  assert.equal(a.dmLibrary.entries[0].label,"Secret Key");
  assert.equal(b.calendar.state.absoluteMinute,0);
  assert.equal(b.rations.ledger.balances.ration,0);
  assert.equal(b.partyStash.wallet.gp,0);
  assert.deepEqual(b.dmLibrary.entries,[]);
  assert.notEqual(a.partyStash.stashId,b.partyStash.stashId);
  assert.notEqual(a.dmLibrary.namespaceId,b.dmLibrary.namespaceId);
});
