import assert from "node:assert/strict";
import test from "node:test";
import { resolveClericDivineIntervention } from "../../src/domain/clericDivineIntervention";
import { CLERIC_DIVINE_INTERVENTION_RESOURCE_ID } from "../../src/domain/coreClassResources";
import { SRD_521_SPELL_MECHANICS } from "../../src/domain/spellMechanics";
import type { SpellCasterContext, SpellCastTarget } from "../../src/domain/spellcasting";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const CURE_WOUNDS = "dnd.srd521.spell.cure-wounds";
const HEALING_WORD = "dnd.srd521.spell.healing-word";
const MAGIC_MISSILE = "dnd.srd521.spell.magic-missile";

function caster(): SpellCasterContext {
  return {
    characterLevel:10,
    spellAttackModifier:8,
    spellSaveDc:16,
    spellcastingAbilityModifier:5,
    preparedSpellIds:[],
    alwaysPreparedSpellIds:[],
    cantripSpellIds:[],
    slotResourceIds:{ 1:"spell-slot-1" },
    featureSpellIds:[],
    featureResourceIds:{ [CURE_WOUNDS]:"other-free-cure-wounds" },
  };
}

function creature(id: string, overrides: Partial<SpellCastTarget> = {}): SpellCastTarget {
  return {
    id,
    kind:"creature",
    relation:id === "hero" ? "self" : "ally",
    distanceFeet:id === "hero" ? 0 : 30,
    visible:true,
    cover:"none",
    ac:12,
    creatureKind:id === "hero" ? "character" : "monster",
    saveModifiers:{},
    targetCanSeeCaster:true,
    ...overrides,
  };
}

function addDivineIntervention(state: ReturnType<typeof runtimeState>, current = 1) {
  state.combatants.hero.resources.push(
    {
      id:CLERIC_DIVINE_INTERVENTION_RESOURCE_ID,
      label:"Divine Intervention",
      current,
      maximum:1,
      recovery:{ longRest:"all" },
    },
    {
      id:"other-free-cure-wounds",
      label:"Other Cure Wounds feature",
      current:1,
      maximum:1,
      recovery:{ longRest:"all" },
    },
  );
}

test("Divine Intervention casts Cure Wounds as one Magic Action without a spell slot or another feature-cast resource", () => {
  const state = runtimeState();
  state.combatants.hero.life.hp = { current:4, maximum:20, temporary:0 };
  addDivineIntervention(state);
  const result = resolveClericDivineIntervention(
    TEST_PROFILE,
    SRD_521_SPELL_MECHANICS[CURE_WOUNDS],
    state,
    {
      id:"divine-intervention.cure-wounds",
      actorId:"hero",
      expectedRevision:0,
      clericLevel:10,
      spellId:CURE_WOUNDS,
      caster:caster(),
      targets:[creature("hero")],
      nonMaterialComponentsSatisfied:true,
      useActionEconomy:true,
      dice:{ effectFaces:[6,7] },
    },
  );
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal((result.results["divine-intervention.cure-wounds:healing-roll"] as { total:number }).total, 18);
  assert.equal(result.state.combatants.hero.life.hp.current, 20);
  assert.equal(result.state.combatants.hero.economy.action, false);
  assert.equal(result.state.combatants.hero.economy.bonusAction, true);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === CLERIC_DIVINE_INTERVENTION_RESOURCE_ID)?.current, 0);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-1")?.current, 2);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === "other-free-cure-wounds")?.current, 1);
});

test("Divine Intervention uses its Magic Action instead of Healing Word's normal Bonus Action", () => {
  const state = runtimeState();
  state.combatants.goblin.life.hp = { current:2, maximum:15, temporary:0 };
  addDivineIntervention(state);
  const result = resolveClericDivineIntervention(
    TEST_PROFILE,
    SRD_521_SPELL_MECHANICS[HEALING_WORD],
    state,
    {
      id:"divine-intervention.healing-word",
      actorId:"hero",
      expectedRevision:0,
      clericLevel:10,
      spellId:HEALING_WORD,
      caster:caster(),
      targets:[creature("goblin")],
      nonMaterialComponentsSatisfied:true,
      useActionEconomy:true,
      dice:{ effectFaces:[3,4] },
    },
  );
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.economy.action, false);
  assert.equal(result.state.combatants.hero.economy.bonusAction, true);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-1")?.current, 2);
  assert.equal(result.state.combatants.goblin.life.hp.current, 14);
});

