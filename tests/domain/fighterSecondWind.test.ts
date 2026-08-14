import assert from "node:assert/strict";
import test from "node:test";
import { FIGHTER_SECOND_WIND_RESOURCE_ID } from "../../src/domain/coreClassResources";
import { resolveFighterSecondWind } from "../../src/domain/fighterSecondWind";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function addSecondWind(state: ReturnType<typeof runtimeState>, current = 2, maximum = 2) {
  state.combatants.hero.resources.push({
    id:FIGHTER_SECOND_WIND_RESOURCE_ID,
    label:"Second Wind",
    current,
    maximum,
    recovery:{ shortRest:1, longRest:"all" },
  });
}

test("Second Wind spends one Bonus Action and use to heal 1d10 + Fighter level", () => {
  const state = runtimeState();
  state.combatants.hero.life.hp = { current:5, maximum:30, temporary:0 };
  addSecondWind(state, 3, 3);
  const result = resolveFighterSecondWind(TEST_PROFILE, state, {
    id:"fighter.second-wind",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:5,
    d10Face:7,
    useActionEconomy:true,
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal((result.results["fighter.second-wind:healing-roll"] as { total:number }).total, 12);
  assert.equal(result.state.combatants.hero.life.hp.current, 17);
  assert.equal(result.state.combatants.hero.economy.action, true);
  assert.equal(result.state.combatants.hero.economy.bonusAction, false);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === FIGHTER_SECOND_WIND_RESOURCE_ID)?.current, 2);
});

test("Tactical Shift reuses Second Wind to grant up to half Speed without spending normal movement or provoking Opportunity Attacks", () => {
  const state = runtimeState();
  state.combatants.hero.life.hp = { current:5, maximum:30, temporary:0 };
  addSecondWind(state,3,3);
  const beforeMovement = state.combatants.hero.economy.movement;
  const result = resolveFighterSecondWind(TEST_PROFILE,state,{
    id:"fighter.tactical-shift",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:5,
    d10Face:5,
    useActionEconomy:true,
    tacticalShift:{ speedFeet:30, distanceFeet:15 },
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  const movement = result.results["fighter.tactical-shift:tactical-shift"] as {
    distanceFeet:number;
    maximumDistanceFeet:number;
    regularMovementSpent:number;
    doesNotProvokeOpportunityAttacks:boolean;
  };
  assert.deepEqual(movement,{
    distanceFeet:15,
    maximumDistanceFeet:15,
    regularMovementSpent:0,
    doesNotProvokeOpportunityAttacks:true,
  });
  assert.equal(result.state.combatants.hero.economy.movement,beforeMovement);
  assert.equal(result.state.combatants.hero.economy.bonusAction,false);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === FIGHTER_SECOND_WIND_RESOURCE_ID)?.current,2);
});

test("Tactical Shift requires Fighter 5, a Bonus Action activation, and no more than half Speed", () => {
  const state = runtimeState();
  addSecondWind(state,2,2);
  const premature = resolveFighterSecondWind(TEST_PROFILE,state,{
    id:"fighter.tactical-shift.premature",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:4,
    d10Face:5,
    useActionEconomy:true,
    tacticalShift:{ speedFeet:30, distanceFeet:15 },
  });
  assert.equal(premature.status,"rejected");
  assert.match(premature.status === "rejected" ? premature.error : "",/requires Fighter level 5/);

  const noBonus = resolveFighterSecondWind(TEST_PROFILE,state,{
    id:"fighter.tactical-shift.no-bonus",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:5,
    d10Face:5,
    useActionEconomy:false,
    tacticalShift:{ speedFeet:30, distanceFeet:15 },
  });
  assert.equal(noBonus.status,"rejected");
  assert.match(noBonus.status === "rejected" ? noBonus.error : "",/requires Second Wind to be activated with its Bonus Action/);

  const tooFar = resolveFighterSecondWind(TEST_PROFILE,state,{
    id:"fighter.tactical-shift.too-far",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:5,
    d10Face:5,
    useActionEconomy:true,
    tacticalShift:{ speedFeet:30, distanceFeet:20 },
  });
  assert.equal(tooFar.status,"rejected");
  assert.match(tooFar.status === "rejected" ? tooFar.error : "",/cannot exceed 15 feet/);
  assert.equal(state.combatants.hero.resources.find((pool) => pool.id === FIGHTER_SECOND_WIND_RESOURCE_ID)?.current,2);
});

test("Second Wind healing respects maximum HP while still consuming its use", () => {
  const state = runtimeState();
  state.combatants.hero.life.hp = { current:18, maximum:20, temporary:0 };
  addSecondWind(state);
  const result = resolveFighterSecondWind(TEST_PROFILE, state, {
    id:"fighter.second-wind.cap",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:1,
    d10Face:10,
    useActionEconomy:true,
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal((result.results["fighter.second-wind.cap:healing-roll"] as { total:number }).total, 11);
  assert.equal((result.results["fighter.second-wind.cap:healing"] as { restored:number }).restored, 2);
  assert.equal(result.state.combatants.hero.life.hp.current, 20);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === FIGHTER_SECOND_WIND_RESOURCE_ID)?.current, 1);
});

test("depleted Second Wind rejects atomically without spending Bonus Action or changing HP", () => {
  const state = runtimeState();
  state.combatants.hero.life.hp = { current:3, maximum:20, temporary:0 };
  addSecondWind(state, 0, 2);
  const result = resolveFighterSecondWind(TEST_PROFILE, state, {
    id:"fighter.second-wind.depleted",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:3,
    d10Face:8,
    useActionEconomy:true,
  });
  assert.equal(result.status, "rejected");
  assert.equal(result.state, state);
  assert.equal(state.combatants.hero.life.hp.current, 3);
  assert.equal(state.combatants.hero.economy.bonusAction, true);
});

test("unavailable Bonus Action rejects before Second Wind can spend a use", () => {
  const state = runtimeState();
  state.combatants.hero.economy.bonusAction = false;
  addSecondWind(state);
  const result = resolveFighterSecondWind(TEST_PROFILE, state, {
    id:"fighter.second-wind.no-bonus",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:4,
    d10Face:6,
    useActionEconomy:true,
  });
  assert.equal(result.status, "rejected");
  assert.equal(result.state, state);
  assert.equal(state.combatants.hero.resources.find((pool) => pool.id === FIGHTER_SECOND_WIND_RESOURCE_ID)?.current, 2);
});

test("Second Wind rejects invalid Fighter level or fixed die face before mutation", () => {
  const state = runtimeState();
  addSecondWind(state);
  const badLevel = resolveFighterSecondWind(TEST_PROFILE, state, {
    id:"fighter.second-wind.level0",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:0,
    d10Face:5,
    useActionEconomy:true,
  });
  assert.equal(badLevel.status, "rejected");
  assert.match(badLevel.status === "rejected" ? badLevel.error : "", /Fighter level 1-20/);

  const badFace = resolveFighterSecondWind(TEST_PROFILE, state, {
    id:"fighter.second-wind.face",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:1,
    d10Face:11,
    useActionEconomy:true,
  });
  assert.equal(badFace.status, "rejected");
  assert.match(badFace.status === "rejected" ? badFace.error : "", /fixed d10 face/);
});
