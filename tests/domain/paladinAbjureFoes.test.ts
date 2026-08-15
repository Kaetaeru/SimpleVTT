import assert from "node:assert/strict";
import test from "node:test";
import {
  ABJURE_FOES_SOURCE_ID,
  ABJURE_FOES_TAG,
  abjureFoesMaximumTargets,
  resolveAbjureFoes,
  type AbjureFoesTarget,
} from "../../src/domain/paladinAbjureFoes";
import { PALADIN_CHANNEL_DIVINITY_RESOURCE_ID } from "../../src/domain/coreClassResources";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function paladinState() {
  const state = runtimeState();
  state.combatants.hero.resources.push({
    id:PALADIN_CHANNEL_DIVINITY_RESOURCE_ID,
    label:"채널 디비니티",
    current:2,
    maximum:2,
    recovery:{ shortRest:1, longRest:"all" },
  });
  return state;
}

function target(face: number, overrides: Partial<AbjureFoesTarget> = {}): AbjureFoesTarget {
  return {
    id:"goblin",
    kind:"creature",
    relation:"enemy",
    distanceFeet:30,
    visible:true,
    cover:"none",
    wisdomSaveModifier:1,
    saveDice:{ id:`abjure-save-${face}`, purpose:"Wisdom save", sides:20, faces:[face] },
    ...overrides,
  };
}

