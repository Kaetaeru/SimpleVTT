import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const panel=readFileSync(new URL("../../src/ProductionSessionAdvancementPanel.tsx",import.meta.url),"utf8");
const bridge=readFileSync(new URL("../../src/ProductionSessionWorkspaceBridge.tsx",import.meta.url),"utf8");

test("Host live production session exposes the existing Campaign advancement owner",()=>{
  assert.ok(bridge.includes("<ProductionSessionAdvancementPanel />"));
  assert.ok(panel.includes('snapshot.session.role!=="host"'));
  assert.ok(panel.includes('snapshot.session.lifecycle!=="live"'));
  assert.ok(panel.includes("grantCampaignAdvancement(activeCampaign.campaignId"));
  assert.ok(panel.includes("rosterMemberIds:validSelectedIds"));
  assert.ok(panel.includes('kind==="level-up-credit"?1'));
  assert.ok(panel.includes("member.active&&Boolean(member.characterId)"));
});
