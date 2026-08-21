import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const play=readFileSync(new URL("../../src/ProductionPlayScreen.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../../src/v09-production-play.css",import.meta.url),"utf8");

test("V0.9 Play is scene-first with one initiative strip and no permanent side context",()=>{
  assert.equal((play.match(/className=\{`?[^\n]*play-v09-initiative/g)??[]).length,1);
  assert.match(play,/className="play-v09-stage"/);
  assert.match(play,/className="play-v09-scene-row upper"/);
  assert.match(play,/className="play-v09-scene-row lower"/);
  assert.doesNotMatch(play,/play-context-strip|play-turn-strip|play-participant-strip|play-intent-grid/);
});

test("Scene Actors separate combatants above from Character party below",()=>{
  assert.match(play,/const sceneActors=scene\.entities\.filter\(\(entity\)=>entity\.kind==="combatant"\)/);
  assert.match(play,/const partyActors=scene\.entities\.filter\(\(entity\)=>entity\.kind==="character"\)/);
  assert.match(play,/aria-label="NPC와 Combatant"/);
  assert.match(play,/aria-label="Player와 Party"/);
});

test("bottom HUD contains Active Actor resources, category tabs, two-row icon grid, and independent End Turn",()=>{
  assert.match(play,/className="play-v09-active-actor"/);
  assert.match(play,/className="play-v09-resource-rail"/);
  assert.match(play,/className="play-v09-hotbar"/);
  assert.match(play,/className="play-v09-turn-control"/);
  assert.match(play,/className="play-v09-end-turn"/);
  assert.match(css,/grid-template-rows:repeat\(2,48px\)/);
  assert.match(css,/\.play-v09-action-icon\{[^}]*width:48px;[^}]*height:48px/s);
});

test("Freeform is honest about non-turn economy and End Turn remains non-executable there",()=>{
  assert.match(play,/economy\?\.action\?"●":"—"\):"FREE"/);
  assert.match(play,/economy\?\.bonusAction\?"●":"—"\):"FREE"/);
  assert.match(play,/economy\?\.reaction\?"●":"—"\):"FREE"/);
  assert.match(play,/"프리폼에는 턴 없음"/);
  assert.match(play,/const canEndTurn=isCombat&&\(dm\|\|canPlayerEndTurn\)/);
});

test("target selection still resolves through the canonical action API",()=>{
  assert.match(play,/await resolveAction\(action\.id,\[\]\)/);
  assert.match(play,/await resolveAction\(action\.id,\[actor\.id\]\)/);
  assert.match(play,/await resolveAction\(chosen\.id,\[entity\.id\]\)/);
  assert.match(play,/await resolveAction\(chosen\.id,multiTargets\)/);
  assert.match(play,/await endTurn\(\)/);
  assert.match(play,/void startInitiative\(\)/);
  assert.match(play,/void endInitiative\(\)/);
});
