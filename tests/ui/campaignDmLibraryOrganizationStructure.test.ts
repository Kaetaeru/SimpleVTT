import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(process.cwd());
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("DM Library PC presets and folders preserve Campaign authority and private ownership",()=>{
  const contracts=read("src/app/campaignDmLibraryOrganizationContracts.ts");
  const runtime=read("src/app/campaignDmLibraryOrganizationRuntimeAdapter.ts");
  const panel=read("src/CampaignDmLibraryOrganizationPanel.tsx");
  const hostPanel=read("src/CampaignRationConversionPanel.tsx");
  const projection=read("src/app/campaignPersistenceContracts.ts");

  assert.match(contracts,/interface CampaignPcActorPreset/);
  assert.match(contracts,/folders\?:CampaignDmLibraryFolder\[\]/);
  assert.match(runtime,/CampaignApplicationService\.prototype\.updateCampaign/);
  assert.match(runtime,/campaign\.dmLibrary\.entries=.*folderId:undefined/);
  assert.match(runtime,/instantiateCampaignDmLibraryPcPreset/);
  assert.match(runtime,/PC preset Actor 생성은 DM Campaign 권위/);
  assert.match(panel,/Player Character 파일을 복사하거나 소유권을 가져오지 않습니다/);
  assert.match(panel,/PC preset 저장/);
  assert.match(panel,/Actor \+1/);
  assert.match(hostPanel,/CampaignDmLibraryOrganizationPanel campaign=\{campaign\}/);
  assert.doesNotMatch(projection,/CampaignSessionSystemsProjection[\s\S]{0,1200}dmLibrary/);
});
