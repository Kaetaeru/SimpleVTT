import assert from "node:assert/strict";
import { test } from "node:test";
import profile from "../../rules/profiles/dnd.srd-5.2.1.profile.json" with { type: "json" };
import scenario from "../../tests/fixtures/rules/profile.d20.ability-check.advantage.json" with { type: "json" };
import { resolveD20Test } from "../../.rules-build/d20.js";

test("d20 ability-check golden fixture", () => {
  const actor = scenario.initialState.actors[scenario.request.actorId];
  const payload = scenario.request.payload;
  const result = resolveD20Test(profile, {
    family: payload.family,
    target: payload.target,
    modifierContributions: payload.modifierContributions,
    rollStateContributions: actor.rollStateContributions,
    dice: scenario.fixedDice[0],
    targetSource: payload.targetSource,
  });
  assert.equal(result.dice.selectedFace, 17);
  assert.equal(result.total, 22);
  assert.equal(result.outcome, "success");
});
