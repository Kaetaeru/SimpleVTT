import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app=readFileSync(new URL("../../src/App.tsx",import.meta.url),"utf8");
const home=readFileSync(new URL("../../src/V1HomeScreen.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../../src/CampaignScreen.tsx",import.meta.url),"utf8");
const campaignStyles=readFileSync(new URL("../../src/campaign-screen.css",import.meta.url),"utf8");
const provider=readFileSync(new URL("../../src/app/AppProvider.tsx",import.meta.url),"utf8");
const session=readFileSync(new URL("../../src/ProductionSessionWorkspaceBridge.tsx",import.meta.url),"utf8");
const directSession=readFileSync(new URL("../../src/ProductionSessionDirectNetworkBridge.tsx",import.meta.url),"utf8");
const systems=readFileSync(new URL("../../src/CampaignSystemsPanel.tsx",import.meta.url),"utf8");
const historyRuntime=readFileSync(new URL("../../src/app/campaignSessionHistoryRuntimeAdapter.ts",import.meta.url),"utf8");
const main=readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf8");

test("Campaign is a first-class product route reachable from navigation and Home",()=>{
  assert.match(app,/\["campaigns", "캠페인",/);
  assert.match(app,/route === "campaigns" && <CampaignScreen/);
  assert.match(app,/import \{ CampaignScreen \}/);
  assert.match(home,/onCampaigns/);
  assert.match(home,/>캠페인 열기</);
});

test("Campaign owns vertical scrolling inside the product content viewport",()=>{
  assert.match(campaignStyles,/\.campaign-screen\{[^}]*height:100%/);
  assert.match(campaignStyles,/\.campaign-screen\{[^}]*min-height:0/);
  assert.match(campaignStyles,/\.campaign-screen\{[^}]*overflow-y:auto/);
});

test("Campaign screen covers empty list create dashboard archive and Session setup",()=>{
  for(const pattern of [/새 캠페인/,/최근 캠페인/,/보관된 캠페인/,/캠페인 대시보드/,/파티/,/달력/,/식량/,/파티 보관함/,/DM 라이브러리/,/세션 기록/,/세션 시작/]) assert.match(screen,pattern);
  assert.match(screen,/createCampaign/);
  assert.match(screen,/openCampaign/);
  assert.match(screen,/archiveCampaign/);
  assert.match(screen,/restoreCampaign/);
  assert.match(screen,/activeCampaignId/);
});

test("Session setup exposes immutable Campaign identity and optional rule toggles",()=>{
  assert.match(screen,/세션 달력 사용/);
  assert.match(screen,/식량 규칙 사용/);
  assert.match(screen,/시작 모드/);
  assert.match(screen,/자유 진행/);
  assert.match(screen,/이니셔티브/);
  assert.match(screen,/기록은 보존/);
  assert.match(screen,/전투맵\/공간/);
  assert.match(screen,/거리·시야·엄폐 판정이 비활성화/);
  assert.doesNotMatch(screen,/distanceFeet|lineOfSight|pathfinding/);
});

test("AppProvider exposes Campaign commands through the canonical adapter",()=>{
  for(const command of ["createCampaign","openCampaign","updateCampaign","archiveCampaign","restoreCampaign"]) assert.match(provider,new RegExp(`${command}:`));
});

test("Host start requires a selected Campaign and exposes its captured capabilities",()=>{
  for(const source of [session,directSession]) {
    assert.match(source,/activeCampaign/);
    assert.match(source,/prepareCampaignSessionSnapshot/);
    assert.match(source,/disabled=\{!activeCampaign\|\|!sessionName\.trim\(\)/);
    assert.match(source,/달력 \{activeCampaign\.calendar\.capability\.enabled/);
    assert.match(source,/식량 \{activeCampaign\.rations\.capability\.enabled/);
    assert.match(source,/공간 모듈/);
  }
});

test("Campaign systems UI exposes roster calendar ration compound and bounded history workflows",()=>{
  for(const pattern of [/파티 명단/,/Character 파일이나 소유권/,/Player Character 참조/,/식량 계산/,/보관함 권한/]) assert.match(systems,pattern);
  for(const pattern of [/세션 달력/,/Simple Day/,/Gregorian/,/\+10분/,/\+1시간/,/\+1일/,/날짜와 시간 직접 설정/,/최근 시간 변경 되돌리기/]) assert.match(systems,pattern);
  for(const pattern of [/하루 필요량/,/식량이/,/피해나 소진을 자동 적용하지 않습니다/,/하루치 소비/,/최근 소비 되돌리기/]) assert.match(systems,pattern);
  assert.match(systems,/advanceCampaignDay/);
  assert.match(systems,/시간과 선택한 식량 소비를 하나의 저장/);
  assert.match(systems,/세션 기록/);
  assert.doesNotMatch(systems,/applyDamage|exhaustionLevel|readyState|initiativeOrder/);
});

test("Campaign calendar exposes structured era date and 24-hour time editing",()=>{
  for(const pattern of [/연호/,/연도/,/>월</,/\?"일":"Day"/,/>시</,/>분</,/날짜와 시간 직접 설정/,/correctCampaignCalendarDateTime/,/GREGORIAN_CALENDAR_MONTHS/,/절대 시간\(분\)으로 변환/]) assert.match(systems,pattern);
  assert.match(systems,/\+30분/);
  assert.match(systems,/\+6시간/);
});

test("successful Host end appends only a bounded Campaign summary projection",()=>{
  assert.match(main,/campaignSessionHistoryRuntimeAdapter/);
  for(const pattern of [/previousStopSession/,/appendCampaignSessionSummary/,/participantLabels/,/calendarBefore/,/calendarAfter/,/rationDelta/,/stashTransactionCount/]) assert.match(historyRuntime,pattern);
  assert.doesNotMatch(historyRuntime,/resolution|ready|initiative|handout/i);
});
