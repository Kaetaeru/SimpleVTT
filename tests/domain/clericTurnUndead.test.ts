import assert from "node:assert/strict";
import test from "node:test";
import { CLERIC_CHANNEL_DIVINITY_RESOURCE_ID } from "../../src/domain/coreClassResources";
import {
  TURN_UNDEAD_SOURCE_ID,
  resolveTurnUndead,
  searUndeadDiceCount,
  turnUndeadMovementDirective,
  type TurnUndeadTarget,
} from "../../src/domain/clericTurnUndead";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function clericState() {
  const state = runtimeState();
  state.combatants.hero.resources.push({
    id:CLERIC_CHANNEL_DIVINITY_RESOURCE_ID,
    label:"채널 디비니티",
    current:2,
    maximum:3,
    recovery:{ shortRest:1, longRest:"all" },
  });
  return state;
}

function undeadTarget(face: number, overrides: Partial<TurnUndeadTarget> = {}): TurnUndeadTarget {
  return {
    id:"goblin",
    kind:"creature",
    relation:"enemy",
    distanceFeet:20,
    visible:true,
    cover:"none",
    creatureType:"undead",
    wisdomSaveModifier:1,
    creatureKind:"monster",
    saveDice:{ id:`turn-undead-save-${face}`, purpose:"Wisdom save", sides:20, faces:[face] },
    ...overrides,
  };
}

