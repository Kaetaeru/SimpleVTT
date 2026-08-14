import assert from "node:assert/strict";
import test from "node:test";
import { DRUID_WILD_SHAPE_RESOURCE_ID } from "../../src/domain/coreClassResources";
import { DRUID_CIRCLE_LAND_SUBCLASS_ID } from "../../src/domain/druidCircleLand";
import {
  naturesSanctuaryBenefits,
  resolveNaturesSanctuaryActivation,
  resolveNaturesSanctuaryMove,
} from "../../src/domain/druidCircleLandSanctuary";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function point(id:string,distanceFeet:number,onGround=true) {
  return {
    id,
    kind:"point" as const,
    relation:"neutral" as const,
    distanceFeet,
    visible:true,
    cover:"none" as const,
    onGround,
  };
}

function stateWithWildShape() {
  const state = runtimeState();
  state.combatants.hero.resources.push({
    id:DRUID_WILD_SHAPE_RESOURCE_ID,
    label:"Wild Shape",
    current:2,
    maximum:2,
    recovery:{ shortRest:1, longRest:"all" },
  });
  return state;
}

test("Nature's Sanctuary activation spends Magic Action and Wild Shape and creates a one-minute source-bound zone", () => {
  const state = stateWithWildShape();
  state.clock.elapsedSeconds = 100;
  const result = resolveNaturesSanctuaryActivation(TEST_PROFILE,state,{
    id:"sanctuary.activate",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:14,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    landType:"arid",
    center:point("point:a",90),
    useActionEconomy:true,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === DRUID_WILD_SHAPE_RESOURCE_ID)?.current,1);
  assert.equal(result.state.combatants.hero.economy.action,false);
  const effect = result.state.effects.find((entry) => entry.id === "sanctuary.activate:zone");
  assert.ok(effect);
  assert.deepEqual(effect?.expiry,{ kind:"time", elapsedSeconds:160 });
  assert.equal(effect?.metadata?.centerPointId,"point:a");
  assert.equal(effect?.metadata?.cubeSizeFeet,15);
  assert.deepEqual(effect?.termination,{ sourceBecomesIncapacitated:true, sourceDies:true });
});

test("moving Nature's Sanctuary uses a Bonus Action, obeys both movement/range limits, and preserves the original expiry", () => {
  const state = stateWithWildShape();
  state.clock.elapsedSeconds = 10;
  const activated = resolveNaturesSanctuaryActivation(TEST_PROFILE,state,{
    id:"sanctuary.move-base",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:14,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    landType:"polar",
    center:point("point:start",40),
    useActionEconomy:false,
  });
  assert.equal(activated.status,"committed");
  if (activated.status !== "committed") return;
  const effectId = "sanctuary.move-base:zone";
  const originalExpiry = structuredClone(activated.state.effects.find((entry) => entry.id === effectId)?.expiry);
  const moved = resolveNaturesSanctuaryMove(TEST_PROFILE,activated.state,{
    id:"sanctuary.move",
    actorId:"hero",
    expectedRevision:activated.state.revision,
    druidLevel:14,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    effectId,
    destination:point("point:end",100),
    movementFeet:60,
    useActionEconomy:true,
  });
  assert.equal(moved.status,"committed");
  if (moved.status !== "committed") return;
  const effect = moved.state.effects.find((entry) => entry.id === effectId);
  assert.deepEqual(effect?.expiry,originalExpiry,"moving the zone must not restart its one-minute duration");
  assert.equal(effect?.metadata?.centerPointId,"point:end");
  assert.equal(effect?.metadata?.centerDistanceFromSourceFeet,100);
  assert.equal(moved.state.combatants.hero.economy.bonusAction,false);
  const updateChange = moved.events.flatMap((event) => event.stateChanges)
    .find((change) => change.kind === "effect" && change.effectId === effectId && change.operation === "updated");
  assert.ok(updateChange);

  const tooFarMove = resolveNaturesSanctuaryMove(TEST_PROFILE,activated.state,{
    id:"sanctuary.move-too-far",
    actorId:"hero",
    expectedRevision:activated.state.revision,
    druidLevel:14,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    effectId,
    destination:point("point:bad",90),
    movementFeet:61,
    useActionEconomy:true,
  });
  assert.equal(tooFarMove.status,"rejected");
  assert.match(tooFarMove.status === "rejected" ? tooFarMove.error : "",/at most 60 feet/);
  assert.equal(tooFarMove.state.combatants.hero.economy.bonusAction,true);

  const outOfRange = resolveNaturesSanctuaryMove(TEST_PROFILE,activated.state,{
    id:"sanctuary.move-out-of-range",
    actorId:"hero",
    expectedRevision:activated.state.revision,
    druidLevel:14,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    effectId,
    destination:point("point:bad-range",121),
    movementFeet:20,
    useActionEconomy:true,
  });
  assert.equal(outOfRange.status,"rejected");
  assert.match(outOfRange.status === "rejected" ? outOfRange.error : "",/within 120 feet/);
});

