import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const campaign=readFileSync(new URL("../../src/CampaignSystemsPanel.tsx",import.meta.url),"utf8");
const session=readFileSync(new URL("../../src/SessionInventoryPane.tsx",import.meta.url),"utf8");
const handout=readFileSync(new URL("../../src/SessionImageHandoutBridge.tsx",import.meta.url),"utf8");
const encounter=readFileSync(new URL("../../src/SessionDmTools.tsx",import.meta.url),"utf8");
const connected=readFileSync(new URL("../../src/app/connectedCampaignSystemsRuntimeAdapter.ts",import.meta.url),"utf8");

test("Campaign dashboard exposes private custom item CRUD search favorite and duplication",()=>{
  for(const label of ["DM 라이브러리 검색","아이템","이미지","NPC 액터","라이브러리에 추가","즐겨찾기","복제","삭제"])assert.match(campaign,new RegExp(label));
  assert.match(campaign,/upsertCampaignDmLibraryEntry/);assert.match(campaign,/removeCampaignDmLibraryEntry/);
  assert.match(campaign,/JSON 가져오기/);assert.match(campaign,/parseCampaignDmLibraryJson/);assert.match(campaign,/검토한 항목 저장/);
});

test("Campaign image and NPC entries have live Session quick actions",()=>{
  assert.match(handout,/revealCampaignDmLibraryImage/);assert.match(handout,/캠페인 DM 라이브러리/);
  assert.match(encounter,/instantiateCampaignDmLibraryNpc/);assert.match(encounter,/비공개 NPC 정의와 PC Actor preset/);
});

test("Session DM quick grant targets either selected Character or Party Stash",()=>{
  assert.match(session,/캠페인 DM 라이브러리/);assert.match(session,/grantCampaignDmLibraryItem/);assert.match(session,/kind:"character"/);assert.match(session,/kind:"stash"/);
});

test("private DM Library is never added to connected Campaign projection",()=>{
  assert.doesNotMatch(connected,/copy\.dmLibrary|projection\.dmLibrary/);
  assert.match(connected,/grantCampaignDmLibraryItem=broadcastAfter/);
});
