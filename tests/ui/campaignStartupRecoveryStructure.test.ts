import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const main=readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf8");
const guard=readFileSync(new URL("../../src/app/campaignHydrationIssueAdapter.ts",import.meta.url),"utf8");
const bridge=readFileSync(new URL("../../src/CampaignStartupRecoveryBridge.tsx",import.meta.url),"utf8");

test("Campaign hydration guard classifies migration/schema/corruption without inventing recovery",()=>{
  for(const pattern of [/CampaignMigrationRequiredError/,/CampaignSchemaError/,/CampaignCorruptError/,/migration-required/,/schema-unsupported/,/corrupt/]) assert.match(guard,pattern);
  assert.match(guard,/throw error/);
  assert.doesNotMatch(guard,/delete|reset|clearGenerations|writeGeneration/);
});

test("Campaign startup recovery uses the existing loading shell and offers an explicit retry",()=>{
  assert.match(bridge,/loading-screen/);
  assert.match(bridge,/캠페인 데이터를 열 수 없습니다/);
  assert.match(bridge,/다시 시도/);
  assert.match(bridge,/refresh\(\)/);
  assert.match(bridge,/role="alertdialog"/);
});

test("Campaign hydration guard is installed before AppProvider performs its first refresh",()=>{
  const guardIndex=main.indexOf('import "./app/campaignHydrationIssueAdapter"');
  const providerIndex=main.indexOf('import { AppProvider }');
  assert.ok(guardIndex>=0&&providerIndex>=0);
  assert.ok(guardIndex<providerIndex,"campaign hydration guard must wrap getSnapshot before AppProvider module evaluation");
  assert.match(main,/CampaignStartupRecoveryBridge/);
});
