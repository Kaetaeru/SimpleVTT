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
import {
  HUNTER_ESCAPE_THE_HORDE_OPTION_ID,
  HUNTER_MULTIATTACK_DEFENSE_OPTION_ID,
  HUNTER_SUPERIOR_PREY_FEATURE_ID,
  hunterEscapeTheHordeContribution,
  hunterMultiattackDefenseContribution,
  hunterSuperiorDefenseResistance,
  replaceHunterDefensiveTactic,
  resolveHunterMultiattackDefenseTrigger,
  resolveHunterSuperiorDefense,
  resolveHunterSuperiorPrey,
} from "../../src/domain/rangerHunter";
import { RANGER_HUNTER_SUBCLASS_ID } from "../../src/domain/srdSubclassCatalog";
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

test("Hunter Defensive Tactics uses stable option IDs and supports Short/Long Rest replacement", () => {
  assert.equal(hunterEscapeTheHordeContribution({
    rangerLevel:7,
    subclassId:RANGER_HUNTER_SUBCLASS_ID,
    subclassFeatureIds:[HUNTER_ESCAPE_THE_HORDE_OPTION_ID],
    opportunityAttack:true,
  })?.state,"disadvantage");
  assert.equal(hunterEscapeTheHordeContribution({
    rangerLevel:7,
    subclassId:RANGER_HUNTER_SUBCLASS_ID,
    subclassFeatureIds:[HUNTER_ESCAPE_THE_HORDE_OPTION_ID],
    opportunityAttack:false,
  }),undefined);
  assert.deepEqual(
    replaceHunterDefensiveTactic([HUNTER_ESCAPE_THE_HORDE_OPTION_ID],HUNTER_MULTIATTACK_DEFENSE_OPTION_ID,"short"),
    [HUNTER_MULTIATTACK_DEFENSE_OPTION_ID],
  );
});

test("Hunter Multiattack Defense marks the creature that hit and penalizes only its later attacks until that turn ends", () => {
  const state = runtimeState();
  const triggered = resolveHunterMultiattackDefenseTrigger(TEST_PROFILE,state,{
    id:"hunter.multiattack-defense",
    rangerId:"hero",
    attackerId:"goblin",
    expectedRevision:state.revision,
    rangerLevel:7,
    subclassId:RANGER_HUNTER_SUBCLASS_ID,
    subclassFeatureIds:[HUNTER_MULTIATTACK_DEFENSE_OPTION_ID],
    attackHit:true,
    round:1,
  });
  assert.equal(triggered.status,"committed");
  if (triggered.status !== "committed") return;
  assert.equal(hunterMultiattackDefenseContribution({ state:triggered.state, rangerId:"hero", attackerId:"goblin" })?.state,"disadvantage");
  assert.equal(hunterMultiattackDefenseContribution({ state:triggered.state, rangerId:"hero", attackerId:"other" }),undefined);
  const ended = resolvePendingResolution(TEST_PROFILE,triggered.state,{
    id:"hunter.attacker-turn.end",
    actorId:"goblin",
    sourceId:"turn:test",
    expectedRevision:triggered.state.revision,
    operations:[{ id:"hunter.attacker-turn.end:op", kind:"end-turn", actorId:"goblin", round:1 }],
  });
  assert.equal(ended.status,"committed");
  if (ended.status !== "committed") return;
  assert.equal(hunterMultiattackDefenseContribution({ state:ended.state, rangerId:"hero", attackerId:"goblin" }),undefined);
});

test("Superior Hunter's Prey mirrors the already-rolled Hunter's Mark bonus damage once per Ranger turn to a visible creature within 30 feet", () => {
  const state = beginHeroTurn();
  state.combatants.goblin2 = structuredClone(state.combatants.goblin);
  state.combatants.goblin2.id = "goblin2";
  const first = resolveHunterSuperiorPrey(TEST_PROFILE,state,{
    id:"hunter.superior-prey",
    rangerId:"hero",
    expectedRevision:state.revision,
    rangerLevel:11,
    subclassId:RANGER_HUNTER_SUBCLASS_ID,
    primaryTargetId:"goblin",
    primaryTargetIsHuntersMarkTarget:true,
    huntersMarkBonusDamage:6,
    secondaryTarget:{ id:"goblin2", distanceFromPrimaryFeet:30, visibleByRanger:true, creatureKind:"monster" },
  });
  assert.equal(first.status,"committed");
  if (first.status !== "committed") return;
  assert.equal(first.state.combatants.goblin2.life.hp.current,9);
  assert.ok(first.state.turnFeatureUsage?.featureIds.includes(HUNTER_SUPERIOR_PREY_FEATURE_ID));
  const repeated = resolveHunterSuperiorPrey(TEST_PROFILE,first.state,{
    id:"hunter.superior-prey.repeat",
    rangerId:"hero",
    expectedRevision:first.state.revision,
    rangerLevel:11,
    subclassId:RANGER_HUNTER_SUBCLASS_ID,
    primaryTargetId:"goblin",
    primaryTargetIsHuntersMarkTarget:true,
    huntersMarkBonusDamage:6,
    secondaryTarget:{ id:"goblin2", distanceFromPrimaryFeet:30, visibleByRanger:true, creatureKind:"monster" },
  });
  assert.equal(repeated.status,"rejected");
  assert.equal(repeated.state.combatants.goblin2.life.hp.current,9);
});

test("Superior Hunter's Defense spends Reaction, resists the triggering damage, and exposes same-type resistance until the current turn ends", () => {
  const state = runtimeState();
  const hpBefore = state.combatants.hero.life.hp.current;
  const result = resolveHunterSuperiorDefense(TEST_PROFILE,state,{
    id:"hunter.superior-defense",
    rangerId:"hero",
    expectedRevision:state.revision,
    rangerLevel:15,
    subclassId:RANGER_HUNTER_SUBCLASS_ID,
    damageType:"slashing",
    incomingDamage:9,
    creatureKind:"character",
    currentTurnActorId:"goblin",
    round:1,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.economy.reaction,false);
  assert.equal(result.state.combatants.hero.life.hp.current,hpBefore - 4);
  assert.deepEqual(hunterSuperiorDefenseResistance(result.state,"hero","slashing"),{
    source:"dnd.srd521.feature.ranger.hunter.superior-hunters-defense",
    kind:"resistance",
    damageType:"slashing",
  });
  assert.equal(hunterSuperiorDefenseResistance(result.state,"hero","fire"),undefined);
  const ended = resolvePendingResolution(TEST_PROFILE,result.state,{
    id:"hunter.superior-defense.turn-end",
    actorId:"goblin",
    sourceId:"turn:test",
    expectedRevision:result.state.revision,
    operations:[{ id:"hunter.superior-defense.turn-end:op", kind:"end-turn", actorId:"goblin", round:1 }],
  });
  assert.equal(ended.status,"committed");
  if (ended.status !== "committed") return;
  assert.equal(hunterSuperiorDefenseResistance(ended.state,"hero","slashing"),undefined);
});
