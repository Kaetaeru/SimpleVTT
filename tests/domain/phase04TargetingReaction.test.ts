import assert from "node:assert/strict";
import test from "node:test";
import { resolveTargeting } from "../../src/domain/targeting";
import {
  conditionActionAvailability,
  conditionD20Adjustments,
  conditionDamageDefenses,
  conditionImmunities,
  effectiveSpeed,
  exhaustionLevel,
  frightenedMovementRestriction,
  initiativeConditionContributions,
  proneStandingCost,
} from "../../src/domain/conditions";
import { beginTurn } from "../../src/domain/turnEconomy";
import { openReactorWindow, resolveReactionChoice } from "../../src/domain/reaction";

test("Phase 04 targeting enforces range, sight, relation and 2024 cover bonuses", () => {
  const rule = {
    kind:"creature" as const,
    rangeFeet:60,
    minTargets:1,
    maxTargets:1,
    allowedRelations:["enemy" as const],
    requiresSight:true,
    directTarget:true,
  };
  const half = resolveTargeting("hero", rule, [{
    id:"goblin", kind:"creature", relation:"enemy", distanceFeet:30, visible:true, cover:"half",
  }]);
  assert.equal(half.valid, true);
  assert.equal(half.targets[0].acBonus, 2);
  assert.equal(half.targets[0].dexteritySaveBonus, 2);

  const threeQuarters = resolveTargeting("hero", rule, [{
    id:"goblin", kind:"creature", relation:"enemy", distanceFeet:30, visible:true, cover:"three-quarters",
  }]);
  assert.equal(threeQuarters.targets[0].acBonus, 5);

  const total = resolveTargeting("hero", rule, [{
    id:"goblin", kind:"creature", relation:"enemy", distanceFeet:30, visible:true, cover:"total",
  }]);
  assert.equal(total.valid, false);
  assert.match(total.rejected[0].reasons.join(" "), /total cover/i);

  const outOfRange = resolveTargeting("hero", rule, [{
    id:"goblin", kind:"creature", relation:"enemy", distanceFeet:65, visible:true, cover:"none",
  }]);
  assert.equal(outOfRange.valid, false);
  assert.match(outOfRange.rejected[0].reasons.join(" "), /beyond range/);
});

test("Reaction window consumes the actor Reaction exactly once", () => {
  const before = beginTurn(30);
  const window = openReactorWindow("hero", before, "enemy-leaves-reach", [{
    id:"opportunity-attack",
    actorId:"hero",
    trigger:"enemy-leaves-reach",
    source:"basic-combat",
  }]);
  assert.equal(window.choiceRequired, true);
  const resolved = resolveReactionChoice("hero", before, window, "opportunity-attack");
  assert.equal(resolved.nextEconomy.reaction, false);
  const closed = openReactorWindow("hero", resolved.nextEconomy, "enemy-leaves-reach", [{
    id:"opportunity-attack",
    actorId:"hero",
    trigger:"enemy-leaves-reach",
    source:"basic-combat",
  }]);
  assert.equal(closed.choiceRequired, false);
  assert.deepEqual(closed.optionIds, []);
});

test("2024 conditions contribute composable D20, movement and defense semantics", () => {
  const exhaustion = [1,2].map((index) => ({
    id:`exhaustion-${index}`,
    conditionId:"exhaustion" as const,
  }));
  assert.equal(exhaustionLevel(exhaustion), 2);
  assert.equal(effectiveSpeed(30, exhaustion), 20);
  const exhaustionD20 = conditionD20Adjustments({
    actorId:"hero",
    family:"ability-check",
    actorConditions:exhaustion,
  });
  assert.deepEqual(exhaustionD20.modifierContributions, [{ source:"condition:exhaustion", value:-4 }]);

  const poisoned = conditionD20Adjustments({
    actorId:"hero",
    family:"attack-roll",
    actorConditions:[{ id:"poison", conditionId:"poisoned" }],
  });
  assert.ok(poisoned.rollStateContributions.some((entry) => entry.state === "disadvantage"));

  const proneNear = conditionD20Adjustments({
    actorId:"hero",
    targetId:"goblin",
    family:"attack-roll",
    distanceToTargetFeet:5,
    actorConditions:[],
    targetConditions:[{ id:"prone", conditionId:"prone" }],
  });
  assert.ok(proneNear.rollStateContributions.some((entry) => entry.state === "advantage"));
  assert.equal(proneStandingCost(30, [{ id:"prone", conditionId:"prone" }]), 15);

  const petrified = [{ id:"stone", conditionId:"petrified" as const }];
  assert.equal(conditionDamageDefenses(petrified)[0].kind, "resistance");
  assert.deepEqual(conditionImmunities(petrified), ["poisoned"]);

  const incapacitated = conditionActionAvailability([{ id:"stun", conditionId:"stunned" }]);
  assert.deepEqual(incapacitated, { action:false, bonusAction:false, reaction:false, canSpeak:false });
});

test("Charmed, Frightened and Invisible keep their source-aware rules", () => {
  const social = conditionD20Adjustments({
    actorId:"hero",
    targetId:"goblin",
    family:"ability-check",
    socialInteraction:true,
    actorConditions:[],
    targetConditions:[{ id:"charm", conditionId:"charmed", sourceActorId:"hero" }],
  });
  assert.ok(social.rollStateContributions.some((entry) => entry.state === "advantage"));

  const fear = frightenedMovementRestriction(
    [{ id:"fear", conditionId:"frightened", sourceActorId:"dragon" }],
    true,
    ["dragon"],
  );
  assert.match(fear ?? "", /dragon/);

  const initiative = initiativeConditionContributions([
    { id:"invisible", conditionId:"invisible" },
    { id:"stunned", conditionId:"stunned" },
  ]);
  assert.ok(initiative.some((entry) => entry.state === "advantage"));
  assert.ok(initiative.some((entry) => entry.state === "disadvantage"));
});
