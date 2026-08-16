import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

test("Phase 07 level-up keeps authoritative progression controls while using the focused creation shell", () => {
  const ui = source("src/LevelUpV10.tsx");
  const css = source("src/level-up-v10.css");
  assert.match(ui, /자동 획득/);
  assert.match(ui, /progressionPlan/);
  assert.match(ui, /setProgressionTargetClass/);
  assert.match(ui, /setProgressionChoice/);
  assert.match(ui, /focused-create-header/);
  assert.match(ui, /focused-create-body/);
  assert.match(ui, /focused-create-stage/);
  assert.match(ui, /focused-character-preview/);
  assert.match(ui, /focused-create-footer/);
  assert.match(css, /phase07-levelup-active > \.builder-screen/);
  assert.doesNotMatch(ui, /LEVEL_STEPS/);
});

test("Phase 07 level-up reuses character-creation option cards and spell library interactions", () => {
  const ui = source("src/LevelUpV10.tsx");
  assert.match(ui, /import \{ OptionCard, SectionShell \} from "\.\/character-create\/v09Ui"/);
  assert.match(ui, /import \{ SpellTile \} from "\.\/SpellUi"/);
  assert.match(ui, /spellMatchesFilter/);
  assert.match(ui, /spellSearchText/);
  assert.match(ui, /SELECTED SPELLS/);
  assert.match(ui, /한국어 \/ English \/ 학파 \/ 속성/);
  assert.match(ui, /spell-filter-chips/);
  assert.match(ui, /spell-choice-grid/);
});

test("Phase 07 level-up and character creation share section anchors for header navigation", () => {
  const ui = source("src/LevelUpV10.tsx");
  const shared = source("src/character-create/v09Ui.tsx");
  assert.match(shared, /<section id=\{section\.id\} className="create-v09-section">/);
  assert.match(ui, /jumpTo\("levelup-class"\)/);
  assert.match(ui, /jumpTo\("levelup-automatic"\)/);
  assert.match(ui, /jumpTo\("levelup-hp"\)/);
  assert.match(ui, /id:"levelup-class"/);
  assert.match(ui, /id:"levelup-automatic"/);
  assert.match(ui, /id:"levelup-hp"/);
});

test("Phase 07 level-up subclass choices expose rich hover presentation instead of name-only buttons", () => {
  const ui = source("src/LevelUpV10.tsx");
  const presentation = source("src/app/levelUpV10Presentation.ts");
  assert.match(ui, /projectLevelUpSubclassPresentation/);
  assert.match(ui, /choice\.kind === "subclass"/);
  assert.match(ui, /levelup-subclass-grid/);
  assert.match(presentation, /Path of the Berserker/);
  assert.match(presentation, /College of Lore/);
  assert.match(presentation, /Life Domain/);
  assert.match(presentation, /Champion/);
  assert.match(presentation, /Draconic Sorcery/);
  assert.match(presentation, /School of Evocation/);
});

test("Phase 07 level-up owns a definite viewport while the creation-style stage and preview scroll", () => {
  const css = source("src/level-up-v10.css");
  assert.match(css, /\.levelup-v10\s*\{[^}]*position:absolute;[^}]*inset:0;[^}]*grid-template-rows:auto minmax\(0,1fr\) auto;[^}]*overflow:hidden;/s);
  assert.match(css, /\.levelup-v10-main\s*\{[^}]*min-height:0;[^}]*overflow-y:auto;[^}]*scrollbar-gutter:stable;/s);
  assert.match(css, /\.levelup-v10-preview\s*\{[^}]*min-height:0;[^}]*overflow-y:auto;[^}]*scrollbar-gutter:stable;/s);
});

test("Phase 07 UI renders catalog-pending choices explicitly instead of silently approximating them", () => {
  const ui = source("src/LevelUpV10.tsx");
  assert.match(ui, /catalog-pending/);
  assert.match(ui, /Phase 08 필요/);
  assert.match(ui, /pendingReason/);
});
