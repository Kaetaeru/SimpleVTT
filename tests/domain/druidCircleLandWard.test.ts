import assert from "node:assert/strict";
import test from "node:test";
import { applyNaturesWard, naturesWardResistance } from "../../src/domain/druidCircleLandWard";
import { DRUID_CIRCLE_LAND_SUBCLASS_ID } from "../../src/domain/druidCircleLand";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

test("Nature's Ward derives the exact resistance from the current land and grants Poisoned immunity", () => {
  assert.equal(naturesWardResistance(10,DRUID_CIRCLE_LAND_SUBCLASS_ID,"arid"),"fire");
  assert.equal(naturesWardResistance(10,DRUID_CIRCLE_LAND_SUBCLASS_ID,"polar"),"cold");
  assert.equal(naturesWardResistance(10,DRUID_CIRCLE_LAND_SUBCLASS_ID,"temperate"),"lightning");
  assert.equal(naturesWardResistance(10,DRUID_CIRCLE_LAND_SUBCLASS_ID,"tropical"),"poison");

  const state = runtimeState();
  state.combatants.hero = applyNaturesWard(state.combatants.hero,10,DRUID_CIRCLE_LAND_SUBCLASS_ID,"arid");
  assert.ok(state.combatants.hero.conditionImmunities?.includes("poisoned"));
  assert.deepEqual(state.combatants.hero.damageDefenses?.filter((entry) => entry.source.includes("natures-ward")),[
    {
      source:"feature:druid.circle-of-the-land.natures-ward:arid",
      kind:"resistance",
      damageType:"fire",
    },
  ]);
});

test("Nature's Ward replacement follows a changed land without retaining the old resistance", () => {
  const state = runtimeState();
  state.combatants.hero.damageDefenses = [{ source:"species:test", kind:"resistance", damageType:"acid" }];
  let warded = applyNaturesWard(state.combatants.hero,10,DRUID_CIRCLE_LAND_SUBCLASS_ID,"arid");
  warded = applyNaturesWard(warded,10,DRUID_CIRCLE_LAND_SUBCLASS_ID,"polar");
  assert.ok(warded.damageDefenses?.some((entry) => entry.source === "species:test" && entry.damageType === "acid"));
  assert.ok(!warded.damageDefenses?.some((entry) => entry.source.endsWith(":arid")));
  assert.ok(warded.damageDefenses?.some((entry) => entry.source.endsWith(":polar") && entry.damageType === "cold"));
});

test("Nature's Ward Poisoned immunity is enforced by the normal apply-effect operation", () => {
  const state = runtimeState();
  state.combatants.hero = applyNaturesWard(state.combatants.hero,10,DRUID_CIRCLE_LAND_SUBCLASS_ID,"tropical");
  const result = resolvePendingResolution(TEST_PROFILE,state,{
    id:"natures-ward.poisoned",
    actorId:"goblin",
    sourceId:"effect:test-poison",
    expectedRevision:0,
    operations:[{
      id:"natures-ward.poisoned:apply",
      kind:"apply-effect",
      effect:{
        id:"effect:poisoned",
        sourceId:"effect:test-poison",
        sourceActorId:"goblin",
        targetId:"hero",
        kind:"condition",
        conditionId:"poisoned",
        duration:{ kind:"minutes", amount:1 },
      },
    }],
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  const applied = result.results["natures-ward.poisoned:apply"] as { applied:boolean; immune:boolean };
  assert.deepEqual({ applied:applied.applied, immune:applied.immune },{ applied:false, immune:true });
  assert.ok(!result.state.effects.some((effect) => effect.id === "effect:poisoned"));
});

test("Nature's Ward resistance is enforced by the normal damage lifecycle", () => {
  const state = runtimeState();
  state.combatants.hero = applyNaturesWard(state.combatants.hero,10,DRUID_CIRCLE_LAND_SUBCLASS_ID,"arid");
  const result = resolvePendingResolution(TEST_PROFILE,state,{
    id:"natures-ward.fire",
    actorId:"goblin",
    sourceId:"damage:test-fire",
    expectedRevision:0,
    operations:[{
      id:"natures-ward.fire:damage",
      kind:"damage",
      targetId:"hero",
      damageType:"fire",
      amount:10,
      creatureKind:"character",
    }],
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.life.hp.current,15,"10 fire damage is halved to 5 by Arid Nature's Ward");
  const damage = result.results["natures-ward.fire:damage"] as { finalDamage:number };
  assert.equal(damage.finalDamage,5);
});