function failedTurnState() {
  const state = clericState();
  const result = resolveTurnUndead(TEST_PROFILE, state, {
    id:"turn-undead.failed",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:2,
    wisdomModifier:3,
    spellSaveDc:13,
    targets:[undeadTarget(5)],
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") throw new Error(result.error);
  return result.state;
}

test("Turn Undead spends one Action and Channel Divinity and gives a failed target Frightened plus Incapacitated for one minute", () => {
  const state = clericState();
  const result = resolveTurnUndead(TEST_PROFILE, state, {
    id:"turn-undead.basic",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:2,
    wisdomModifier:3,
    spellSaveDc:13,
    targets:[undeadTarget(5)],
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.economy.action, false);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === CLERIC_CHANNEL_DIVINITY_RESOURCE_ID)?.current, 1);
  const turned = result.state.effects.filter((effect) => effect.targetId === "goblin" && effect.sourceId === TURN_UNDEAD_SOURCE_ID);
  assert.deepEqual(new Set(turned.map((effect) => effect.conditionId)), new Set(["frightened","incapacitated"]));
  assert.ok(turned.every((effect) => effect.expiry.kind === "time" && effect.expiry.elapsedSeconds === 60));
  assert.ok(turned.every((effect) => effect.termination?.targetTakesDamage && effect.termination?.sourceBecomesIncapacitated && effect.termination?.sourceDies));
  assert.deepEqual(turnUndeadMovementDirective(result.state, "goblin"), {
    active:true,
    sourceActorIds:["hero"],
    mustMoveAsFarFromSourcesAsPossible:true,
  });
});

test("a successful Wisdom save receives no Turn Undead conditions", () => {
  const state = clericState();
  const result = resolveTurnUndead(TEST_PROFILE, state, {
    id:"turn-undead.success",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:2,
    wisdomModifier:3,
    spellSaveDc:13,
    targets:[undeadTarget(18)],
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.effects.some((effect) => effect.sourceId === TURN_UNDEAD_SOURCE_ID), false);
  assert.equal(turnUndeadMovementDirective(result.state, "goblin").active, false);
});

test("Turn Undead ends on the target when it later takes positive damage", () => {
  const turned = failedTurnState();
  const result = resolvePendingResolution(TEST_PROFILE, turned, {
    id:"turn-undead.break-on-damage",
    actorId:"hero",
    sourceId:"test:damage",
    expectedRevision:turned.revision,
    operations:[{
      id:"damage-turned",
      kind:"damage",
      targetId:"goblin",
      damageType:"force",
      amount:1,
      creatureKind:"monster",
    }],
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.effects.some((effect) => effect.sourceId === TURN_UNDEAD_SOURCE_ID), false);
});

test("Turn Undead ends on all affected creatures when the Cleric becomes Incapacitated", () => {
  const turned = failedTurnState();
  const result = resolvePendingResolution(TEST_PROFILE, turned, {
    id:"turn-undead.source-incapacitated",
    actorId:"goblin",
    sourceId:"test:stun-cleric",
    expectedRevision:turned.revision,
    operations:[{
      id:"stun-cleric",
      kind:"apply-effect",
      effect:{
        id:"cleric-stunned",
        sourceId:"test:stun-cleric",
        sourceActorId:"goblin",
        targetId:"hero",
        kind:"condition",
        conditionId:"stunned",
        duration:{ kind:"rounds", amount:1, anchorActorId:"hero", boundary:"end" },
      },
    }],
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.effects.some((effect) => effect.sourceId === TURN_UNDEAD_SOURCE_ID), false);
});

test("Sear Undead uses one shared Wisdom-modifier d8 roll for every failed target and that damage does not end Turn Undead", () => {
  assert.equal(searUndeadDiceCount(-1), 1);
  assert.equal(searUndeadDiceCount(0), 1);
  assert.equal(searUndeadDiceCount(3), 3);
  const state = clericState();
  state.combatants.skeleton = {
    ...structuredClone(state.combatants.goblin),
    id:"skeleton",
    life:{
      ...structuredClone(state.combatants.goblin.life),
      hp:{ current:15, maximum:15, temporary:0 },
    },
  };
  const result = resolveTurnUndead(TEST_PROFILE, state, {
    id:"turn-undead.sear",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:5,
    wisdomModifier:3,
    spellSaveDc:14,
    targets:[
      undeadTarget(4),
      undeadTarget(6, {
        id:"skeleton",
        saveDice:{ id:"turn-undead-save-skeleton", purpose:"Wisdom save", sides:20, faces:[6] },
      }),
    ],
    searUndead:{ effectFaces:[2,4,6] },
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.goblin.life.hp.current, 3);
  assert.equal(result.state.combatants.skeleton.life.hp.current, 3);
  assert.equal(result.state.effects.filter((effect) => effect.sourceId === TURN_UNDEAD_SOURCE_ID).length, 4, "Sear damage happens before the turned effects exist, so it does not end them");
  const searRoll = result.results["turn-undead.sear:sear-roll"] as { total:number };
  assert.equal(searRoll.total, 12);
});

test("Turn Undead rejects a non-Undead target, out-of-range target, depleted Channel Divinity, or early Sear Undead atomically", () => {
  const wrongType = clericState();
  const nonUndead = resolveTurnUndead(TEST_PROFILE, wrongType, {
    id:"turn-undead.not-undead",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:2,
    wisdomModifier:3,
    spellSaveDc:13,
    targets:[undeadTarget(5, { creatureType:"beast" })],
  });
  assert.equal(nonUndead.status, "rejected");
  assert.equal(nonUndead.state, wrongType);
  assert.equal(wrongType.combatants.hero.economy.action, true);

  const rangeState = clericState();
  const outOfRange = resolveTurnUndead(TEST_PROFILE, rangeState, {
    id:"turn-undead.range",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:2,
    wisdomModifier:3,
    spellSaveDc:13,
    targets:[undeadTarget(5, { distanceFeet:35 })],
  });
  assert.equal(outOfRange.status, "rejected");
  assert.equal(outOfRange.state, rangeState);

  const depleted = clericState();
  depleted.combatants.hero.resources.find((pool) => pool.id === CLERIC_CHANNEL_DIVINITY_RESOURCE_ID)!.current = 0;
  const noResource = resolveTurnUndead(TEST_PROFILE, depleted, {
    id:"turn-undead.depleted",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:2,
    wisdomModifier:3,
    spellSaveDc:13,
    targets:[undeadTarget(5)],
  });
  assert.equal(noResource.status, "rejected");
  assert.equal(noResource.state, depleted);
  assert.equal(depleted.combatants.hero.economy.action, true);

  const earlySearState = clericState();
  const earlySear = resolveTurnUndead(TEST_PROFILE, earlySearState, {
    id:"turn-undead.early-sear",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:4,
    wisdomModifier:3,
    spellSaveDc:13,
    targets:[undeadTarget(5)],
    searUndead:{ effectFaces:[1,2,3] },
  });
  assert.equal(earlySear.status, "rejected");
  assert.equal(earlySear.state, earlySearState);
  assert.match(earlySear.status === "rejected" ? earlySear.error : "", /requires Cleric level 5/);
});
