import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE,
  persistAppearancePreference,
  readAppearancePreference,
  type AppearanceStorage,
} from "../../src/app/appearancePreferences";

const app = readFileSync("src/App.tsx", "utf8");
const productRoot = readFileSync("src/ProductRoot.tsx", "utf8");
const sessionRoot = readFileSync("src/SessionModeRoot.tsx", "utf8");
const sessionCss = readFileSync("src/session-mode.css", "utf8");
const contracts = readFileSync("src/app/contracts.ts", "utf8");
const main = readFileSync("src/main.tsx", "utf8");
const vite = readFileSync("vite.config.ts", "utf8");
const home = readFileSync("src/V1HomeScreen.tsx", "utf8");
const content = readFileSync("src/V1ContentScreen.tsx", "utf8");
const css = readFileSync("src/v1-product-shell.css", "utf8");
const appearanceBridge = readFileSync("src/AppearanceSettingsBridge.tsx", "utf8");
const appearanceCss = readFileSync("src/appearance-settings.css", "utf8");
const design = readFileSync(".agents/V1_PRODUCT_EXPERIENCE.md", "utf8");

test("v1 launches into a real Home/title surface", () => {
  assert.match(contracts, /\| "home"/);
  assert.match(app, /useState<AppRoute>\("home"\)/);
  assert.match(app, /<V1HomeScreen/);
  assert.match(home, />SimpleVTT</);
  assert.match(home, /새 캐릭터 만들기/);
  assert.match(home, /세션 참가하기|Host \/ Join/);
  assert.match(home, /애드온 추가/);
  assert.match(home, /규칙 찾아보기/);
});

test("v1 global navigation is small and stable", () => {
  for (const route of ["home", "characters", "session", "content", "catalog", "settings"]) {
    assert.match(app, new RegExp(`\\[\\"${route}\\"`));
  }
  assert.doesNotMatch(app, /const dmNav:[\s\S]*?combatants/);
  assert.doesNotMatch(app, /const playerNav:[\s\S]*?activity/);
  assert.match(app, /liveSession[\s\S]*플레이로 돌아가기/);
  assert.match(css, /\.v1-sidebar/);
});

test("connected sessions switch to the persistent Session root without duplicating mechanics authority", () => {
  assert.match(main, /<ProductRoot\s*\/>/);
  assert.match(productRoot, /snapshot\.session\.role !== "offline"/);
  assert.match(productRoot, /return <SessionModeRoot\s*\/>/);
  assert.match(productRoot, /return <App\s*\/>/);

  assert.match(sessionRoot, /className="session-mode-root"/);
  assert.match(sessionRoot, /className="session-mode-bar"/);
  assert.match(sessionRoot, /className="session-mode-main"/);
  assert.match(sessionRoot, /className="session-mode-action-dock"/);
  assert.match(sessionRoot, /className="session-mode-layer-host"/);
  assert.match(sessionRoot, /빠른 캐릭터 시트 열기/);
  assert.match(sessionRoot, /snapshot\.activeCharacter/);
  assert.match(sessionRoot, /snapshot\.scene\.actionsByActor/);
  assert.match(sessionRoot, /snapshot\.session\.participants/);
  assert.match(sessionRoot, /stopSession/);
  assert.doesNotMatch(sessionRoot, /mockAdapter|VisualDiceTray|플레이로 돌아가기|HOTBAR_TABS|SCENE ACTORS/);

  assert.match(sessionCss, /grid-template-rows:\s*52px minmax\(0, 1fr\) 68px/);
  assert.match(sessionCss, /\.session-mode-rail/);
  assert.match(sessionCss, /\.session-quick-sheet/);
  assert.match(sessionCss, /@media \(max-width: 899px\)/);
});

test("addons have a first-class file-based product flow", () => {
  assert.match(contracts, /\| "content"/);
  assert.match(app, /route === "content" && <V1ContentScreen/);
  assert.match(content, /type="file"/);
  assert.match(content, /accept="\.json,application\/json"/);
  assert.match(content, /previewContentImport/);
  assert.match(content, /activateContentImport/);
  assert.match(content, /애드온 만드는 방법/);
  assert.match(content, /0\.1-draft/);
  assert.match(content, /MAX_ADDON_BYTES/);
});

test("production routes are explicit source composition, not a Vite string-rewrite hook", () => {
  assert.match(app, /import \{ CharacterSheetPlayScreen \}/);
  assert.match(app, /import \{ CharacterCreateScreenV10 \}/);
  assert.match(app, /route === "character" && <CharacterSheetPlayScreen/);
  assert.match(app, /route === "create" && <CharacterCreateScreenV10/);
  assert.doesNotMatch(vite, /simplevtt-character-progression-routes|legacyCharacterRoute|Expected legacy CharacterSheetScreen route/);
  assert.match(vite, /plugins:\s*\[react\(\)\]/);
});

test("the new product shell is imported as production composition", () => {
  assert.match(app, /import \{ V1HomeScreen \}/);
  assert.match(app, /import \{ V1ContentScreen \}/);
  assert.match(main, /v1-product-shell\.css/);
  assert.match(main, /v1-product-shell-tokens\.css/);
  assert.match(app, /className="app-shell v1-shell"/);
  assert.match(app, /className="v1-sidebar"/);
  assert.match(app, /className="v1-topbar"/);
});

test("V0.9 appearance persists independent mode and accent preferences", () => {
  const memory = new Map<string, string>();
  const storage: AppearanceStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => { memory.set(key, value); },
  };
  const saved = persistAppearancePreference({ mode: "light", accent: "#3478c9" }, storage);
  assert.deepEqual(saved, { mode: "light", accent: "#3478c9" });
  assert.deepEqual(readAppearancePreference(storage), saved);
  memory.set(APPEARANCE_STORAGE_KEY, JSON.stringify({ mode: "light", accent: "javascript:red" }));
  assert.deepEqual(readAppearancePreference(storage), { mode: "light", accent: DEFAULT_APPEARANCE.accent });
});

test("V0.9 appearance is applied before render and Settings exposes presets plus a custom color", () => {
  assert.match(main, /initializeAppearancePreference\(\);[\s\S]*createRoot/);
  assert.match(main, /<AppearanceSettingsBridge/);
  assert.match(main, /appearance-settings\.css/);
  assert.match(appearanceBridge, /APPEARANCE_SWATCHES\.map/);
  assert.match(appearanceBridge, /type="color"/);
  assert.match(appearanceBridge, /aria-pressed/);
  assert.match(appearanceBridge, /mode === "dark" \? "다크" : "라이트"/);
  assert.doesNotMatch(appearanceBridge, /Parchment|Crimson|양피지/);
  assert.match(appearanceCss, /--accent-base/);
  assert.match(appearanceCss, /focus-visible/);
  assert.match(appearanceCss, /Retire the legacy fixed Theme\/Accent controls/);
  assert.doesNotMatch(appearanceCss, /--(?:good|bad|info)\s*:/);
});

test("v1 completion contract covers every production entry journey", () => {
  for (const phrase of ["Fresh-user product walkthrough", "Character/tabletop walkthrough", "Addon/content walkthrough", "Session/connected walkthrough", "Play/DM walkthrough", "Dice and quality gates"]) {
    assert.match(design, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(design, /Debug Dock/);
  assert.match(design, /one exact source SHA/);
});
