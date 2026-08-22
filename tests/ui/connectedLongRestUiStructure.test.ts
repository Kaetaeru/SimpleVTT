import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pane=readFileSync(new URL("../../src/SessionCampaignPane.tsx",import.meta.url),"utf8");
const controls=readFileSync(new URL("../../src/ConnectedLongRestCampaignControls.tsx",import.meta.url),"utf8");

test("connected Long Rest stays inside the existing Session Campaign pane",()=>{
  assert.match(pane,/ConnectedLongRestDmControls/);
  assert.match(pane,/ConnectedLongRestPlayerControls/);
  assert.match(pane,/session-campaign-long-rest/);
  assert.match(pane,/advanceTime=\{restAdvanceTime\}/);
  assert.match(pane,/consumeRations=\{restConsumeRations\}/);
  assert.doesNotMatch(controls,/position:\s*fixed|createPortal|AppRoute|full[- ]?screen/i);
});

test("DM remote Rest control calls the production connected adapter with existing opt-ins",()=>{
  assert.match(controls,/mockAdapter\.startConnectedLongRest/);
  assert.match(controls,/advanceMinutes:advanceTime\?480:0/);
  assert.match(controls,/consumeRations/);
  assert.match(controls,/member\.connectionState==="connected"/);
  assert.match(controls,/장기 휴식 제안/);
});

test("Player Rest request exposes exact preview decision and immutable progress",()=>{
  assert.match(controls,/connectedLongRest\?\.ownerPrompts/);
  assert.match(controls,/HP \{prompt\.hp\.before\} → \{prompt\.hp\.after\}/);
  assert.match(controls,/임시 HP \{prompt\.tempHp\.before\} → \{prompt\.tempHp\.after\}/);
  assert.match(controls,/mockAdapter\.respondConnectedLongRest/);
  assert.match(controls,/prompt\.phase==="offered"/);
  assert.match(controls,/>거절</);
  assert.match(controls,/>승인</);
  for(const label of ["결정 대기","거절됨","승인됨","저장 준비됨","캠페인 커밋됨","완료","복구 필요"]) assert.match(controls,new RegExp(label));
});
