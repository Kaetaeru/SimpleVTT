import assert from "node:assert/strict";
import test from "node:test";
import { DRUID_WILD_SHAPE_FEATURE_ID, DRUID_WILD_SHAPE_TAG } from "../../src/domain/druidWildShape";
import { SRD_521_SPELL_MECHANICS } from "../../src/domain/spellMechanics";
import { resolveSpellCast, type SpellCasterContext, type SpellCastTarget } from "../../src/domain/spellcasting";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const HEALING_WORD="dnd.srd521.spell.healing-word";

function caster():SpellCasterContext {
  return {
    characterLevel:5,
    spellAttackModifier:5,
    spellSaveDc:14,
    spellcastingAbilityModifier:3,
    preparedSpellIds:[HEALING_WORD],
    alwaysPreparedSpellIds:[],
    cantripSpellIds:[],
    slotResourceIds:{1:"spell-slot-1"},
  };
}

function selfTarget():SpellCastTarget {
  return {
    id:"hero",
    kind:"creature",
    relation:"self",
    distanceFeet:0,
    visible:true,
    cover:"none",
    creatureKind:"character",
    targetCanSeeCaster:true,
  };
}

function addWildShape(state:ReturnType<typeof runtimeState>,spellcastingAllowed:boolean) {
  state.effects.push({
    id:"wild-shape:hero",
    sourceId:DRUID_WILD_SHAPE_FEATURE_ID,
    sourceActorId:"hero",
    targetId:"hero",
    kind:"marker",
    tags:[DRUID_WILD_SHAPE_TAG],
    expiry:{kind:"time",elapsedSeconds:3600},
    metadata:{spellcastingAllowed},
  });
}

test("Wild Shape blocks spellcasting before economy, slot, HP, or history mutate",()=>{
  const state=runtimeState();
  addWildShape(state,false);
  const result=resolveSpellCast(TEST_PROFILE,SRD_521_SPELL_MECHANICS[HEALING_WORD],state,{
    id:"cast.wild-shape.healing-word",
    actorId:"hero",
    spellId:HEALING_WORD,
    source:"prepared",
    expectedRevision:state.revision,
    caster:caster(),
    targets:[selfTarget()],
    slotLevel:1,
    componentsSatisfied:true,
    useActionEconomy:true,
    turnId:"round-1:hero",
    dice:{effectFaces:[2,3]},
  });
  assert.equal(result.status,"rejected");
  assert.match(result.status==="rejected"?result.error:"",/prevents casting spells/);
  assert.equal(result.state,state);
  assert.equal(state.combatants.hero.economy.bonusAction,true);
  assert.equal(state.combatants.hero.resources.find((pool)=>pool.id==="spell-slot-1")?.current,2);
  assert.equal(state.history.length,0);
});

test("Beast Spells marker allows the normal spellcasting pipeline to continue",()=>{
  const state=runtimeState();
  state.combatants.hero.life.hp.current=5;
  addWildShape(state,true);
  const result=resolveSpellCast(TEST_PROFILE,SRD_521_SPELL_MECHANICS[HEALING_WORD],state,{
    id:"cast.beast-spells.healing-word",
    actorId:"hero",
    spellId:HEALING_WORD,
    source:"prepared",
    expectedRevision:state.revision,
    caster:caster(),
    targets:[selfTarget()],
    slotLevel:1,
    componentsSatisfied:true,
    useActionEconomy:true,
    turnId:"round-1:hero",
    dice:{effectFaces:[2,3]},
  });
  assert.equal(result.status,"committed");
  if(result.status!=="committed")return;
  assert.equal(result.state.combatants.hero.resources.find((pool)=>pool.id==="spell-slot-1")?.current,1);
  assert.equal(result.state.combatants.hero.economy.bonusAction,false);
  assert.ok(result.state.combatants.hero.life.hp.current>5);
});
