import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(path:string)=>readFileSync(new URL(`../../${path}`,import.meta.url),"utf8");

test("production composition retires persistent dock and spell HUD in favor of one play surface",()=>{
  const main=read("src/main.tsx");
  const app=read("src/App.tsx");
  assert.doesNotMatch(main,/<PlaySessionDock \/>/);
  assert.doesNotMatch(main,/<CombatSpellHudBridge \/>/);
  assert.match(app,/route === "scene" && <ProductionPlayScreen role=\{productionRole\} \/>/);
});

test("redesigned sheet and play screens own viewport scrolling and explicit keyboard focus",()=>{
  const css=read("src/player-experience-redesign.css");
  const access=read("src/player-experience-accessibility.css");
  assert.match(css,/\.sheet-play-screen,\.play-redesign-screen\{[^}]*position:absolute;[^}]*inset:0;[^}]*overflow:auto/s);
  assert.match(access,/\.sheet-play-screen button:focus-visible/);
  assert.match(access,/\.play-redesign-screen button:focus-visible/);
  assert.match(access,/button:disabled/);
});

test("play hierarchy exposes selected and combat-only states without permanent inspector windows",()=>{
  const play=read("src/ProductionPlayScreen.tsx");
  const css=read("src/player-experience-redesign.css");
  assert.match(play,/className=\{active\?"play-intent active":"play-intent"\}/);
  assert.match(play,/className=\{selected\?"selected":""\}/);
  assert.match(play,/isCombat&&economy/);
  assert.match(play,/TURN ORDER/);
  assert.doesNotMatch(play,/<Inspector|ActionConsole|activity-mini|scene-side/);
  assert.match(css,/\.play-intent\.active/);
  assert.match(css,/\.play-target-grid button\.selected/);
});

test("session recovery remains user-visible while routine play does not require Debug Dock",()=>{
  const session=read("src/ProductionSessionWorkspaceBridge.tsx");
  const play=read("src/ProductionPlayScreen.tsx");
  assert.match(session,/재연결 중/);
  assert.match(session,/연결이 끊겼습니다|연결이 끊겼/);
  assert.match(session,/Host를 시작하지 못했습니다/);
  for(const source of [session,play]) assert.doesNotMatch(source,/Ctrl\+Shift\+D/);
});
