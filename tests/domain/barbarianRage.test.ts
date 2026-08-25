import assert from "node:assert/strict";
import test from "node:test";
import { BARBARIAN_RAGE_RESOURCE_ID, BARBARIAN_RAGE_TAG } from "../../src/domain/barbarianBerserker";
import type { RulesRuntimeState } from "../../src/domain/combatState";
import type { RulesProfileLike } from "../../src/domain/profileEngine";
import { resolvePendingResolution } from "../../src/domain/resolution";
import type { ResolutionCommit } from "../../src/domain/resolutionTypes";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

interface RageLifecycleRequest {
  id:string;
  actorId:string;
  expectedRevision:number;
  barbarianLevel:number;
  wearingHeavyArmor:boolean;
}

type RageStartResolver = (
  profile:RulesProfileLike,
  state:RulesRuntimeState,
  request:RageLifecycleRequest,
) => ResolutionCommit;

type RageHeavyArmorResolver = (
  profile:RulesProfileLike,
  state:RulesRuntimeState,
  request:{ id:string; actorId:string; expectedRevision:number },
) => ResolutionCommit;

async function rageModule() {
  return await import("../../src/domain/barbarianBerserker") as unknown as Record<string,unknown>;
}

async function rageStartResolver() {
  const exports = await rageModule();
  const start = exports.resolveBarbarianRageStart;
  assert.equal(typeof start,"function","base Rage start resolver must exist");
  assert.equal(exports.resolveBarbarianRageEnd,undefined,"SRD 5.2.1 Rage has no voluntary end resolver");
  return start as RageStartResolver;
}

async function rageHeavyArmorResolver() {
  const exports = await rageModule();
  const resolver = exports.resolveBarbarianRageHeavyArmorEquipped;
  assert.equal(typeof resolver,"function","donning Heavy Armor must have an explicit forced Rage-end resolver");
  return resolver as RageHeavyArmorResolver;
}

function barbarianState(rageUses:number) {
  const state = runtimeState();
  state.combatants.hero.resources.push({
    id:BARBARIAN_RAGE_RESOURCE_ID,
    label:"격노",
    current:rageUses,
    maximum:2,
    recovery:{ shortRest:1, longRest:"all" },
  });
  return state;
}

function rageEffects(state:RulesRuntimeState) {
  return state.effects.filter((effect) => effect.targetId === "hero" && effect.tags.includes(BARBARIAN_RAGE_TAG));
}

async function activeRageState(level=1) {
  const start = await rageStartResolver();
  const state = barbarianState(2);
  const started = start(TEST_PROFILE,state,{
    id:`barbarian.rage.active.${level}`,
    actorId:"hero",
    expectedRevision:state.revision,
    barbarianLevel:level,
    wearingHeavyArmor:false,
  });
  assert.equal(started.status,"committed");
  if (started.status !== "committed") throw new Error(started.error);
  return started.state;
}

test("Barbarian Rage starts atomically and expires at the end of the Barbarian's next turn", async () => {
  const start = await rageStartResolver();
  const state = barbarianState(2);

  const started = start(TEST_PROFILE,state,{
    id:"barbarian.rage.start",
    actorId:"hero",
    expectedRevision:state.revision,
    barbarianLevel:1,
    wearingHeavyArmor:false,
  });
  assert.equal(started.status,"committed");
  if (started.status !== "committed") return;
  assert.equal(started.state.combatants.hero.economy.bonusAction,false);
  assert.equal(
    started.state.combatants.hero.resources.find((pool) => pool.id === BARBARIAN_RAGE_RESOURCE_ID)?.current,
    1,
  );
  assert.ok(rageEffects(started.state).length > 0,"starting Rage must create active Rage effects");
  for (const effect of rageEffects(started.state)) {
    assert.deepEqual(effect.expiry,{ kind:"turn-boundary", actorId:"hero", round:2, boundary:"end" });
    assert.equal(effect.termination?.targetBecomesIncapacitated,true);
  }

  const currentTurnEnd = resolvePendingResolution(TEST_PROFILE,started.state,{
    id:"barbarian.rage.current-turn-end",
    actorId:"hero",
    sourceId:"test:turn",
    expectedRevision:started.state.revision,
    operations:[{ id:"barbarian.rage.current-turn-end:end", kind:"end-turn", actorId:"hero", round:1 }],
  });
  assert.equal(currentTurnEnd.status,"committed");
  if (currentTurnEnd.status !== "committed") return;
  assert.ok(rageEffects(currentTurnEnd.state).length > 0,"Rage must survive the activation turn");

  const nextTurnEnd = resolvePendingResolution(TEST_PROFILE,currentTurnEnd.state,{
    id:"barbarian.rage.next-turn-end",
    actorId:"hero",
    sourceId:"test:turn",
    expectedRevision:currentTurnEnd.state.revision,
    operations:[{ id:"barbarian.rage.next-turn-end:end", kind:"end-turn", actorId:"hero", round:2 }],
  });
  assert.equal(nextTurnEnd.status,"committed");
  if (nextTurnEnd.status !== "committed") return;
  assert.equal(rageEffects(nextTurnEnd.state).length,0);
  assert.equal(
    nextTurnEnd.state.combatants.hero.resources.find((pool) => pool.id === BARBARIAN_RAGE_RESOURCE_ID)?.current,
    1,
    "natural Rage expiry must not refund the spent use",
  );
});

