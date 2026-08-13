import assert from "node:assert/strict";
import { test } from "node:test";
import { beginTurn, useMovement, useTurnSlot } from "../../.rules-build/turnEconomy.js";

test("turn economy spends action, granted bonus action, reaction, and split movement", () => {
  let state = beginTurn(30);
  state = useMovement(state, 10);
  state = useTurnSlot(state, "action");
  state = useMovement(state, 20);
  state = useTurnSlot(state, "bonus-action", true);
  state = useTurnSlot(state, "reaction");
  assert.deepEqual(state, {
    action: false,
    bonusAction: false,
    reaction: false,
    movement: 0,
    movementMaximum: 30,
  });
});

test("starting the next turn restores the reaction slot", () => {
  const spent = useTurnSlot(beginTurn(30), "reaction");
  assert.equal(spent.reaction, false);
  assert.equal(beginTurn(30).reaction, true);
});
