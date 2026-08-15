import assert from "node:assert/strict";
import test from "node:test";
import {
  druidElementalFuryChoice,
  druidPotentSpellcastingDefinition,
  resolveDruidCantripWithElementalFury,
} from "../../src/domain/druidElementalFury";
import {
  DRUID_POTENT_SPELLCASTING_OPTION,
  DRUID_PRIMAL_STRIKE_OPTION,
} from "../../src/domain/druidProgressionChoices";
import { SRD_521_SPELL_MECHANICS } from "../../src/domain/spellMechanics";
import type { SpellCasterContext, SpellCastRequest, SpellCastTarget } from "../../src/domain/spellcasting";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const POISON_SPRAY = "dnd.srd521.spell.poison-spray";
const FIRE_BOLT = "dnd.srd521.spell.fire-bolt";

function caster(level:number, wisdomModifier = 4):SpellCasterContext {
  return {
    characterLevel:level,
    spellAttackModifier:7,
    spellSaveDc:15,
    spellcastingAbilityModifier:wisdomModifier,
    preparedSpellIds:[],
    alwaysPreparedSpellIds:[],
    cantripSpellIds:[POISON_SPRAY,FIRE_BOLT],
    slotResourceIds:{},
  };
}

function target(distanceFeet = 30):SpellCastTarget {
  return {
    id:"goblin",
    kind:"creature",
    relation:"enemy",
    distanceFeet,
    visible:true,
    cover:"none",
    ac:12,
    creatureKind:"monster",
    saveModifiers:{},
    targetCanSeeCaster:true,
  };
}

function poisonSprayRequest(level:number, distanceFeet:number, effectFaces:number[]):SpellCastRequest {
  return {
    id:`druid.poison-spray.${level}.${distanceFeet}`,
    actorId:"hero",
    spellId:POISON_SPRAY,
    source:"prepared",
    expectedRevision:0,
    caster:caster(level),
    targets:[target(distanceFeet)],
    componentsSatisfied:true,
    useActionEconomy:false,
    dice:{
      attack:{ id:"poison-spray-attack", purpose:"Poison Spray ranged spell attack", sides:20, faces:[15] },
      effectFaces,
    },
  };
}

test("Elemental Fury stable options are mutually exclusive", () => {
  assert.equal(druidElementalFuryChoice([DRUID_POTENT_SPELLCASTING_OPTION]),"potent-spellcasting");
  assert.equal(druidElementalFuryChoice([DRUID_PRIMAL_STRIKE_OPTION]),"primal-strike");
  assert.throws(
    () => druidElementalFuryChoice([DRUID_POTENT_SPELLCASTING_OPTION,DRUID_PRIMAL_STRIKE_OPTION]),
    /cannot contain both/,
  );
});

test("Poison Spray is executable through the generic attack-damage spell schema", () => {
  const definition = SRD_521_SPELL_MECHANICS[POISON_SPRAY];
  assert.equal(definition.runtimeSupport,"combat-executable");
  assert.equal(definition.baseLevel,0);
  assert.equal(definition.castingEconomy,"action");
  assert.equal(definition.targeting.rangeFeet,30);
  assert.equal(definition.primary.kind,"attack-damage");
  if (definition.primary.kind !== "attack-damage") return;
  assert.equal(definition.primary.damageType,"poison");
  assert.deepEqual(definition.primary.dice,{ count:1, sides:12, cantripScaling:true });
});

test("Druid Potent Spellcasting adds Wisdom to Poison Spray damage with stable provenance", () => {
  const state = runtimeState();
  state.combatants.goblin.life.hp = { current:30, maximum:30, temporary:0 };
  const request = poisonSprayRequest(7,30,[3,4]);
  const result = resolveDruidCantripWithElementalFury(
    TEST_PROFILE,
    SRD_521_SPELL_MECHANICS[POISON_SPRAY],
    state,
    request,
    {
      druidLevel:7,
      wisdomModifier:4,
      persistentFeatureOptionIds:[DRUID_POTENT_SPELLCASTING_OPTION],
    },
  );
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  const roll = result.results[`${request.id}:damage-roll`] as {
    total:number;
    flatTotal:number;
    provenance:Array<{source:string}>;
  };
  assert.equal(roll.total,11,"level-7 Poison Spray is 2d12 plus Wisdom 4");
  assert.equal(roll.flatTotal,4);
  assert.ok(roll.provenance.some((entry) => entry.source === DRUID_POTENT_SPELLCASTING_OPTION));
  assert.equal(result.state.combatants.goblin.life.hp.current,19);
});

test("Improved Potent Spellcasting increases eligible Druid cantrip range by exactly 300 feet at level 15", () => {
  const base = SRD_521_SPELL_MECHANICS[POISON_SPRAY];
  const improved = druidPotentSpellcastingDefinition(base,{
    druidLevel:15,
    wisdomModifier:4,
    persistentFeatureOptionIds:[DRUID_POTENT_SPELLCASTING_OPTION],
  });
  assert.equal(improved.targeting.rangeFeet,330);
  assert.equal(base.targeting.rangeFeet,30,"definition transformation must not mutate the canonical spell definition");

  const state = runtimeState();
  state.combatants.goblin.life.hp = { current:30, maximum:30, temporary:0 };
  const request = poisonSprayRequest(15,330,[1,2,3]);
  const result = resolveDruidCantripWithElementalFury(
    TEST_PROFILE,
    base,
    state,
    request,
    {
      druidLevel:15,
      wisdomModifier:4,
      persistentFeatureOptionIds:[DRUID_POTENT_SPELLCASTING_OPTION],
    },
  );
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal((result.results[`${request.id}:damage-roll`] as { total:number }).total,10);
  assert.equal(result.state.combatants.goblin.life.hp.current,20);
});

test("level 14 Potent Spellcasting does not receive the level-15 range increase", () => {
  const state = runtimeState();
  const request = poisonSprayRequest(14,31,[1,2,3]);
  const result = resolveDruidCantripWithElementalFury(
    TEST_PROFILE,
    SRD_521_SPELL_MECHANICS[POISON_SPRAY],
    state,
    request,
    {
      druidLevel:14,
      wisdomModifier:4,
      persistentFeatureOptionIds:[DRUID_POTENT_SPELLCASTING_OPTION],
    },
  );
  assert.equal(result.status,"rejected");
  assert.match(result.status === "rejected" ? result.error : "",/beyond range 30 ft/);
  assert.equal(result.state,state);
});

test("Druid Potent Spellcasting rejects a non-Druid cantrip instead of applying a display-name approximation", () => {
  const state = runtimeState();
  const request:SpellCastRequest = {
    id:"druid.potent.fire-bolt",
    actorId:"hero",
    spellId:FIRE_BOLT,
    source:"prepared",
    expectedRevision:0,
    caster:caster(7),
    targets:[target(30)],
    componentsSatisfied:true,
    useActionEconomy:false,
    dice:{
      attack:{ id:"fire-bolt-attack", purpose:"Fire Bolt attack", sides:20, faces:[15] },
      effectFaces:[5,5],
    },
  };
  const result = resolveDruidCantripWithElementalFury(
    TEST_PROFILE,
    SRD_521_SPELL_MECHANICS[FIRE_BOLT],
    state,
    request,
    {
      druidLevel:7,
      wisdomModifier:4,
      persistentFeatureOptionIds:[DRUID_POTENT_SPELLCASTING_OPTION],
    },
  );
  assert.equal(result.status,"rejected");
  assert.match(result.status === "rejected" ? result.error : "",/not a cantrip for dnd\.srd521\.class\.druid/);
  assert.equal(result.state,state);
});
