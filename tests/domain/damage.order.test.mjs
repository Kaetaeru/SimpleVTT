import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDamage } from "../../.rules-build/damage.js";

test("SRD damage order produces 28 to 23 to 11 to 22", () => {
  const result = resolveDamage({
    damageType: "fire",
    amount: 28,
    hp: { current: 30, maximum: 30, temporary: 0 },
    adjustments: [{ source: "aura", operation: "subtract", value: 5 }],
    defenses: [
      { source: "resistance", kind: "resistance", damageType: "*" },
      { source: "vulnerability", kind: "vulnerability", damageType: "fire" },
    ],
  });
  assert.equal(result.finalDamage, 22);
  assert.equal(result.nextHp.current, 8);
});
