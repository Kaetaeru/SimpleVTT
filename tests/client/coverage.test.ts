/**
 * R43~R48 (ROLL20_TABLE_SPEC.md D183): the coverage count, per class.
 *
 * A feature is covered when the app says *something* about it: a contract with operations it runs, or a contract
 * whose `adjudication.request` states plainly what the table decides. What is not covered is a rule the app is
 * silent about — the sheet prints its description and nothing happens, which is the one outcome §14.1 rules out.
 *
 * This test is the authoring slices' end criterion. Each one drives one more class's number to zero.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { classCoverage } from "./support";

/** Classes whose authoring slice has landed; each one must stay at zero once it gets there. */
/** R48: every class. The list stays explicit so a new class cannot join the game silently. */
const AUTHORED = ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"];

test("coverage: every class whose authoring slice has landed says something about every feature (D183)", () => {
  const { silent } = classCoverage();
  for (const slug of AUTHORED) assert.deepEqual(silent[slug], [], `${slug}: 아직 앱이 아무 말도 안 하는 특성\n  ${silent[slug].join("\n  ")}`);
  // Nothing is left to schedule, so the forward table has no authoring rows.
  const spec = readFileSync("docs/design/v3/ROLL20_TABLE_SPEC.md", "utf8");
  assert.ok(!/\| [가-힣]+ · [가-힣]+ \| \d+ \+ \d+ \|/.test(spec), "앞으로 표에 남은 저작 슬라이스가 없습니다");
});
