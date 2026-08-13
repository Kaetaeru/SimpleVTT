import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDamageRoll } from "../../.rules-build/damageRoll.js";

test("critical doubles damage dice but not flat modifiers", () => {
  const result = resolveDamageRoll({
    critical: true,
    dice: [
      { source: "weapon:dagger", sides: 4, count: 1, faces: [3, 4] },
      { source: "feature:sneak", sides: 6, count: 1, faces: [5, 2] },
    ],
    flat: [{ source: "actor:dex", value: 3 }],
  });
  assert.equal(result.diceTotal, 14);
  assert.equal(result.flatTotal, 3);
  assert.equal(result.total, 17);
  assert.deepEqual(result.dice.map((entry) => entry.rolledCount), [2, 2]);
});
