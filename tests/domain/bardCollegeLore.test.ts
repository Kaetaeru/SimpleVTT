import assert from "node:assert/strict";
import test from "node:test";
import { BARDIC_INSPIRATION_RESOURCE_ID } from "../../src/domain/bardicInspiration";
import {
  BARD_COLLEGE_LORE_SUBCLASS_ID,
  resolveLoreCuttingWords,
} from "../../src/domain/bardCollegeLore";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function stateWithInspiration(current=3) {
  const state = runtimeState();
  state.combatants.hero.resources.push({
    id:BARDIC_INSPIRATION_RESOURCE_ID,
    label:"바드의 영감",
    current,
    maximum:4,
    recovery:{ shortRest:"all", longRest:"all" },
  });
  return state;
}

test("Cutting Words spends Reaction and Bardic Inspiration to reduce a successful attack/check total", () => {
  const state = stateWithInspiration();
  const result = resolveLoreCuttingWords(TEST_PROFILE,state,{
    id:"lore.cutting-words.attack",
    actorId:"hero",
    targetActorId:"goblin",
    expectedRevision:0,
    bardLevel:5,
    subclassId:BARD_COLLEGE_LORE_SUBCLASS_ID,
    distanceFeet:30,
    targetVisible:true,
    trigger:{ kind:"attack-roll", total:17, target:15 },
    inspirationDieFace:4,
    useReaction:true,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.deepEqual(result.adjustment,{ kind:"attack-roll", originalTotal:17, reduction:4, adjustedTotal:13, target:15, outcome:"failure" });
  assert.equal(result.state.combatants.hero.economy.reaction,false);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === BARDIC_INSPIRATION_RESOURCE_ID)?.current,2);
});
test("Cutting Words can reduce a damage roll but never below zero", () => {
  const state = stateWithInspiration();
  const result = resolveLoreCuttingWords(TEST_PROFILE,state,{
    id:"lore.cutting-words.damage",
    actorId:"hero",
    targetActorId:"goblin",
    expectedRevision:0,
    bardLevel:10,
    subclassId:BARD_COLLEGE_LORE_SUBCLASS_ID,
    distanceFeet:45,
    targetVisible:true,
    trigger:{ kind:"damage-roll", total:3 },
    inspirationDieFace:8,
    useReaction:true,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.adjustment?.adjustedTotal,0);
  assert.equal(result.adjustment?.reduction,8);
});

test("Cutting Words validates visible 60-foot target and an already successful d20 trigger before spending anything", () => {
  const state = stateWithInspiration();
  const far = resolveLoreCuttingWords(TEST_PROFILE,state,{
    id:"lore.cutting-words.far",
    actorId:"hero",
    targetActorId:"goblin",
    expectedRevision:0,
    bardLevel:3,
    subclassId:BARD_COLLEGE_LORE_SUBCLASS_ID,
    distanceFeet:65,
    targetVisible:true,
    trigger:{ kind:"ability-check", total:18, target:15 },
    inspirationDieFace:3,
    useReaction:true,
  });
  assert.equal(far.status,"rejected");
  assert.equal(far.state,state);
  assert.equal(state.combatants.hero.economy.reaction,true);
  assert.equal(state.combatants.hero.resources.find((pool) => pool.id === BARDIC_INSPIRATION_RESOURCE_ID)?.current,3);
});
