import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "../../src/app/sessionInventoryRuntimeAdapter";
import "../../src/app/campaignRuntimeAdapter";
import "../../src/app/connectedPartyStashHostPolicyAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { setCampaignLibraryStoreForTests } from "../../src/app/campaignRuntimeAdapter";

const main=readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf8");
const clientPolicy=readFileSync(new URL("../../src/app/connectedPartyStashClientPolicyAdapter.ts",import.meta.url),"utf8");
const hostPolicy=readFileSync(new URL("../../src/app/connectedPartyStashHostPolicyAdapter.ts",import.meta.url),"utf8");
const recovery=readFileSync(new URL("../../src/app/connectedPartyStashHostRecoveryAdapter.ts",import.meta.url),"utf8");
const playerUi=readFileSync(new URL("../../src/SessionInventoryPane.tsx",import.meta.url),"utf8");

test("default dm-approval accepts Player deposit but rejects direct withdrawal at Host authority",async()=>{
  const adapter=new MockAdapter();setCampaignLibraryStoreForTests(adapter,new MemoryCampaignLibraryStore());
  await adapter.getSnapshot();await adapter.createCampaign({campaignId:"campaign.policy",name:"Policy"});
  await adapter.upsertCampaignRosterMember("campaign.policy",{rosterMemberId:"member.aelar",label:"Aelar",kind:"player-character-ref",characterRef:{characterId:"char.aelar"},active:true,countsForRations:true,stashPermission:"request"});
  let snapshot=await adapter.commitConnectedPartyStashDeposit({requestId:"policy.deposit",campaignId:"campaign.policy",actorId:"char.aelar",direction:"character-to-stash",asset:"currency",amount:1});
  assert.equal(snapshot.campaignSessionSystems?.partyStash.wallet.gp,1);
  await assert.rejects(()=>adapter.commitConnectedPartyStashDeposit({requestId:"policy.withdraw",campaignId:"campaign.policy",actorId:"char.aelar",direction:"stash-to-character",asset:"currency",amount:1}),/DM 승인이 필요/);
  snapshot=await adapter.getSnapshot();assert.equal(snapshot.campaignSessionSystems?.partyStash.wallet.gp,1);
});

test("production wrapper order preserves Host authority and Client preflight policy",()=>{
  const host=main.indexOf('import "./app/connectedPartyStashHostPolicyAdapter"');
  const connected=main.indexOf('import "./app/connectedCampaignSystemsRuntimeAdapter"');
  const client=main.indexOf('import "./app/connectedPartyStashClientPolicyAdapter"');
  assert.ok(host>=0&&connected>host&&client>connected);
  assert.match(hostPolicy,/policy==="dm-managed"/);assert.match(hostPolicy,/policy==="dm-approval"&&command\.direction==="stash-to-character"/);
  assert.match(clientPolicy,/policy==="dm-managed"/);assert.match(clientPolicy,/policy==="dm-approval"&&command\.direction==="stash-to-character"/);
});

test("Player Stash UI exposes policy state before mutation",()=>{
  assert.match(playerUi,/const canDeposit=Boolean\(stash&&canTransfer&&stash\.policy!=="dm-managed"\)/);
  assert.match(playerUi,/const canWithdraw=Boolean\(stash&&canTransfer&&stash\.policy==="shared"\)/);
  assert.match(playerUi,/DM 전용 관리 정책/);assert.match(playerUi,/출고는 DM 승인이 필요/);
});

test("malformed or policy-denied requests are rejected before a recovery coordinator is written",()=>{
  const decode=recovery.indexOf("function decodeClientStashRequest");
  const prepare=recovery.indexOf("async function prepareClientStashCoordinator");
  const write=recovery.indexOf("connectedPartyStashHostCoordinatorStoreFor(host).write",prepare);
  assert.ok(decode>=0&&prepare>decode&&write>prepare);
  assert.match(recovery,/Number\.isInteger\(command\.amount\).*Number\(command\.amount\)<1/s);
  assert.match(recovery,/Number\.isInteger\(command\.quantity\).*Number\(command\.quantity\)<1/s);
  const approval=recovery.indexOf('campaign.partyStash.policy==="dm-approval"',prepare);
  const managed=recovery.indexOf('campaign.partyStash.policy==="dm-managed"',prepare);
  assert.ok(approval>prepare&&approval<write&&managed>prepare&&managed<write);
});
