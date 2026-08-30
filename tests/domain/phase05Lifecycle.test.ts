import assert from "node:assert/strict";
import test from "node:test";
import {
  createEffect,
  expireEffectsAtClock,
  expireEffectsForRest,
  removeEffectGroup,
} from "../../src/domain/effects";
import {
  SRD_521_CONDITIONS,
  activeConditionIds,
  conditionActionAvailability,
  conditionDamageDefenses,
  conditionD20Adjustments,
  conditionImmunities,
  conditionSenses,
  effectiveSpeed,
  exhaustionLevel,
  type ConditionId,
} from "../../src/domain/conditions";
import {
  concentrationCheckDc,
  resolveConcentrationDamageCheck,
  startConcentration,
} from "../../src/domain/concentration";
import { resolveTemporaryHpGain } from "../../src/domain/temporaryHp";
import { resolveLongRest, resolveShortRest } from "../../src/domain/rest";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

test("EffectInstance duration expires by time, turn boundary, rest, or concentration group", () => {
  const clock = { round:1, elapsedSeconds:0 };
  const timed = createEffect({
    id:"timed",
    sourceId:"spell:timed",
    targetId:"goblin",
    kind:"marker",
    duration:{ kind:"minutes", amount:1 },
  }, clock);
  assert.equal(expireEffectsAtClock([timed], { round:1, elapsedSeconds:59 }).expired.length, 0);
  assert.deepEqual(expireEffectsAtClock([timed], { round:1, elapsedSeconds:60 }).expired.map((item) => item.id), ["timed"]);

  const boundary = createEffect({
    id:"boundary",
    sourceId:"feature:boundary",
    targetId:"goblin",
    kind:"marker",
    duration:{ kind:"until-turn-boundary", actorId:"goblin", round:2, boundary:"end" },
  }, clock);
  assert.equal(expireEffectsAtClock([boundary], { round:2, elapsedSeconds:6, activeActorId:"goblin", phase:"start" }).expired.length, 0);
  assert.equal(expireEffectsAtClock([boundary], { round:2, elapsedSeconds:12, activeActorId:"goblin", phase:"end" }).expired.length, 1);

  const rest = createEffect({
    id:"rest",
    sourceId:"feature:rest",
    targetId:"hero",
    kind:"marker",
    duration:{ kind:"until-rest", rest:"short" },
  }, clock);
  assert.equal(expireEffectsForRest([rest], "short").expired.length, 1);

  const concentrated = createEffect({
    id:"conc-effect",
    sourceId:"spell:conc",
    sourceActorId:"hero",
    targetId:"goblin",
    kind:"marker",
    duration:{ kind:"concentration" },
    concentrationGroupId:"conc:1",
  }, clock);
  assert.deepEqual(removeEffectGroup([concentrated], "conc:1").expired.map((item) => item.id), ["conc-effect"]);
});

test("Concentration replacement and damage DC use deterministic 2024 lifecycle semantics", () => {
  const clock = { round:1, elapsedSeconds:0 };
  const oldEffect = createEffect({
    id:"old-effect",
    sourceId:"spell:old",
    sourceActorId:"hero",
    targetId:"goblin",
    kind:"marker",
    duration:{ kind:"concentration" },
    concentrationGroupId:"old-group",
  }, clock);
  const started = startConcentration(
    { actorId:"hero", groupId:"old-group", sourceId:"spell:old" },
    { actorId:"hero", groupId:"new-group", sourceId:"spell:new" },
    [oldEffect],
  );
  assert.equal(started.replaced?.groupId, "old-group");
  assert.deepEqual(started.expiredEffects.map((item) => item.id), ["old-effect"]);
  assert.equal(started.next.groupId, "new-group");

  assert.equal(concentrationCheckDc(1), 10);
  assert.equal(concentrationCheckDc(21), 10);
  assert.equal(concentrationCheckDc(50), 25);
  assert.equal(concentrationCheckDc(100), 30);

  const failed = resolveConcentrationDamageCheck(TEST_PROFILE, {
    damage:8,
    dice:{ id:"concentration", purpose:"concentration", sides:20, faces:[5] },
    modifierContributions:[{ source:"con", value:2 }],
  });
  assert.equal(failed.dc, 10);
  assert.equal(failed.maintained, false);
});

test("Temporary HP requires the non-stacking replacement choice and clears on Long Rest", () => {
  const hp = { current:10, maximum:20, temporary:5 };
  assert.throws(
    () => resolveTemporaryHpGain({ hp, amount:8, source:"spell:false-life" }),
    /does not stack/,
  );
  const keep = resolveTemporaryHpGain({ hp, amount:8, source:"spell:false-life", choice:"keep-existing" });
  assert.equal(keep.nextHp.temporary, 5);
  const take = resolveTemporaryHpGain({ hp, amount:8, source:"spell:false-life", choice:"take-new" });
  assert.equal(take.nextHp.temporary, 8);

  const state = runtimeState();
  state.combatants.hero.life.hp = { current:7, maximum:20, temporary:8 };
  const long = resolveLongRest("hero", {
    life:state.combatants.hero.life,
    resources:state.combatants.hero.resources,
    hitDice:state.combatants.hero.hitDice,
    effects:[],
  });
  assert.deepEqual(long.next.life.hp, { current:20, maximum:20, temporary:0 });
});

