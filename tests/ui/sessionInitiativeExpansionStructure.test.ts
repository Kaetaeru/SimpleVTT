import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = readFileSync(new URL("../../src/SessionModeRoot.tsx", import.meta.url), "utf8");
const strip = readFileSync(new URL("../../src/SessionInitiativeStrip.tsx", import.meta.url), "utf8");
const focus = readFileSync(new URL("../../src/SessionMainFocus.tsx", import.meta.url), "utf8");
const dock = readFileSync(new URL("../../src/SessionActionDock.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../src/session-initiative.css", import.meta.url), "utf8");

test("Initiative expands the same persistent Session root instead of navigating to a combat page", () => {
  assert.match(root, /import \{ SessionInitiativeStrip \} from "\.\/SessionInitiativeStrip"/);
  assert.match(root, /<SessionInitiativeStrip role=\{role\} \/>/);
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
  assert.match(focus, /current\.hp\/\{current\.maxHp\}/);
  assert.match(focus, /current\.status\.map/);
  assert.match(focus, /session-freeform-focus/);
  assert.match(focus, /대화와 탐험을 이어가고/);
  assert.doesNotMatch(focus, /actionsByActor|resolveAction|selectDmActor/);
});

test("Action Dock keeps its existing Initiative intent set and the strip remains horizontally compact", () => {
  assert.match(dock, /const INITIATIVE_RESTING: PlayIntentId\[\] = \["attack", "magic", "dash", "disengage", "dodge", "help"\]/);
  assert.match(css, /\.session-mode-root\[data-session-mode="initiative"\][\s\S]*grid-template-rows: 52px auto minmax\(0, 1fr\) 68px/);
  assert.match(css, /\.session-initiative-order\s*\{[\s\S]*display: flex;[\s\S]*overflow-x: auto/);
  assert.match(css, /@media \(max-width: 620px\)/);
});
