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
import { catalog, classCoverage } from "./support";
import { APPLIED_OPERATIONS, COMPUTED_OPERATIONS } from "../../client/rules/contract";

const SPEC = "docs/design/v3/ROLL20_TABLE_SPEC.md";
/**
 * R42 (D182): slots are counted by *demand*, not by how many the grammar lists — opening a slot nothing asks for is
 * speculation, and a plan that counts speculation is not measuring anything.
 *
 * R54 (D189): the demanded set is measured from the catalog now rather than typed here, because R52–R54 added three
 * seams and a hand-written list would have gone stale the same way the scoreboard it feeds would have.
 */
const OPEN_SLOTS = ["d20.roll", "attack.outcome", "reaction"];
const wantedSlots = () => [...new Set([...catalog().contracts.values()].flatMap((contract) => contract.interceptors.map((item) => item.slot)))].sort();

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
    `| ${OPEN_SLOTS.length} / ${wantedSlots().length} |`,
    `| ${covered} / ${total} |`,
  ]) assert.ok(spec.includes(row), `§14.1의 점수판이 측정값과 다릅니다: ${row} 가 없습니다`);
  // And the four-way split of the features.
  assert.equal(total, 223);
  // R72 (D207): Extra Attack moved from a name the code compared to a contract — five from "mentioned" to "contract".
  // R95 (D230): 기묘한 회피 got its reaction contract — one more from "activation" to "contract".
  // H3 (D240): nineteen creation-time features moved from a name the code compared to a gain contract.
  // H3c (D241): eight more — armour, speed, half proficiency and martial arts are gain contracts now.
  // H3d (D242): the order and subclass option grants moved too.
  assert.deepEqual(counts, { contract: 196, activation: 8, mentioned: 19, silent: 0 });
  // Every slot a contract asks for is one this executor actually opens; nothing is demanded and ignored.
  assert.deepEqual(wantedSlots().filter((slot) => !OPEN_SLOTS.includes(slot)), ["primary.damage"], "R42's one outstanding demand");
  for (const [label, value] of [["계약이 있다", counts.contract], ["사용 버튼이 있다", counts.activation], ["코드가 이름은 안다", counts.mentioned]] as Array<[string, number]>) {
    assert.ok(spec.includes(`| ${label} | ${value} |`), `${label} = ${value}`);
  }
  assert.ok(spec.includes(`| **코드가 이름조차 모른다** | **${counts.silent}** |`), `침묵 = ${counts.silent}`);
});

test("plan: no class is silent any more, and the forward table has no authoring rows left (D183)", () => {
  const spec = readFileSync(SPEC, "utf8");
  const { silent } = classCoverage();
  for (const [slug, list] of Object.entries(silent)) assert.deepEqual(list, [], `${slug}: ${list.join(", ")}`);
  assert.ok(!/\| [가-힣]+ · [가-힣]+ \| \d+ \+ \d+ \|/.test(spec), "끝난 직업은 앞으로 표에 남아 있지 않습니다");
});
