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
const productRootCss = readFileSync("src/product-root.css", "utf8");
const sessionRoot = readFileSync("src/SessionModeRoot.tsx", "utf8");
const sessionMainFocus = readFileSync("src/SessionMainFocus.tsx", "utf8");
const sessionCss = readFileSync("src/session-mode.css", "utf8");
const contracts = readFileSync("src/app/contracts.ts", "utf8");
const main = readFileSync("src/main.tsx", "utf8");
const vite = readFileSync("vite.config.ts", "utf8");
const home = readFileSync("src/V1HomeScreen.tsx", "utf8");
const content = readFileSync("src/V1ContentScreen.tsx", "utf8");
const css = readFileSync("src/v1-product-shell.css", "utf8");
const firstRun = readFileSync("src/FirstRunTutorial.tsx", "utf8");
const firstRunBridge = readFileSync("src/FirstRunTutorialBridge.tsx", "utf8");
const appearanceBridge = readFileSync("src/AppearanceSettingsBridge.tsx", "utf8");
const appearanceCss = readFileSync("src/appearance-settings.css", "utf8");
const playbook = readFileSync("docs/design/ui-ux/contracts/IMPLEMENTATION-PLAYBOOK.md", "utf8");
const workOrder = readFileSync("docs/design/ui-ux/work-orders/WO-UI-001-product-shell-first-run-tutorial-sheet-preference.md", "utf8");
const continuityWorkOrder = readFileSync("docs/design/ui-ux/work-orders/WO-UI-002-connected-product-shell-continuity-return-to-play.md", "utf8");
const continuityAuthorization = readFileSync("docs/design/ui-ux/work-orders/WO-UI-002-SCOPED-AUTHORIZATION.md", "utf8");

function globalNavBlock() {
  const start = app.indexOf("const nav: Array<[AppRoute, string, string]> = [");
  const end = app.indexOf("  ];", start);
  assert.ok(start >= 0, "missing global nav declaration");
  assert.ok(end > start, "missing global nav declaration boundary");
  return app.slice(start, end);
}

