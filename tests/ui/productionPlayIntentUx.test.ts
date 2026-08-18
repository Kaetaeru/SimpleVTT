import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const model=readFileSync(new URL("../../src/playerExperienceModel.ts",import.meta.url),"utf8");
const play=readFileSync(new URL("../../src/ProductionPlayScreen.tsx",import.meta.url),"utf8");
const app=readFileSync(new URL("../../src/App.tsx",import.meta.url),"utf8");

test("Scene route uses the V0.9 scene-first production play surface",()=>{
  assert.match(app,/route === "scene" && <ProductionPlayScreen role=\{productionRole\} \/>/);
  assert.match(play,/FREEFORM/);
  assert.match(play,/COMBAT/);
  assert.match(play,/play-v09-stage/);
  assert.match(play,/play-v09-hud/);
  assert.doesNotMatch(play,/play-redesign-main|play-context-strip/);
});

test("official action vocabulary is preserved as icon-HUD capability entry points rather than a fullscreen intent grid",()=>{
  for(const id of ["attack","dash","disengage","dodge","help","hide","influence","magic","ready","search","study","utilize"]) assert.match(model,new RegExp(`id:\"${id}\"`));
  assert.match(play,/BASIC_INTENTS\.map\(renderIntentButton\)/);
  assert.match(play,/SITUATIONAL_INTENTS\.map\(renderIntentButton\)/);
  assert.match(play,/renderIntentButton\("magic"\)/);
  assert.doesNotMatch(play,/play-intent-grid|OFFICIAL_PLAY_INTENTS\.map\(\(item\)/);
});

test("Influence Search Study Hide and Magic reveal real runtime actions only after intent selection",()=>{
  assert.match(model,/INFLUENCE = \["action\.skill\.deception"/);
  assert.match(model,/SEARCH = \["action\.skill\.insight"/);
  assert.match(model,/STUDY = \["action\.skill\.arcana"/);
  assert.match(model,/skillActionIds:\["action\.skill\.stealth"\]/);
  assert.match(play,/intentOptions\(intent,actions\)/);
  assert.match(play,/play-v09-option-strip/);
  assert.match(play,/chooseOption\(action\)/);
});

test("Common is visibly grouped and dedicated tabs remain presentation filters over real ActionVm data",()=>{
  for(const label of ["기본 행동","상황 행동","클래스 · 특성","주문","아이템"]) assert.match(play,new RegExp(label.replace(" · "," \\· ")));
  assert.match(play,/id:"common", label:"공통"/);
  assert.match(play,/id:"class", label:"클래스"/);
  assert.match(play,/id:"spells", label:"주문"/);
  assert.match(play,/id:"items", label:"아이템"/);
  assert.match(play,/id:"passives", label:"패시브"/);
  assert.match(play,/id:"custom", label:"커스텀"/);
  assert.match(play,/const itemActions=actions\.filter/);
  assert.match(play,/const spellActions=actions\.filter/);
  assert.match(play,/const classActions=actions\.filter/);
});

test("combat information uses one top initiative order and no permanent inspector/activity windows",()=>{
  assert.match(play,/play-v09-initiative/);
  assert.match(play,/orderedInitiative\.map/);
  assert.match(play,/scene\.economyByActor\[actor\.id\]/);
  assert.doesNotMatch(play,/TURN ORDER|play-turn-strip|play-context-strip|<Inspector|ActionConsole|activity-mini|scene-side/);
});
