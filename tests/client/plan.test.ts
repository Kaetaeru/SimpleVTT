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
import { readFileSync } from "node:fs";
import { classCoverage } from "./support";
import { APPLIED_OPERATIONS, COMPUTED_OPERATIONS } from "../../client/rules/contract";

const SPEC = "docs/design/v3/ROLL20_TABLE_SPEC.md";
/**
 * R42 (D182): slots are counted by *demand*, not by how many the grammar lists. Nine of the ten have no contract
 * asking for them; opening those would be speculation, and a plan that counts speculation is not measuring anything.
 */
const WANTED_SLOTS = ["d20.roll", "primary.damage"];
const OPEN_SLOTS = ["d20.roll"];

test("plan: the schema's operation vocabulary is 26, and the executor's share of it is counted twice (D176)", () => {
  const schema = JSON.parse(readFileSync("schemas/common-play-contract.schema.json", "utf8")) as { $defs: Record<string, unknown> };
  const operation = schema.$defs.operation as { oneOf?: unknown[]; anyOf?: unknown[] };
  // 26 definitions, 27 kinds: condition.apply and condition.remove share one. Kinds are what a contract writes, so
  // kinds are what the scoreboard counts.
  assert.equal((operation.oneOf ?? operation.anyOf ?? []).length, 26, "the contract grammar's operation definitions");
  assert.equal(COMPUTED_OPERATIONS.length, 27, "every kind those definitions allow");
  // Everything is read; what is left is the kinds with no call site yet.
  const waiting = COMPUTED_OPERATIONS.filter((kind) => !(APPLIED_OPERATIONS as readonly string[]).includes(kind));
  assert.equal(APPLIED_OPERATIONS.length + waiting.length, COMPUTED_OPERATIONS.length);
  assert.equal(APPLIED_OPERATIONS.length, 27, "R42 opened the table-level entry point, so every kind lands");
  for (const applied of APPLIED_OPERATIONS) assert.ok((COMPUTED_OPERATIONS as readonly string[]).includes(applied), applied);
});

test("plan: the document's scoreboard is the measured one (D176)", () => {
  const spec = readFileSync(SPEC, "utf8");
  const { counts, total } = classCoverage();
  const covered = counts.contract;
  // The four headline numbers, exactly as §14.1 prints them.
  for (const row of [
    `| ${COMPUTED_OPERATIONS.length} / 27 |`,
    `| ${APPLIED_OPERATIONS.length} / 27 |`,
    `| ${OPEN_SLOTS.length} / ${WANTED_SLOTS.length} |`,
    `| ${covered} / ${total} |`,
  ]) assert.ok(spec.includes(row), `§14.1의 점수판이 측정값과 다릅니다: ${row} 가 없습니다`);
  // And the four-way split of the features.
  assert.equal(total, 223);
  assert.deepEqual(counts, { contract: 69, activation: 32, mentioned: 63, silent: 59 });
  for (const [label, value] of [["계약이 있다", counts.contract], ["사용 버튼이 있다", counts.activation], ["코드가 이름은 안다", counts.mentioned]] as Array<[string, number]>) {
    assert.ok(spec.includes(`| ${label} | ${value} |`), `${label} = ${value}`);
  }
  assert.ok(spec.includes(`| **코드가 이름조차 모른다** | **${counts.silent}** |`), `침묵 = ${counts.silent}`);
});

test("plan: every authoring slice is sized from the real silent-feature count (D176)", () => {
  const spec = readFileSync(SPEC, "utf8");
  const { silent } = classCoverage();
  const perClass = Object.fromEntries(Object.entries(silent).map(([slug, list]) => [slug, list.length]));
  const KO: Record<string, string> = { fighter: "파이터", barbarian: "바바리안", monk: "몽크", rogue: "로그", wizard: "위저드", sorcerer: "소서러", cleric: "클레릭", druid: "드루이드", paladin: "팔라딘", ranger: "레인저", bard: "바드", warlock: "워락" };
  // R42~R47 pair the classes up; each row prints "a + b" and those are the numbers measured here.
  // The rows for the slices still to come; a class whose slice has landed has no row left (R43+).
  const pairs: Array<[string, string]> = [["wizard", "sorcerer"], ["cleric", "druid"], ["paladin", "ranger"], ["bard", "warlock"]];
  for (const [left, right] of pairs) {
    const row = `| ${KO[left]} · ${KO[right]} | ${perClass[left]} + ${perClass[right]} |`;
    assert.ok(spec.includes(row), `저작 슬라이스 줄이 측정값과 다릅니다: ${row}`);
  }
  for (const done of ["파이터 · 바바리안", "몽크 · 로그"]) assert.ok(!spec.includes(`| ${done} |`), "끝난 직업은 앞으로 표에 남아 있지 않습니다");

});
