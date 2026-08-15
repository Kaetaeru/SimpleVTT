import assert from "node:assert/strict";
import test from "node:test";
import { SRD_521_SPELL_MECHANICS } from "../../src/domain/spellMechanics";
import { recoverResources } from "../../src/domain/resources";
import { resolveSpellCast, type SpellCasterContext, type SpellCastTarget } from "../../src/domain/spellcasting";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const MAGIC_MISSILE = "dnd.srd521.spell.magic-missile";
const SIGNATURE_RESOURCE = `resource:wizard.signature-spell:${MAGIC_MISSILE}`;

function caster(featureResourceIds: Partial<Record<string,string>> = {}): SpellCasterContext {
  return {
    characterLevel:20,
    spellAttackModifier:11,
    spellSaveDc:19,
    spellcastingAbilityModifier:5,
    preparedSpellIds:[],
    alwaysPreparedSpellIds:[MAGIC_MISSILE],
    cantripSpellIds:[],
    slotResourceIds:{ 1:"spell-slot-1" },
    featureSpellIds:[MAGIC_MISSILE],
    featureResourceIds,
  };
}

const target: SpellCastTarget = {
  id:"goblin",
  kind:"creature",
  relation:"enemy",
  distanceFeet:30,
  visible:true,
  cover:"none",
  ac:12,
  creatureKind:"monster",
  saveModifiers:{},
  targetCanSeeCaster:true,
};

function request(expectedRevision: number, featureResourceIds: Partial<Record<string,string>> = {}) {
  return {
    id:`cast.feature.${expectedRevision}`,
    actorId:"hero",
    spellId:MAGIC_MISSILE,
    source:"feature" as const,
    expectedRevision,
    caster:caster(featureResourceIds),
    targets:[target],
    componentsSatisfied:true,
    useActionEconomy:false,
    dice:{ projectileFaces:[1,2,3] },
  };
}

test("slotless feature casting can be at-will without spending a spell slot, matching Spell Mastery resource semantics", () => {
  const state = runtimeState();
  const beforeSlot = state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-1")?.current;
  const result = resolveSpellCast(TEST_PROFILE, SRD_521_SPELL_MECHANICS[MAGIC_MISSILE], state, request(0));
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-1")?.current, beforeSlot);
});

test("resource-backed feature casting spends exactly one feature charge atomically and Short Rest restores it", () => {
  const state = runtimeState();
  state.combatants.hero.resources.push({
    id:SIGNATURE_RESOURCE,
    label:"대표 주문 · Magic Missile",
    current:1,
    maximum:1,
    recovery:{ shortRest:"all", longRest:"all" },
  });
  const first = resolveSpellCast(
    TEST_PROFILE,
    SRD_521_SPELL_MECHANICS[MAGIC_MISSILE],
    state,
    request(0, { [MAGIC_MISSILE]:SIGNATURE_RESOURCE }),
  );
  assert.equal(first.status, "committed");
  if (first.status !== "committed") return;
  assert.equal(first.state.combatants.hero.resources.find((pool) => pool.id === SIGNATURE_RESOURCE)?.current, 0);
  assert.equal(first.state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-1")?.current, 2);

  const second = resolveSpellCast(
    TEST_PROFILE,
    SRD_521_SPELL_MECHANICS[MAGIC_MISSILE],
    first.state,
    request(first.state.revision, { [MAGIC_MISSILE]:SIGNATURE_RESOURCE }),
  );
  assert.equal(second.status, "rejected");
  assert.equal(second.state, first.state, "spent feature resource must reject without any partial mutation");
  assert.match(second.status === "rejected" ? second.error : "", /cannot spend 1/);

  const recovered = recoverResources(first.state.combatants.hero.resources, "shortRest");
  assert.equal(recovered.next.find((pool) => pool.id === SIGNATURE_RESOURCE)?.current, 1);
});
