import assert from "node:assert/strict";
import { test } from "node:test";
import { orderInitiative } from "../../.rules-build/initiative.js";

test("initiative ties remain explicit choices", () => {
  const groups = orderInitiative([
    { id: "pc-a", controller: "player", total: 18 },
    { id: "pc-b", controller: "player", total: 18 },
    { id: "monster", controller: "gm", total: 12 },
    { id: "pc-c", controller: "player", total: 12 },
  ]);
  assert.equal(groups[0].tieBreak, "player-choice");
  assert.deepEqual(groups[0].participantIds, ["pc-a", "pc-b"]);
  assert.equal(groups[1].tieBreak, "gm-choice");
});
