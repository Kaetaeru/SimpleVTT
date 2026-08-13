import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveHealing } from "../../.rules-build/damage.js";
import { applyHealingToLife, stabilizeAtZero } from "../../.rules-build/lifeTransitions.js";

const zeroLife = {
  hp: { current: 0, maximum: 12, temporary: 0 },
  deathSaves: { successes: 1, failures: 2 },
  stable: false,
  unconscious: true,
  dead: false,
};

test("stabilization resets death saves and remains unconscious at 0 HP", () => {
  const result = stabilizeAtZero(zeroLife);
  assert.equal(result.next.stable, true);
  assert.equal(result.next.unconscious, true);
  assert.deepEqual(result.next.deathSaves, { successes: 0, failures: 0 });
});

test("healing above 0 ends unconscious state and resets death saves", () => {
  const healing = resolveHealing(zeroLife.hp, 4);
  const result = applyHealingToLife(zeroLife, healing);
  assert.equal(result.next.hp.current, 4);
  assert.equal(result.next.stable, false);
  assert.equal(result.next.unconscious, false);
  assert.deepEqual(result.next.deathSaves, { successes: 0, failures: 0 });
});
