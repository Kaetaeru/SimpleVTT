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
const localDicePresentation=readFileSync(new URL("../../src/app/localDicePresentation.ts",import.meta.url),"utf8");
const visualDiceBridge=readFileSync(new URL("../../src/VisualDiceBridge.tsx",import.meta.url),"utf8");
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
  assert.match(legacy,/기기로 플레이/);
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

test("Standalone local rolls keep validated mechanics but present through the shared full-screen dice overlay",()=>{
  for(const pattern of [/능력 판정/,/내성 굴림/,/view\.skillsByAbility/,/명중 굴림/,/피해 굴림/,/crypto\.getRandomValues/,/유리/,/불리/,/최근 굴림/]) assert.match(legacy,pattern);
  assert.match(legacy,/presentLocalDiceRoll\(next\)/);
  assert.match(official,/presentLocalDiceRoll\(next\)/);
  assert.doesNotMatch(legacy,/VisualDiceTray/);
  assert.doesNotMatch(official,/VisualDiceTray/);
  assert.match(localDicePresentation,/LOCAL_DICE_PRESENT_EVENT/);
  assert.match(localDicePresentation,/window\.dispatchEvent\(new CustomEvent/);
  assert.match(visualDiceBridge,/window\.addEventListener\(LOCAL_DICE_PRESENT_EVENT/);
  assert.match(visualDiceBridge,/createPortal\(/);
  assert.match(visualDiceBridge,/document\.body/);
  assert.doesNotMatch(legacy,/resolveAction|startInitiative|sessionMode/);
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

test("Official Character page follows paper information arrangement and keeps supported controls interactive",()=>{
  for (const label of ["Character Name","Class & Level","Background","Player Name","Race / Species","Alignment","Experience Points","Saving Throws","Skills","Passive Wisdom (Perception)","Armor Class","Initiative","Speed","Hit Point Maximum","Temporary Hit Points","Hit Dice","Death Saves","Attacks & Spellcasting","Equipment & Currency","Personality Traits","Ideals","Bonds","Flaws","Features & Traits"]) assert.match(characterPage,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(characterPage,/official-ability-column/);
  assert.match(characterPage,/toggleItemEquipped/);
  assert.match(characterPage,/toggleItemAttunement/);
  assert.match(characterPage,/useItem/);
  assert.match(characterPage,/rawDie\(hitDie/);
  assert.match(characterPage,/Player Name" value="미추적"/);
  assert.match(characterPage,/Alignment" value="미추적"/);
  assert.match(characterPage,/Experience Points" value="미추적"/);
  assert.match(characterPage,/official-resource-box/);
  assert.match(css,/grid-template-columns: 116px 235px minmax\(360px, 1\.35fr\) minmax\(220px, \.85fr\)/);
  assert.doesNotMatch(css,/parchment|url\(/i);
});

test("Official Spellcasting page provides levels 0 through 9 shared slots known/prepared state and supported local actions",()=>{
  assert.match(spellPage,/Array\.from\(\{ length: 10 \}/);
  assert.match(spellPage,/data-spell-level=\{level\}/);
  assert.match(spellPage,/spellcasting\?\.slots/);
  assert.match(spellPage,/spell\.alwaysPrepared \? "◆" : spell\.prepared \? "●" : "○"/);
  for(const label of ["Spellcasting Class","Spellcasting Ability","Spell Save DC","Spell Attack Bonus"]) assert.match(spellPage,new RegExp(label));
  assert.match(spellPage,/spellcastingAbilityModifier/);
  assert.match(spellPage,/candidate\.spellCast\?\.spellId/);
  assert.match(spellPage,/action!\.attackBonus!/);
  assert.match(spellPage,/damage\(spell\.name, expression\)/);
});

test("Official presentation reads existing projections instead of adding spell/save mechanics arithmetic",()=>{
  assert.doesNotMatch([official,characterPage,spellPage].join("\n"),/8\s*\+\s*c\.proficiencyBonus|Math\.floor\(\(c\.abilities|spellSaveDc\s*=/);
  assert.match(official,/snapshot\.scene\.spellcastingByActor\?\.\[c\.id\]/);
  assert.match(official,/projectOfficialSheet\(c\)/);
  assert.match(characterPage,/sheetAbilityModifier/);
  assert.match(characterPage,/sheetSaveBonus/);
});