test("depleted Divine Intervention rejects atomically without consuming Action, slot, or changing HP", () => {
  const state = runtimeState();
  state.combatants.hero.life.hp = { current:5, maximum:20, temporary:0 };
  addDivineIntervention(state, 0);
  const result = resolveClericDivineIntervention(
    TEST_PROFILE,
    SRD_521_SPELL_MECHANICS[CURE_WOUNDS],
    state,
    {
      id:"divine-intervention.depleted",
      actorId:"hero",
      expectedRevision:0,
      clericLevel:10,
      spellId:CURE_WOUNDS,
      caster:caster(),
      targets:[creature("hero")],
      nonMaterialComponentsSatisfied:true,
      useActionEconomy:true,
      dice:{ effectFaces:[8,8] },
    },
  );
  assert.equal(result.status, "rejected");
  assert.equal(result.state, state);
  assert.equal(state.combatants.hero.life.hp.current, 5);
  assert.equal(state.combatants.hero.economy.action, true);
  assert.equal(state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-1")?.current, 2);
});

test("Divine Intervention rejects below Cleric 10 and rejects a non-Cleric spell before spending anything", () => {
  const state = runtimeState();
  addDivineIntervention(state);
  const belowLevel = resolveClericDivineIntervention(
    TEST_PROFILE,
    SRD_521_SPELL_MECHANICS[CURE_WOUNDS],
    state,
    {
      id:"divine-intervention.level9",
      actorId:"hero",
      expectedRevision:0,
      clericLevel:9,
      spellId:CURE_WOUNDS,
      caster:caster(),
      targets:[creature("hero")],
      nonMaterialComponentsSatisfied:true,
      useActionEconomy:true,
      dice:{ effectFaces:[4,4] },
    },
  );
  assert.equal(belowLevel.status, "rejected");
  assert.match(belowLevel.status === "rejected" ? belowLevel.error : "", /Cleric level 10-20/);

  const nonCleric = resolveClericDivineIntervention(
    TEST_PROFILE,
    SRD_521_SPELL_MECHANICS[MAGIC_MISSILE],
    state,
    {
      id:"divine-intervention.magic-missile",
      actorId:"hero",
      expectedRevision:0,
      clericLevel:10,
      spellId:MAGIC_MISSILE,
      caster:caster(),
      targets:[creature("goblin", { relation:"enemy" })],
      nonMaterialComponentsSatisfied:true,
      useActionEconomy:true,
      dice:{ projectileFaces:[2,3,4] },
      projectileAllocations:[{ targetId:"goblin", count:3 }],
    },
  );
  assert.equal(nonCleric.status, "rejected");
  assert.match(nonCleric.status === "rejected" ? nonCleric.error : "", /requires a Cleric spell/);
  assert.equal(state.combatants.hero.resources.find((pool) => pool.id === CLERIC_DIVINE_INTERVENTION_RESOURCE_ID)?.current, 1);
});

test("Divine Intervention rejects a Reaction-casting Cleric spell shape and unmet non-material components", () => {
  const state = runtimeState();
  addDivineIntervention(state);
  const reactionDefinition = {
    ...SRD_521_SPELL_MECHANICS[CURE_WOUNDS],
    castingEconomy:"reaction" as const,
  };
  const reaction = resolveClericDivineIntervention(
    TEST_PROFILE,
    reactionDefinition,
    state,
    {
      id:"divine-intervention.reaction",
      actorId:"hero",
      expectedRevision:0,
      clericLevel:10,
      spellId:CURE_WOUNDS,
      caster:caster(),
      targets:[creature("hero")],
      nonMaterialComponentsSatisfied:true,
      useActionEconomy:true,
      dice:{ effectFaces:[5,5] },
    },
  );
  assert.equal(reaction.status, "rejected");
  assert.match(reaction.status === "rejected" ? reaction.error : "", /Reaction casting time/);

  const components = resolveClericDivineIntervention(
    TEST_PROFILE,
    SRD_521_SPELL_MECHANICS[CURE_WOUNDS],
    state,
    {
      id:"divine-intervention.components",
      actorId:"hero",
      expectedRevision:0,
      clericLevel:10,
      spellId:CURE_WOUNDS,
      caster:caster(),
      targets:[creature("hero")],
      nonMaterialComponentsSatisfied:false,
      useActionEconomy:true,
      dice:{ effectFaces:[5,5] },
    },
  );
  assert.equal(components.status, "rejected");
  assert.match(components.status === "rejected" ? components.error : "", /non-material spell components/);
});
