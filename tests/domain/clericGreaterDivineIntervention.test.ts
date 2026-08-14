import assert from "node:assert/strict";
import test from "node:test";
import { CLERIC_DIVINE_INTERVENTION_RESOURCE_ID } from "../../src/domain/coreClassResources";
import {
  greaterDivineInterventionLockoutLongRests,
  resolveGreaterDivineInterventionWishLockout,
} from "../../src/domain/clericGreaterDivineIntervention";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function stateAfterWish() {
  const state = runtimeState();
  state.combatants.hero.resources.push({
    id:CLERIC_DIVINE_INTERVENTION_RESOURCE_ID,
    label:"Divine Intervention",
    current:0,
    maximum:1,
    recovery:{ longRest:"all" },
  });
  return state;
}

function longRest(state:ReturnType<typeof runtimeState>,expectedRevision:number,index:number) {
  return resolvePendingResolution(TEST_PROFILE,state,{
    id:`greater-di.rest.${index}`,
    actorId:"hero",
    sourceId:"test:long-rest",
    expectedRevision,
    operations:[{ id:`greater-di.rest.${index}:rest`, kind:"long-rest", targetId:"hero" }],
  });
}

test("Greater Divine Intervention Wish lockout uses the authoritative 2d4 total", () => {
  assert.equal(greaterDivineInterventionLockoutLongRests([1,1]),2);
  assert.equal(greaterDivineInterventionLockoutLongRests([4,4]),8);
  assert.throws(() => greaterDivineInterventionLockoutLongRests([0,4]),/exactly two authoritative d4 faces/);
});

test("post-Wish Greater Divine Intervention lockout blocks recovery until all rolled Long Rests are finished", () => {
  const state = stateAfterWish();
  const locked = resolveGreaterDivineInterventionWishLockout(TEST_PROFILE,state,{
    id:"greater-di.wish-lockout",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:20,
    d4Faces:[2,3],
  });
  assert.equal(locked.status,"committed");
  if (locked.status !== "committed") return;
  assert.equal((locked.results["greater-di.wish-lockout:lockout-roll"] as { total:number }).total,5);
  let pool = locked.state.combatants.hero.resources.find((entry) => entry.id === CLERIC_DIVINE_INTERVENTION_RESOURCE_ID);
  assert.deepEqual(pool?.recoveryLockouts,{ longRest:5 });

  let current = locked.state;
  for (let index = 1; index <= 4; index += 1) {
    const rested = longRest(current,index,index);
    assert.equal(rested.status,"committed");
    if (rested.status !== "committed") return;
    current = rested.state;
    pool = current.combatants.hero.resources.find((entry) => entry.id === CLERIC_DIVINE_INTERVENTION_RESOURCE_ID);
    assert.equal(pool?.current,0,`Long Rest ${index} must not restore Divine Intervention yet`);
    assert.deepEqual(pool?.recoveryLockouts,{ longRest:5 - index });
  }

  const fifth = longRest(current,5,5);
  assert.equal(fifth.status,"committed");
  if (fifth.status !== "committed") return;
  pool = fifth.state.combatants.hero.resources.find((entry) => entry.id === CLERIC_DIVINE_INTERVENTION_RESOURCE_ID);
  assert.equal(pool?.current,1,"finishing the fifth rolled Long Rest ends the lockout and allows normal recovery");
  assert.equal(pool?.recoveryLockouts,undefined);
});

test("Greater Divine Intervention lockout rejects before level 20 or without the target resource", () => {
  const state = stateAfterWish();
  const premature = resolveGreaterDivineInterventionWishLockout(TEST_PROFILE,state,{
    id:"greater-di.premature",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:19,
    d4Faces:[2,2],
  });
  assert.equal(premature.status,"rejected");
  assert.equal(premature.state,state);

  const missing = runtimeState();
  const noResource = resolveGreaterDivineInterventionWishLockout(TEST_PROFILE,missing,{
    id:"greater-di.missing-resource",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:20,
    d4Faces:[2,2],
  });
  assert.equal(noResource.status,"rejected");
  assert.equal(noResource.state,missing);
});
