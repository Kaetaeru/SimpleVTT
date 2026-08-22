import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import {
  commitConnectedLongRestCampaignParticipant,
  connectedLongRestCampaignCommitId,
} from "../../src/app/connectedLongRestCampaignPersistence";
import type { ConnectedLongRestCommitPreflight } from "../../src/app/connectedLongRestPreflight";

async function configuredAdapter() {
  const adapter=new MockAdapter();
  await adapter.getSnapshot();
  await adapter.createCampaign({campaignId:"campaign.connected-rest",name:"Connected Rest"});
  await adapter.configureCampaignCalendar("campaign.connected-rest",{enabled:true,providerId:"builtin.gregorian"});
  await adapter.configureCampaignRations("campaign.connected-rest",{enabled:true,providerId:"builtin.tracking-only"});
  await adapter.adjustCampaignRations("campaign.connected-rest",{amount:5,note:"seed"});
  const snapshot=await adapter.getSnapshot();
  const campaign=snapshot.campaigns?.find((item)=>item.campaignId==="campaign.connected-rest");
  assert.ok(campaign);
  return {adapter,snapshot,campaign};
}

function preflight(campaignRevision:number):ConnectedLongRestCommitPreflight {
  return {
    transactionId:"long-rest.connected.campaign.1",
    sessionId:"session.connected",
    campaignId:"campaign.connected-rest",
    expectedCampaignRevision:campaignRevision,
    ownerParticipantId:"client:char.remote",
    character:{characterId:"char.remote",sourceRevision:3,runtimeRevision:7},
    options:{advanceMinutes:480,consumeRations:true},
  };
}

test("connected Long Rest Campaign participant commits optional effects only after an exact preflight",async()=>{
  const {adapter,campaign}=await configuredAdapter();
  const result=await commitConnectedLongRestCampaignParticipant(adapter,preflight(campaign.revision));

  assert.equal(result.status,"committed");
  assert.equal(result.preview.status,"ready");
  assert.equal(result.snapshot.campaignSessionSystems?.calendar.absoluteMinute,480);
  assert.equal(result.snapshot.campaignSessionSystems?.rations.balance,4);
  const committed=result.snapshot.campaigns?.find((item)=>item.campaignId==="campaign.connected-rest");
  assert.ok(committed?.recentRequestIds.includes("long-rest.connected.campaign.1"));
  assert.equal(result.campaignCommitId,connectedLongRestCampaignCommitId("long-rest.connected.campaign.1"));
});

test("connected Long Rest Campaign participant retry keeps one restart-stable global commit identity",async()=>{
  const {adapter,campaign}=await configuredAdapter();
  const approved=preflight(campaign.revision);
  const first=await commitConnectedLongRestCampaignParticipant(adapter,approved);
  await adapter.adjustCampaignRations("campaign.connected-rest",{amount:1,note:"later mutation"});
  const second=await commitConnectedLongRestCampaignParticipant(adapter,approved);

  assert.equal(second.status,"duplicate");
  assert.equal(second.campaignCommitId,first.campaignCommitId);
  assert.equal(second.campaignCommitId,"long-rest.connected.campaign.1:campaign-commit-v1");
  assert.equal(second.snapshot.campaignSessionSystems?.calendar.absoluteMinute,480);
  assert.equal(second.snapshot.campaignSessionSystems?.rations.balance,5);
});

test("connected Long Rest Campaign participant rejects revision drift before the global commit point",async()=>{
  const {adapter,campaign}=await configuredAdapter();
  const approved=preflight(campaign.revision);
  await adapter.adjustCampaignRations("campaign.connected-rest",{amount:1,note:"concurrent mutation"});
  await assert.rejects(
    ()=>commitConnectedLongRestCampaignParticipant(adapter,approved),
    /Campaign revision is stale/,
  );
  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.campaignSessionSystems?.calendar.absoluteMinute,0);
  assert.equal(snapshot.campaignSessionSystems?.rations.balance,6);
});