test("Barbarian Rage start rejects atomically when no Rage use remains or Heavy Armor is worn", async () => {
  const start = await rageStartResolver();
  const depleted = barbarianState(0);
  const noUse = start(TEST_PROFILE,depleted,{
    id:"barbarian.rage.depleted",
    actorId:"hero",
    expectedRevision:depleted.revision,
    barbarianLevel:1,
    wearingHeavyArmor:false,
  });
  assert.equal(noUse.status,"rejected");
  assert.equal(noUse.state,depleted);
  assert.equal(depleted.combatants.hero.economy.bonusAction,true);
  assert.equal(depleted.effects.length,0);

  const armored = barbarianState(2);
  const heavyArmor = start(TEST_PROFILE,armored,{
    id:"barbarian.rage.heavy-armor",
    actorId:"hero",
    expectedRevision:armored.revision,
    barbarianLevel:1,
    wearingHeavyArmor:true,
  });
  assert.equal(heavyArmor.status,"rejected");
  assert.equal(heavyArmor.state,armored);
  assert.equal(armored.combatants.hero.economy.bonusAction,true);
  assert.equal(armored.combatants.hero.resources.find((pool) => pool.id === BARBARIAN_RAGE_RESOURCE_ID)?.current,2);
  assert.equal(armored.effects.length,0);
});