test("fresh use is gated by the canonical Tutorial before normal Home interaction", () => {
  assert.match(contracts, /\| "home"/);
  assert.match(app, /useState<AppRoute>\("home"\)/);
  assert.match(main, /<FirstRunTutorialBridge\s*\/>/);
  assert.match(firstRunBridge, /readFirstRunCompletion\(\) \? null : "first-run"/);
  assert.match(firstRunBridge, /setAttribute\("inert"/);
  assert.match(firstRun, /Standalone Character/);
  assert.match(firstRun, /Host Session/);
  assert.match(firstRun, /Join Session/);
  assert.match(firstRun, /Official-style/);
  assert.match(firstRun, /SimpleVTT 최적화/);
  assert.match(app, /<V1HomeScreen/);
  assert.match(home, />SimpleVTT</);
  assert.doesNotMatch(home, /simplevtt\.v1\.guide\.dismissed|v1-onboarding/);
});

test("v1 global navigation is small, ordered, and top-oriented", () => {
  const nav = globalNavBlock();
  const order = ["home", "characters", "session", "content", "catalog", "settings"];
  let previous = -1;
  for (const route of order) {
    const index = nav.indexOf(`["${route}"`);
    assert.ok(index > previous, `${route} must follow accepted global order`);
    previous = index;
  }
  assert.doesNotMatch(app, /const dmNav:[\s\S]*?combatants/);
  assert.doesNotMatch(app, /const playerNav:[\s\S]*?activity/);
  assert.match(css, /\.v1-shell\{grid-template-columns:minmax\(0,1fr\);grid-template-rows:auto minmax\(0,1fr\)\}/);
  assert.match(css, /\.v1-sidebar\{[^}]*display:flex;align-items:center/);
  assert.doesNotMatch(css, /grid-template-columns:220px/);
  assert.doesNotMatch(css, /\.v1-nav\{display:flex;flex-direction:column/);
});

test("live connected sessions separate authority truth from Product-vs-Play presentation", () => {
  assert.match(main, /<ProductRoot\s*\/>/);
  assert.match(productRoot, /type ProductSurface = "product" \| "play"/);
  assert.match(productRoot, /snapshot\.session\.role !== "offline"/);
  assert.match(productRoot, /snapshot\.session\.lifecycle === "live"/);
  assert.match(productRoot, /useState<ProductSurface>\("product"\)/);
  assert.match(productRoot, /if \(!wasLiveConnected\.current\)[\s\S]*setSurface\("play"\)/);
  assert.match(productRoot, /liveConnected && surface === "play"/);
  assert.match(productRoot, /<SessionModeRoot\s*\/>/);
  assert.match(productRoot, /<App\s*\/>/);
  assert.match(productRoot, /SimpleVTT 메뉴/);
  assert.match(productRoot, /setSurface\("product"\)/);
  assert.match(productRoot, /setSurface\("play"\)/);
  assert.doesNotMatch(productRoot, /stopSession|hostSession|joinSession|reconnect/);
  assert.doesNotMatch(productRoot, /localStorage|sessionStorage/);

  assert.match(productRoot, /isReturnToConnectedPlayTarget/);
  assert.match(productRoot, /플레이로 돌아가기/);
  assert.match(productRoot, /기기로 플레이/);
  assert.match(productRoot, /event\.preventDefault\(\)/);
  assert.match(productRoot, /event\.stopPropagation\(\)/);

  assert.match(productRootCss, /\.connected-product-shell-entry/);
  assert.match(productRootCss, /:focus-visible/);
  assert.match(productRootCss, /@media \(max-width: 899px\)/);
  assert.match(continuityWorkOrder, /Scenario 34/);
  assert.match(continuityWorkOrder, /QA-NAV-06/);
  assert.match(continuityWorkOrder, /QA-SES-09/);
  assert.match(continuityAuthorization, /ACTIVE FOR WO-UI-002 ONLY/);
  assert.match(continuityAuthorization, /explicitly approved in conversation on 2026-08-21/);

  assert.match(sessionRoot, /className="session-mode-root"/);
  assert.match(sessionRoot, /className="session-mode-bar"/);
  assert.match(sessionRoot, /className="session-mode-main"/);
  assert.match(sessionRoot, /className="session-mode-action-dock"/);
  assert.match(sessionRoot, /className="session-mode-layer-host"/);
  assert.match(sessionRoot, /빠른 캐릭터 시트 열기/);
  assert.match(sessionRoot, /snapshot\.activeCharacter/);
  assert.match(sessionRoot, /snapshot\.scene\.actionsByActor/);
  assert.match(sessionRoot, /<SessionMainFocus/);
  assert.match(sessionMainFocus, /snapshot\.session\.participants/);
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

test("the accepted product shell composition is imported in production", () => {
  assert.match(app, /import \{ V1HomeScreen \}/);
  assert.match(app, /import \{ V1ContentScreen \}/);
  assert.match(main, /v1-product-shell\.css/);
  assert.match(main, /v1-product-shell-tokens\.css/);
  assert.match(main, /first-run-tutorial\.css/);
  assert.match(main, /FirstRunTutorialBridge/);
  assert.match(app, /className="app-shell v1-shell"/);
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
  assert.doesNotMatch(appearanceCss, /--(?:good|bad|info)\s*:/);
});

test("formal accepted contracts, not historical agent notes, define the current shell slice", () => {
  assert.match(playbook, /SimpleVTT는 \*\*배틀맵 VTT가 아니다\.\*\*/);
  assert.match(playbook, /ActorCard/);
  assert.match(playbook, /Host\/Join/);
  assert.match(workOrder, /Scenario 01/);
  assert.match(workOrder, /QA-NAV-01/);
  assert.match(workOrder, /Product Shell \+ First-run Tutorial \+ Sheet Presentation Preference/);
});
