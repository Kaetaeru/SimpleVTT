import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEFAULT_SHEET_LAYOUT, SHEET_LAYOUT_STORAGE_KEY, persistSheetLayoutPreference, readSheetLayoutPreference, sanitizeSheetLayoutPreference, type SheetLayoutStorage } from "../../src/app/sheetLayoutPreferences";

const wrapper=readFileSync(new URL("../../src/CharacterSheetPlayScreen.tsx",import.meta.url),"utf8");
const legacy=readFileSync(new URL("../../src/LegacyCharacterSheetPlayScreen.tsx",import.meta.url),"utf8");
const official=readFileSync(new URL("../../src/OfficialCharacterSheetPlayScreen.tsx",import.meta.url),"utf8");
const characterPage=readFileSync(new URL("../../src/OfficialCharacterSheetPage.tsx",import.meta.url),"utf8");
const spellPage=readFileSync(new URL("../../src/OfficialSpellcastingSheetPage.tsx",import.meta.url),"utf8");
const libraryBridge=readFileSync(new URL("../../src/CharacterLibraryUxBridge.tsx",import.meta.url),"utf8");
const main=readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf8");
const sheet=[wrapper,legacy,official,characterPage,spellPage].join("\n");
const app=readFileSync(new URL("../../src/App.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../../src/character-sheet-layouts.css",import.meta.url),"utf8");
class MemoryStorage implements SheetLayoutStorage { value=new Map<string,string>(); getItem(key:string){return this.value.get(key)??null;} setItem(key:string,value:string){this.value.set(key,value);} }

test("Character route keeps the validated standalone SimpleVTT sheet and adds a persisted layout router",()=>{
  assert.match(app,/route === "character" && <CharacterSheetPlayScreen/);
  assert.match(wrapper,/SimpleVttCharacterSheetPlayScreen/);
  assert.match(wrapper,/OfficialCharacterSheetPlayScreen/);
  assert.match(legacy,/TABLE CHARACTER SHEET/);
  assert.doesNotMatch(sheet,/기기로 플레이/);
});

test("Character Library exposes the demo-established sheet-style switch before a card is opened",()=>{
  assert.match(main,/CharacterLibraryUxBridge/);
  assert.match(main,/<CharacterLibraryUxBridge \/>/);
  assert.match(libraryBridge,/character-library-grid/);
  assert.match(libraryBridge,/SimpleVTT 시트/);
  assert.match(libraryBridge,/공식 시트 스타일/);
  assert.match(libraryBridge,/persistSheetLayoutPreference/);
  assert.match(libraryBridge,/snapshot\.characters\[index\]/);
  assert.match(libraryBridge,/selectProductionCharacter\(character\.id\)/);
});

test("validated SimpleVTT sheet local roll behavior remains unchanged behind the router",()=>{
  for(const pattern of [/능력 판정/,/내성 굴림/,/view\.skillsByAbility/,/명중 굴림/,/피해 굴림/,/crypto\.getRandomValues/,/유리/,/불리/,/StandaloneDicePresentation/,/최근 굴림/]) assert.match(legacy,pattern);
  assert.doesNotMatch(legacy,/resolveAction|startInitiative|sessionMode/);
  assert.match(legacy,/hostMode==="standalone"&&roll&&<StandaloneDicePresentation/);
});

test("standalone Official Sheet shows both pages together and owns commands inside the paper",()=>{
  assert.match(app,/className="v1-topbar" hidden=\{route === "character"\}/);
  assert.doesNotMatch(wrapper,/className="sheet-layout-choice-bar"/);
  assert.doesNotMatch(official,/className="sheet-play-statusbar"/);
  assert.doesNotMatch(official,/official-sheet-page-tabs|setPage/);
  assert.match(official,/<OfficialCharacterSheetPage[\s\S]*<OfficialSpellcastingSheetPage/);
  assert.match(characterPage,/official-2024-brand-row/);
  assert.match(characterPage,/유리/);
  assert.match(characterPage,/보통/);
  assert.match(characterPage,/불리/);
  assert.match(characterPage,/onEdit=\{onEdit\}/);
  assert.match(characterPage,/onLevelUp=\{onLevelUp\}/);
});

