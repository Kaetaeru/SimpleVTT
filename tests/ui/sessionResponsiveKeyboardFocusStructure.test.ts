import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = readFileSync(new URL("../../src/SessionModeRoot.tsx", import.meta.url), "utf8");
const handout = readFileSync(new URL("../../src/SessionImageHandoutBridge.tsx", import.meta.url), "utf8");
const dm = readFileSync(new URL("../../src/SessionDmTools.tsx", import.meta.url), "utf8");
const modeCss = readFileSync(new URL("../../src/session-mode.css", import.meta.url), "utf8");
const referenceCss = readFileSync(new URL("../../src/session-integrated-reference-play.css", import.meta.url), "utf8");
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
  assert.match(handout, /handout\.dismissed \? reopenSessionImageHandout\(mockAdapter\) : dismissCurrentSessionImageHandout\(\)/);
});

test("DM session termination remains in the contextual Session pane", () => {
  assert.match(root, />세션</);
  assert.match(root, /toggleUtility\(role === "dm" \? "session" : "player-session"/);
  assert.match(dm, /export function SessionSharePane/);
  assert.match(dm, /const \{ snapshot, stopSession \} = useSimpleVtt\(\)/);
  assert.match(dm, /await stopSession\(\)/);
  assert.match(dm, />세션 종료</);
});

test("constrained desktop overlays the accepted right-side utility instead of restoring a vertical rail", () => {
  assert.doesNotMatch(root, /session-mode-rail/);
  const narrow = mediaBlock(referenceCss, 1000);
  assert.match(narrow, /\.session-reference-utility-host \{ position: absolute; right: 0; top: 0; bottom: 0; width: 308px; max-width: 42%; \}/);
  assert.match(modeCss, /\.session-resolution-layer\s*\{[\s\S]*max-height: calc\(100% - 28px\);[\s\S]*overflow: auto;/);
});

test("narrow desktop keeps accepted Actor Board and Command Center proportions reachable", () => {
  const narrow = mediaBlock(referenceCss, 1000);
  assert.match(referenceCss, /\.session-reference-play-root \.session-actor-board-scroll[\s\S]*overflow-x: auto/);
  assert.match(referenceCss, /\.session-reference-play-root \.session-actor-card[\s\S]*min-width: 164px/);
  assert.match(narrow, /--svtt-actor-board-h: 80px; --svtt-command-h: 164px/);
  assert.match(narrow, /\.session-hotbar-slot \{ flex-basis: 62px; min-width: 62px; \}/);
  assert.match(referenceCss, /\.session-hotbar-slots[\s\S]*overflow-x: auto/);
});

test("major Session interaction surfaces retain constrained-width fallbacks", () => {
  assert.match(mediaBlock(modeCss, 620), /\.session-quick-sheet \{ width: 100%; \}/);
  assert.match(mediaBlock(referenceCss, 760), /\.session-command-body \{ grid-template-columns: 150px minmax\(0, 1fr\) 78px; \}/);
  assert.match(mediaBlock(handoutCss, 620), /\.session-handout-pane \{ width: 100%; \}/);
  assert.match(mediaBlock(dmCss, 620), /\.session-dm-pane \{ width: 100%; \}/);
});
