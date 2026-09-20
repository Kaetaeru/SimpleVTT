/**
 * V0.9 D346: the table waits for the dice.
 *
 * A card with dice in it used to reach the chat — and the hit point bars — the moment the dice started tumbling, so
 * the answer was on screen before the roll had one. The gate is what the two sides agree on: the overlay holds it
 * while dice are up, the screens read the table they were already showing until it is let go, and the replay reads
 * the live table so it can queue the next roll. One roll at a time: three bites are roll, card, roll, card.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { diceHolding, holdForDice, releaseForDice, resetDiceGate, subscribeToDice } from "../../client/ui/dice/gate";

test("D346: the gate counts the rolls the table is waiting on", () => {
  resetDiceGate();
  assert.equal(diceHolding(), 0, "nothing on screen, nothing held");
  holdForDice();
  holdForDice();
  assert.equal(diceHolding(), 2);
  releaseForDice();
  assert.equal(diceHolding(), 1, "the table still waits on the second");
  releaseForDice();
  assert.equal(diceHolding(), 0);
  releaseForDice();
  assert.equal(diceHolding(), 0, "a release with nothing held never goes below zero");
});

test("D346: whoever is watching hears every change", () => {
  resetDiceGate();
  const seen: number[] = [];
  const stop = subscribeToDice(() => seen.push(diceHolding()));
  holdForDice();
  releaseForDice();
  stop();
  holdForDice();
  assert.deepEqual(seen, [1, 0], "the screens are told when dice go up and when they settle, and not after they stop listening");
  resetDiceGate();
  assert.equal(diceHolding(), 0, "a table that is left starts clean");
});
