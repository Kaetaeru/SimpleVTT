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

test("Phase 07 level-up follows the same active-stage navigation contract as character creation", () => {
  const levelUp = source("src/LevelUpV10.tsx");
  const creation = source("src/CharacterCreateV10.tsx");
  assert.match(levelUp, /type LevelUpStageId = "class" \| "automatic" \| "hp" \| "choices" \| "review"/);
  assert.match(levelUp, /const \[activeStage,setActiveStage\] = useState<LevelUpStageId>\("class"\)/);
  assert.match(levelUp, /activeStage === item\.id \? "active /);
  assert.match(levelUp, />이전<\/button>/);
  assert.match(levelUp, />다음<\/button>/);
  assert.match(levelUp, /activeStage === "review" \? <button[^>]*>레벨 업<\/button>/);
  assert.match(levelUp, /focused-create-header-actions/);
  assert.match(levelUp, />닫기<\/button>/);
  assert.match(creation, /focused-create-tabs/);
  assert.match(creation, />이전<\/button>/);
  assert.match(creation, />다음<\/button>/);
  assert.doesNotMatch(levelUp, /jumpTo\(/);
  assert.doesNotMatch(levelUp, /scrollIntoView/);
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

test("Phase 07 level-up uses the same stage-only scroll and persistent preview viewport as character creation", () => {
  const css = source("src/level-up-v10.css");
  assert.match(css, /\.levelup-v10\s*\{[^}]*position:absolute;[^}]*inset:0;[^}]*grid-template-rows:auto minmax\(0,1fr\) auto;[^}]*overflow:hidden;/s);
  assert.match(css, /\.levelup-v10-main\s*\{[^}]*min-height:0;[^}]*overflow-y:auto;[^}]*scrollbar-gutter:stable;/s);
  assert.match(css, /\.levelup-v10-preview\s*\{[^}]*min-height:0;[^}]*overflow-y:auto;[^}]*scrollbar-gutter:stable;/s);
  assert.match(css, /\.levelup-create-tabs \{ grid-template-columns:repeat\(5/);
});

test("Phase 07 UI renders catalog-pending choices explicitly instead of silently approximating them", () => {
  const ui = source("src/LevelUpV10.tsx");
  assert.match(ui, /catalog-pending/);
  assert.match(ui, /Phase 08 필요/);
  assert.match(ui, /pendingReason/);
});
