import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const productRoot = readFileSync("src/ProductRoot.tsx", "utf8");
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

test("accepted Play chrome owns the Product exit without mutating Session lifecycle", () => {
  assert.match(productRoot, /<SessionModeRoot onOpenProduct=\{\(\) => setSurface\("product"\)\} \/>/);
  assert.match(sessionRoot, /onOpenProduct\(\): void/);
  assert.match(sessionRoot, />← 제품</);
  assert.match(sessionRoot, /onClick=\{onOpenProduct\}/);
  assert.doesNotMatch(productRoot, /stopSession|hostSession|joinSession|startPreparedSession|setSessionReady/);
  assert.doesNotMatch(sessionRoot, /onOpenProduct[\s\S]*stopSession/);
});

test("live Product Shell Return to Play reuses the same SessionModeRoot", () => {
  assert.match(app, /플레이로 돌아가기/);
  assert.match(productRoot, /isReturnToConnectedPlayTarget/);
  assert.match(productRoot, /label === "플레이로 돌아가기" \|\| label === "기기로 플레이"/);
  assert.match(productRoot, /event\.preventDefault\(\)/);
  assert.match(productRoot, /event\.stopPropagation\(\)/);
  assert.match(productRoot, /setSurface\("play"\)/);
  assert.match(productRoot, /<SessionModeRoot onOpenProduct=/);
  assert.doesNotMatch(productRoot, /ProductionPlayScreen/);
});

test("WO-UI-002 authorization remains bounded to continuity while later visual work keeps the same authority separation", () => {
  assert.match(authorization, /ACTIVE FOR WO-UI-002 ONLY/);
  assert.match(authorization, /UX-01-03/);
  assert.match(authorization, /NAV-01-02/);
  assert.match(authorization, /QA-NAV-06/);
  assert.match(authorization, /QA-SES-09/);
  assert.match(authorization, /does \*\*not\*\* authorize:[\s\S]*Connected Play topology redesign/);
});
