import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = readFileSync(new URL("../../src/SessionModeRoot.tsx", import.meta.url), "utf8");
const strip = readFileSync(new URL("../../src/SessionInitiativeStrip.tsx", import.meta.url), "utf8");
const focus = readFileSync(new URL("../../src/SessionMainFocus.tsx", import.meta.url), "utf8");
const dock = readFileSync(new URL("../../src/SessionActionDock.tsx", import.meta.url), "utf8");
const referenceCss = readFileSync(new URL("../../src/session-integrated-reference-play.css", import.meta.url), "utf8");

test("Initiative expands the same accepted Actor Board Stage Command Center skeleton", () => {
  assert.match(root, /<SessionActorBoard position="upper" role=\{role\}/);
  assert.match(root, /session-reference-mapless-stage/);
  assert.match(root, /<SessionInitiativeStrip role=\{role\} \/>/);
  assert.match(root, /<SessionActorBoard position="lower" role=\{role\}/);
  assert.match(root, /aria-label="Command Center"/);
  assert.match(root, /data-session-mode=\{snapshot\.sessionMode\}/);
  assert.doesNotMatch(strip, /setRoute|AppRoute|navigate\(|ProductionPlayScreen/);
});

test("Initiative tracker is projection-only and stays a compact order strip", () => {
  assert.match(strip, /snapshot\.scene\.round/);
  assert.match(strip, /snapshot\.scene\.currentActorId/);
  assert.match(strip, /snapshot\.scene\.entities/);
  assert.match(strip, /right\.entity\.initiative - left\.entity\.initiative/);
  assert.match(strip, /session-reference-initiative-strip/);
  assert.doesNotMatch(strip, /economyByActor|endTurn|endInitiative|setCurrentActor|selectDmActor|setSessionMode|startInitiative|localStorage/);
  assert.match(referenceCss, /\.session-reference-initiative-strip\s*\{[\s\S]*height:\s*40px/);
  assert.match(referenceCss, /\.session-reference-initiative-strip \.session-initiative-order > div[\s\S]*flex:\s*0 0 65px/);
});

test("Initiative economy and End Turn stay in the persistent Command Center", () => {
  assert.match(dock, /snapshot\.scene\.economyByActor\[actorId\]/);
  assert.match(dock, /const \{snapshot,resolveAction,endTurn\}=useSimpleVtt\(\)/);
  assert.match(dock, /currentActor\?\.id===snapshot\.activeCharacter\.id/);
  assert.match(dock, /role==="dm"\|\|playerOwnsTurn/);
  assert.match(dock, /await endTurn\(\)/);
  assert.match(dock, /snapshot\.connectionState==="connected"/);
  assert.match(dock, /<i\/>행동/);
  assert.match(dock, /<i\/>보너스/);
  assert.match(dock, /<i\/>반응/);
  assert.match(dock, /<i\/>이동/);
});

test("Stage focus remains presentation-only and centers the authoritative current Actor", () => {
  assert.match(focus, /snapshot\.sessionMode === "initiative"/);
  assert.match(focus, /snapshot\.scene\.currentActorId/);
  assert.match(focus, /CURRENT TURN · ROUND/);
  assert.match(focus, /session-current-turn-actor/);
  assert.match(focus, /session-freeform-focus/);
  assert.doesNotMatch(focus, /current\.hp|economyByActor|actionsByActor|resolveAction|selectDmActor/);
});

test("Initiative keeps the exact accepted Play root proportions", () => {
  assert.match(referenceCss, /\.session-reference-play-root\.session-mode-root\[data-session-mode="initiative"\][\s\S]*grid-template-rows:\s*41px minmax\(0, 1fr\) var\(--svtt-command-h\)/);
  assert.match(referenceCss, /--svtt-command-h:\s*max\(174px/);
  assert.match(referenceCss, /--svtt-actor-board-h:\s*112px/);
});
