import assert from "node:assert/strict";
import { test } from "node:test";
import profile from "../../rules/profiles/dnd.srd-5.2.1.profile.json" with { type: "json" };
import { resolveDamage } from "../../.rules-build/damage.js";
import { resolveDeathSavingThrow, resolveZeroHpAfterDamage } from "../../.rules-build/life.js";

function life(current, maximum = 12) {
  return {
    hp: { current, maximum, temporary: 0 },
    deathSaves: { successes: 0, failures: 0 },
    stable: false,
    unconscious: current === 0,
    dead: false,
  };
}

test("massive damage kills a character when overflow reaches maximum HP", () => {
  const before = life(6);
  const damage = resolveDamage({ damageType: "force", amount: 18, hp: before.hp });
  const result = resolveZeroHpAfterDamage({ creatureKind: "character", before, damage });
  assert.equal(result.massiveDamage, true);
  assert.equal(result.next.dead, true);
});

test("critical damage at 0 HP adds two death save failures", () => {
  const before = life(0);
  const damage = resolveDamage({ damageType: "slashing", amount: 2, hp: before.hp });
  const result = resolveZeroHpAfterDamage({ creatureKind: "character", before, damage, critical: true });
  assert.equal(result.failuresAdded, 2);
  assert.equal(result.next.deathSaves.failures, 2);
});

test("death save natural 20 restores 1 HP and resets saves", () => {
  const before = life(0);
  before.deathSaves = { successes: 1, failures: 1 };
  const result = resolveDeathSavingThrow(profile, {
    life: before,
    dice: { id: "death-20", purpose: "death-save", sides: 20, faces: [20] },
  });
  assert.equal(result.outcome, "revived");
  assert.equal(result.next.hp.current, 1);
  assert.deepEqual(result.next.deathSaves, { successes: 0, failures: 0 });
});

test("death save natural 1 adds two failures and can kill", () => {
  const before = life(0);
  before.deathSaves.failures = 1;
  const result = resolveDeathSavingThrow(profile, {
    life: before,
    dice: { id: "death-1", purpose: "death-save", sides: 20, faces: [1] },
  });
  assert.equal(result.outcome, "dead");
  assert.equal(result.next.deathSaves.failures, 3);
});

test("third successful death save stabilizes and resets counters", () => {
  const before = life(0);
  before.deathSaves.successes = 2;
  const result = resolveDeathSavingThrow(profile, {
    life: before,
    dice: { id: "death-10", purpose: "death-save", sides: 20, faces: [10] },
  });
  assert.equal(result.outcome, "stable");
  assert.equal(result.next.stable, true);
  assert.deepEqual(result.next.deathSaves, { successes: 0, failures: 0 });
});
