import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sheet=readFileSync(new URL("../../src/CharacterSheetPlayScreen.tsx",import.meta.url),"utf8");
const app=readFileSync(new URL("../../src/App.tsx",import.meta.url),"utf8");

test("Character route uses the standalone playable sheet surface",()=>{
  assert.match(app,/CharacterSheetPlayScreen/);
  assert.match(app,/route === "character" && <CharacterSheetPlayScreen/);
  assert.match(sheet,/TABLE CHARACTER SHEET/);
  assert.match(sheet,/기기로 플레이/);
});

test("sheet directly rolls ability checks saves skills attacks damage and common dice",()=>{
  assert.match(sheet,/능력 판정/);
  assert.match(sheet,/내성 굴림/);
  assert.match(sheet,/view\.skillsByAbility/);
  assert.match(sheet,/명중 굴림/);
  assert.match(sheet,/피해 굴림/);
  assert.match(sheet,/\[4,6,8,10,12,20\]/);
  assert.match(sheet,/crypto\.getRandomValues/);
  assert.match(sheet,/유리/);
  assert.match(sheet,/불리/);
  assert.match(sheet,/VisualDiceTray/);
});

test("tabletop sheet does not require entering a Scene to make local rolls",()=>{
  assert.doesNotMatch(sheet,/resolveAction|startInitiative|sessionMode/);
  assert.match(sheet,/local tabletop physics roll/);
  assert.match(sheet,/최근 굴림/);
});
