import { describe, expect, it } from "vitest";
import profileJson from "../../rules/profiles/dnd.srd-5.2.1.profile.json";
import abilityScenario from "../../tests/fixtures/rules/profile.ability-modifier.basic.json";
import rollStateScenario from "../../tests/fixtures/rules/profile.advantage-disadvantage.cancel.json";
import {
  resolveProfileProperty,
  resolveRollState,
  type RollStateContribution,
  type RulesProfileLike,
} from "./profileEngine";

const profile = profileJson as unknown as RulesProfileLike;

describe("SRD 5.2.1 executable rules fixtures", () => {
  it("executes the ability modifier fixture", () => {
    const actor = abilityScenario.initialState.actors[abilityScenario.request.actorId];
    const property = abilityScenario.request.payload.property;
    const resolution = resolveProfileProperty(profile, property, actor.properties);

    expect({ [property]: resolution.value }).toEqual(abilityScenario.expected.resolvedProperties);
    for (const assertion of abilityScenario.expected.provenanceAssertions) {
      expect(resolution.provenance).toContainEqual(assertion);
    }
  });

  it("executes the Advantage and Disadvantage cancellation fixture", () => {
    const actor = rollStateScenario.initialState.actors[rollStateScenario.request.actorId];
    const resolution = resolveRollState(
      profile,
      actor.rollStateContributions as RollStateContribution[],
    );

    expect({ rollState: resolution.rollState }).toEqual(rollStateScenario.expected.result);
    for (const assertion of rollStateScenario.expected.provenanceAssertions) {
      expect(resolution.provenance).toContainEqual(assertion);
    }
  });
});
