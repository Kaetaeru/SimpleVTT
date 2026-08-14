import assert from "node:assert/strict";
import test from "node:test";
import { resolveDivineSpark, clericDivineSparkDiceCount, type DivineSparkTarget } from "../../src/domain/clericDivineSpark";
import { CLERIC_CHANNEL_DIVINITY_RESOURCE_ID } from "../../src/domain/coreClassResources";
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

function goblinTarget(overrides: Partial<DivineSparkTarget> = {}): DivineSparkTarget {
  return {
    id:"goblin",
    kind:"creature",
    relation:"enemy",
    distanceFeet:20,
    visible:true,
    cover:"none",
    constitutionSaveModifier:1,
    creatureKind:"monster",
    ...overrides,
  };
}

test("Divine Spark dice scale at Cleric levels 7, 13, and 18", () => {
  assert.equal(clericDivineSparkDiceCount(2), 1);
  assert.equal(clericDivineSparkDiceCount(6), 1);
  assert.equal(clericDivineSparkDiceCount(7), 2);
  assert.equal(clericDivineSparkDiceCount(12), 2);
  assert.equal(clericDivineSparkDiceCount(13), 3);
  assert.equal(clericDivineSparkDiceCount(17), 3);
  assert.equal(clericDivineSparkDiceCount(18), 4);
  assert.equal(clericDivineSparkDiceCount(20), 4);
});

test("Divine Spark healing spends one Action and Channel Divinity and restores the shared d8 + Wisdom total", () => {
  const state = clericState();
  state.combatants.goblin.life.hp.current = 5;
  const result = resolveDivineSpark(TEST_PROFILE, state, {
    id:"divine-spark.heal",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:2,
    wisdomModifier:3,
    spellSaveDc:13,
    target:goblinTarget(),
    effectFaces:[5],
    mode:"healing",
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.goblin.life.hp.current, 13);
  assert.equal(result.state.combatants.hero.economy.action, false);
  assert.equal(result.state.combatants.hero.economy.bonusAction, true);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === CLERIC_CHANNEL_DIVINITY_RESOURCE_ID)?.current, 1);
  assert.equal(state.combatants.goblin.life.hp.current, 5, "source state remains immutable");
});

test("Divine Spark damage deals the same roll on a failed Constitution save and half rounded down on success", () => {
  const failedState = clericState();
  const failed = resolveDivineSpark(TEST_PROFILE, failedState, {
    id:"divine-spark.failed-save",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:7,
    wisdomModifier:4,
    spellSaveDc:15,
    target:goblinTarget(),
    effectFaces:[3,4],
    mode:"damage",
    damageType:"radiant",
    saveDice:{ id:"divine-spark-save-fail", purpose:"Constitution save", sides:20, faces:[5] },
  });
  assert.equal(failed.status, "committed");
  if (failed.status !== "committed") return;
  assert.equal(failed.state.combatants.goblin.life.hp.current, 4, "3+4+4 = 11 radiant damage");

  const successState = clericState();
  const success = resolveDivineSpark(TEST_PROFILE, successState, {
    id:"divine-spark.success-save",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:7,
    wisdomModifier:4,
    spellSaveDc:15,
    target:goblinTarget(),
    effectFaces:[3,4],
    mode:"damage",
    damageType:"necrotic",
    saveDice:{ id:"divine-spark-save-success", purpose:"Constitution save", sides:20, faces:[18] },
  });
  assert.equal(success.status, "committed");
  if (success.status !== "committed") return;
  assert.equal(success.state.combatants.goblin.life.hp.current, 10, "11 / 2 rounds down to 5 damage");
});

test("Divine Spark requires another visible creature within 30 feet and rejects atomically before spending Action or Channel Divinity", () => {
  const selfState = clericState();
  const self = resolveDivineSpark(TEST_PROFILE, selfState, {
    id:"divine-spark.self",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:2,
    wisdomModifier:3,
    spellSaveDc:13,
    target:{
      id:"hero", kind:"creature", relation:"self", distanceFeet:0, visible:true, cover:"none",
      constitutionSaveModifier:2, creatureKind:"character",
    },
    effectFaces:[4],
    mode:"healing",
  });
  assert.equal(self.status, "rejected");
  assert.equal(self.state, selfState);
  assert.match(self.status === "rejected" ? self.error : "", /another creature/);

  const rangeState = clericState();
  const outOfRange = resolveDivineSpark(TEST_PROFILE, rangeState, {
    id:"divine-spark.range",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:2,
    wisdomModifier:3,
    spellSaveDc:13,
    target:goblinTarget({ distanceFeet:35 }),
    effectFaces:[4],
    mode:"healing",
  });
  assert.equal(outOfRange.status, "rejected");
  assert.equal(outOfRange.state, rangeState);
  assert.equal(rangeState.combatants.hero.economy.action, true);
  assert.equal(rangeState.combatants.hero.resources.find((pool) => pool.id === CLERIC_CHANNEL_DIVINITY_RESOURCE_ID)?.current, 2);
});

test("Divine Spark rolls back Action and effect if Channel Divinity is depleted", () => {
  const state = clericState();
  state.combatants.hero.resources.find((pool) => pool.id === CLERIC_CHANNEL_DIVINITY_RESOURCE_ID)!.current = 0;
  const result = resolveDivineSpark(TEST_PROFILE, state, {
    id:"divine-spark.depleted",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:2,
    wisdomModifier:3,
    spellSaveDc:13,
    target:goblinTarget(),
    effectFaces:[8],
    mode:"damage",
    damageType:"radiant",
    saveDice:{ id:"divine-spark-depleted-save", purpose:"Constitution save", sides:20, faces:[2] },
  });
  assert.equal(result.status, "rejected");
  assert.equal(result.state, state);
  assert.equal(state.combatants.hero.economy.action, true);
  assert.equal(state.combatants.goblin.life.hp.current, 15);
});
