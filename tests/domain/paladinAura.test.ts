import assert from "node:assert/strict";
import test from "node:test";
import {
  auraOfCourageSuppressesFrightened,
  auraOfProtectionContribution,
  auraOfProtectionOptions,
  chooseAuraOfProtection,
  paladinAuraRadiusFeet,
} from "../../src/domain/paladinAura";

const fact = (overrides: Partial<Parameters<typeof auraOfProtectionContribution>[0]> = {}) => ({
  paladinId:"paladin-a",
  paladinLevel:6,
  charismaModifier:3,
  incapacitated:false,
  distanceFeet:10,
  relation:"ally" as const,
  ...overrides,
});

test("Aura of Protection starts at 10 feet on level 6 and expands to 30 feet on level 18", () => {
  assert.equal(paladinAuraRadiusFeet(5), 0);
  assert.equal(paladinAuraRadiusFeet(6), 10);
  assert.equal(paladinAuraRadiusFeet(17), 10);
  assert.equal(paladinAuraRadiusFeet(18), 30);
  assert.equal(paladinAuraRadiusFeet(20), 30);
});

test("Aura of Protection grants Charisma modifier with minimum +1 only to self/allies inside the active radius", () => {
  assert.equal(auraOfProtectionContribution(fact())?.bonus, 3);
  assert.equal(auraOfProtectionContribution(fact({ charismaModifier:0 }))?.bonus, 1);
  assert.equal(auraOfProtectionContribution(fact({ charismaModifier:-2 }))?.bonus, 1);
  assert.equal(auraOfProtectionContribution(fact({ relation:"self", distanceFeet:0 }))?.bonus, 3);
  assert.equal(auraOfProtectionContribution(fact({ relation:"enemy" })), undefined);
  assert.equal(auraOfProtectionContribution(fact({ relation:"neutral" })), undefined);
  assert.equal(auraOfProtectionContribution(fact({ distanceFeet:10.1 })), undefined);
  assert.equal(auraOfProtectionContribution(fact({ paladinLevel:5 })), undefined);
  assert.equal(auraOfProtectionContribution(fact({ incapacitated:true })), undefined);
});

test("Aura Expansion permits a 30-foot ally while preserving the same saving-throw bonus", () => {
  const contribution = auraOfProtectionContribution(fact({
    paladinLevel:18,
    charismaModifier:5,
    distanceFeet:30,
  }));
  assert.deepEqual({ bonus:contribution?.bonus, radiusFeet:contribution?.radiusFeet }, { bonus:5, radiusFeet:30 });
});

test("multiple Paladin auras are exposed as alternatives and exactly one chosen aura contributes", () => {
  const facts = [
    fact({ paladinId:"paladin-a", charismaModifier:2 }),
    fact({ paladinId:"paladin-b", charismaModifier:5 }),
    fact({ paladinId:"paladin-c", charismaModifier:4, incapacitated:true }),
  ];
  const options = auraOfProtectionOptions(facts);
  assert.deepEqual(options.map((entry) => [entry.paladinId,entry.bonus]), [["paladin-a",2],["paladin-b",5]]);
  assert.equal(chooseAuraOfProtection(facts, "paladin-b").bonus, 5);
  assert.throws(() => chooseAuraOfProtection(facts, "paladin-c"), /not available/);
});

test("Aura of Courage suppresses Frightened only for self/allies in an active level-10+ Aura of Protection", () => {
  assert.equal(auraOfCourageSuppressesFrightened(fact({ paladinLevel:9 })), false);
  assert.equal(auraOfCourageSuppressesFrightened(fact({ paladinLevel:10 })), true);
  assert.equal(auraOfCourageSuppressesFrightened(fact({ paladinLevel:10, distanceFeet:11 })), false);
  assert.equal(auraOfCourageSuppressesFrightened(fact({ paladinLevel:18, distanceFeet:30 })), true);
  assert.equal(auraOfCourageSuppressesFrightened(fact({ paladinLevel:18, distanceFeet:31 })), false);
  assert.equal(auraOfCourageSuppressesFrightened(fact({ paladinLevel:18, relation:"enemy" })), false);
  assert.equal(auraOfCourageSuppressesFrightened(fact({ paladinLevel:18, incapacitated:true })), false);
});
