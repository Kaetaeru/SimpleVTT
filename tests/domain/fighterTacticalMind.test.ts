import assert from "node:assert/strict";
import test from "node:test";
import { FIGHTER_SECOND_WIND_RESOURCE_ID } from "../../src/domain/coreClassResources";
import { resolveFighterTacticalMind } from "../../src/domain/fighterTacticalMind";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function addSecondWind(state: ReturnType<typeof runtimeState>, current = 2) {
  state.combatants.hero.resources.push({
    id:FIGHTER_SECOND_WIND_RESOURCE_ID,
    label:"Second Wind",
    current,
    maximum:2,
    recovery:{ shortRest:1, longRest:"all" },
  });
}

test("Tactical Mind turns a failed ability check into a success and expends one Second Wind use", () => {
  const state = runtimeState();
  addSecondWind(state, 2);
  const result = resolveFighterTacticalMind(TEST_PROFILE, state, {
    id:"fighter.tactical-mind.success",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:2,
    failedCheckTotal:10,
    target:15,
    d10Face:6,
  });
  assert.equal(result.status, "committed");
  assert.deepEqual(result.check, {
    initialTotal:10,
    target:15,
    bonus:6,
    finalTotal:16,
    outcome:"success",
    secondWindExpended:true,
  });
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === FIGHTER_SECOND_WIND_RESOURCE_ID)?.current, 1);
  assert.equal(result.state.combatants.hero.economy.action, true);
  assert.equal(result.state.combatants.hero.economy.bonusAction, true);
});

test("Tactical Mind keeps the Second Wind use when the d10 still cannot make the check succeed", () => {
  const state = runtimeState();
  addSecondWind(state, 2);
  const result = resolveFighterTacticalMind(TEST_PROFILE, state, {
    id:"fighter.tactical-mind.failure",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:2,
    failedCheckTotal:9,
    target:18,
    d10Face:4,
  });
  assert.equal(result.status, "committed");
  assert.deepEqual(result.check, {
    initialTotal:9,
    target:18,
    bonus:4,
    finalTotal:13,
    outcome:"failure",
    secondWindExpended:false,
  });
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === FIGHTER_SECOND_WIND_RESOURCE_ID)?.current, 2);
  assert.equal(Object.keys(result.results).length, 1, "failed Tactical Mind records only the authoritative d10 roll");
});

test("Tactical Mind requires an available Second Wind use even when the reroll would still fail", () => {
  const state = runtimeState();
  addSecondWind(state, 0);
  const result = resolveFighterTacticalMind(TEST_PROFILE, state, {
    id:"fighter.tactical-mind.depleted",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:2,
    failedCheckTotal:4,
    target:20,
    d10Face:1,
  });
  assert.equal(result.status, "rejected");
  assert.match(result.status === "rejected" ? result.error : "", /available Second Wind use/);
  assert.equal(result.state, state);
  assert.equal(state.revision, 0);
});

test("Tactical Mind rejects if the original ability check was not actually a failure", () => {
  const state = runtimeState();
  addSecondWind(state, 2);
  const result = resolveFighterTacticalMind(TEST_PROFILE, state, {
    id:"fighter.tactical-mind.not-failed",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:2,
    failedCheckTotal:15,
    target:15,
    d10Face:5,
  });
  assert.equal(result.status, "rejected");
  assert.match(result.status === "rejected" ? result.error : "", /only follow a failed ability check/);
  assert.equal(state.combatants.hero.resources.find((pool) => pool.id === FIGHTER_SECOND_WIND_RESOURCE_ID)?.current, 2);
});

test("Tactical Mind rejects below Fighter 2 or an invalid d10 before mutation", () => {
  const state = runtimeState();
  addSecondWind(state, 2);
  const lowLevel = resolveFighterTacticalMind(TEST_PROFILE, state, {
    id:"fighter.tactical-mind.level1",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:1,
    failedCheckTotal:5,
    target:10,
    d10Face:5,
  });
  assert.equal(lowLevel.status, "rejected");
  assert.match(lowLevel.status === "rejected" ? lowLevel.error : "", /Fighter level 2-20/);

  const badFace = resolveFighterTacticalMind(TEST_PROFILE, state, {
    id:"fighter.tactical-mind.bad-face",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:2,
    failedCheckTotal:5,
    target:10,
    d10Face:0,
  });
  assert.equal(badFace.status, "rejected");
  assert.match(badFace.status === "rejected" ? badFace.error : "", /fixed d10 face/);
});
