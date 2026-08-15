import assert from "node:assert/strict";
import test from "node:test";
import { DRUID_WILD_SHAPE_RESOURCE_ID } from "../../src/domain/coreClassResources";
import {
  DRUID_CIRCLE_LAND_SUBCLASS_ID,
  landsAidDiceCount,
  resolveLandsAid,
} from "../../src/domain/druidCircleLand";
import type { TargetFacts } from "../../src/domain/targeting";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function point(distanceFeet = 10):TargetFacts {
  return {
    id:"point:land-aid",
    kind:"point",
    relation:"neutral",
    distanceFeet,
    visible:true,
    cover:"none",
  };
}

function creature(id:"hero"|"goblin", relation:"self"|"ally"|"enemy", distanceFeet:number):TargetFacts {
  return {
    id,
    kind:"creature",
    relation,
    distanceFeet,
    visible:true,
    cover:"none",
  };
}

function stateWithWildShape(current = 2) {
  const state = runtimeState();
  state.combatants.hero.resources.push({
    id:DRUID_WILD_SHAPE_RESOURCE_ID,
    label:"Wild Shape",
    current,
    maximum:2,
    recovery:{ shortRest:1, longRest:"all" },
  });
  return state;
}

test("Land's Aid uses one Magic Action and Wild Shape use for failed-save damage plus independent healing", () => {
  const state = stateWithWildShape();
  state.combatants.hero.life.hp = { current:4, maximum:20, temporary:0 };
  const result = resolveLandsAid(TEST_PROFILE,state,{
    id:"land-aid.basic",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:3,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    spellSaveDc:14,
    point:point(),
    damageTargets:[{
      target:creature("goblin","enemy",15),
      distanceFromPointFeet:5,
      constitutionSaveModifier:0,
      saveDice:{ id:"land-aid-save", purpose:"Land's Aid Constitution save", sides:20, faces:[5] },
      creatureKind:"monster",
    }],
    healingTarget:{ target:creature("hero","self",0), distanceFromPointFeet:10 },
    damageFaces:[3,4],
    healingFaces:[5,6],
    useActionEconomy:true,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.goblin.life.hp.current,8,"failed save takes 7 necrotic damage");
  assert.equal(result.state.combatants.hero.life.hp.current,15,"healing roll restores 11 HP independently");
  assert.equal(result.state.combatants.hero.resources.find((resource) => resource.id === DRUID_WILD_SHAPE_RESOURCE_ID)?.current,1);
  assert.equal(result.state.combatants.hero.economy.action,false);
});

test("Land's Aid halves damage on a successful Constitution save and follows exact 3/10/14 dice scaling", () => {
  assert.equal(landsAidDiceCount(3),2);
  assert.equal(landsAidDiceCount(9),2);
  assert.equal(landsAidDiceCount(10),3);
  assert.equal(landsAidDiceCount(13),3);
  assert.equal(landsAidDiceCount(14),4);
  assert.equal(landsAidDiceCount(20),4);

  const state = stateWithWildShape();
  const result = resolveLandsAid(TEST_PROFILE,state,{
    id:"land-aid.save",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:10,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    spellSaveDc:14,
    point:point(),
    damageTargets:[{
      target:creature("goblin","enemy",15),
      distanceFromPointFeet:5,
      constitutionSaveModifier:0,
      saveDice:{ id:"land-aid-success", purpose:"Land's Aid Constitution save", sides:20, faces:[18] },
      creatureKind:"monster",
    }],
    damageFaces:[3,4,5],
    healingFaces:[],
    useActionEconomy:false,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.goblin.life.hp.current,9,"12 damage becomes 6 on a successful save");
});

test("Land's Aid rejects a point or creature outside authoritative geometry before spending Wild Shape", () => {
  const state = stateWithWildShape();
  const badPoint = resolveLandsAid(TEST_PROFILE,state,{
    id:"land-aid.point-reject",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:3,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    spellSaveDc:14,
    point:point(65),
    damageTargets:[],
    healingTarget:{ target:creature("hero","self",0), distanceFromPointFeet:5 },
    damageFaces:[],
    healingFaces:[2,2],
    useActionEconomy:true,
  });
  assert.equal(badPoint.status,"rejected");
  assert.match(badPoint.status === "rejected" ? badPoint.error : "",/within 60 feet/);
  assert.equal(badPoint.state.combatants.hero.resources.find((resource) => resource.id === DRUID_WILD_SHAPE_RESOURCE_ID)?.current,2);
  assert.equal(badPoint.state.combatants.hero.economy.action,true);

  const badCreature = resolveLandsAid(TEST_PROFILE,state,{
    id:"land-aid.sphere-reject",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:3,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    spellSaveDc:14,
    point:point(),
    damageTargets:[{
      target:creature("goblin","enemy",21),
      distanceFromPointFeet:11,
      constitutionSaveModifier:0,
      saveDice:{ id:"land-aid-outside", purpose:"Land's Aid Constitution save", sides:20, faces:[5] },
      creatureKind:"monster",
    }],
    damageFaces:[3,4],
    healingFaces:[],
    useActionEconomy:true,
  });
  assert.equal(badCreature.status,"rejected");
  assert.match(badCreature.status === "rejected" ? badCreature.error : "",/10-foot sphere/);
  assert.equal(badCreature.state.combatants.hero.resources.find((resource) => resource.id === DRUID_WILD_SHAPE_RESOURCE_ID)?.current,2);
});

test("Land's Aid forwards a target's fixed Concentration check to the damage lifecycle", () => {
  const state = stateWithWildShape();
  state.combatants.goblin.life.hp = { current:30, maximum:30, temporary:0 };
  state.concentration.goblin = { actorId:"goblin", groupId:"concentration:goblin", sourceId:"spell:test" };
  const result = resolveLandsAid(TEST_PROFILE,state,{
    id:"land-aid.concentration",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:14,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    spellSaveDc:18,
    point:point(),
    damageTargets:[{
      target:creature("goblin","enemy",15),
      distanceFromPointFeet:5,
      constitutionSaveModifier:0,
      saveDice:{ id:"land-aid-fail", purpose:"Land's Aid Constitution save", sides:20, faces:[5] },
      creatureKind:"monster",
      concentrationCheck:{
        dice:{ id:"land-aid-concentration", purpose:"Concentration", sides:20, faces:[8] },
        modifierContributions:[],
      },
    }],
    damageFaces:[6,6,6,6],
    healingFaces:[],
    useActionEconomy:false,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.goblin.life.hp.current,6);
  assert.equal(result.state.concentration.goblin,undefined,"24 damage sets Concentration DC 12; total 8 fails");
});