test("dual Sheet preference is presentation-only sanitized and restart-persistent",()=>{
  const storage=new MemoryStorage();
  assert.equal(DEFAULT_SHEET_LAYOUT,"simplevtt");
  assert.equal(readSheetLayoutPreference(storage),"simplevtt");
  assert.equal(persistSheetLayoutPreference("official",storage),"official");
  assert.equal(storage.getItem(SHEET_LAYOUT_STORAGE_KEY),"official");
  assert.equal(readSheetLayoutPreference(storage),"official");
  assert.equal(sanitizeSheetLayoutPreference("unexpected"),"simplevtt");
  assert.match(wrapper,/readSheetLayoutPreference/);
  assert.match(wrapper,/persistSheetLayoutPreference/);
  const pref=readFileSync(new URL("../../src/app/sheetLayoutPreferences.ts",import.meta.url),"utf8");
  assert.doesNotMatch(pref,/CharacterSheet|activeCharacter|mockAdapter|ResolutionEvent/);
});

test("both layouts remain on one canonical activeCharacter authority",()=>{
  assert.match(legacy,/snapshot\.activeCharacter/);
  assert.match(official,/const c = snapshot\.activeCharacter/);
  assert.doesNotMatch([wrapper,official,characterPage,spellPage].join("\n"),/useState<[^>]*Character|localStorage.*Character|new Map<[^>]*Character/i);
});

test("Official Character page follows the 2024 paper arrangement and keeps supported controls interactive",()=>{
  for (const label of ["Character Name","Background","Class","Species","Subclass","LEVEL","XP","ARMOR","SHIELD","HIT POINTS","HIT DICE","DEATH","PROFICIENCY BONUS","Saving Throw","INITIATIVE","SPEED","SIZE","PASSIVE PERCEPTION","WEAPONS &amp; DAMAGE CANTRIPS","CLASS FEATURES","SPECIES TRAITS","FEATS","EQUIPMENT TRAINING &amp; PROFICIENCIES","HEROIC"]) assert.match(characterPage,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(characterPage,/official-2024-sheet/);
  assert.match(characterPage,/official-2024-ability-score/);
  assert.match(characterPage,/RollModeControl/);
  assert.match(characterPage,/rawDie\(hitDie/);
  assert.match(css,/\.official-2024-body/);
  assert.match(css,/grid-template-columns:330px minmax\(0,1fr\)/);
  assert.doesNotMatch(css,/parchment|url\(/i);
});

test("Official Spellcasting page follows the 2024 second page and keeps shared state and local actions",()=>{
  assert.match(spellPage,/Array\.from\(\{ length: 9 \}/);
  assert.match(spellPage,/spellcasting\?\.slots/);
  assert.match(spellPage,/spell\.alwaysPrepared \? "◆ 항상 준비" : spell\.prepared \? "● 준비" : "○ 알려짐"/);
  for(const label of ["SPELLCASTING ABILITY","SPELLCASTING MODIFIER","SPELL SAVE DC","SPELL ATTACK BONUS","SPELL SLOTS","CANTRIPS &amp; PREPARED SPELLS","APPEARANCE","BACKSTORY &amp; PERSONALITY","LANGUAGES","EQUIPMENT","COINS"]) assert.match(spellPage,new RegExp(label));
  assert.match(spellPage,/spellcastingAbilityModifier/);
  assert.match(spellPage,/candidate\.spellCast\?\.spellId/);
  assert.match(spellPage,/action\.attackBonus!/);
  assert.match(spellPage,/damage\(spell\.name, expression\)/);
  assert.match(spellPage,/toggleItemEquipped/);
  assert.match(spellPage,/toggleItemAttunement/);
  assert.match(spellPage,/useItem/);
});

test("Official presentation reads existing projections instead of adding spell/save mechanics arithmetic",()=>{
  assert.doesNotMatch([official,characterPage,spellPage].join("\n"),/8\s*\+\s*c\.proficiencyBonus|Math\.floor\(\(c\.abilities|spellSaveDc\s*=/);
  assert.match(official,/snapshot\.scene\.spellcastingByActor\?\.\[c\.id\]/);
  assert.match(official,/projectOfficialSheet\(c\)/);
  assert.match(characterPage,/sheetAbilityModifier/);
  assert.match(characterPage,/sheetSaveBonus/);
});
