import assert from "node:assert/strict";
import test from "node:test";
import {
  clericBlessedStrikesChoice,
  clericDivineStrikeDiceCount,
  resolveClericCantripWithBlessedStrikes,
} from "../../src/domain/clericBlessedStrikes";
import {
  CLERIC_DIVINE_STRIKE_OPTION,
  CLERIC_POTENT_SPELLCASTING_OPTION,
} from "../../src/domain/clericProgressionChoices";
import { SRD_521_SPELL_MECHANICS } from "../../src/domain/spellMechanics";
import type { SpellCasterContext, SpellCastRequest, SpellCastTarget } from "../../src/domain/spellcasting";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const SACRED_FLAME = "dnd.srd521.spell.sacred-flame";
const FIRE_BOLT = "dnd.srd521.spell.fire-bolt";

function caster(level: number, wisdomModifier = 4): SpellCasterContext {
  return {
    characterLevel:level,
    spellAttackModifier:7,
    spellSaveDc:15,
    spellcastingAbilityModifier:wisdomModifier,
    preparedSpellIds:[],
    alwaysPreparedSpellIds:[],
    cantripSpellIds:[SACRED_FLAME,FIRE_BOLT],
    slotResourceIds:{},
  };
}

function target(id: string, overrides: Partial<SpellCastTarget> = {}): SpellCastTarget {
  return {
    id,
    kind:"creature",
    relation:"enemy",
    distanceFeet:30,
    visible:true,
    cover:"none",
    ac:12,
    creatureKind:"monster",
    saveModifiers:{ dex:0 },
    targetCanSeeCaster:true,
    ...overrides,
  };
}

function sacredFlameRequest(level: number, faces: number[], saveFace = 2): SpellCastRequest {
  return {
    id:`blessed.sacred-flame.${level}`,
    actorId:"hero",
    spellId:SACRED_FLAME,
    source:"prepared",
    expectedRevision:0,
    caster:caster(level),
    targets:[target("goblin")],
    componentsSatisfied:true,
    useActionEconomy:false,
    dice:{
      saves:{ goblin:{ id:"save", purpose:"Sacred Flame Dexterity save", sides:20, faces:[saveFace] } },
      effectFaces:faces,
    },
  };
}

test("Blessed Strikes stable options are mutually exclusive and Divine Strike scales from 1d8 to 2d8 at Cleric 14", () => {
  assert.equal(clericBlessedStrikesChoice([CLERIC_DIVINE_STRIKE_OPTION]), "divine-strike");
  assert.equal(clericDivineStrikeDiceCount(7, [CLERIC_DIVINE_STRIKE_OPTION]), 1);
  assert.equal(clericDivineStrikeDiceCount(13, [CLERIC_DIVINE_STRIKE_OPTION]), 1);
  assert.equal(clericDivineStrikeDiceCount(14, [CLERIC_DIVINE_STRIKE_OPTION]), 2);
  assert.equal(clericDivineStrikeDiceCount(20, [CLERIC_POTENT_SPELLCASTING_OPTION]), 0);
  assert.throws(
    () => clericBlessedStrikesChoice([CLERIC_DIVINE_STRIKE_OPTION, CLERIC_POTENT_SPELLCASTING_OPTION]),
    /cannot contain both/,
  );
});

test("Potent Spellcasting adds Wisdom to an executable Cleric cantrip damage roll with stable provenance", () => {
  const state = runtimeState();
  state.combatants.goblin.life.hp = { current:30, maximum:30, temporary:0 };
  const request = sacredFlameRequest(7, [5,6]);
  const result = resolveClericCantripWithBlessedStrikes(
    TEST_PROFILE,
    SRD_521_SPELL_MECHANICS[SACRED_FLAME],
    state,
    request,
    {
      clericLevel:7,
      wisdomModifier:4,
      persistentFeatureOptionIds:[CLERIC_POTENT_SPELLCASTING_OPTION],
    },
  );
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  const roll = result.results[`${request.id}:damage-roll`] as {
    total:number;
    flatTotal:number;
    provenance:Array<{source:string}>;
  };
  assert.equal(roll.total, 15, "level-7 Sacred Flame is 2d8 plus Wisdom 4");
  assert.equal(roll.flatTotal, 4);
  assert.ok(roll.provenance.some((entry) => entry.source === CLERIC_POTENT_SPELLCASTING_OPTION));
  assert.equal(result.state.combatants.goblin.life.hp.current, 15);
});

