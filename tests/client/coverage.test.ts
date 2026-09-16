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
const AUTHORED = ["fighter", "barbarian", "monk", "rogue"];

test("coverage: every class whose authoring slice has landed says something about every feature (D183)", () => {
  const { silent } = classCoverage();
  for (const slug of AUTHORED) assert.deepEqual(silent[slug], [], `${slug}: 아직 앱이 아무 말도 안 하는 특성\n  ${silent[slug].join("\n  ")}`);
  // And the classes still to come are counted, so the plan's table cannot drift from the code.
  const spec = readFileSync("docs/design/v3/ROLL20_TABLE_SPEC.md", "utf8");
  const KO: Record<string, string> = { fighter: "파이터", barbarian: "바바리안", monk: "몽크", rogue: "로그", wizard: "위저드", sorcerer: "소서러", cleric: "클레릭", druid: "드루이드", paladin: "팔라딘", ranger: "레인저", bard: "바드", warlock: "워락" };
  for (const [left, right] of [["wizard", "sorcerer"], ["cleric", "druid"], ["paladin", "ranger"], ["bard", "warlock"]] as Array<[string, string]>) {
    const row = `| ${KO[left]} · ${KO[right]} | ${silent[left].length} + ${silent[right].length} |`;
    assert.ok(spec.includes(row), `저작 슬라이스 줄이 측정값과 다릅니다: ${row}`);
  }
});
