import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const campaign=readFileSync(new URL("../../src/CampaignSystemsPanel.tsx",import.meta.url),"utf8");
const session=readFileSync(new URL("../../src/SessionInventoryPane.tsx",import.meta.url),"utf8");
const connected=readFileSync(new URL("../../src/app/connectedCampaignSystemsRuntimeAdapter.ts",import.meta.url),"utf8");

test("Campaign dashboard exposes private custom item CRUD search favorite and duplication",()=>{
  for(const label of ["DM 라이브러리 검색","아이템 만들기","아이템 수정","즐겨찾기","복제","삭제"])assert.match(campaign,new RegExp(label));
  assert.match(campaign,/upsertCampaignDmLibraryEntry/);assert.match(campaign,/removeCampaignDmLibraryEntry/);
});

test("Session DM quick grant targets either selected Character or Party Stash",()=>{
  assert.match(session,/캠페인 DM 라이브러리/);assert.match(session,/grantCampaignDmLibraryItem/);assert.match(session,/kind:"character"/);assert.match(session,/kind:"stash"/);
});

test("private DM Library is never added to connected Campaign projection",()=>{
  assert.doesNotMatch(connected,/copy\.dmLibrary|projection\.dmLibrary/);
  assert.match(connected,/grantCampaignDmLibraryItem=broadcastAfter/);
});
