import assert from "node:assert/strict";
import { test } from "node:test";
import { beginTurn, useMovement, useTurnSlot } from "../../.rules-build/turnEconomy.js";
import { economyStateChanges } from "../../.rules-build/stateChange.js";

test("turn spending produces session economy changes", () => {
  const before = beginTurn(30);
  let after = useMovement(before, 10);
  after = useTurnSlot(after, "action");
  const changes = economyStateChanges("actor", before, after, []);
  assert.deepEqual(changes.map((entry) => entry.field), ["action", "movement"]);
  assert.ok(changes.every((entry) => entry.writeBack === "session"));
});
