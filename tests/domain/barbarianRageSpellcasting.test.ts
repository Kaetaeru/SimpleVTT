import assert from "node:assert/strict";
import test from "node:test";
import {
  BARBARIAN_RAGE_DURATION_KEY,
  BARBARIAN_RAGE_FEATURE_ID,
  BARBARIAN_RAGE_TAG,
} from "../../src/domain/barbarianRage";
import { SRD_521_SPELL_MECHANICS } from "../../src/domain/spellMechanics";
import { resolveSpellCast } from "../../src/domain/spellcasting";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const HEALING_WORD = "dnd.srd521.spell.healing-word";

test("Rage blocks spellcasting before economy, slot, or history can mutate", () => {
  const state=runtimeState();
  state.effects.push({
    id:"rage:hero",
    sourceId:BARBARIAN_RAGE_FEATURE_ID,
    sourceActorId:"hero",
    targetId:"hero",
    kind:"marker",
    tags:[BARBARIAN_RAGE_TAG],
    expiry:{kind:"special",key:BARBARIAN_RAGE_DURATION_KEY},
  });

  const result=resolveSpellCast(TEST_PROFILE,SRD_521_SPELL_MECHANICS[HEALING_WORD],state,{
    id:"cast.raging.healing-word",
    actorId:"hero",
    spellId:HEALING_WORD,
    source:"prepared",
    expectedRevision:0,
    caster:{
      characterLevel:5,
      spellAttackModifier:5,
      spellSaveDc:14,
      spellcastingAbilityModifier:3,
      preparedSpellIds:[HEALING_WORD],
      cantripSpellIds:[],
      slotResourceIds:{1:"spell-slot-1"},
    },
    targets:[{
      id:"hero",
      kind:"creature",
      relation:"self",
      distanceFeet:0,
      visible:true,
      cover:"none",
      creatureKind:"character",
      saveModifiers:{},
      targetCanSeeCaster:true,
    }],
    slotLevel:1,
    componentsSatisfied:true,
    useActionEconomy:true,
    turnId:"round-1:hero",
    dice:{effectFaces:[2,3]},
  });

  assert.equal(result.status,"rejected");
  assert.match(result.status==="rejected"?result.error:"",/Rage prevents casting spells/);
  assert.equal(result.state,state);
  assert.equal(state.combatants.hero.economy.bonusAction,true);
  assert.equal(state.combatants.hero.resources.find((pool)=>pool.id==="spell-slot-1")?.current,2);
  assert.equal(state.history.length,0);
});