test("Short and Long Rest recover deterministic Hit Dice/resources and reduce Exhaustion", () => {
  const state = runtimeState();
  const hero = state.combatants.hero;
  hero.life.hp.current = 5;
  const short = resolveShortRest("hero", {
    life:hero.life,
    resources:hero.resources,
    hitDice:hero.hitDice,
    effects:[],
  }, [{ poolId:"hero-d8", faces:[6], constitutionModifier:2 }]);
  assert.equal(short.next.life.hp.current, 13);
  assert.equal(short.next.hitDice[0].current, 0);
  assert.equal(short.next.resources.find((pool) => pool.id === "short-resource")?.current, 2);

  const exhaustionOne = createEffect({
    id:"exhaustion-1", sourceId:"condition", targetId:"hero", kind:"condition", conditionId:"exhaustion", duration:{ kind:"permanent" },
  }, state.clock);
  const exhaustionTwo = createEffect({
    id:"exhaustion-2", sourceId:"condition", targetId:"hero", kind:"condition", conditionId:"exhaustion", duration:{ kind:"permanent" },
  }, state.clock);
  hero.life.hp = { current:3, maximum:20, temporary:4 };
  hero.hitDice[0].current = 0;
  hero.resources.find((pool) => pool.id === "spell-slot-1")!.current = 0;
  const long = resolveLongRest("hero", {
    life:hero.life,
    resources:hero.resources,
    hitDice:hero.hitDice,
    effects:[exhaustionOne, exhaustionTwo],
  });
  assert.deepEqual(long.next.life.hp, { current:20, maximum:20, temporary:0 });
  assert.equal(long.next.hitDice[0].current, 1);
  assert.equal(long.next.resources.find((pool) => pool.id === "spell-slot-1")?.current, 2);
  assert.equal(long.next.effects.filter((effect) => effect.conditionId === "exhaustion").length, 1);
});

test("Family M generic condition effects preserve SRD condition semantics across arbitrary identities", () => {
  const conditionIds=Object.keys(SRD_521_CONDITIONS) as ConditionId[];
  assert.deepEqual(conditionIds, [
    "blinded","charmed","deafened","exhaustion","frightened","grappled","incapacitated","invisible",
    "paralyzed","petrified","poisoned","prone","restrained","stunned","unconscious",
  ]);

  const build=(identity:string)=>conditionIds.map((conditionId,index)=>createEffect({
    id:`${identity}:effect:${index}`,
    sourceId:`${identity}:source:${index}`,
    sourceActorId:`${identity}:actor:${index}`,
    targetId:"hero",
    kind:"condition",
    conditionId,
    duration:{kind:"permanent"},
  }, {round:1,elapsedSeconds:0}));

  const alpha=build("external.module.alpha");
  const renamed=build("external.completely-renamed.module");
  assert.deepEqual(activeConditionIds(alpha),activeConditionIds(renamed));
  assert.deepEqual(alpha.map((effect)=>effect.conditionId),conditionIds);
  assert.deepEqual(renamed.map((effect)=>effect.conditionId),conditionIds);

  const only=(...ids:ConditionId[])=>alpha.filter((effect)=>effect.conditionId&&ids.includes(effect.conditionId));
  assert.deepEqual(conditionSenses(only("blinded","deafened")),{canSee:false,canHear:false,canSpeak:true});
  assert.deepEqual(conditionActionAvailability(only("stunned")),{action:false,bonusAction:false,reaction:false,canSpeak:false});
  assert.equal(effectiveSpeed(30,only("grappled")),0);
  assert.deepEqual(conditionDamageDefenses(only("petrified")),[{source:"condition:petrified",kind:"resistance",damageType:"*"}]);
  assert.deepEqual(conditionImmunities(only("petrified")),["poisoned"]);

  const exhaustion=Array.from({length:7},(_,index)=>createEffect({
    id:`exhaustion:${index}`,
    sourceId:`external.exhaustion:${index}`,
    targetId:"hero",
    kind:"condition",
    conditionId:"exhaustion",
    duration:{kind:"permanent"},
  }, {round:1,elapsedSeconds:0}));
  assert.equal(exhaustionLevel(exhaustion),6);
  assert.equal(effectiveSpeed(30,exhaustion),0);

  const blindedAttack=conditionD20Adjustments({
    actorId:"hero",
    targetId:"enemy",
    family:"attack-roll",
    actorConditions:only("blinded"),
    targetConditions:[],
  });
  assert.deepEqual(blindedAttack.rollStateContributions,[{source:"condition:blinded:actor",state:"disadvantage"}]);
});
