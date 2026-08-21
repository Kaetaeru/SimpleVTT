import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sessionRoot = readFileSync(new URL("../../src/SessionModeRoot.tsx", import.meta.url), "utf8");
const panes = readFileSync(new URL("../../src/SessionUtilityPanes.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../../src/CharacterSheetPlayScreen.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../src/session-utility-panes.css", import.meta.url), "utf8");
const referenceCss = readFileSync(new URL("../../src/session-integrated-reference-play.css", import.meta.url), "utf8");

test("Rules and Activity launch from accepted Play chrome into contextual utilities", () => {
  assert.match(sessionRoot, /type SessionUtility = [^;]*"rules"/);
  assert.match(sessionRoot, /type SessionUtility = [^;]*"activity"/);
  assert.match(sessionRoot, /<SessionRulesPane onClose=\{closeUtility\}/);
  assert.match(sessionRoot, /<SessionActivityPane onClose=\{closeUtility\}/);
  assert.match(sessionRoot, />Rules</);
  assert.match(sessionRoot, />Activity</);
  assert.match(sessionRoot, /session-reference-utility-host/);
  assert.doesNotMatch(sessionRoot, /session-mode-rail/);
  assert.doesNotMatch(panes, /setRoute|AppRoute|플레이로 돌아가기/);
});

test("Session Rules reads the existing catalog projection and keeps search local to presentation", () => {
  assert.match(panes, /snapshot\.catalog/);
  assert.match(panes, /entry\.nameKo/);
  assert.match(panes, /entry\.nameEn/);
  assert.match(panes, /entry\.description/);
  assert.match(panes, /selected\.relationships/);
  assert.doesNotMatch(panes, /mockAdapter|new Map<[^>]*Catalog|localStorage/i);
});

test("Activity reads canonical history and DM Undo uses the existing command", () => {
  assert.match(panes, /snapshot\.activity\.slice\(0, 20\)/);
  assert.match(panes, /undoLastResolution/);
  assert.match(panes, /snapshot\.session\.role === "host"/);
  assert.match(panes, /최근 판정 되돌리기/);
});

test("Rules opened from Full Sheet layers above it and Escape closes Rules first", () => {
  assert.match(workspace, /onOpenRules\?: \(launcher: HTMLButtonElement\) => void/);
  assert.match(sessionRoot, /onOpenRules=\{\(button\) => toggleUtility\("rules", button\)\}/);
  assert.match(sessionRoot, /workspaceLayer && activeUtility === "rules"[\s\S]*closeUtility\(\)/);
  assert.match(css, /z-index: 34/);
});

test("accepted contextual utility owns right-side width while reused pane internals remain responsive", () => {
  assert.match(referenceCss, /\.session-reference-utility-host\s*\{[\s\S]*width:\s*338px;[\s\S]*min-width:\s*288px;[\s\S]*max-width:\s*455px/);
  assert.match(referenceCss, /\.session-reference-utility-host > \*[\s\S]*width:\s*100% !important/);
  assert.match(referenceCss, /@media \(max-width: 1000px\)[\s\S]*width: 308px; max-width: 42%/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*width: 100%/);
  assert.match(panes, /필요할 때만 여는 세션 기록입니다/);
});
