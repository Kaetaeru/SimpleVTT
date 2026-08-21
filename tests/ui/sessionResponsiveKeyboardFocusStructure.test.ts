import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = readFileSync(new URL("../../src/SessionModeRoot.tsx", import.meta.url), "utf8");
const handout = readFileSync(new URL("../../src/SessionImageHandoutBridge.tsx", import.meta.url), "utf8");
const dm = readFileSync(new URL("../../src/SessionDmTools.tsx", import.meta.url), "utf8");
const modeCss = readFileSync(new URL("../../src/session-mode.css", import.meta.url), "utf8");
const layoutCss = readFileSync(new URL("../../src/session-connected-layout.css", import.meta.url), "utf8");
const actorCss = readFileSync(new URL("../../src/session-actor-boards.css", import.meta.url), "utf8");
const actionCss = readFileSync(new URL("../../src/session-action-dock.css", import.meta.url), "utf8");
const handoutCss = readFileSync(new URL("../../src/session-image-handout.css", import.meta.url), "utf8");
const dmCss = readFileSync(new URL("../../src/session-dm-tools.css", import.meta.url), "utf8");

function mediaBlock(source: string, width: number) {
  const marker = `@media (max-width: ${width}px)`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `missing ${marker}`);
  const next = source.indexOf("@media (", start + marker.length);
  return source.slice(start, next >= 0 ? next : undefined);
}

test("Escape closes only the top Session layer and utility close restores its launcher", () => {
  assert.match(root, /if \(playerHandoutOpen\)[\s\S]*dismissCurrentSessionImageHandout\(\);[\s\S]*return;/);
  assert.match(root, /if \(workspaceLayer && activeUtility === "rules"\)/);
  assert.match(root, /if \(workspaceLayer\)/);
  assert.match(root, /if \(activeUtility\)/);
  assert.match(root, /window\.requestAnimationFrame\(\(\) => lastLauncher\.current\?\.focus\(\)\)/);
  assert.match(root, /event\.key !== "Escape"/);
});

test("Player Handout dismissal restores keyboard focus to the contextual reopen control", () => {
  assert.match(handout, /PLAYER_HANDOUT_LAUNCHER_ID = "session-player-handout-launcher"/);
  assert.match(handout, /id=\{PLAYER_HANDOUT_LAUNCHER_ID\}/);
  assert.match(handout, /dismissSessionImageHandout\(mockAdapter\);[\s\S]*requestAnimationFrame[\s\S]*getElementById\(PLAYER_HANDOUT_LAUNCHER_ID\)\?\.focus\(\)/);
  assert.match(handout, /autoFocus onClick=\{dismissCurrentSessionImageHandout\}/);
});

test("DM session termination stays reachable when the narrow header action is hidden", () => {
  assert.match(modeCss, /@media \(max-width: 899px\)[\s\S]*\.session-mode-exit \{ display: none; \}/);
  assert.match(dm, /export function SessionSharePane/);
  assert.match(dm, /const \{ snapshot, stopSession \} = useSimpleVtt\(\)/);
  assert.match(dm, /await stopSession\(\)/);
  assert.match(dm, /session-dm-end-session/);
  assert.match(dm, />세션 종료</);
});

test("constrained Session utility rail and resolution layer remain scroll-reachable", () => {
  const narrow = mediaBlock(modeCss, 899);
  assert.match(narrow, /\.session-mode-rail\s*\{[\s\S]*overflow-y: auto;[\s\S]*overscroll-behavior: contain;/);
  assert.match(modeCss, /\.session-resolution-layer\s*\{[\s\S]*max-height: calc\(100% - 28px\);[\s\S]*overflow: auto;/);
  assert.match(mediaBlock(layoutCss, 899), /\.session-play-context \.session-mode-rail[\s\S]*max-height: calc\(100% - 16px\)/);
});

test("narrow desktop keeps Actor Boards scrollable and Command Center reachable", () => {
  assert.match(actorCss, /\.session-actor-board-scroll\s*\{[\s\S]*display: flex;[\s\S]*overflow-x: auto/);
  assert.match(actorCss, /\.session-actor-card\s*\{[\s\S]*min-width: 168px/);
  assert.match(mediaBlock(actorCss, 899), /\.session-actor-card[\s\S]*min-width: 164px/);
  assert.match(mediaBlock(layoutCss, 899), /--session-command-height: 154px/);
  assert.match(actionCss, /\.session-hotbar-slots\s*\{[\s\S]*overflow-x: auto/);
});

test("major Session interaction surfaces retain constrained-width fallbacks", () => {
  assert.match(mediaBlock(modeCss, 620), /\.session-quick-sheet \{ width: 100%; \}/);
  assert.match(mediaBlock(actionCss, 620), /\.session-command-center[\s\S]*grid-template-columns: 118px minmax\(0, 1fr\)/);
  assert.match(mediaBlock(actionCss, 620), /\.session-action-target-list,[\s\S]*grid-template-columns: 1fr/);
  assert.match(mediaBlock(handoutCss, 620), /\.session-handout-pane \{ width: 100%; \}/);
  assert.match(mediaBlock(dmCss, 620), /\.session-dm-pane \{ width: 100%; \}/);
});
