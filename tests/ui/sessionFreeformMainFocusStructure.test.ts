import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = readFileSync(new URL("../../src/SessionModeRoot.tsx", import.meta.url), "utf8");
const focus = readFileSync(new URL("../../src/SessionMainFocus.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../src/session-main-focus.css", import.meta.url), "utf8");
const freeform = focus.slice(focus.indexOf("  const recent = snapshot.activity[0] ?? null;"));

test("Session root delegates the dominant center to a dedicated Main Focus projection", () => {
  assert.match(root, /<SessionMainFocus role=\{role\}/);
  assert.match(root, /onOpenActivity=\{\(button\) => toggleUtility\("activity", button\)\}/);
  assert.doesNotMatch(root, /SCENE ACTORS|HOTBAR_TABS|공통.*클래스.*주문.*아이템/s);
});

test("Freeform stays intentionally low-noise and shows at most one recent meaningful outcome", () => {
  assert.match(focus, /snapshot\.sessionMode === "initiative"/);
  assert.match(freeform, /const recent = snapshot\.activity\[0\] \?\? null/);
  assert.match(freeform, /session-freeform-recent/);
  assert.match(freeform, /필요한 순간에만 시트·규칙·행동을 엽니다/);
  assert.doesNotMatch(freeform, /snapshot\.activity\.map|scene\.entities\.map|economyByActor|actionsByActor/);
});

test("zero-player and empty-Encounter DM states are quiet valid-session notes, not gates", () => {
  assert.match(freeform, /connectedPlayers === 0/);
  assert.match(freeform, /combatantCount === 0/);
  assert.match(freeform, /플레이어 없이도 세션을 계속 준비하고 진행할 수 있습니다/);
  assert.match(freeform, /Encounter가 비어 있어도 자유 진행은 정상 상태입니다/);
  assert.doesNotMatch(freeform, /Ready|플레이 시작|Host Preparing|Lobby/);
});

test("Main Focus layout preserves table space instead of becoming a dashboard", () => {
  assert.match(css, /width: min\(760px, 100%\)/);
  assert.match(css, /session-freeform-recent/);
  assert.match(css, /width: min\(520px, 100%\)/);
  assert.match(css, /session-freeform-dm-notes[\s\S]*margin-top: auto/);
});
