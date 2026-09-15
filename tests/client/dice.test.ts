import assert from "node:assert/strict";
import test from "node:test";
import { describeRoll, formatFormula, parseFormula, rollFormula } from "../../client/character/dice";
import { choicesOpenedByLevelUp, summarizeLevelUp } from "../../client/character/levelup";
import { addLevel } from "../../client/character/source";
import { deriveCharacter } from "../../client/character/derive";
import { autofill } from "../../client/character/autofill";
import { build, catalog } from "./support";

test("dice formulas parse, roll with an injectable RNG and describe themselves", () => {
  assert.deepEqual(parseFormula("2d6+3"), { dice: [{ count: 2, sides: 6 }], modifier: 3 });
  assert.deepEqual(parseFormula("d20 - 1 + 1d4"), { dice: [{ count: 1, sides: 20 }, { count: 1, sides: 4 }], modifier: -1 });
  assert.equal(parseFormula("banana"), null);
  assert.equal(parseFormula(""), null);
  assert.equal(formatFormula(parseFormula("2d6+3")!), "2d6+3");
  const high = rollFormula({ label: "명중", formula: "1d20+5" }, () => 0.999);
  assert.equal(high.total, 25);
  assert.equal(high.natural, 20);
  const low = rollFormula({ label: "명중", formula: "1d20+5" }, () => 0);
  assert.equal(low.total, 6);
  assert.equal(low.natural, 1);
  const damage = rollFormula({ label: "피해", formula: "2d6+3" }, () => 0.5);
  assert.equal(damage.total, 4 + 4 + 3);
  assert.equal(damage.natural, undefined);
  assert.ok(describeRoll(high).includes("자연 20"));
  assert.ok(describeRoll(damage).includes("[4+4] + 3 = 11"));
});

test("a level-up opens only the new levels' choices and the pools that grew", () => {
  const { source } = build({ species: "human", classes: "fighter", level: 3 });
  const before = deriveCharacter(source, catalog());
  const leveled = addLevel(source, "dnd.srd521.class.fighter");
  const after = deriveCharacter(leveled, catalog());
  const opened = choicesOpenedByLevelUp(after, 3);
  const ids = opened.map((choice) => choice.id);
  assert.ok(ids.includes("class.3.asi"), "level 4 ASI is asked");
  assert.ok(ids.includes("class.0.weapon-mastery"), "fighter mastery pool grows 3 → 4 at level 4");
  assert.ok(!ids.includes("class.0.skills"), "level-1 skills stay closed");
  assert.ok(!ids.includes("origin.languages"));
  const filled = autofill(leveled, catalog(), { prefer: {} });
  const summary = summarizeLevelUp(before, filled.derived);
  assert.equal(summary.fromLevel, 3);
  assert.equal(summary.toLevel, 4);
  assert.deepEqual(summary.classes, [{ name: "파이터", from: 3, to: 4 }]);
  assert.ok(summary.hpTo > summary.hpFrom);
  assert.ok(summary.newFeatures.some((feature) => feature.name === "능력치 향상"));
  // Multiclass: a wizard level on a fighter opens the wizard's level-1 choices only.
  const multi = deriveCharacter(addLevel(source, "dnd.srd521.class.wizard"), catalog());
  const multiIds = choicesOpenedByLevelUp(multi, 3).map((choice) => choice.id);
  assert.ok(multiIds.includes("class.3.cantrips") && multiIds.includes("class.3.spellbook"));
  assert.ok(!multiIds.includes("class.0.skills"));
});
