import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = readFileSync(new URL("../../src/SessionModeRoot.tsx", import.meta.url), "utf8");
const strip = readFileSync(new URL("../../src/SessionInitiativeStrip.tsx", import.meta.url), "utf8");
const focus = readFileSync(new URL("../../src/SessionMainFocus.tsx", import.meta.url), "utf8");
const dock = readFileSync(new URL("../../src/SessionActionDock.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../src/session-initiative.css", import.meta.url), "utf8");
const layoutCss = readFileSync(new URL("../../src/session-connected-layout.css", import.meta.url), "utf8");

test("Initiative expands the same persistent Actor Board Stage Command Center skeleton", () => {
  assert.match(root, /<SessionActorBoard position="upper" role=\{role\} \/>/);
  assert.match(root, /<section className="session-play-context"/);
  assert.match(root, /<SessionInitiativeStrip role=\{role\} \/>/);
  assert.match(root, /<SessionActorBoard position="lower" role=\{role\} \/>/);
  assert.match(root, /aria-label="Command Center"/);
  assert.match(root, /data-session-mode=\{snapshot\.sessionMode\}/);
  assert.doesNotMatch(strip, /setRoute|AppRoute|navigate\(|ProductionPlayScreen/);
});

test("Initiative strip reads canonical round current actor order and economy projections", () => {
  assert.match(strip, /snapshot\.scene\.round/);
  assert.match(strip, /snapshot\.scene\.currentActorId/);
  assert.match(strip, /snapshot\.scene\.entities/);
  assert.match(strip, /right\.entity\.initiative - left\.entity\.initiative/);
  assert.match(strip, /snapshot\.scene\.economyByActor\[current\.id\]/);
  assert.doesNotMatch(strip, /setCurrentActor|selectDmActor|economyByActor\[[^\]]+\]\s*=|currentActorId\s*=/);
});

test("turn and Initiative controls delegate to existing authority with player turn ownership", () => {
  assert.match(strip, /const \{ snapshot, endTurn, endInitiative \} = useSimpleVtt\(\)/);
  assert.match(strip, /current\?\.id === snapshot\.activeCharacter\.id/);
  assert.match(strip, /role === "dm" \|\| playerOwnsTurn/);
  assert.match(strip, /await endTurn\(\)/);
  assert.match(strip, /await endInitiative\(\)/);
  assert.match(strip, /snapshot\.resolution/);
  assert.match(strip, /snapshot\.connectionState === "connected"/);
  assert.doesNotMatch(strip, /setSessionMode|startInitiative|new Map|localStorage/);
});

test("Initiative Main Focus stays compact while Freeform remains the quiet default", () => {
  assert.match(focus, /snapshot\.sessionMode === "initiative"/);
  assert.match(focus, /session-initiative-current-card/);
  assert.match(focus, /\{current\.hp\}\/\{current\.maxHp\}/);
  assert.match(focus, /current\.status\.map/);
  assert.match(focus, /session-freeform-focus/);
  assert.match(focus, /대화와 탐험을 이어가고/);
  assert.doesNotMatch(focus, /actionsByActor|resolveAction|selectDmActor/);
});

test("Initiative preserves direct Hotbar discovery and tracker remains horizontally compact", () => {
  assert.match(dock, /HOTBAR_PAGES/);
  assert.match(dock, /snapshot\.sessionMode === "initiative" \? snapshot\.scene\.economyByActor\[actorId\]/);
  assert.doesNotMatch(dock, /INITIATIVE_RESTING|OFFICIAL_PLAY_INTENTS|intentOptions/);
  assert.match(layoutCss, /\.session-mode-root\[data-session-mode="initiative"\][\s\S]*grid-template-rows:\s*52px minmax\(0, 1fr\) var\(--session-command-height\)/);
  assert.match(layoutCss, /\.session-mode-root\[data-session-mode="initiative"\] \.session-play-context[\s\S]*grid-template-rows:\s*auto minmax\(0, 1fr\)/);
  assert.match(css, /\.session-initiative-order\s*\{[\s\S]*display: flex;[\s\S]*overflow-x: auto/);
  assert.match(css, /@media \(max-width: 899px\)/);
});
