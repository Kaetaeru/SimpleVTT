import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const systems=readFileSync(new URL("../../src/CampaignSystemsPanel.tsx",import.meta.url),"utf8");

test("Campaign Party Stash policy selector is user-reachable and uses the persisted policy runtime",()=>{
  assert.match(systems,/campaignPartyStashPolicyRuntimeAdapter/);
  assert.match(systems,/configureCampaignPartyStashPolicy\(campaign\.campaignId,policy\)/);
  assert.match(systems,/await api\.refresh\(\)/);
  assert.match(systems,/aria-label="Party Stash 정책"/);
  assert.match(systems,/<option value="shared">/);
  assert.match(systems,/<option value="dm-approval">/);
  assert.match(systems,/<option value="dm-managed">/);
});

test("dm-approval copy preserves the no-mutation-before-approval contract",()=>{
  assert.match(systems,/출고는 DM 승인 요청으로 전환합니다/);
  assert.match(systems,/승인 전에는 자산을 이동하지 않습니다/);
});
