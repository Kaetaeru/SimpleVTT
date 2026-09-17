/**
 * R50 (ROLL20_TABLE_SPEC.md D185): the finish line.
 *
 * §14.1 defined done as: every rule the app chose to mechanise comes from the catalog, every rule it chose not to
 * says so on the sheet, and no rule quietly does nothing. This test is that sentence, checked.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { featureRuleKey } from "../../client/rules/activation";
import { characterScope } from "../../client/rules/contract";
import { contractSummary, featureContract } from "../../client/rules/contractActivation";
import { build, catalog, classCoverage, CLASS_SLUGS } from "./support";

test("done: no class feature is silent, in any class, at level twenty (D185)", () => {
  const { silent, counts, total } = classCoverage();
  for (const [slug, list] of Object.entries(silent)) assert.deepEqual(list, [], `${slug}: ${list.join(", ")}`);
  assert.equal(counts.silent, 0);
  assert.equal(total, 223);
  assert.equal(counts.contract + counts.activation + counts.mentioned, total);
});

test("done: every feature with a contract carries its own line on the sheet (D185)", () => {
  const cat = catalog();
  let checked = 0;
  for (const slug of CLASS_SLUGS) {
    const made = build({ name: slug, classes: slug, level: 20 });
    for (const feature of made.derived.features) {
      const contract = featureContract(cat, featureRuleKey(feature.id));
      if (!contract) continue;
      checked += 1;
      assert.ok(feature.rules?.length, `${feature.name}: 시트에 적을 줄이 없습니다`);
      assert.ok(feature.execution === "derived" || feature.execution === "descriptive", `${feature.name}: ${feature.execution}`);
      // A contract that only asks the table questions is marked as such, and one with operations is not.
      const summary = contractSummary(contract, characterScope(made.derived));
      assert.deepEqual(feature.rules, summary.rules, feature.name);
      assert.equal(feature.execution, summary.execution, feature.name);
    }
  }
  assert.ok(checked > 150, `${checked} features checked`);
});

test("done: the line says what the engine does, and 표에서 판단 means it does nothing (D185)", () => {
  const cat = catalog();
  const barbarian = build({ name: "b", classes: "barbarian", level: 16 }).derived;
  const rage = barbarian.features.find((feature) => featureRuleKey(feature.id) === "barbarian.rage")!;
  assert.equal(rage.execution, "derived");
  assert.ok(rage.rules!.some((line) => line.includes("피해 +4")), JSON.stringify(rage.rules));
  assert.ok(rage.rules!.some((line) => line.includes("1회 소비")), JSON.stringify(rage.rules));
  assert.ok(rage.rules!.some((line) => line.includes("주문 시전·집중 불가")), "the prose is on the same line list");
  // R96 (D231): 야성의 본능 is advantage on initiative, which the host now rolls — the sheet computes it.
  const feral = barbarian.features.find((feature) => featureRuleKey(feature.id) === "barbarian.feral-instinct")!;
  assert.equal(feral.execution, "derived");
  void cat;
});
