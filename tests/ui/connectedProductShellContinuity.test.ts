import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const productRoot = readFileSync("src/ProductRoot.tsx", "utf8");
const productRootCss = readFileSync("src/product-root.css", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const sessionRoot = readFileSync("src/SessionModeRoot.tsx", "utf8");
const provider = readFileSync("src/app/AppProvider.tsx", "utf8");
const main = readFileSync("src/main.tsx", "utf8");
const authorization = readFileSync("docs/design/ui-ux/work-orders/WO-UI-002-SCOPED-AUTHORIZATION.md", "utf8");

test("AppProvider remains above ProductRoot and owns canonical application state", () => {
  assert.match(main, /<AppProvider>[\s\S]*<ProductRoot\s*\/>[\s\S]*<\/AppProvider>/);
  assert.match(provider, /snapshot: AppSnapshot \| null/);
  assert.doesNotMatch(productRoot, /createContext|AppSnapshot\s*=|useReducer/);
});

test("ProductRoot separates live Session truth from local Product-vs-Play presentation", () => {
  assert.match(productRoot, /type ProductSurface = "product" \| "play"/);
  assert.match(productRoot, /useState<ProductSurface>\("product"\)/);
  assert.match(productRoot, /snapshot\.session\.role !== "offline"/);
  assert.match(productRoot, /snapshot\.session\.lifecycle === "live"/);
  assert.match(productRoot, /if \(!liveConnected\)[\s\S]*setSurface\("product"\)/);
  assert.match(productRoot, /if \(!wasLiveConnected\.current\)[\s\S]*setSurface\("play"\)/);
  assert.doesNotMatch(productRoot, /localStorage|sessionStorage/);
});

test("Connected Play can open Product Shell without mutating Session lifecycle", () => {
  assert.match(productRoot, /data-connected-surface="play"/);
  assert.match(productRoot, /aria-label="제품 메뉴 열기"/);
  assert.match(productRoot, /SimpleVTT 메뉴/);
  assert.match(productRoot, /onClick=\{\(\) => setSurface\("product"\)\}/);
  assert.doesNotMatch(productRoot, /stopSession|hostSession|joinSession|startPreparedSession|setSessionReady/);
  assert.match(sessionRoot, /stopSession/);
  assert.match(sessionRoot, />세션 종료</);
});

test("live Product Shell Return to Play reuses SessionModeRoot rather than ProductionPlayScreen", () => {
  assert.match(app, /플레이로 돌아가기/);
  assert.match(productRoot, /isReturnToConnectedPlayTarget/);
  assert.match(productRoot, /label === "플레이로 돌아가기" \|\| label === "기기로 플레이"/);
  assert.match(productRoot, /event\.preventDefault\(\)/);
  assert.match(productRoot, /event\.stopPropagation\(\)/);
  assert.match(productRoot, /setSurface\("play"\)/);
  assert.match(productRoot, /<SessionModeRoot\s*\/>/);
  assert.doesNotMatch(productRoot, /ProductionPlayScreen/);
});

test("connected Product entry stays compact, focus-visible, and responsive", () => {
  assert.match(productRootCss, /\.connected-product-shell-entry/);
  assert.match(productRootCss, /position: absolute/);
  assert.match(productRootCss, /:focus-visible/);
  assert.match(productRootCss, /@media \(max-width: 899px\)/);
  assert.match(productRootCss, /@media \(max-width: 620px\)/);
  assert.doesNotMatch(productRootCss, /display:\s*none/);
});

test("WO-UI-002 authorization is bounded to navigation composition", () => {
  assert.match(authorization, /ACTIVE FOR WO-UI-002 ONLY/);
  assert.match(authorization, /UX-01-03/);
  assert.match(authorization, /NAV-01-02/);
  assert.match(authorization, /QA-NAV-06/);
  assert.match(authorization, /QA-SES-09/);
  assert.match(authorization, /does \*\*not\*\* authorize:[\s\S]*Connected Play topology redesign/);
});
