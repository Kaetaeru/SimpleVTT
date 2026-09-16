/**
 * R40 (ROLL20_TABLE_SPEC.md D180): what a use costs and what it heals, from the contract.
 *
 * `FEATURE_ACTIVATIONS` answers three questions per feature: which pool it spends, what it heals or grants, and what
 * dice it rolls. `resource.change`, `healing.apply`, `temp-hp.grant` and `damage.apply` say the same four things as
 * data — level-dependent numbers included, read off the character through `actor.class-level:`.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { featureActivation, featureRuleKey } from "../../client/rules/activation";
import { characterScope } from "../../client/rules/contract";
import { contractDurations, contractUse, featureContract } from "../../client/rules/contractActivation";
import { build, catalog } from "./support";

const USES: Array<[string, string, number]> = [
  ["fighter", "fighter.second-wind", 20],
  ["monk", "monk.uncanny-metabolism", 20],
  ["ranger", "ranger.tireless", 20],
  ["cleric", "cleric.life-domain.preserve-life", 20],
  ["druid", "druid.wild-shape", 20],
];
/** "1d8+0" and "1d8" are the same roll; compare what the dice say, not how the string was built. */
const same = (left?: string, right?: string) => (left ?? "").replace(/\+0$/, "") === (right ?? "").replace(/\+0$/, "");

test("uses: every authored contract spends the same pool and rolls the same dice as the table (D180)", () => {
  const cat = catalog();
  for (const [slug, key, level] of USES) {
    const made = build({ name: slug, classes: slug, level });
    const feature = made.derived.features.find((item) => featureRuleKey(item.id) === key);
    assert.ok(feature, `${key}: ${slug} ${level}레벨에 없습니다`);
    const before = featureActivation(feature, made.derived)!;
    const after = featureActivation(feature, made.derived, contractDurations(cat, characterScope(made.derived)))!;
    assert.equal(after.resourceId, before.resourceId, `${key} 자원`);
    assert.equal(after.cost ?? 1, before.cost ?? 1, `${key} 비용`);
    assert.ok(same(after.heal?.(made.derived), before.heal?.(made.derived)), `${key} 회복: ${after.heal?.(made.derived)} ≠ ${before.heal?.(made.derived)}`);
    assert.ok(same(after.tempHp?.(made.derived), before.tempHp?.(made.derived)), `${key} 임시 HP: ${after.tempHp?.(made.derived)} ≠ ${before.tempHp?.(made.derived)}`);
    assert.ok(same(after.roll?.(made.derived).formula, before.roll?.(made.derived).formula), `${key} 굴림: ${after.roll?.(made.derived).formula} ≠ ${before.roll?.(made.derived).formula}`);
  }
});

test("uses: the level-dependent numbers are read off the character, not written into the contract (D180)", () => {
  const cat = catalog();
  const at = (level: number) => {
    const made = build({ name: "f", classes: "fighter", level });
    return contractUse(featureContract(cat, "fighter.second-wind")!, characterScope(made.derived), "재기의 바람")!;
  };
  assert.equal(at(1).heal, "1d10+1");
  assert.equal(at(9).heal, "1d10+9");
  assert.equal(at(20).heal, "1d10+20");
  assert.equal(at(5).resourceId, "resource.fighter.second-wind");
  // 생명 보존 is five times the cleric's level, worked out by the expression rather than a table of twenty numbers.
  const cleric = build({ name: "c", classes: "cleric", level: 7 }).derived;
  assert.equal(contractUse(featureContract(cat, "cleric.life-domain.preserve-life")!, characterScope(cleric), "생명 보존")!.roll!.formula, "35");
});

test("uses: a contract that says nothing about a use leaves the table's answer alone (D180)", () => {
  const cat = catalog();
  const made = build({ name: "b", classes: "barbarian", level: 5 });
  const rage = made.derived.features.find((item) => featureRuleKey(item.id) === "barbarian.rage")!;
  // 격노's contract carries its pool, its ten minutes and the three things the table decides.
  const after = featureActivation(rage, made.derived, contractDurations(cat, characterScope(made.derived)))!;
  assert.equal(after.resourceId, "resource.barbarian.rage");
  assert.equal(after.duration!(made.derived).rounds, 100);
  assert.ok(after.note?.includes("추가 행동으로 연장"), after.note);
  // A feature whose contract only changes a standing number says nothing about *using* it at all.
  const fighter = build({ name: "f", classes: "fighter", level: 20 }).derived;
  assert.equal(contractUse(featureContract(cat, "fighter.champion.improved-critical")!, characterScope(fighter), "향상된 치명타"), undefined);
});
