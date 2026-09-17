/**
 * R49 (ROLL20_TABLE_SPEC.md D184): the hand-written tables, emptied.
 *
 * `EFFECT_RULES` held 63 functions and `FEATURE_ACTIVATIONS` 49 rows. Both are now contracts, one at a time, each
 * verified against the code it replaced before the code was deleted. What is left is named here rather than left
 * lying about: the handful whose shape the contract grammar still cannot say.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { featureActivation, featureRuleKey } from "../../client/rules/activation";
import { characterScope, evaluate } from "../../client/rules/contract";
import { contractDurations, featureContract } from "../../client/rules/contractActivation";
import { effectApplication } from "../../client/rules/effects";
import { build, catalog } from "./support";

/** The rules the grammar still cannot express, and why. This list is the slice's real output. */
// H5c·H5d (D246, D247): the last five were given grammar (`diceCount`, `use.points`, `hp.heal-on-start`) and moved.
const HELD_BACK: Record<string, string> = {};

test("migration: EFFECT_RULES is down to what the grammar cannot say (D184)", () => {
  const source = readFileSync("client/rules/effects.ts", "utf8");
  assert.ok(!source.includes("EFFECT_RULES"), "no hand-written effect table is left");
  assert.deepEqual(HELD_BACK, {});
  // 원조 is a contract: +5 maximum, and the +5 healed once when it starts.
  const aid = effectApplication({ key: "spell:dnd.srd521.spell.aid", name: "원조", source: "spell", duration: "8시간", startedRound: 0 } as never, build({ name: "c", classes: "cleric", level: 3 }).derived, catalog());
  assert.equal(aid?.hpMax, 5);
  assert.deepEqual(aid?.onStart, { heal: 5 });
});

test("migration: the activations that moved spend and roll exactly what they did (D184)", () => {
  const cat = catalog();
  const source = readFileSync("client/rules/activation.ts", "utf8");
  const table = source.slice(source.indexOf("const FEATURE_ACTIVATIONS"), source.indexOf("\n};", source.indexOf("const FEATURE_ACTIVATIONS")));
  const rows = [...table.matchAll(/^\s*"([^"]+)":/gm)].map((match) => match[1]);
  const held = new Set(Object.keys(HELD_BACK));
  const uncovered = rows.filter((key) => !featureContract(cat, key) && !held.has(key));
  assert.deepEqual(uncovered, [], `계약 없이 남은 활성화: ${uncovered.join(", ")}`);
  // Every row that moved still answers the same: same pool, same cost.
  for (const slug of ["fighter", "monk", "cleric", "druid", "paladin", "warlock", "bard", "sorcerer", "wizard", "rogue"]) {
    const made = build({ name: slug, classes: slug, level: 20 });
    for (const feature of made.derived.features) {
      const key = featureRuleKey(feature.id);
      if (!featureContract(cat, key) || held.has(key)) continue;
      const before = featureActivation(feature, made.derived);
      const after = featureActivation(feature, made.derived, contractDurations(cat, characterScope(made.derived)));
      if (!before || !after) continue;
      assert.equal(after.resourceId, before.resourceId, `${key} 자원`);
      assert.equal(after.cost ?? 1, before.cost ?? 1, `${key} 비용`);
    }
  }
});

test("migration: a level table is an expression now, not a closure (D184)", () => {
  const cat = catalog();
  const rage = featureContract(cat, "barbarian.rage")!;
  const bonus = rage.entryPoints[0].operations.find((operation) => operation.kind === "property.modify" && operation.property === "damage.bonus")!;
  const at = (level: number) => evaluate((bonus as { value?: Parameters<typeof evaluate>[0] }).value, characterScope(build({ name: "b", classes: "barbarian", level }).derived));
  // 2024 Rage: +2, +3 from 9, +4 from 16 — two nested `if`s in the contract, no code anywhere.
  assert.equal(at(1), 2);
  assert.equal(at(8), 2);
  assert.equal(at(9), 3);
  assert.equal(at(15), 3);
  assert.equal(at(16), 4);
  assert.equal(at(20), 4);
});
