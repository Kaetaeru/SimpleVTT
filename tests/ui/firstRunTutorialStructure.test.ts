import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const main = readFileSync("src/main.tsx", "utf8");
const tutorial = readFileSync("src/FirstRunTutorial.tsx", "utf8");
const tutorialBridge = readFileSync("src/FirstRunTutorialBridge.tsx", "utf8");
const tutorialPreferences = readFileSync("src/app/firstRunPreferences.ts", "utf8");
const sheetPreferences = readFileSync("src/app/sheetLayoutPreferences.ts", "utf8");
const sheet = readFileSync("src/CharacterSheetPlayScreen.tsx", "utf8");
const home = readFileSync("src/V1HomeScreen.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const shellCss = readFileSync("src/v1-product-shell.css", "utf8");
const tutorialCss = readFileSync("src/first-run-tutorial.css", "utf8");

test("fresh first-use Tutorial is mounted outside product/domain state", () => {
  assert.match(main, /<FirstRunTutorialBridge\s*\/>/);
  assert.match(tutorialBridge, /readFirstRunCompletion\(\) \? null : "first-run"/);
  assert.match(tutorialBridge, /createPortal\([\s\S]*<FirstRunTutorial/);
  assert.match(tutorialBridge, /document\.body/);
  assert.match(tutorialPreferences, /simplevtt\.product\.first-run\.v1/);
  assert.doesNotMatch(tutorialPreferences, /AppSnapshot|session|Character/);
  assert.match(tutorialBridge, /setAttribute\("inert"/);
});

test("Tutorial explains all three product orientations and requires a Sheet choice", () => {
  assert.match(tutorial, /Standalone Character/);
  assert.match(tutorial, /Host Session/);
  assert.match(tutorial, /Join Session/);
  assert.match(tutorial, /Official-style/);
  assert.match(tutorial, /SimpleVTT 최적화/);
  assert.match(tutorial, /disabled=\{!layout\}/);
  assert.match(tutorial, /onComplete\(layout\)/);
  assert.match(tutorial, /캐릭터 생성이나 세션 연결은 자동으로 시작하지 않습니다/);
});

test("Tutorial persists presentation and completion but does not duplicate Character data", () => {
  assert.match(tutorialBridge, /persistSheetLayoutPreference\(layout\)/);
  assert.match(tutorialBridge, /persistFirstRunCompletion\(\)/);
  assert.match(sheetPreferences, /readStoredSheetLayoutPreference/);
  assert.match(sheet, /const character = snapshot\.activeCharacter/);
  assert.match(sheet, /layout === "simplevtt"[\s\S]*SimpleVttCharacterSheetPlayScreen[\s\S]*OfficialCharacterSheetPlayScreen/);
});

test("Home no longer owns a competing onboarding lifecycle", () => {
  assert.doesNotMatch(home, /GUIDE_KEY|simplevtt\.v1\.guide\.dismissed|v1-onboarding|guideOpen|dismissGuide/);
  assert.match(home, /처음 사용 안내는 설정에서 언제든 다시 열 수 있습니다/);
});

test("Settings can reopen the canonical Tutorial without resetting runtime state", () => {
  assert.match(tutorialBridge, /querySelector<HTMLElement>\("\.settings-card"\)/);
  assert.match(tutorialBridge, /튜토리얼 다시 보기/);
  assert.match(tutorialBridge, /setMode\("reopen"\)/);
  assert.doesNotMatch(tutorialBridge, /createCharacterDraft|startSession|joinSession|stopSession|AppSnapshot/);
});

test("global product navigation order stays exact and renders as a top horizontal baseline", () => {
  const expected = ["home", "characters", "session", "content", "catalog", "settings"];
  let last = -1;
  for (const route of expected) {
    const index = app.indexOf(`["${route}"`);
    assert.ok(index > last, `${route} must follow accepted global order`);
    last = index;
  }
  assert.match(shellCss, /\.v1-shell\{grid-template-columns:minmax\(0,1fr\);grid-template-rows:auto minmax\(0,1fr\)\}/);
  assert.match(shellCss, /\.v1-sidebar\{[^}]*display:flex;align-items:center/);
  assert.doesNotMatch(shellCss, /\.v1-shell\{grid-template-columns:220px/);
  assert.doesNotMatch(shellCss, /\.v1-nav\{display:flex;flex-direction:column/);
});

test("Tutorial and top product navigation expose visible keyboard focus", () => {
  assert.match(tutorialCss, /focus-visible/);
  assert.match(shellCss, /focus-visible/);
});
