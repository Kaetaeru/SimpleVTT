import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const screen=readFileSync(new URL("../../src/CampaignScreen.tsx",import.meta.url),"utf8");

test("Campaign lifecycle UI exposes duplicate and delete without redesigning the existing card/overlay shell",()=>{
  assert.match(screen,/복제/);
  assert.match(screen,/삭제/);
  assert.match(screen,/duplicateCampaign/);
  assert.match(screen,/deleteCampaign/);
  assert.match(screen,/campaign-session-setup/);
});

test("Campaign duplicate confirmation states the exact ownership boundary",()=>{
  for(const pattern of [/Character 파일/,/설치 콘텐츠/,/파티 명단/,/달력/,/식량/,/파티 보관함/,/DM 라이브러리/,/세션 기록/]) assert.match(screen,pattern);
  assert.match(screen,/복사하지 않습니다|복제하지 않습니다/);
});

test("Campaign delete requires explicit confirmation and describes external data preservation",()=>{
  assert.match(screen,/deleteTarget/);
  assert.match(screen,/정말 삭제/);
  assert.match(screen,/되돌릴 수 없습니다/);
  assert.match(screen,/Character 파일/);
  assert.match(screen,/설치 콘텐츠/);
});