test("Nature's Sanctuary grants Half Cover to self/allies and the current Nature's Ward resistance only to allies", () => {
  const state = stateWithWildShape();
  const activated = resolveNaturesSanctuaryActivation(TEST_PROFILE,state,{
    id:"sanctuary.benefits",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:14,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    landType:"temperate",
    center:point("point:benefits",30),
    useActionEconomy:false,
  });
  assert.equal(activated.status,"committed");
  if (activated.status !== "committed") return;
  const effectId = "sanctuary.benefits:zone";
  assert.deepEqual(naturesSanctuaryBenefits(activated.state,{
    effectId,targetId:"hero",relationToDruid:"self",insideCube:true,
  }),{ active:true, halfCover:true, grantedResistance:undefined });
  assert.deepEqual(naturesSanctuaryBenefits(activated.state,{
    effectId,targetId:"goblin",relationToDruid:"ally",insideCube:true,
  }),{ active:true, halfCover:true, grantedResistance:"lightning" });
  assert.deepEqual(naturesSanctuaryBenefits(activated.state,{
    effectId,targetId:"goblin",relationToDruid:"enemy",insideCube:true,
  }),{ active:true, halfCover:false });
  assert.deepEqual(naturesSanctuaryBenefits(activated.state,{
    effectId,targetId:"goblin",relationToDruid:"ally",insideCube:false,
  }),{ active:true, halfCover:false });
});

test("Nature's Sanctuary ends immediately when its Druid source becomes Incapacitated", () => {
  const state = stateWithWildShape();
  const activated = resolveNaturesSanctuaryActivation(TEST_PROFILE,state,{
    id:"sanctuary.termination",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:14,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    landType:"tropical",
    center:point("point:termination",30),
    useActionEconomy:false,
  });
  assert.equal(activated.status,"committed");
  if (activated.status !== "committed") return;
  const effectId = "sanctuary.termination:zone";
  const incapacitated = resolvePendingResolution(TEST_PROFILE,activated.state,{
    id:"sanctuary.incapacitate-source",
    actorId:"goblin",
    sourceId:"effect:test-incapacitated",
    expectedRevision:activated.state.revision,
    operations:[{
      id:"sanctuary.incapacitate-source:effect",
      kind:"apply-effect",
      effect:{
        id:"effect:hero-incapacitated",
        sourceId:"effect:test-incapacitated",
        sourceActorId:"goblin",
        targetId:"hero",
        kind:"condition",
        conditionId:"incapacitated",
        duration:{ kind:"minutes", amount:1 },
      },
    }],
  });
  assert.equal(incapacitated.status,"committed");
  if (incapacitated.status !== "committed") return;
  assert.ok(!incapacitated.state.effects.some((effect) => effect.id === effectId));
  assert.deepEqual(naturesSanctuaryBenefits(incapacitated.state,{
    effectId,targetId:"goblin",relationToDruid:"ally",insideCube:true,
  }),{ active:false, halfCover:false });
});
