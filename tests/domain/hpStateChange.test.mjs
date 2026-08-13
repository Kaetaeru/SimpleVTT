import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDamage } from "../../.rules-build/damage.js";
import { hpStateChanges } from "../../.rules-build/stateChange.js";

test("damage produces HP changes only for mutated fields", () => {
  const before = { current: 10, maximum: 10, temporary: 5 };
  const damage = resolveDamage({ damageType: "force", amount: 7, hp: before });
  const changes = hpStateChanges("actor", before, damage.nextHp, damage.provenance);
  assert.deepEqual(changes.map((entry) => [entry.field, entry.before, entry.after]), [
    ["current", 10, 8],
    ["temporary", 5, 0],
  ]);
});
