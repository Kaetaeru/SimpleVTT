import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(path:string)=>readFileSync(new URL(`../../${path}`,import.meta.url),"utf8");

test("production composition retires persistent dock and spell HUD in favor of one play surface",()=>{
  const main=read("src/main.tsx");
  const app=read("src/App.tsx");
  assert.doesNotMatch(main,/<PlaySessionDock \/>/);
  assert.doesNotMatch(main,/<CombatSpellHudBridge \/>/);
  assert.match(main,/import "\.\/v09-production-play\.css"/);
  assert.match(app,/route === "scene" && <ProductionPlayScreen role=\{productionRole\} \/>/);
});

test("sheet and V0.9 play screens own keyboard focus while icon-only actions stay labeled",()=>{
  const legacyCss=read("src/player-experience-redesign.css");
  const playCss=read("src/v09-production-play.css");
  const access=read("src/player-experience-accessibility.css");
  const play=read("src/ProductionPlayScreen.tsx");
  assert.match(legacyCss,/\.sheet-play-screen,\.play-redesign-screen\{[^}]*position:absolute;[^}]*inset:0/s);
  assert.match(access,/\.sheet-play-screen button:focus-visible/);
  assert.match(playCss,/\.play-v09-screen button:focus-visible/);
  assert.match(play,/className=\{`play-v09-action-icon/);
  assert.match(play,/aria-label=\{item\.label\}/);
  assert.match(play,/aria-label=\{skillFactByActionId\(action\.id\)\?\.name\?\?action\.name\}/);
  assert.match(play,/play-action-tooltip/);
});

test("disabled hotbar capabilities remain focusable and explain why they cannot run",()=>{
  const play=read("src/ProductionPlayScreen.tsx");
  const css=read("src/v09-production-play.css");
  assert.match(play,/aria-disabled=\{unavailable\}/);
  assert.match(play,/aria-disabled=\{!action\.available\}/);
  assert.doesNotMatch(play,/renderActionButton[\s\S]{0,500}<button[^>]*\sdisabled=/);
  assert.match(play,/action\.disabledReason\|\|"현재 사용할 수 없습니다\."/);
  assert.match(css,/\.play-v09-action-icon\[aria-disabled="true"\]/);
  assert.match(css,/\.play-v09-action-icon:focus-visible \.play-action-tooltip/);
});

test("play hierarchy exposes scene target state and combat economy without permanent side windows",()=>{
  const play=read("src/ProductionPlayScreen.tsx");
  const css=read("src/v09-production-play.css");
  assert.match(play,/entity\.kind==="combatant"/);
  assert.match(play,/entity\.kind==="character"/);
  assert.match(play,/targetable=\{Boolean\(chosen\?\.eligibleTargetIds\.includes\(entity\.id\)\)\}/);
  assert.match(play,/scene\.economyByActor\[actor\.id\]/);
  assert.match(play,/play-v09-resource-rail/);
  assert.doesNotMatch(play,/play-context-strip|TURN ORDER|<Inspector|ActionConsole|activity-mini|scene-side/);
  assert.match(css,/\.play-v09-actor\.targetable/);
  assert.match(css,/\.play-v09-actor\.target-selected/);
});

test("session recovery remains user-visible while routine play does not require Debug Dock",()=>{
  const session=read("src/ProductionSessionWorkspaceBridge.tsx");
  const play=read("src/ProductionPlayScreen.tsx");
  assert.match(session,/재연결 중/);
  assert.match(session,/연결이 끊겼습니다|연결이 끊겼/);
  assert.match(session,/Host를 시작하지 못했습니다/);
  for(const source of [session,play]) assert.doesNotMatch(source,/Ctrl\+Shift\+D/);
});
