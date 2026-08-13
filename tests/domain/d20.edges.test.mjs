import assert from "node:assert/strict";
import { test } from "node:test";
import profile from "../../rules/profiles/dnd.srd-5.2.1.profile.json" with { type: "json" };
import { resolveD20Test } from "../../.rules-build/d20.js";

test("saving throw with disadvantage selects the lower d20", () => {
  const result = resolveD20Test(profile, {
    family: "saving-throw",
    target: 14,
    modifierContributions: [{ source: "actor:save", value: 3 }],
    rollStateContributions: [{ source: "effect:test", state: "disadvantage" }],
    dice: { id: "save", purpose: "saving-throw", sides: 20, faces: [18, 7] },
  });
  assert.equal(result.natural, 7);
  assert.equal(result.total, 10);
  assert.equal(result.outcome, "failure");
});

test("attack natural 20 auto-hits and is critical", () => {
  const result = resolveD20Test(profile, {
    family: "attack-roll",
    target: 99,
    modifierContributions: [],
    dice: { id: "attack-20", purpose: "attack-roll", sides: 20, faces: [20] },
  });
  assert.equal(result.outcome, "success");
  assert.equal(result.critical, true);
});

test("attack natural 1 auto-misses", () => {
  const result = resolveD20Test(profile, {
    family: "attack-roll",
    target: 1,
    modifierContributions: [{ source: "actor:attack", value: 20 }],
    dice: { id: "attack-1", purpose: "attack-roll", sides: 20, faces: [1] },
  });
  assert.equal(result.outcome, "failure");
  assert.equal(result.critical, false);
});
