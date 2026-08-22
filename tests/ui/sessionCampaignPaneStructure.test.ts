import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root=readFileSync(new URL("../../src/SessionModeRoot.tsx",import.meta.url),"utf8");
const pane=readFileSync(new URL("../../src/SessionCampaignPane.tsx",import.meta.url),"utf8");
const palette=readFileSync(new URL("../../src/SessionQuickPalette.tsx",import.meta.url),"utf8");
const provider=readFileSync(new URL("../../src/app/AppProvider.tsx",import.meta.url),"utf8");
const chromeStyles=readFileSync(new URL("../../src/session-integrated-reference-play.css",import.meta.url),"utf8");

test("Session shell exposes Campaign status through the canonical utility rail and quick palette",()=>{
  assert.match(root,/"campaign"/);
  assert.match(root,/<SessionCampaignPane role=\{role\}/);
  assert.match(root,/>캠페인<\/button>/);
  assert.match(palette,/캠페인 달력 · 식량/);
  assert.match(palette,/캠페인 현황/);
});

test("Campaign time and detailed day period remain visible in the Session chrome",()=>{
  assert.match(root,/session-reference-campaign-clock/);
  assert.match(root,/campaignDayPeriod/);
  assert.match(root,/campaignClockTime/);
  assert.match(root,/Campaign 시간/);
  assert.match(root,/toggleUtility\("campaign"/);
  assert.match(root,/role==="dm"&&campaignCalendar\?\.enabled/);
  assert.match(root,/type="time"/);
  assert.match(root,/correctCampaignCalendarDateTime/);
  assert.match(root,/세션 상단 시계 직접 수정/);
  assert.match(root,/campaignClockBusy/);
  assert.match(provider,/previewCalendarOverride/);
  assert.match(provider,/correctCampaignCalendarDateTime: async/);
  assert.match(provider,/campaignDateTimeToAbsoluteMinute/);
  assert.match(provider,/setPreviewCalendarOverride/);
  assert.match(pane,/dayPeriod\?\.label/);
  assert.match(chromeStyles,/\.session-reference-play-chrome \.session-reference-campaign-clock/);
  assert.match(chromeStyles,/\.session-reference-campaign-clock-wrap:hover \.session-reference-campaign-clock-editor/);
  assert.match(chromeStyles,/\.session-reference-campaign-clock-wrap:focus-within \.session-reference-campaign-clock-editor/);
  for(const period of ["deep-night","dawn","morning","midday","afternoon","sunset","evening","night"])assert.match(chromeStyles,new RegExp(`session-reference-campaign-clock\\.${period}`));
});

test("DM Session Campaign pane can operate calendar and rations",()=>{
  for(const pattern of [/role==="dm"/,/advanceCampaignCalendar/,/correctCampaignCalendarDateTime/,/setCampaignCalendarNote/,/undoCampaignCalendar/,/adjustCampaignRations/,/consumeCampaignDailyRations/,/undoCampaignRationConsumption/]) assert.match(pane,pattern);
  for(const pattern of [/\+10분/,/\+30분/,/\+1시간/,/\+6시간/,/\+1일/,/날짜·시간 직접 설정/,/하루치 소비/]) assert.match(pane,pattern);
});

test("Session Campaign pane grants XP with a default target and opens the canonical level-up draft in-session",()=>{
  assert.match(pane,/setSelectedRosterIds\(projection\?\.roster\.filter\(\(member\)=>member\.active\)/);
  assert.match(pane,/grantCampaignAdvancement/);
  assert.match(pane,/XP를 지급했습니다/);
  assert.match(pane,/session-campaign-xp-entry/);
  assert.match(pane,/지급할 XP/);
  assert.match(pane,/inputMode="numeric"/);
  assert.match(pane,/바로 레벨업 가능/);
  assert.match(pane,/세션에서 레벨업/);
  assert.match(root,/openSessionLevelUp/);
  assert.match(root,/<LevelUpScreen onDone=\{finishSessionLevelUp\}/);
  assert.match(root,/consumeCampaignLevelUpCredit/);
});

test("Session Campaign pane shows persisted party references and browser preview always mounts a connected Player",()=>{
  assert.match(pane,/파티 명단/);
  assert.match(pane,/projection\.roster\.map/);
  assert.match(pane,/Player Character 참조/);
  assert.match(pane,/접속 중/);
  assert.match(pane,/role==="dm"&&<small className="session-campaign-roster-policy"/);
  assert.match(provider,/campaign\.browser-preview/);
  assert.match(provider,/previewRosterMemberId=`connected:\$\{activeCharacter\.id\}`/);
  assert.match(provider,/connectionState:"connected"/);
});

test("Player pane is read-only and hidden ration values are removed from preview projection",()=>{
  assert.match(pane,/Player 읽기 전용/);
  assert.match(pane,/role==="player"&&!projection\.rations\.visibleToPlayers/);
  assert.match(pane,/식량 현황은 DM에게만 공개됩니다/);
  assert.match(provider,/role==="player"&&!previewRations\.visibleToPlayers/);
  assert.match(provider,/advancementRoster\.map\(\(\{countsForRations:_,rationUnitsPerDay:__/);
  assert.match(provider,/visibleToPlayers:false/);
  assert.doesNotMatch(pane,/role==="player"[\s\S]{0,120}advanceCampaignCalendar/);
});

test("disabled Session Campaign capabilities explain inactivity without blocking play",()=>{
  assert.match(pane,/이번 세션에서는 달력을 사용하지 않습니다/);
  assert.match(pane,/저장된 Campaign 시간은 유지됩니다/);
  assert.match(pane,/이번 세션에서는 식량 규칙을 사용하지 않습니다/);
});
