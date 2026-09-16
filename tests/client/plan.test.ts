/**
 * R36 (ROLL20_TABLE_SPEC.md D176): the plan's scoreboard, measured.
 *
 * §14.1 says what "다 됐다" means and carries four numbers: how many contract operations this executor computes, how
 * many actually reach the table, how many interceptor slots are open, and how many class features are covered. A plan
 * whose numbers are typed by hand goes stale the first time somebody ships a slice. This test measures them from the
 * code and the catalog and then asserts the document says the same thing — so the plan cannot drift from the truth
 * without a red test, and every slice has to update it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { build, catalog } from "./support";
import { featureActivation, featureRuleKey } from "../../client/rules/activation";
import { APPLIED_OPERATIONS, COMPUTED_OPERATIONS } from "../../client/rules/contract";

const SPEC = "docs/design/v3/ROLL20_TABLE_SPEC.md";
const CLASS_SLUGS = ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"];
/** The slots the interceptor grammar defines, and the ones the host opens today. */
const SLOTS = ["declaration", "targets", "d20.roll", "attack.roll", "attack.outcome", "primary.damage", "secondary.damage", "effects", "movement", "stateChanges"];
const OPEN_SLOTS = ["d20.roll"];

/** Every class and subclass feature at level 20, sorted into what the app does with it. */
function coverage() {
  const cat = catalog();
  let code = "";
  for (const dir of ["client/character", "client/rules", "client/session", "client/screens", "client/compendium"]) {
    for (const file of readdirSync(dir)) if (/\.tsx?$/.test(file)) code += readFileSync(join(dir, file), "utf8");
  }
  const seen = new Set<string>();
  const counts = { contract: 0, activation: 0, mentioned: 0, silent: 0 };
  const perClass: Record<string, number> = {};
  for (const slug of CLASS_SLUGS) {
    const made = build({ name: slug, classes: slug, level: 20 });
    perClass[slug] = 0;
    for (const feature of made.derived.features) {
      if (feature.source !== "class" && feature.source !== "subclass") continue;
      const key = featureRuleKey(feature.id);
      if (seen.has(key)) continue;
      seen.add(key);
      const tail = key.split(".").pop()!;
      if (cat.contractFor(key)) counts.contract += 1;
      else if (featureActivation(feature, made.derived)) counts.activation += 1;
      else if (tail.length > 3 && code.includes(tail)) counts.mentioned += 1;
      else { counts.silent += 1; perClass[slug] += 1; }
    }
  }
  return { counts, perClass, total: seen.size };
}

test("plan: the schema's operation vocabulary is 26, and the executor's share of it is counted twice (D176)", () => {
  const schema = JSON.parse(readFileSync("schemas/common-play-contract.schema.json", "utf8")) as { $defs: Record<string, unknown> };
  const operation = schema.$defs.operation as { oneOf?: unknown[]; anyOf?: unknown[] };
  assert.equal((operation.oneOf ?? operation.anyOf ?? []).length, 26, "the contract grammar's operation count — the denominator of the plan");
  assert.deepEqual([...COMPUTED_OPERATIONS].sort(), ["condition.apply", "economy.modify", "effect.apply", "effect.remove", "effect.suppress", "healing.apply", "property.modify", "roll.modify"]);
  // An operation the executor understands but nobody applies changes nothing at the table, and is not counted as if it did.
  assert.deepEqual([...APPLIED_OPERATIONS].sort(), ["economy.modify", "effect.apply", "effect.remove", "effect.suppress", "property.modify", "roll.modify"]);
  for (const applied of APPLIED_OPERATIONS) assert.ok((COMPUTED_OPERATIONS as readonly string[]).includes(applied), applied);
});

test("plan: the document's scoreboard is the measured one (D176)", () => {
  const spec = readFileSync(SPEC, "utf8");
  const { counts, total } = coverage();
  const covered = counts.contract;
  // The four headline numbers, exactly as §14.1 prints them.
  for (const row of [
    `| ${COMPUTED_OPERATIONS.length} / 26 |`,
    `| ${APPLIED_OPERATIONS.length} / 26 |`,
    `| ${OPEN_SLOTS.length} / ${SLOTS.length} |`,
    `| ${covered} / ${total} |`,
  ]) assert.ok(spec.includes(row), `§14.1의 점수판이 측정값과 다릅니다: ${row} 가 없습니다`);
  // And the four-way split of the features.
  assert.equal(total, 223);
  assert.deepEqual(counts, { contract: 6, activation: 50, mentioned: 63, silent: 104 });
  for (const [label, value] of [["계약이 있다", counts.contract], ["사용 버튼이 있다", counts.activation], ["코드가 이름은 안다", counts.mentioned]] as Array<[string, number]>) {
    assert.ok(spec.includes(`| ${label} | ${value} |`), `${label} = ${value}`);
  }
  assert.ok(spec.includes(`| **코드가 이름조차 모른다** | **${counts.silent}** |`), `침묵 = ${counts.silent}`);
});

test("plan: every authoring slice is sized from the real silent-feature count (D176)", () => {
  const spec = readFileSync(SPEC, "utf8");
  const { perClass } = coverage();
  const KO: Record<string, string> = { fighter: "파이터", barbarian: "바바리안", monk: "몽크", rogue: "로그", wizard: "위저드", sorcerer: "소서러", cleric: "클레릭", druid: "드루이드", paladin: "팔라딘", ranger: "레인저", bard: "바드", warlock: "워락" };
  // R42~R47 pair the classes up; each row prints "a + b" and those are the numbers measured here.
  const pairs: Array<[string, string]> = [["fighter", "barbarian"], ["monk", "rogue"], ["wizard", "sorcerer"], ["cleric", "druid"], ["paladin", "ranger"], ["bard", "warlock"]];
  for (const [left, right] of pairs) {
    const row = `| ${KO[left]} · ${KO[right]} | ${perClass[left]} + ${perClass[right]} |`;
    assert.ok(spec.includes(row), `저작 슬라이스 줄이 측정값과 다릅니다: ${row}`);
  }
  // Every class is in exactly one slice, and the pairs account for every silent feature.
  assert.equal(pairs.flat().length, CLASS_SLUGS.length);
  assert.equal(pairs.flat().reduce((sum, slug) => sum + perClass[slug], 0), 104);
});
