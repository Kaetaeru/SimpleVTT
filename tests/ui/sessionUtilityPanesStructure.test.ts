import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sessionRoot = readFileSync(new URL("../../src/SessionModeRoot.tsx", import.meta.url), "utf8");
const panes = readFileSync(new URL("../../src/SessionUtilityPanes.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../../src/CharacterSheetPlayScreen.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../src/session-utility-panes.css", import.meta.url), "utf8");

test("Rules and Activity are Session utilities instead of route replacements", () => {
  assert.match(sessionRoot, /"rules" \| "activity"/);
  assert.match(sessionRoot, /<SessionRulesPane onClose=\{closeUtility\}/);
  assert.match(sessionRoot, /<SessionActivityPane onClose=\{closeUtility\}/);
  assert.match(sessionRoot, /세션 규칙 찾아보기/);
  assert.match(sessionRoot, /최근 세션 결과 보기/);
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

test("Session utility panes are responsive drawers without becoming permanent feeds", () => {
  assert.match(css, /width: min\(440px, calc\(100vw - 80px\)\)/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*width: 100%/);
  assert.match(panes, /필요할 때만 여는 세션 기록입니다/);
});
