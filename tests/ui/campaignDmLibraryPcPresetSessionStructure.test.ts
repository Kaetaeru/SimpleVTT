import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(process.cwd());
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("live DM Encounter quick-add reuses the Campaign PC preset actor path",()=>{
  const runtime=read("src/app/campaignDmLibraryOrganizationRuntimeAdapter.ts");
  const session=read("src/SessionDmTools.tsx");

  assert.match(runtime,/instantiateCampaignDmLibraryPcPreset/);
  assert.match(runtime,/await this\.instantiateCombatant\(materialized\.id\)/);
  assert.match(runtime,/session\.role==="client"/);
  assert.match(session,/campaignDmLibraryOrganizationRuntimeAdapter/);
  assert.match(session,/entry\.kind==="pc-preset"&&entry\.pcPreset/);
  assert.match(session,/mockAdapter\.instantiateCampaignDmLibraryPcPreset\(campaignId,entryId\)/);
  assert.match(session,/await refresh\(\)/);
  assert.match(session,/instantiateCampaignDmLibraryNpc/);
  assert.match(session,/비공개 NPC 정의와 PC Actor preset/);
});