test("starting Rage ends Concentration atomically", async () => {
  const state = barbarianState(2);
  const concentrating = resolvePendingResolution(TEST_PROFILE,state,{
    id:"barbarian.rage.concentration.setup",
    actorId:"hero",
    sourceId:"test:concentration",
    expectedRevision:state.revision,
    operations:[{
      id:"barbarian.rage.concentration.setup:start",
      kind:"start-concentration",
      actorId:"hero",
      groupId:"test:concentration:group",
      sourceId:"test:concentration",
    }],
  });
  assert.equal(concentrating.status,"committed");
  if (concentrating.status !== "committed") return;
  assert.ok(concentrating.state.concentration.hero);

  const start = await rageStartResolver();
  const result = start(TEST_PROFILE,concentrating.state,{
    id:"barbarian.rage.break-concentration",
    actorId:"hero",
    expectedRevision:concentrating.state.revision,
    barbarianLevel:1,
    wearingHeavyArmor:false,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.concentration.hero,undefined);
  assert.ok(rageEffects(result.state).length > 0);
});

test("Rage ends early when a level 1-14 Barbarian becomes Incapacitated", async () => {
  const active = await activeRageState(1);
  const result = resolvePendingResolution(TEST_PROFILE,active,{
    id:"barbarian.rage.incapacitated",
    actorId:"goblin",
    sourceId:"test:incapacitated",
    expectedRevision:active.revision,
    operations:[{
      id:"barbarian.rage.incapacitated:effect",
      kind:"apply-effect",
      effect:{
        id:"hero-incapacitated",
        sourceId:"test:incapacitated",
        sourceActorId:"goblin",
        targetId:"hero",
        kind:"condition",
        conditionId:"incapacitated",
        duration:{ kind:"rounds", amount:1, anchorActorId:"hero", boundary:"end" },
      },
    }],
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(rageEffects(result.state).length,0);
});

test("Persistent Rage at Barbarian 15 lasts ten minutes, survives mere Incapacitated, and ends on Unconscious", async () => {
  const persistent = await activeRageState(15);
  for (const effect of rageEffects(persistent)) {
    assert.deepEqual(effect.expiry,{ kind:"time", elapsedSeconds:600 });
    assert.equal(effect.termination?.targetBecomesIncapacitated,undefined);
    assert.equal(effect.termination?.targetBecomesUnconscious,true);
  }

  const incapacitated = resolvePendingResolution(TEST_PROFILE,persistent,{
    id:"barbarian.rage.persistent.incapacitated",
    actorId:"goblin",
    sourceId:"test:incapacitated",
    expectedRevision:persistent.revision,
    operations:[{
      id:"barbarian.rage.persistent.incapacitated:effect",
      kind:"apply-effect",
      effect:{
        id:"persistent-incapacitated",
        sourceId:"test:incapacitated",
        sourceActorId:"goblin",
        targetId:"hero",
        kind:"condition",
        conditionId:"incapacitated",
        duration:{ kind:"rounds", amount:1, anchorActorId:"hero", boundary:"end" },
      },
    }],
  });
  assert.equal(incapacitated.status,"committed");
  if (incapacitated.status !== "committed") return;
  assert.ok(rageEffects(incapacitated.state).length > 0,"Persistent Rage must survive Incapacitated without Unconscious");

  const unconscious = resolvePendingResolution(TEST_PROFILE,persistent,{
    id:"barbarian.rage.persistent.unconscious",
    actorId:"goblin",
    sourceId:"test:unconscious",
    expectedRevision:persistent.revision,
    operations:[{
      id:"barbarian.rage.persistent.unconscious:effect",
      kind:"apply-effect",
      effect:{
        id:"persistent-unconscious",
        sourceId:"test:unconscious",
        sourceActorId:"goblin",
        targetId:"hero",
        kind:"condition",
        conditionId:"unconscious",
        duration:{ kind:"rounds", amount:1, anchorActorId:"hero", boundary:"end" },
      },
    }],
  });
  assert.equal(unconscious.status,"committed");
  if (unconscious.status !== "committed") return;
  assert.equal(rageEffects(unconscious.state).length,0);
});

test("donning Heavy Armor forcibly ends active Rage without a voluntary end API", async () => {
  const active = await activeRageState(1);
  const forcedEnd = await rageHeavyArmorResolver();
  const result = forcedEnd(TEST_PROFILE,active,{
    id:"barbarian.rage.don-heavy-armor",
    actorId:"hero",
    expectedRevision:active.revision,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(rageEffects(result.state).length,0);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === BARBARIAN_RAGE_RESOURCE_ID)?.current,1);
});

test("active Rage resists Bludgeoning, Piercing, and Slashing damage through the generic damage lifecycle", async () => {
  for (const damageType of ["bludgeoning","piercing","slashing"] as const) {
    const active = await activeRageState();
    const result = resolvePendingResolution(TEST_PROFILE,active,{
      id:`barbarian.rage.damage.${damageType}`,
      actorId:"goblin",
      sourceId:"test:rage-damage",
      expectedRevision:active.revision,
      operations:[{
        id:`barbarian.rage.damage.${damageType}:damage`,
        kind:"damage",
        targetId:"hero",
        damageType,
        amount:9,
        creatureKind:"character",
      }],
    });
    assert.equal(result.status,"committed");
    if (result.status !== "committed") continue;
    assert.equal(result.state.combatants.hero.life.hp.current,16,`${damageType} 9 must be halved and rounded down to 4`);
  }

  const active = await activeRageState();
  const fire = resolvePendingResolution(TEST_PROFILE,active,{
    id:"barbarian.rage.damage.fire",
    actorId:"goblin",
    sourceId:"test:rage-damage",
    expectedRevision:active.revision,
    operations:[{
      id:"barbarian.rage.damage.fire:damage",
      kind:"damage",
      targetId:"hero",
      damageType:"fire",
      amount:9,
      creatureKind:"character",
    }],
  });
  assert.equal(fire.status,"committed");
  if (fire.status !== "committed") assert.fail(fire.error);
  assert.equal(fire.state.combatants.hero.life.hp.current,11,"Rage must not resist fire damage");
});

test("Rage Damage follows the exact Barbarian level breakpoints", async () => {
  const exports = await rageModule();
  const damageBonus = exports.barbarianRageDamageBonus;
  assert.equal(typeof damageBonus,"function","Rage Damage level helper must exist");
  const resolveBonus = damageBonus as (level:number) => number;
  assert.deepEqual(
    [1,8,9,15,16,20].map((level) => [level,resolveBonus(level)]),
    [[1,2],[8,2],[9,3],[15,3],[16,4],[20,4]],
  );
  assert.throws(() => resolveBonus(0),/Barbarian level 1-20/);
  assert.throws(() => resolveBonus(21),/Barbarian level 1-20/);
});