function failedAbjureState() {
  const state = paladinState();
  const result = resolveAbjureFoes(TEST_PROFILE, state, {
    id:"abjure.failed",
    actorId:"hero",
    expectedRevision:0,
    paladinLevel:9,
    charismaModifier:3,
    spellSaveDc:15,
    targets:[target(4)],
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") throw new Error(result.error);
  return result.state;
}

test("Abjure Foes target cap is Charisma modifier with a minimum of one", () => {
  assert.equal(abjureFoesMaximumTargets(-2), 1);
  assert.equal(abjureFoesMaximumTargets(0), 1);
  assert.equal(abjureFoesMaximumTargets(1), 1);
  assert.equal(abjureFoesMaximumTargets(4), 4);
});

test("Abjure Foes spends Action and Channel Divinity and a failed save gains Frightened plus choose-one turn activity", () => {
  const state = paladinState();
  const result = resolveAbjureFoes(TEST_PROFILE, state, {
    id:"abjure.basic",
    actorId:"hero",
    expectedRevision:0,
    paladinLevel:9,
    charismaModifier:3,
    spellSaveDc:15,
    targets:[target(5)],
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.economy.action, false);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === PALADIN_CHANNEL_DIVINITY_RESOURCE_ID)?.current, 1);
  const effect = result.state.effects.find((entry) => entry.sourceId === ABJURE_FOES_SOURCE_ID && entry.tags.includes(ABJURE_FOES_TAG));
  assert.ok(effect);
  assert.equal(effect?.conditionId, "frightened");
  assert.deepEqual(effect?.expiry, { kind:"time", elapsedSeconds:60 });
  assert.deepEqual(effect?.termination, { targetTakesDamage:true });
  assert.deepEqual(effect?.turnActivity, {
    chooseOneOf:["movement","action","bonus-action"],
    selectedCategory:undefined,
  });
});

test("a successful Wisdom save receives no Abjure Foes effect", () => {
  const state = paladinState();
  const result = resolveAbjureFoes(TEST_PROFILE, state, {
    id:"abjure.success",
    actorId:"hero",
    expectedRevision:0,
    paladinLevel:9,
    charismaModifier:2,
    spellSaveDc:15,
    targets:[target(18)],
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.effects.some((effect) => effect.sourceId === ABJURE_FOES_SOURCE_ID), false);
});

test("while Abjured, movement commits the target's turn to movement and a later Action is rejected", () => {
  const abjured = failedAbjureState();
  const turn = resolvePendingResolution(TEST_PROFILE, abjured, {
    id:"abjure.turn-start",
    actorId:"goblin",
    sourceId:"test:turn-start",
    expectedRevision:abjured.revision,
    operations:[{ id:"begin", kind:"begin-turn", actorId:"goblin", round:2 }],
  });
  assert.equal(turn.status, "committed");
  if (turn.status !== "committed") return;
  const move = resolvePendingResolution(TEST_PROFILE, turn.state, {
    id:"abjure.move",
    actorId:"goblin",
    sourceId:"test:move",
    expectedRevision:turn.state.revision,
    operations:[{ id:"move", kind:"move", actorId:"goblin", distanceFeet:10 }],
  });
  assert.equal(move.status, "committed");
  if (move.status !== "committed") return;
  assert.equal(move.state.effects.find((effect) => effect.sourceId === ABJURE_FOES_SOURCE_ID)?.turnActivity?.selectedCategory, "movement");

  const action = resolvePendingResolution(TEST_PROFILE, move.state, {
    id:"abjure.action-reject",
    actorId:"goblin",
    sourceId:"test:action",
    expectedRevision:move.state.revision,
    operations:[{ id:"action", kind:"use-economy", actorId:"goblin", slot:"action" }],
  });
  assert.equal(action.status, "rejected");
  assert.equal(action.state, move.state);
  assert.match(action.status === "rejected" ? action.error : "", /already committed this turn to movement/);
});

test("damage ends Abjure Foes immediately, removing the choose-one restriction for the rest of that same turn", () => {
  const abjured = failedAbjureState();
  const turn = resolvePendingResolution(TEST_PROFILE, abjured, {
    id:"abjure.damage-turn-start",
    actorId:"goblin",
    sourceId:"test:turn-start",
    expectedRevision:abjured.revision,
    operations:[{ id:"begin", kind:"begin-turn", actorId:"goblin", round:2 }],
  });
  assert.equal(turn.status, "committed");
  if (turn.status !== "committed") return;
  const move = resolvePendingResolution(TEST_PROFILE, turn.state, {
    id:"abjure.damage-move",
    actorId:"goblin",
    sourceId:"test:move",
    expectedRevision:turn.state.revision,
    operations:[{ id:"move", kind:"move", actorId:"goblin", distanceFeet:5 }],
  });
  assert.equal(move.status, "committed");
  if (move.status !== "committed") return;

  const damage = resolvePendingResolution(TEST_PROFILE, move.state, {
    id:"abjure.damage-break",
    actorId:"hero",
    sourceId:"test:damage",
    expectedRevision:move.state.revision,
    operations:[{
      id:"damage",
      kind:"damage",
      targetId:"goblin",
      damageType:"force",
      amount:1,
      creatureKind:"monster",
    }],
  });
  assert.equal(damage.status, "committed");
  if (damage.status !== "committed") return;
  assert.equal(damage.state.effects.some((effect) => effect.sourceId === ABJURE_FOES_SOURCE_ID), false);

  const action = resolvePendingResolution(TEST_PROFILE, damage.state, {
    id:"abjure.action-after-damage",
    actorId:"goblin",
    sourceId:"test:action",
    expectedRevision:damage.state.revision,
    operations:[{ id:"action", kind:"use-economy", actorId:"goblin", slot:"action" }],
  });
  assert.equal(action.status, "committed");
});

test("Abjure Foes enforces target count, sight, range, level, and Channel Divinity atomically", () => {
  const tooManyState = paladinState();
  const tooMany = resolveAbjureFoes(TEST_PROFILE, tooManyState, {
    id:"abjure.too-many",
    actorId:"hero",
    expectedRevision:0,
    paladinLevel:9,
    charismaModifier:1,
    spellSaveDc:15,
    targets:[target(5),target(5,{ id:"second" })],
  });
  assert.equal(tooMany.status, "rejected");
  assert.equal(tooMany.state, tooManyState);

  const unseenState = paladinState();
  const unseen = resolveAbjureFoes(TEST_PROFILE, unseenState, {
    id:"abjure.unseen",
    actorId:"hero",
    expectedRevision:0,
    paladinLevel:9,
    charismaModifier:2,
    spellSaveDc:15,
    targets:[target(5,{ visible:false })],
  });
  assert.equal(unseen.status, "rejected");
  assert.equal(unseen.state, unseenState);

  const rangeState = paladinState();
  const range = resolveAbjureFoes(TEST_PROFILE, rangeState, {
    id:"abjure.range",
    actorId:"hero",
    expectedRevision:0,
    paladinLevel:9,
    charismaModifier:2,
    spellSaveDc:15,
    targets:[target(5,{ distanceFeet:65 })],
  });
  assert.equal(range.status, "rejected");
  assert.equal(range.state, rangeState);

  const lowState = paladinState();
  const low = resolveAbjureFoes(TEST_PROFILE, lowState, {
    id:"abjure.level",
    actorId:"hero",
    expectedRevision:0,
    paladinLevel:8,
    charismaModifier:2,
    spellSaveDc:15,
    targets:[target(5)],
  });
  assert.equal(low.status, "rejected");
  assert.equal(low.state, lowState);

  const depleted = paladinState();
  depleted.combatants.hero.resources.find((pool) => pool.id === PALADIN_CHANNEL_DIVINITY_RESOURCE_ID)!.current = 0;
  const noResource = resolveAbjureFoes(TEST_PROFILE, depleted, {
    id:"abjure.depleted",
    actorId:"hero",
    expectedRevision:0,
    paladinLevel:9,
    charismaModifier:2,
    spellSaveDc:15,
    targets:[target(5)],
  });
  assert.equal(noResource.status, "rejected");
  assert.equal(noResource.state, depleted);
  assert.equal(depleted.combatants.hero.economy.action, true);
});
