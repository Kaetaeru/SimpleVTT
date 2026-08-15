import assert from "node:assert/strict";
import test from "node:test";
import { createEffect } from "../../src/domain/effects";
import { PALADIN_LAY_ON_HANDS_RESOURCE_ID } from "../../src/domain/coreClassResources";
import { resolveLayOnHands } from "../../src/domain/paladinLayOnHands";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function paladinState(level = 3) {
  const state = runtimeState();
  state.combatants.hero.resources.push({
    id:PALADIN_LAY_ON_HANDS_RESOURCE_ID,
    label:"Lay On Hands",
    current:level * 5,
    maximum:level * 5,
    recovery:{ longRest:"all" },
  });
  return state;
}

function target(overrides: Record<string, unknown> = {}) {
  return {
    id:"goblin",
    kind:"creature" as const,
    relation:"enemy" as const,
    distanceFeet:5,
    visible:true,
    cover:"none" as const,
    ...overrides,
  };
}

function addCondition(state: ReturnType<typeof paladinState>, id: string, conditionId: "poisoned" | "blinded" | "stunned") {
  state.effects.push(createEffect({
    id,
    sourceId:`test:${conditionId}`,
    sourceActorId:"goblin",
    targetId:"goblin",
    kind:"condition",
    conditionId,
    duration:{ kind:"permanent" },
  }, state.clock));
}

test("Lay On Hands uses a Bonus Action, spends the requested pool amount, and heals a touched creature", () => {
  const state = paladinState(3);
  state.combatants.goblin.life.hp.current = 5;
  const result = resolveLayOnHands(TEST_PROFILE, state, {
    id:"lay-on-hands.heal",
    actorId:"hero",
    expectedRevision:0,
    paladinLevel:3,
    target:target(),
    healingAmount:7,
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.goblin.life.hp.current, 12);
  assert.equal(result.state.combatants.hero.economy.action, true);
  assert.equal(result.state.combatants.hero.economy.bonusAction, false);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === PALADIN_LAY_ON_HANDS_RESOURCE_ID)?.current, 8);
  assert.equal(state.combatants.goblin.life.hp.current, 5);
});

test("Lay On Hands spends 5 pool points to remove Poisoned without also healing, including duplicate Poisoned sources", () => {
  const state = paladinState(3);
  state.combatants.goblin.life.hp.current = 5;
  addCondition(state, "poison.one", "poisoned");
  addCondition(state, "poison.two", "poisoned");
  const result = resolveLayOnHands(TEST_PROFILE, state, {
    id:"lay-on-hands.poison",
    actorId:"hero",
    expectedRevision:0,
    paladinLevel:3,
    target:target(),
    healingAmount:0,
    removeConditions:["poisoned"],
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.goblin.life.hp.current, 5);
  assert.equal(result.state.effects.some((effect) => effect.targetId === "goblin" && effect.conditionId === "poisoned"), false);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === PALADIN_LAY_ON_HANDS_RESOURCE_ID)?.current, 10);
});

test("Paladin 14 Restoring Touch can heal and remove multiple eligible conditions at 5 pool points each", () => {
  const state = paladinState(14);
  state.combatants.goblin.life.hp.current = 4;
  addCondition(state, "blind.one", "blinded");
  addCondition(state, "stun.one", "stunned");
  const result = resolveLayOnHands(TEST_PROFILE, state, {
    id:"lay-on-hands.restoring-touch",
    actorId:"hero",
    expectedRevision:0,
    paladinLevel:14,
    target:target(),
    healingAmount:4,
    removeConditions:["blinded","stunned"],
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.goblin.life.hp.current, 8);
  assert.equal(result.state.effects.some((effect) => effect.targetId === "goblin" && ["blinded","stunned"].includes(effect.conditionId ?? "")), false);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === PALADIN_LAY_ON_HANDS_RESOURCE_ID)?.current, 56, "70 - 4 healing - 10 condition removal");
});

test("Restoring Touch conditions other than Poisoned reject below Paladin 14 without spending pool or Bonus Action", () => {
  const state = paladinState(13);
  addCondition(state, "blind.one", "blinded");
  const result = resolveLayOnHands(TEST_PROFILE, state, {
    id:"lay-on-hands.too-low",
    actorId:"hero",
    expectedRevision:0,
    paladinLevel:13,
    target:target(),
    healingAmount:0,
    removeConditions:["blinded"],
  });
  assert.equal(result.status, "rejected");
  assert.equal(result.state, state);
  assert.match(result.status === "rejected" ? result.error : "", /requires Paladin level 14 Restoring Touch/);
  assert.equal(state.combatants.hero.economy.bonusAction, true);
  assert.equal(state.combatants.hero.resources.find((pool) => pool.id === PALADIN_LAY_ON_HANDS_RESOURCE_ID)?.current, 65);
});

test("Lay On Hands insufficient pool or invalid touch range rejects atomically", () => {
  const depleted = paladinState(1);
  depleted.combatants.goblin.life.hp.current = 5;
  const insufficient = resolveLayOnHands(TEST_PROFILE, depleted, {
    id:"lay-on-hands.insufficient",
    actorId:"hero",
    expectedRevision:0,
    paladinLevel:1,
    target:target(),
    healingAmount:6,
  });
  assert.equal(insufficient.status, "rejected");
  assert.equal(insufficient.state, depleted);
  assert.equal(depleted.combatants.hero.economy.bonusAction, true);
  assert.equal(depleted.combatants.goblin.life.hp.current, 5);

  const range = paladinState(3);
  const outOfRange = resolveLayOnHands(TEST_PROFILE, range, {
    id:"lay-on-hands.range",
    actorId:"hero",
    expectedRevision:0,
    paladinLevel:3,
    target:target({ distanceFeet:10 }),
    healingAmount:5,
  });
  assert.equal(outOfRange.status, "rejected");
  assert.equal(outOfRange.state, range);
  assert.equal(range.combatants.hero.economy.bonusAction, true);
  assert.equal(range.combatants.hero.resources.find((pool) => pool.id === PALADIN_LAY_ON_HANDS_RESOURCE_ID)?.current, 15);
});

test("Lay On Hands rejects a requested condition that is not currently present", () => {
  const state = paladinState(3);
  const result = resolveLayOnHands(TEST_PROFILE, state, {
    id:"lay-on-hands.no-poison",
    actorId:"hero",
    expectedRevision:0,
    paladinLevel:3,
    target:target(),
    healingAmount:0,
    removeConditions:["poisoned"],
  });
  assert.equal(result.status, "rejected");
  assert.equal(result.state, state);
  assert.match(result.status === "rejected" ? result.error : "", /does not have poisoned/);
});
