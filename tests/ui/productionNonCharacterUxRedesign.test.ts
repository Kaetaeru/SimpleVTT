import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app=readFileSync(new URL("../../src/App.tsx",import.meta.url),"utf8");
const main=readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf8");
const sessionRoot=readFileSync(new URL("../../src/SessionModeRoot.tsx",import.meta.url),"utf8");
const content=readFileSync(new URL("../../src/V1ContentScreen.tsx",import.meta.url),"utf8");
const wire=readFileSync(new URL("../../src/app/connectedSessionWire.ts",import.meta.url),"utf8");
const runtime=readFileSync(new URL("../../src/app/connectedSessionRuntimeAdapter.ts",import.meta.url),"utf8");

function slice(start:string,end:string) {
  const from=app.indexOf(start);
  const to=app.indexOf(end,from+start.length);
  assert.ok(from>=0,`missing ${start}`);
  assert.ok(to>from,`missing boundary ${end}`);
  return app.slice(from,to);
}

test("global shell follows connected session authority and keeps Session navigation consistent",()=>{
  const shell=slice("export function App(","function topTitle");
  assert.match(shell,/snapshot\?\.session\.role\s*===\s*"host"\s*\?\s*"dm"/);
  assert.match(shell,/snapshot\?\.session\.role\s*===\s*"client"\s*\?\s*"player"/);
  assert.doesNotMatch(shell,/\["session",\s*"연결"/);
  assert.doesNotMatch(shell,/>플레이어<|>던전 마스터</);
  assert.match(shell,/snapshot\.session\.lifecycle\s*===\s*"live"/);
});

test("Session route is a dedicated production mount instead of legacy duplicate cards",()=>{
  const session=slice("function SessionScreen(","function SettingsScreen()");
  assert.match(session,/production-session-workspace-root/);
  assert.doesNotMatch(session,/Host Session|Join by IP|RulesProfile|Reference 흐름|sessionContent/);
});

test("the live session owns play and old local scene/sheet/create helpers are gone",()=>{
  assert.doesNotMatch(app,/route === "scene"|ProductionPlayScreen/);
  for(const legacy of ["CharacterSheetScreen","CharacterCreateScreen","GuidedCreateStep","useTargeting","PlayerSceneScreen","DmSceneScreen","ActionConsole","EntityList","EntityPortrait","Inspector","TargetingOverlay"]) {
    assert.doesNotMatch(app,new RegExp(`function ${legacy}`));
  }
});

test("the live Encounter pane owns DM encounter editing and its copy avoids mechanics jargon",()=>{
  const pane=readFileSync(new URL("../../src/SessionDmTools.tsx",import.meta.url),"utf8");
  assert.match(pane,/instantiateCombatant/);
  assert.match(pane,/removeCombatant/);
  assert.match(pane,/SRD 몬스터/);
  assert.doesNotMatch(pane,/ResolutionEvent|Fog|pathfinding|minimap|line of sight/i);
});

test("Content is the primary addon review/install surface and points users to Rules for lookup",()=>{
  assert.match(content,/설치 파일은 이 화면에서 검토하고 승인합니다/);
  assert.match(content,/규칙 화면에서 검색됩니다/);
  assert.match(content,/검토 완료 · 설치/);
  assert.doesNotMatch(content,/RuleModule|Capability|generic Catalog|mechanics\/progression/);
});

test("dead global production wiring stays removed while current Session presentation owners stay mounted",()=>{
  assert.doesNotMatch(main,/PlaySessionDock|play-session-dock\.css/);
  assert.match(main,/sessionImageHandoutRuntimeAdapter/);
  assert.doesNotMatch(main,/<SessionImageHandoutBridge \/>/);
  assert.match(sessionRoot,/SessionDmHandoutPane/);
  assert.match(sessionRoot,/SessionPlayerHandoutViewer/);
  assert.match(main,/CharacterPortraitBridge/);
});

test("Combatants, Rules, Activity, and Settings hide implementation jargon from the primary path",()=>{
  const combatants=slice("function CombatantsScreen()","function CatalogScreen()");
  const catalog=slice("function CatalogScreen()","function ImportPanel(");
  const activity=slice("function ActivityScreen()","function SessionScreen(");
  const settings=slice("function SettingsScreen()","function DebugPanel(");

  assert.match(combatants,/Encounter에 추가/);
  assert.match(combatants,/현재 Encounter/);
  assert.doesNotMatch(combatants,/>Definition<|>Instance<|세션에 인스턴스 추가|재사용 Definition/);

  assert.match(catalog,/규칙 검색/);
  assert.match(catalog,/기술 정보/);
  assert.doesNotMatch(catalog,/Stable ID/);

  assert.match(activity,/플레이 기록/);
  assert.doesNotMatch(activity,/최근 안전 Resolution 되돌리기|ResolutionEvent ·/);

  assert.match(settings,/접근성|움직임/);
  assert.doesNotMatch(settings,/Reference|Ctrl\+Shift\+D|Debug Dock/);
});

test("Host-selected session name is carried in the connected handshake",()=>{
  assert.match(wire,/type:"hello-ack";\s*sessionId:string;\s*sessionName\?:string;/);
  assert.match(runtime,/sessionName:app\.session\.name/);
  assert.match(runtime,/if \(wire\.sessionName\) app\.session\.name=wire\.sessionName/);
});
