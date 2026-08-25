import assert from "node:assert/strict";
import test from "node:test";
import { DRUID_WILD_SHAPE_RESOURCE_ID } from "../../src/domain/coreClassResources";
import {
  DRUID_WILD_SHAPE_TAG,
  druidWildShapeFormLimits,
  resolveDruidWildShapeEnd,
  resolveDruidWildShapeStart,
} from "../../src/domain/druidWildShape";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function druidState() {
  const state = runtimeState();
  state.combatants.hero.resources.push({
    id:DRUID_WILD_SHAPE_RESOURCE_ID,
    label:"야생 변신",
    current:3,
    maximum:3,
    recovery:{ shortRest:1, longRest:"all" },
  });
  return state;
}

const wolf = {
  id:"dnd.srd521.beast.wolf",
  name:"늑대",
  challengeRating:0.25,
  hasFlySpeed:false,
  armorClass:12,
  speedFeet:40,
};

const blackBear = {
  id:"dnd.srd521.beast.black-bear",
  name:"흑곰",
  challengeRating:0.5,
  hasFlySpeed:false,
  armorClass:11,
  speedFeet:30,
};

test("Wild Shape starts atomically with one use, Bonus Action, Druid-level temporary HP, and canonical duration", () => {
  const state = druidState();
  const result = resolveDruidWildShapeStart(TEST_PROFILE,state,{
    id:"wild-shape.start",
    actorId:"hero",
    expectedRevision:state.revision,
    druidLevel:2,
    form:wolf,
  });
  assert.equal(result.status,"committed");
  if (result.status!=="committed") return;
  assert.equal(result.state.combatants.hero.resources.find((pool)=>pool.id===DRUID_WILD_SHAPE_RESOURCE_ID)?.current,2);
  assert.equal(result.state.combatants.hero.economy.bonusAction,false);
  assert.equal(result.state.combatants.hero.life.hp.temporary,2);
  const marker=result.state.effects.find((effect)=>effect.targetId==="hero"&&effect.tags.includes(DRUID_WILD_SHAPE_TAG));
  assert.ok(marker);
  assert.equal(marker?.expiry.kind,"time");
  if(marker?.expiry.kind==="time") assert.equal(marker.expiry.elapsedSeconds,state.clock.elapsedSeconds+3600);
  assert.equal(marker?.termination?.targetBecomesIncapacitated,true);
  assert.equal(marker?.termination?.targetDies,true);
  assert.equal(marker?.metadata?.formId,wolf.id);
  assert.equal(marker?.metadata?.formName,wolf.name);
  assert.equal(marker?.metadata?.publicLabel,"야생 변신 · 늑대");
  assert.equal(marker?.metadata?.spellcastingAllowed,false);
});

test("Wild Shape level gates reject excessive CR and flying forms before level 8", () => {
  assert.deepEqual(druidWildShapeFormLimits(2),{ knownForms:4, maximumChallengeRating:0.25, flightAllowed:false });
  assert.deepEqual(druidWildShapeFormLimits(4),{ knownForms:6, maximumChallengeRating:0.5, flightAllowed:false });
  assert.deepEqual(druidWildShapeFormLimits(8),{ knownForms:8, maximumChallengeRating:1, flightAllowed:true });

  const crState=druidState();
  const tooStrong=resolveDruidWildShapeStart(TEST_PROFILE,crState,{
    id:"wild-shape.too-strong",
    actorId:"hero",
    expectedRevision:crState.revision,
    druidLevel:2,
    form:blackBear,
  });
  assert.equal(tooStrong.status,"rejected");
  assert.match(tooStrong.status==="rejected"?tooStrong.error:"",/maximum CR 0.25/);

  const flyState=druidState();
  const flying=resolveDruidWildShapeStart(TEST_PROFILE,flyState,{
    id:"wild-shape.flying",
    actorId:"hero",
    expectedRevision:flyState.revision,
    druidLevel:4,
    form:{...wolf,id:"dnd.srd521.beast.bat",name:"박쥐",challengeRating:0,hasFlySpeed:true},
  });
  assert.equal(flying.status,"rejected");
  assert.match(flying.status==="rejected"?flying.error:"",/flying speed before Druid level 8/);
});

test("using Wild Shape again replaces the active form and spends another use without a parallel shape manager", () => {
  const state=druidState();
  const first=resolveDruidWildShapeStart(TEST_PROFILE,state,{
    id:"wild-shape.first",
    actorId:"hero",
    expectedRevision:state.revision,
    druidLevel:4,
    form:blackBear,
    useBonusActionEconomy:false,
  });
  assert.equal(first.status,"committed");
  if(first.status!=="committed") return;
  const second=resolveDruidWildShapeStart(TEST_PROFILE,first.state,{
    id:"wild-shape.second",
    actorId:"hero",
    expectedRevision:first.state.revision,
    druidLevel:4,
    form:wolf,
    temporaryHpChoice:"take-new",
    useBonusActionEconomy:false,
  });
  assert.equal(second.status,"committed");
  if(second.status!=="committed") return;
  assert.equal(second.state.combatants.hero.resources.find((pool)=>pool.id===DRUID_WILD_SHAPE_RESOURCE_ID)?.current,1);
  const markers=second.state.effects.filter((effect)=>effect.targetId==="hero"&&effect.tags.includes(DRUID_WILD_SHAPE_TAG));
  assert.equal(markers.length,1);
  assert.equal(markers[0]?.metadata?.formId,wolf.id);
  assert.equal(second.state.combatants.hero.life.hp.temporary,4);
});

test("voluntary Wild Shape exit removes only the form marker and uses Bonus Action when turn economy is active", () => {
  const state=druidState();
  const started=resolveDruidWildShapeStart(TEST_PROFILE,state,{
    id:"wild-shape.exit-start",
    actorId:"hero",
    expectedRevision:state.revision,
    druidLevel:2,
    form:wolf,
    useBonusActionEconomy:false,
  });
  assert.equal(started.status,"committed");
  if(started.status!=="committed") return;
  const ended=resolveDruidWildShapeEnd(TEST_PROFILE,started.state,{
    id:"wild-shape.exit",
    actorId:"hero",
    expectedRevision:started.state.revision,
  });
  assert.equal(ended.status,"committed");
  if(ended.status!=="committed") return;
  assert.equal(ended.state.effects.some((effect)=>effect.targetId==="hero"&&effect.tags.includes(DRUID_WILD_SHAPE_TAG)),false);
  assert.equal(ended.state.combatants.hero.economy.bonusAction,false);
  assert.equal(ended.state.combatants.hero.life.hp.temporary,2);
});

test("Druid level 18 Wild Shape marker records Beast Spells casting permission", () => {
  const state=druidState();
  const result=resolveDruidWildShapeStart(TEST_PROFILE,state,{
    id:"wild-shape.beast-spells",
    actorId:"hero",
    expectedRevision:state.revision,
    druidLevel:18,
    form:wolf,
    useBonusActionEconomy:false,
  });
  assert.equal(result.status,"committed");
  if(result.status!=="committed") return;
  const marker=result.state.effects.find((effect)=>effect.targetId==="hero"&&effect.tags.includes(DRUID_WILD_SHAPE_TAG));
  assert.equal(marker?.metadata?.spellcastingAllowed,true);
});
