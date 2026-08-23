import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(process.cwd());
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("ration conversion production composition keeps Campaign authority and connected projection reuse",()=>{
  const offline=read("src/app/offlineRuntimeAdapters.ts");
  const capability=read("src/app/campaignPartyStashCapabilityRuntimeAdapter.ts");
  const runtime=read("src/app/campaignRationConversionRuntimeAdapter.ts");
  const connected=read("src/app/connectedCampaignSystemsRuntimeAdapter.ts");
  const screen=read("src/CampaignScreen.tsx");
  const panel=read("src/CampaignRationConversionPanel.tsx");

  assert.ok(offline.indexOf('import "./campaignRuntimeAdapter";')<offline.indexOf('import "./campaignPartyStashCapabilityRuntimeAdapter";'));
  assert.ok(offline.indexOf('import "./campaignPartyStashCapabilityRuntimeAdapter";')<offline.indexOf('import "./campaignRationConversionRuntimeAdapter";'));
  assert.match(capability,/trustedCatalogCapabilities/);
  assert.match(capability,/matches\.length!==1/);
  assert.match(capability,/commitConnectedPartyStashDepositWithTrustedCapabilities/);
  assert.match(runtime,/CampaignApplicationService\.prototype\.adjustRations/);
  assert.match(runtime,/return this\.adjustCampaignRations\(command\.campaignId/);
  assert.match(runtime,/Ration provider changed/);
  assert.match(connected,/MockAdapter\.prototype\.adjustCampaignRations=broadcastAfter\(MockAdapter\.prototype\.adjustCampaignRations\)/);
  assert.match(screen,/CampaignRationConversionPanel campaign=\{activeCampaign\}/);
  assert.match(panel,/전환 미리보기/);
  assert.match(panel,/이름이나 설명으로 음식 여부를 추측하지 않습니다/);
  assert.match(panel,/convertCampaignPartyStashItemToRations/);
});
