import assert from "node:assert/strict";
import test from "node:test";
import { resolveAttack, type AttackRequest } from "../../src/domain/attack";
import {
  clericDivineStrikeRider,
  druidPrimalStrikeDiceCount,
  druidPrimalStrikeRider,
} from "../../src/domain/classAttackRiders";
import { CLERIC_DIVINE_STRIKE_OPTION } from "../../src/domain/clericProgressionChoices";
import { DRUID_PRIMAL_STRIKE_OPTION } from "../../src/domain/druidProgressionChoices";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function beginHeroTurn() {
  const state = runtimeState();
  const begun = resolvePendingResolution(TEST_PROFILE, state, {
    id:"turn.begin",
    actorId:"hero",
    sourceId:"turn:test",
    expectedRevision:0,
    operations:[{ id:"turn.begin:op", kind:"begin-turn", actorId:"hero", round:1 }],
  });
  assert.equal(begun.status, "committed");
  if (begun.status !== "committed") throw new Error(begun.error);
  return begun.state;
}

function target(ac = 12) {
  return {
    id:"goblin",
    kind:"creature" as const,
    relation:"enemy" as const,
    distanceFeet:5,
    visible:true,
    cover:"none" as const,
    ac,
    creatureKind:"monster" as const,
    targetCanSeeAttacker:true,
  };
}

function baseRequest(stateRevision:number): AttackRequest {
  return {
    id:`attack.${stateRevision}`,
    actorId:"hero",
    expectedRevision:stateRevision,
    sourceId:"weapon:longsword",
    sourceKind:"weapon",
    target:target(),
    rangeFeet:5,
    attackDice:{ id:`attack-d20-${stateRevision}`, purpose:"weapon attack", sides:20, faces:[12] },
    attackModifierContributions:[{ source:"weapon:attack-modifier", value:5 }],
    baseDamage:{
      sourceId:"weapon:longsword",
      damageType:"slashing",
      dice:[{ source:"weapon:longsword", count:1, sides:8, faces:[6,6] }],
      flat:[{ source:"weapon:ability", value:3 }],
    },
  };
}

test("Cleric Divine Strike joins weapon damage in one compound hit and spends its own-turn gate only on a hit", () => {
  const state = beginHeroTurn();
  const rider = clericDivineStrikeRider({
    clericLevel:7,
    persistentFeatureOptionIds:[CLERIC_DIVINE_STRIKE_OPTION],
    sourceKind:"weapon",
    damageType:"radiant",
    faces:[5,5],
  });
  assert.ok(rider);
  const first = resolveAttack(TEST_PROFILE, state, { ...baseRequest(state.revision), riders:[rider!] });
  assert.equal(first.status, "committed");
  if (first.status !== "committed") return;
  const damage = first.results[`attack.${state.revision}:damage`] as {
    finalDamage:number;
    components:Array<{ damageType:string; finalDamage:number }>;
  };
  assert.equal(damage.finalDamage, 14, "longsword 6+3 plus Divine Strike 5");
  assert.deepEqual(damage.components.map((entry) => [entry.damageType,entry.finalDamage]), [["slashing",9],["radiant",5]]);
  assert.deepEqual(first.state.turnFeatureUsage, { actorId:"hero", featureIds:[CLERIC_DIVINE_STRIKE_OPTION] });

  const repeated = resolveAttack(TEST_PROFILE, first.state, {
    ...baseRequest(first.state.revision),
    id:"attack.repeat",
    expectedRevision:first.state.revision,
    riders:[rider!],
  });
  assert.equal(repeated.status, "rejected");
  assert.match(repeated.status === "rejected" ? repeated.error : "", /already used/);
  assert.equal(repeated.state.combatants.goblin.life.hp.current, first.state.combatants.goblin.life.hp.current, "rejected repeated rider must roll back the whole attempted attack");

  const nextTurn = resolvePendingResolution(TEST_PROFILE, first.state, {
    id:"turn.next",
    actorId:"hero",
    sourceId:"turn:test",
    expectedRevision:first.state.revision,
    operations:[{ id:"turn.next:op", kind:"begin-turn", actorId:"hero", round:2 }],
  });
  assert.equal(nextTurn.status, "committed");
  if (nextTurn.status !== "committed") return;
  assert.deepEqual(nextTurn.state.turnFeatureUsage, { actorId:"hero", featureIds:[] });
});

