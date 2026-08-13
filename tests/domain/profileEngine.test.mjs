import assert from "node:assert/strict";
import { test } from "node:test";
import profile from "../../rules/profiles/dnd.srd-5.2.1.profile.json" with { type: "json" };
import abilityScenario from "../../tests/fixtures/rules/profile.ability-modifier.basic.json" with { type: "json" };
import rollStateScenario from "../../tests/fixtures/rules/profile.advantage-disadvantage.cancel.json" with { type: "json" };
import { resolveProfileProperty, resolveRollState } from "../../.rules-build/profileEngine.js";

test("ability modifier golden fixture", () => {
  const actor = abilityScenario.initialState.actors[abilityScenario.request.actorId];
  const property = abilityScenario.request.payload.property;
  const resolution = resolveProfileProperty(profile, property, actor.properties);
  assert.deepEqual({ [property]: resolution.value }, abilityScenario.expected.resolvedProperties);
  for (const expected of abilityScenario.expected.provenanceAssertions) {
    assert.ok(resolution.provenance.some((entry) => JSON.stringify(entry) === JSON.stringify(expected)));
  }
});

test("Advantage and Disadvantage golden fixture", () => {
  const actor = rollStateScenario.initialState.actors[rollStateScenario.request.actorId];
  const resolution = resolveRollState(profile, actor.rollStateContributions);
  assert.deepEqual({ rollState: resolution.rollState }, rollStateScenario.expected.result);
  for (const expected of rollStateScenario.expected.provenanceAssertions) {
    assert.ok(resolution.provenance.some((entry) => JSON.stringify(entry) === JSON.stringify(expected)));
  }
});
