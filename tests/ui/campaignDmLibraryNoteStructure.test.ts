import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(process.cwd());
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("DM Library notes stay private while supporting CRUD, search, folders, tags, and favorites",()=>{
  const contracts=read("src/app/campaignDmLibraryOrganizationContracts.ts");
  const runtime=read("src/app/campaignDmLibraryOrganizationRuntimeAdapter.ts");
  const panel=read("src/CampaignDmLibraryNotePanel.tsx");
  const mount=read("src/CampaignRationConversionPanel.tsx");
  const persistence=read("src/app/campaignPersistenceContracts.ts");
  const projectionStart=persistence.indexOf("export interface CampaignSessionSystemsProjection");
  const projectionEnd=persistence.indexOf("export interface CampaignRecordV1",projectionStart);
  const projection=persistence.slice(projectionStart,projectionEnd);

  assert.match(contracts,/noteText\?:string/);
  assert.match(runtime,/entry\.kind==="note"/);
  assert.match(runtime,/DM Library note text is required/);
  assert.match(panel,/kind!=="note"/);
  assert.match(panel,/kind:"note"/);
  assert.match(panel,/제목 · 내용 · 태그 검색/);
  assert.match(panel,/folderFilter/);
  assert.match(panel,/favorite:!entry\.favorite/);
  assert.match(panel,/removeCampaignDmLibraryEntry/);
  assert.match(panel,/Host Campaign에만 저장됩니다/);
  assert.match(mount,/CampaignDmLibraryNotePanel campaign=\{campaign\}/);
  assert.ok(projectionStart>=0&&projectionEnd>projectionStart);
  assert.doesNotMatch(projection,/dmLibrary|noteText/);
});
