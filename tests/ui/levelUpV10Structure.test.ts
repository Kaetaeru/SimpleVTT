import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

test("Phase 07 level-up UI hides the legacy wizard and exposes BG3-style automatic gains plus actual decisions", () => {
  const ui = source("src/LevelUpV10.tsx");
  const css = source("src/level-up-v10.css");
  assert.match(ui, /자동 획득/);
  assert.match(ui, /선택 필요/);
  assert.match(ui, /\+ 클래스 추가/);
  assert.match(ui, /Before → After/);
  assert.match(ui, /progressionPlan/);
  assert.match(ui, /setProgressionTargetClass/);
  assert.match(ui, /setProgressionChoice/);
  assert.match(css, /phase07-levelup-active > \.builder-screen/);
  assert.doesNotMatch(ui, /LEVEL_STEPS/);
});

test("Phase 07 level-up owns a definite viewport and scrolls its middle panels like character creation", () => {
  const css = source("src/level-up-v10.css");
  assert.match(css, /\.levelup-v10\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;/s);
  assert.match(css, /\.levelup-v10-layout\s*\{[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s);
  assert.match(css, /\.levelup-class-picker,\.levelup-v10-preview,\.levelup-v10-main\s*\{[^}]*overflow-y:\s*auto;[^}]*scrollbar-gutter:\s*stable;/s);
  assert.match(css, /\.levelup-v10-layout > \*\s*\{[^}]*height:\s*100%;[^}]*max-height:\s*100%;/s);
});

test("Phase 07 UI renders catalog-pending choices explicitly instead of silently approximating them", () => {
  const ui = source("src/LevelUpV10.tsx");
  assert.match(ui, /catalog-pending/);
  assert.match(ui, /Phase 08 필요/);
  assert.match(ui, /pendingReason/);
});
