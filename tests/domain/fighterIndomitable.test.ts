import assert from "node:assert/strict";
import test from "node:test";
import { FIGHTER_INDOMITABLE_RESOURCE_ID } from "../../src/domain/coreClassResources";
import { resolveFighterIndomitable } from "../../src/domain/fighterIndomitable";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function addIndomitable(state: ReturnType<typeof runtimeState>, current = 1, maximum = 1) {
  state.combatants.hero.resources.push({
    id:FIGHTER_INDOMITABLE_RESOURCE_ID,
    label:"Indomitable",
    current,
    maximum,
    recovery:{ longRest:"all" },
  });
}

test("Indomitable rerolls a failed save, adds Fighter level, and expends one use", () => {
  const state = runtimeState();
  addIndomitable(state);
  const result = resolveFighterIndomitable(TEST_PROFILE, state, {
    id:"fighter.indomitable.success",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:9,
    originalOutcome:"failure",
    ability:"wis",
    target:15,
    modifierContributions:[{ source:"hero:wis-save", value:2 }],
    dice:{ id:"indomitable-d20", purpose:"Indomitable Wisdom save", sides:20, faces:[5] },
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  const reroll = result.results["fighter.indomitable.success:reroll"] as { total:number; outcome:string; provenance:Array<{source:string}> };
  assert.equal(reroll.total, 16);
  assert.equal(reroll.outcome, "success");
  assert.ok(reroll.provenance.some((entry) => entry.source === "feature:fighter.indomitable"));
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === FIGHTER_INDOMITABLE_RESOURCE_ID)?.current, 0);
});

test("Indomitable still expends its use when the mandatory new save result also fails", () => {
  const state = runtimeState();
  addIndomitable(state, 2, 2);
  const result = resolveFighterIndomitable(TEST_PROFILE, state, {
    id:"fighter.indomitable.failure",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:13,
    originalOutcome:"failure",
    ability:"con",
    target:25,
    modifierContributions:[{ source:"hero:con-save", value:1 }],
    dice:{ id:"indomitable-d20-fail", purpose:"Indomitable Constitution save", sides:20, faces:[4] },
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  const reroll = result.results["fighter.indomitable.failure:reroll"] as { total:number; outcome:string };
  assert.equal(reroll.total, 18);
  assert.equal(reroll.outcome, "failure");
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === FIGHTER_INDOMITABLE_RESOURCE_ID)?.current, 1);
});

test("depleted Indomitable rejects atomically before the new saving throw can commit", () => {
  const state = runtimeState();
  addIndomitable(state, 0, 1);
  const result = resolveFighterIndomitable(TEST_PROFILE, state, {
    id:"fighter.indomitable.depleted",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:9,
    originalOutcome:"failure",
    ability:"dex",
    target:15,
    modifierContributions:[{ source:"hero:dex-save", value:3 }],
    dice:{ id:"indomitable-d20-depleted", purpose:"Indomitable Dexterity save", sides:20, faces:[20] },
  });
  assert.equal(result.status, "rejected");
  assert.equal(result.state, state);
  assert.equal(state.revision, 0);
  assert.equal(state.history.length, 0);
});

test("Indomitable rejects below Fighter 9 before resource mutation", () => {
  const state = runtimeState();
  addIndomitable(state);
  const result = resolveFighterIndomitable(TEST_PROFILE, state, {
    id:"fighter.indomitable.level8",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:8,
    originalOutcome:"failure",
    ability:"str",
    target:12,
    modifierContributions:[{ source:"hero:str-save", value:4 }],
    dice:{ id:"indomitable-d20-level", purpose:"Indomitable Strength save", sides:20, faces:[10] },
  });
  assert.equal(result.status, "rejected");
  assert.match(result.status === "rejected" ? result.error : "", /Fighter level 9-20/);
  assert.equal(state.combatants.hero.resources.find((pool) => pool.id === FIGHTER_INDOMITABLE_RESOURCE_ID)?.current, 1);
});