test("a missed attack neither deals compound damage nor spends the Divine Strike turn gate", () => {
  const state = beginHeroTurn();
  const rider = clericDivineStrikeRider({
    clericLevel:7,
    persistentFeatureOptionIds:[CLERIC_DIVINE_STRIKE_OPTION],
    sourceKind:"weapon",
    damageType:"necrotic",
    faces:[4,4],
  });
  const request = baseRequest(state.revision);
  request.attackDice = { id:"miss-d20", purpose:"weapon attack", sides:20, faces:[2] };
  request.target = target(20);
  request.riders = rider ? [rider] : [];
  const result = resolveAttack(TEST_PROFILE, state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.goblin.life.hp.current, 15);
  assert.deepEqual(result.state.turnFeatureUsage, { actorId:"hero", featureIds:[] });
  assert.deepEqual(result.results[`${request.id}:turn-feature:1`], { skipped:true });
  assert.deepEqual(result.results[`${request.id}:damage`], { skipped:true });
});

test("critical weapon hits double both base weapon dice and Divine Strike dice while flat damage stays single", () => {
  const state = beginHeroTurn();
  state.combatants.goblin.life.hp = { current:50, maximum:50, temporary:0 };
  const rider = clericDivineStrikeRider({
    clericLevel:7,
    persistentFeatureOptionIds:[CLERIC_DIVINE_STRIKE_OPTION],
    sourceKind:"weapon",
    damageType:"radiant",
    faces:[5,6],
  });
  const request = baseRequest(state.revision);
  request.attackDice = { id:"crit-d20", purpose:"weapon attack", sides:20, faces:[20] };
  request.baseDamage.dice[0].faces = [6,7];
  request.riders = rider ? [rider] : [];
  const result = resolveAttack(TEST_PROFILE, state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  const damage = result.results[`${request.id}:damage`] as { finalDamage:number };
  assert.equal(damage.finalDamage, 27, "weapon dice 13 + flat 3 + Divine Strike dice 11");
});

test("Divine Strike and Primal Strike exact scaling and attack-source eligibility use persistent stable option IDs", () => {
  assert.equal(druidPrimalStrikeDiceCount(7,[DRUID_PRIMAL_STRIKE_OPTION]),1);
  assert.equal(druidPrimalStrikeDiceCount(14,[DRUID_PRIMAL_STRIKE_OPTION]),1);
  assert.equal(druidPrimalStrikeDiceCount(15,[DRUID_PRIMAL_STRIKE_OPTION]),2);

  const cleric14 = clericDivineStrikeRider({
    clericLevel:14,
    persistentFeatureOptionIds:[CLERIC_DIVINE_STRIKE_OPTION],
    sourceKind:"weapon",
    damageType:"radiant",
    faces:[1,2,3,4],
  });
  assert.equal(cleric14?.dice[0].count,2);
  assert.throws(() => clericDivineStrikeRider({
    clericLevel:14,
    persistentFeatureOptionIds:[CLERIC_DIVINE_STRIKE_OPTION],
    sourceKind:"wild-shape",
    damageType:"radiant",
    faces:[1,2,3,4],
  }), /weapon/);

  const druid15 = druidPrimalStrikeRider({
    druidLevel:15,
    persistentFeatureOptionIds:[DRUID_PRIMAL_STRIKE_OPTION],
    sourceKind:"wild-shape",
    damageType:"thunder",
    faces:[2,3,4,5],
  });
  assert.equal(druid15?.dice[0].count,2);
  assert.equal(druid15?.oncePerOwnTurnFeatureId,DRUID_PRIMAL_STRIKE_OPTION);
});

test("compound class rider damage makes one Concentration check from the aggregate damage", () => {
  const state = beginHeroTurn();
  state.combatants.goblin.life.hp = { current:50, maximum:50, temporary:0 };
  state.combatants.goblin.damageDefenses = [{ source:"armor", kind:"resistance", damageType:"slashing" }];
  state.concentration.goblin = { actorId:"goblin", groupId:"concentration:goblin", sourceId:"spell:test" };
  const rider = clericDivineStrikeRider({
    clericLevel:7,
    persistentFeatureOptionIds:[CLERIC_DIVINE_STRIKE_OPTION],
    sourceKind:"weapon",
    damageType:"radiant",
    faces:[8,8],
  });
  const request = baseRequest(state.revision);
  request.baseDamage.dice[0].faces = [8,8];
  request.baseDamage.flat = [];
  request.riders = rider ? [rider] : [];
  request.concentrationCheck = {
    dice:{ id:"concentration-d20", purpose:"Concentration", sides:20, faces:[9] },
    modifierContributions:[],
  };
  const result = resolveAttack(TEST_PROFILE, state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  const damage = result.results[`${request.id}:damage`] as { finalDamage:number };
  assert.equal(damage.finalDamage,12, "8 slashing resisted to 4 plus 8 radiant");
  assert.equal(result.state.concentration.goblin, undefined, "aggregate damage 12 sets DC 10, so a total 9 fails exactly one Concentration check");
  const concentrationEntries = result.events
    .flatMap((event) => event.provenance)
    .filter((entry) => entry.source === "profile:dnd.srd-5.2.1/concentration");
  assert.equal(concentrationEntries.length,1);
});
