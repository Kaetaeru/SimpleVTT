import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app=readFileSync(new URL("../../src/App.tsx",import.meta.url),"utf8");
const home=readFileSync(new URL("../../src/V1HomeScreen.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../../src/CampaignScreen.tsx",import.meta.url),"utf8");
const provider=readFileSync(new URL("../../src/app/AppProvider.tsx",import.meta.url),"utf8");
const session=readFileSync(new URL("../../src/ProductionSessionWorkspaceBridge.tsx",import.meta.url),"utf8");
const directSession=readFileSync(new URL("../../src/ProductionSessionDirectNetworkBridge.tsx",import.meta.url),"utf8");

test("Campaign is a first-class product route reachable from navigation and Home",()=>{
  assert.match(app,/\["campaigns", "캠페인",/);
  assert.match(app,/route === "campaigns" && <CampaignScreen/);
  assert.match(app,/import \{ CampaignScreen \}/);
  assert.match(home,/onCampaigns/);
  assert.match(home,/>캠페인 열기</);
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
