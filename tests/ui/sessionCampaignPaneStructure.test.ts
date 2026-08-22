import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root=readFileSync(new URL("../../src/SessionModeRoot.tsx",import.meta.url),"utf8");
const pane=readFileSync(new URL("../../src/SessionCampaignPane.tsx",import.meta.url),"utf8");
const palette=readFileSync(new URL("../../src/SessionQuickPalette.tsx",import.meta.url),"utf8");
const provider=readFileSync(new URL("../../src/app/AppProvider.tsx",import.meta.url),"utf8");

test("Session shell exposes Campaign status through the canonical utility rail and quick palette",()=>{
  assert.match(root,/"campaign"/);
  assert.match(root,/<SessionCampaignPane role=\{role\}/);
  assert.match(root,/>캠페인<\/button>/);
  assert.match(palette,/캠페인 달력 · 식량/);
  assert.match(palette,/캠페인 현황/);
});

test("DM Session Campaign pane can operate calendar and rations",()=>{
  for(const pattern of [/role==="dm"/,/advanceCampaignCalendar/,/correctCampaignCalendarDateTime/,/setCampaignCalendarNote/,/undoCampaignCalendar/,/adjustCampaignRations/,/consumeCampaignDailyRations/,/undoCampaignRationConsumption/]) assert.match(pane,pattern);
  for(const pattern of [/\+10분/,/\+30분/,/\+1시간/,/\+6시간/,/\+1일/,/날짜·시간 직접 설정/,/하루치 소비/]) assert.match(pane,pattern);
});

test("Player pane is read-only and hidden ration values are removed from preview projection",()=>{
  assert.match(pane,/Player 읽기 전용/);
  assert.match(pane,/role==="player"&&!projection\.rations\.visibleToPlayers/);
  assert.match(pane,/식량 현황은 DM에게만 공개됩니다/);
  assert.match(provider,/role==="player"&&!parent\.snapshot\.campaignSessionSystems\.rations\.visibleToPlayers/);
  assert.match(provider,/visibleToPlayers:false/);
  assert.doesNotMatch(pane,/role==="player"[\s\S]{0,120}advanceCampaignCalendar/);
});

test("disabled Session Campaign capabilities explain inactivity without blocking play",()=>{
  assert.match(pane,/이번 세션에서는 달력을 사용하지 않습니다/);
  assert.match(pane,/저장된 Campaign 시간은 유지됩니다/);
  assert.match(pane,/이번 세션에서는 식량 규칙을 사용하지 않습니다/);
});