test("Improved Potent Spellcasting grants twice Wisdom temporary HP only after positive cantrip damage", () => {
  const state = runtimeState();
  state.combatants.goblin.life.hp = { current:40, maximum:40, temporary:0 };
  const request = sacredFlameRequest(14, [2,3,4]);
  const result = resolveClericCantripWithBlessedStrikes(
    TEST_PROFILE,
    SRD_521_SPELL_MECHANICS[SACRED_FLAME],
    state,
    request,
    {
      clericLevel:14,
      wisdomModifier:4,
      persistentFeatureOptionIds:[CLERIC_POTENT_SPELLCASTING_OPTION],
      improvedPotentSpellcastingTarget:{
        id:"hero",
        kind:"creature",
        relation:"self",
        distanceFeet:0,
        visible:true,
        cover:"none",
      },
    },
  );
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal((result.results[`${request.id}:damage-roll`] as { total:number }).total, 13);
  assert.equal(result.state.combatants.goblin.life.hp.current, 27);
  assert.equal(result.state.combatants.hero.life.hp.temporary, 8);
});

test("Improved Potent Spellcasting does not grant temporary HP when radiant immunity reduces final damage to zero", () => {
  const state = runtimeState();
  state.combatants.goblin.damageDefenses = [{
    source:"test:radiant-immunity",
    kind:"immunity",
    damageType:"radiant",
  }];
  const request = sacredFlameRequest(14, [8,8,8]);
  const result = resolveClericCantripWithBlessedStrikes(
    TEST_PROFILE,
    SRD_521_SPELL_MECHANICS[SACRED_FLAME],
    state,
    request,
    {
      clericLevel:14,
      wisdomModifier:4,
      persistentFeatureOptionIds:[CLERIC_POTENT_SPELLCASTING_OPTION],
      improvedPotentSpellcastingTarget:{
        id:"hero",
        kind:"creature",
        relation:"self",
        distanceFeet:0,
        visible:true,
        cover:"none",
      },
    },
  );
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.goblin.life.hp.current, 15);
  assert.equal(result.state.combatants.hero.life.hp.temporary, 0);
  const tempResult = result.results[`${request.id}:blessed-strikes:temp-hp:0`] as { skipped?:boolean };
  assert.equal(tempResult.skipped, true);
});

test("Potent Spellcasting rejects a non-Cleric cantrip instead of applying the Wisdom bonus by display semantics", () => {
  const state = runtimeState();
  const request: SpellCastRequest = {
    id:"blessed.fire-bolt",
    actorId:"hero",
    spellId:FIRE_BOLT,
    source:"prepared",
    expectedRevision:0,
    caster:caster(7),
    targets:[target("goblin")],
    componentsSatisfied:true,
    useActionEconomy:false,
    dice:{
      attack:{ id:"attack", purpose:"Fire Bolt attack", sides:20, faces:[20] },
      effectFaces:[5,5,5,5],
    },
  };
  const result = resolveClericCantripWithBlessedStrikes(
    TEST_PROFILE,
    SRD_521_SPELL_MECHANICS[FIRE_BOLT],
    state,
    request,
    {
      clericLevel:7,
      wisdomModifier:4,
      persistentFeatureOptionIds:[CLERIC_POTENT_SPELLCASTING_OPTION],
    },
  );
  assert.equal(result.status, "rejected");
  assert.match(result.status === "rejected" ? result.error : "", /requires a Cleric cantrip/);
  assert.equal(result.state, state);
});
