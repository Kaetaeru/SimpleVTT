import assert from "node:assert/strict";
import test from "node:test";
import { createEffect } from "../../src/domain/effects";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function restrictedState(selectedCategory?: "movement" | "action" | "bonus-action") {
  const state = runtimeState();
  state.effects.push(createEffect({
    id:"choose-one-activity",
    sourceId:"test:choose-one",
    sourceActorId:"hero",
    targetId:"goblin",
    kind:"marker",
    duration:{ kind:"minutes", amount:1 },
    turnActivity:{
      chooseOneOf:["movement","action","bonus-action"],
      selectedCategory,
    },
  }, state.clock));
  return state;
}

function beginGoblinTurn(state: ReturnType<typeof restrictedState>, round = 1) {
  return resolvePendingResolution(TEST_PROFILE, state, {
    id:`turn-start.${round}`,
    actorId:"goblin",
    sourceId:"test:turn-start",
    expectedRevision:state.revision,
    operations:[{ id:"begin", kind:"begin-turn", actorId:"goblin", round }],
  });
}

test("begin-turn clears the prior turn activity choice but keeps the restriction active", () => {
  const state = restrictedState("action");
  const result = beginGoblinTurn(state);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  const effect = result.state.effects.find((entry) => entry.id === "choose-one-activity");
  assert.ok(effect);
  assert.equal(effect?.turnActivity?.selectedCategory, undefined);
  assert.deepEqual(effect?.turnActivity?.chooseOneOf, ["movement","action","bonus-action"]);
});

test("multiple movement segments are allowed, then Action is rejected for the same turn without mutating the committed movement state", () => {
  const started = beginGoblinTurn(restrictedState());
  assert.equal(started.status, "committed");
  if (started.status !== "committed") return;
  const first = resolvePendingResolution(TEST_PROFILE, started.state, {
    id:"activity.move-1",
    actorId:"goblin",
    sourceId:"test:movement",
    expectedRevision:started.state.revision,
    operations:[{ id:"move", kind:"move", actorId:"goblin", distanceFeet:10 }],
  });
  assert.equal(first.status, "committed");
  if (first.status !== "committed") return;
  assert.equal(first.state.effects.find((effect) => effect.id === "choose-one-activity")?.turnActivity?.selectedCategory, "movement");

  const second = resolvePendingResolution(TEST_PROFILE, first.state, {
    id:"activity.move-2",
    actorId:"goblin",
    sourceId:"test:movement",
    expectedRevision:first.state.revision,
    operations:[{ id:"move", kind:"move", actorId:"goblin", distanceFeet:5 }],
  });
  assert.equal(second.status, "committed");
  if (second.status !== "committed") return;
  assert.equal(second.state.combatants.goblin.economy.movement, 15);

  const action = resolvePendingResolution(TEST_PROFILE, second.state, {
    id:"activity.action-reject",
    actorId:"goblin",
    sourceId:"test:action",
    expectedRevision:second.state.revision,
    operations:[{ id:"action", kind:"use-economy", actorId:"goblin", slot:"action" }],
  });
  assert.equal(action.status, "rejected");
  assert.equal(action.state, second.state);
  assert.match(action.status === "rejected" ? action.error : "", /already committed this turn to movement/);
  assert.equal(second.state.combatants.goblin.economy.action, true);
});

test("Action commits the turn to Action and a later Bonus Action is rejected until the next turn", () => {
  const started = beginGoblinTurn(restrictedState());
  assert.equal(started.status, "committed");
  if (started.status !== "committed") return;
  const action = resolvePendingResolution(TEST_PROFILE, started.state, {
    id:"activity.action",
    actorId:"goblin",
    sourceId:"test:action",
    expectedRevision:started.state.revision,
    operations:[{ id:"action", kind:"use-economy", actorId:"goblin", slot:"action" }],
  });
  assert.equal(action.status, "committed");
  if (action.status !== "committed") return;
  const bonus = resolvePendingResolution(TEST_PROFILE, action.state, {
    id:"activity.bonus-reject",
    actorId:"goblin",
    sourceId:"test:bonus",
    expectedRevision:action.state.revision,
    operations:[{
      id:"bonus",
      kind:"use-economy",
      actorId:"goblin",
      slot:"bonus-action",
      bonusActionGranted:true,
    }],
  });
  assert.equal(bonus.status, "rejected");
  assert.equal(bonus.state, action.state);

  const nextTurn = beginGoblinTurn(action.state, 2);
  assert.equal(nextTurn.status, "committed");
  if (nextTurn.status !== "committed") return;
  const nextBonus = resolvePendingResolution(TEST_PROFILE, nextTurn.state, {
    id:"activity.next-bonus",
    actorId:"goblin",
    sourceId:"test:bonus",
    expectedRevision:nextTurn.state.revision,
    operations:[{
      id:"bonus",
      kind:"use-economy",
      actorId:"goblin",
      slot:"bonus-action",
      bonusActionGranted:true,
    }],
  });
  assert.equal(nextBonus.status, "committed");
  if (nextBonus.status !== "committed") return;
  assert.equal(nextBonus.state.effects.find((effect) => effect.id === "choose-one-activity")?.turnActivity?.selectedCategory, "bonus-action");
});

test("movement outside the restricted creature's own turn does not consume its on-turn activity choice", () => {
  const state = restrictedState();
  state.clock.activeActorId = "hero";
  state.clock.phase = "action";
  const forcedMove = resolvePendingResolution(TEST_PROFILE, state, {
    id:"activity.off-turn-move",
    actorId:"hero",
    sourceId:"test:forced-move",
    expectedRevision:0,
    operations:[{ id:"move", kind:"move", actorId:"goblin", distanceFeet:5 }],
  });
  assert.equal(forcedMove.status, "committed");
  if (forcedMove.status !== "committed") return;
  assert.equal(forcedMove.state.effects.find((effect) => effect.id === "choose-one-activity")?.turnActivity?.selectedCategory, undefined);
});
