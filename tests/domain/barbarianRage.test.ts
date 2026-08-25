import assert from "node:assert/strict";
import test from "node:test";
import { BARBARIAN_RAGE_RESOURCE_ID } from "../../src/domain/barbarianBerserker";
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
}

type RageLifecycleResolver = (
  profile:RulesProfileLike,
  state:RulesRuntimeState,
  request:RageLifecycleRequest,
) => ResolutionCommit;

async function rageModule() {
  return await import("../../src/domain/barbarianBerserker") as unknown as Record<string,unknown>;
}

async function rageResolvers() {
  const exports = await rageModule();
  const start = exports.resolveBarbarianRageStart;
  const end = exports.resolveBarbarianRageEnd;
  assert.equal(typeof start,"function","base Rage start resolver must exist");
  assert.equal(typeof end,"function","base Rage end resolver must exist");
  return {
    start:start as RageLifecycleResolver,
    end:end as RageLifecycleResolver,
  };
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

async function activeRageState(level=1) {
  const { start } = await rageResolvers();
  const state = barbarianState(2);
  const started = start(TEST_PROFILE,state,{
    id:`barbarian.rage.active.${level}`,
    actorId:"hero",
    expectedRevision:state.revision,
    barbarianLevel:level,
  });
  assert.equal(started.status,"committed");
  if (started.status !== "committed") throw new Error(started.error);
  return started.state;
}

test("Barbarian Rage start and end form one atomic resource/economy/effect lifecycle", async () => {
  const { start,end } = await rageResolvers();
  const state = barbarianState(2);
  const existingEffectIds = new Set(state.effects.map((effect) => effect.id));

  const started = start(TEST_PROFILE,state,{
    id:"barbarian.rage.start",
    actorId:"hero",
    expectedRevision:state.revision,
    barbarianLevel:1,
  });
  assert.equal(started.status,"committed");
  if (started.status !== "committed") return;
  assert.equal(started.state.combatants.hero.economy.bonusAction,false);
  assert.equal(
    started.state.combatants.hero.resources.find((pool) => pool.id === BARBARIAN_RAGE_RESOURCE_ID)?.current,
    1,
  );
  const createdRageEffects = started.state.effects.filter((effect) =>
    effect.targetId === "hero" && !existingEffectIds.has(effect.id),
  );
  assert.ok(createdRageEffects.length > 0,"starting Rage must create an active self effect");

  const ended = end(TEST_PROFILE,started.state,{
    id:"barbarian.rage.end",
    actorId:"hero",
    expectedRevision:started.state.revision,
    barbarianLevel:1,
  });
  assert.equal(ended.status,"committed");
  if (ended.status !== "committed") return;
  const createdIds = new Set(createdRageEffects.map((effect) => effect.id));
  assert.equal(ended.state.effects.some((effect) => createdIds.has(effect.id)),false);
  assert.equal(
    ended.state.combatants.hero.resources.find((pool) => pool.id === BARBARIAN_RAGE_RESOURCE_ID)?.current,
    1,
    "ending Rage must not refund the spent use",
  );
});

test("Barbarian Rage start rejects atomically when no Rage use remains", async () => {
  const { start } = await rageResolvers();
  const state = barbarianState(0);

  const result = start(TEST_PROFILE,state,{
    id:"barbarian.rage.depleted",
    actorId:"hero",
    expectedRevision:state.revision,
    barbarianLevel:1,
  });
  assert.equal(result.status,"rejected");
  assert.equal(result.state,state);
  assert.equal(state.combatants.hero.economy.bonusAction,true);
  assert.equal(
    state.combatants.hero.resources.find((pool) => pool.id === BARBARIAN_RAGE_RESOURCE_ID)?.current,
    0,
  );
  assert.equal(state.effects.length,0);
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
