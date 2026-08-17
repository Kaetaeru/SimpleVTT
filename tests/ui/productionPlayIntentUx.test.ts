import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const model=readFileSync(new URL("../../src/playerExperienceModel.ts",import.meta.url),"utf8");
const play=readFileSync(new URL("../../src/ProductionPlayScreen.tsx",import.meta.url),"utf8");
const app=readFileSync(new URL("../../src/App.tsx",import.meta.url),"utf8");

test("Scene route uses the redesigned play surface",()=>{
  assert.match(app,/route === "scene" && <ProductionPlayScreen role=\{productionRole\} \/>/);
  assert.match(play,/EXPLORATION/);
  assert.match(play,/COMBAT/);
});

test("primary play actions use the official action vocabulary instead of a flat skill wall",()=>{
  for(const id of ["attack","dash","disengage","dodge","help","hide","influence","magic","ready","search","study","utilize"]) assert.match(model,new RegExp(`id:\"${id}\"`));
  assert.match(play,/OFFICIAL_PLAY_INTENTS\.map/);
  assert.doesNotMatch(play,/\["all",\s*"basic",\s*"weapon",\s*"magic"\]/);
});

test("Influence Search Study and Hide reveal skills only after intent selection",()=>{
  assert.match(model,/INFLUENCE = \["action\.skill\.deception"/);
  assert.match(model,/SEARCH = \["action\.skill\.insight"/);
  assert.match(model,/STUDY = \["action\.skill\.arcana"/);
  assert.match(model,/skillActionIds:\["action\.skill\.stealth"\]/);
  assert.match(play,/intentOptions\(intent,actions\)/);
  assert.match(play,/play-decision-panel/);
});

test("combat-only information is conditional and old permanent inspector/activity windows are not part of the new surface",()=>{
  assert.match(play,/isCombat&&economy/);
  assert.match(play,/isCombat&&<section/);
  assert.match(play,/TURN ORDER/);
  assert.doesNotMatch(play,/<Inspector|ActionConsole|activity-mini|scene-side/);
});
