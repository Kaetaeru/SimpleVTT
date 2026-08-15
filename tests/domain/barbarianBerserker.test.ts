import assert from "node:assert/strict";
import test from "node:test";
import { createEffect } from "../../src/domain/effects";
import {
  BARBARIAN_BERSERKER_SUBCLASS_ID,
  BERSERKER_INTIMIDATING_PRESENCE_FEATURE_ID,
  BERSERKER_INTIMIDATING_PRESENCE_TAG,
  BERSERKER_MINDLESS_RAGE_FEATURE_ID,
  BERSERKER_MINDLESS_RAGE_TAG,
  BERSERKER_RETALIATION_FEATURE_ID,
  berserkerIntimidatingPresenceDc,
  resolveBerserkerIntimidatingPresence,
  resolveBerserkerIntimidatingPresenceRepeatSave,
  resolveBerserkerMindlessRageEnd,
  resolveBerserkerMindlessRageStart,
  resolveBerserkerRetaliation,
} from "../../src/domain/barbarianBerserker";
import type { ProgressionRequest } from "../../src/domain/progression";
import { buildProgressionPlanPhase08Subclass, resolveProgressionPhase08Subclass } from "../../src/domain/progressionPhase08Subclass";
import {
  BARBARIAN_SUBCLASS_CLASS_ID,
  srdSubclassRelationship,
  type SrdSubclassProgressionState,
} from "../../src/domain/srdSubclassProgression";
import {
  MONK_OPEN_HAND_SUBCLASS_ID,
  PALADIN_DEVOTION_SUBCLASS_ID,
  RANGER_HUNTER_SUBCLASS_ID,
  ROGUE_THIEF_SUBCLASS_ID,
  srdSubclassIdForClass,
  WARLOCK_FIEND_SUBCLASS_ID,
} from "../../src/domain/srdSubclassCatalog";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function berserkerState(level:number):SrdSubclassProgressionState {
  return {
    revision:level,
    id:"berserker",
    name:"Berserker",
    totalLevel:level,
    abilities:{ str:18,dex:14,con:16,int:8,wis:12,cha:10 },
    hpCurrent:20 + level * 8,
    hpMaximum:20 + level * 8,
    proficiencyBonus:level >= 13 ? 5 : level >= 9 ? 4 : level >= 5 ? 3 : 2,
    classTracks:[{
      classId:BARBARIAN_SUBCLASS_CLASS_ID,
      className:"바바리안",
      level,
      subclassName:level >= 3 ? "광전사의 길" : undefined,
    }],
    hitDiceByDie:{ d12:level },
    features:[],
    proficientSkills:["운동","지각"],
    subclassIds:level >= 3 ? { [BARBARIAN_SUBCLASS_CLASS_ID]:BARBARIAN_BERSERKER_SUBCLASS_ID } : {},
    subclassFeatureIds:[],
    subclassFeatureSources:{},
  };
}

function progressionRequest(state:SrdSubclassProgressionState,selections:ProgressionRequest["selections"] = {}):ProgressionRequest {
  return {
    expectedRevision:state.revision,
    targetClassId:BARBARIAN_SUBCLASS_CLASS_ID,
    hpMethod:"fixed",
    selections,
    featOptions:[],
    originFeatOptions:[],
    fightingStyleOptions:[],
    languageOptions:[],
    spellOptions:[],
  };
}

test("the remaining six SRD subclasses have stable identity relationships without inventing unsupported high-level mechanics", () => {
  assert.equal(srdSubclassIdForClass("dnd.srd521.class.barbarian"),BARBARIAN_BERSERKER_SUBCLASS_ID);
  assert.equal(srdSubclassIdForClass("dnd.srd521.class.monk"),MONK_OPEN_HAND_SUBCLASS_ID);
  assert.equal(srdSubclassIdForClass("dnd.srd521.class.paladin"),PALADIN_DEVOTION_SUBCLASS_ID);
  assert.equal(srdSubclassIdForClass("dnd.srd521.class.ranger"),RANGER_HUNTER_SUBCLASS_ID);
  assert.equal(srdSubclassIdForClass("dnd.srd521.class.rogue"),ROGUE_THIEF_SUBCLASS_ID);
  assert.equal(srdSubclassIdForClass("dnd.srd521.class.warlock"),WARLOCK_FIEND_SUBCLASS_ID);
  assert.deepEqual(srdSubclassRelationship("dnd.srd521.class.monk",MONK_OPEN_HAND_SUBCLASS_ID,3)?.features,[]);
  assert.equal(srdSubclassRelationship("dnd.srd521.class.monk",MONK_OPEN_HAND_SUBCLASS_ID,6),undefined);
});

test("Barbarian 2 to 3 persists Path of the Berserker stable identity", () => {
  const state = berserkerState(2);
  const selections = {
    [`progression.${BARBARIAN_SUBCLASS_CLASS_ID}.3.subclass`]:{ kind:"options" as const, optionIds:["subclass:광전사의 길"] },
  };
  const result = resolveProgressionPhase08Subclass(state,progressionRequest(state,selections));
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  const next = result.state as SrdSubclassProgressionState;
  assert.equal(next.subclassIds?.[BARBARIAN_SUBCLASS_CLASS_ID],BARBARIAN_BERSERKER_SUBCLASS_ID);
});

test("Berserker 6/10/14 progression relationships replace the generic subclass blocker with mechanics-backed feature ids", () => {
  const expected = new Map([
    [6,BERSERKER_MINDLESS_RAGE_FEATURE_ID],
    [10,BERSERKER_RETALIATION_FEATURE_ID],
    [14,BERSERKER_INTIMIDATING_PRESENCE_FEATURE_ID],
  ]);
  for (const [targetLevel,featureId] of expected) {
    const state = berserkerState(targetLevel - 1);
    const plan = buildProgressionPlanPhase08Subclass(state,progressionRequest(state));
    assert.equal(plan.choices.some((choice) => choice.status === "catalog-pending"),false,`Barbarian ${targetLevel}`);
    assert.ok(plan.diffs.some((diff) => diff.label === "서브클래스 특성"));
    assert.ok(srdSubclassRelationship(BARBARIAN_SUBCLASS_CLASS_ID,BARBARIAN_BERSERKER_SUBCLASS_ID,targetLevel)?.features.some((feature) => feature.id === featureId));
  }
});

test("Mindless Rage ends existing Charmed/Frightened, suppresses them during Rage, and releases immunity when Rage ends", () => {
  const state = runtimeState();
  state.effects.push(
    createEffect({ id:"old-charmed", sourceId:"test:charm", targetId:"hero", kind:"condition", conditionId:"charmed", duration:{ kind:"minutes", amount:1 } },state.clock),
    createEffect({ id:"old-frightened", sourceId:"test:fear", targetId:"hero", kind:"condition", conditionId:"frightened", duration:{ kind:"minutes", amount:1 } },state.clock),
  );
  const started = resolveBerserkerMindlessRageStart(TEST_PROFILE,state,{
    id:"berserker.rage.start",
    actorId:"hero",
    expectedRevision:0,
    barbarianLevel:6,
    subclassId:BARBARIAN_BERSERKER_SUBCLASS_ID,
  });
  assert.equal(started.status,"committed");
  if (started.status !== "committed") return;
  assert.equal(started.state.effects.some((effect) => effect.conditionId === "charmed" || effect.conditionId === "frightened"),false);
  assert.ok(started.state.effects.some((effect) => effect.tags.includes(BERSERKER_MINDLESS_RAGE_TAG)));

  const suppressed = resolvePendingResolution(TEST_PROFILE,started.state,{
    id:"berserker.rage.charm-attempt",
    actorId:"goblin",
    sourceId:"test:charm",
    expectedRevision:started.state.revision,
    operations:[{
      id:"apply-charm",
      kind:"apply-effect",
      effect:{ id:"new-charmed", sourceId:"test:charm", targetId:"hero", kind:"condition", conditionId:"charmed", duration:{ kind:"minutes", amount:1 } },
    }],
  });
  assert.equal(suppressed.status,"committed");
  if (suppressed.status !== "committed") return;
  assert.equal(suppressed.state.effects.some((effect) => effect.id === "new-charmed"),false);

  const ended = resolveBerserkerMindlessRageEnd(TEST_PROFILE,suppressed.state,{
    id:"berserker.rage.end",
    actorId:"hero",
    expectedRevision:suppressed.state.revision,
  });
  assert.equal(ended.status,"committed");
  if (ended.status !== "committed") return;
  assert.equal(ended.state.effects.some((effect) => effect.tags.includes(BERSERKER_MINDLESS_RAGE_TAG)),false);

  const applied = resolvePendingResolution(TEST_PROFILE,ended.state,{
    id:"berserker.after-rage.charm",
    actorId:"goblin",
    sourceId:"test:charm",
    expectedRevision:ended.state.revision,
    operations:[{
      id:"apply-charm",
      kind:"apply-effect",
      effect:{ id:"post-rage-charmed", sourceId:"test:charm", targetId:"hero", kind:"condition", conditionId:"charmed", duration:{ kind:"minutes", amount:1 } },
    }],
  });
  assert.equal(applied.status,"committed");
  if (applied.status !== "committed") return;
  assert.ok(applied.state.effects.some((effect) => effect.id === "post-rage-charmed"));
});

test("Retaliation spends Reaction and makes the melee attack against the triggering creature, including unseen-target disadvantage", () => {
  const state = runtimeState();
  const result = resolveBerserkerRetaliation(TEST_PROFILE,state,{
    id:"berserker.retaliation",
    actorId:"hero",
    expectedRevision:0,
    barbarianLevel:10,
    subclassId:BARBARIAN_BERSERKER_SUBCLASS_ID,
    triggeringDamageSourceActorId:"goblin",
    attack:{
      sourceKind:"weapon",
      target:{
        id:"goblin",
        kind:"creature",
        relation:"enemy",
        distanceFeet:5,
        visible:false,
        cover:"none",
        ac:12,
        creatureKind:"monster",
        targetCanSeeAttacker:true,
      },
      attackDice:{ id:"retaliation-d20", purpose:"Retaliation melee attack", sides:20, faces:[18,12] },
      attackModifierContributions:[{ source:"strength", value:5 }],
      baseDamage:{
        sourceId:"weapon:greataxe",
        damageType:"slashing",
        dice:[{ source:"weapon:greataxe", count:1, sides:12, faces:[6,6] }],
        flat:[{ source:"strength", value:3 }],
      },
    },
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.economy.reaction,false);
  assert.equal(result.state.combatants.goblin.life.hp.current,6);
  const attackResult = result.results["berserker.retaliation:attack"] as { rollState:string; dice:{ selectedFace:number } };
  assert.equal(attackResult.rollState,"disadvantage");
  assert.equal(attackResult.dice.selectedFace,12);

  const wrongSource = resolveBerserkerRetaliation(TEST_PROFILE,runtimeState(),{
    id:"berserker.retaliation.invalid",
    actorId:"hero",
    expectedRevision:0,
    barbarianLevel:10,
    subclassId:BARBARIAN_BERSERKER_SUBCLASS_ID,
    triggeringDamageSourceActorId:"someone-else",
    attack:{
      sourceKind:"unarmed",
      target:{ id:"goblin", kind:"creature", relation:"enemy", distanceFeet:5, visible:true, cover:"none", ac:12, creatureKind:"monster", targetCanSeeAttacker:true },
      attackDice:{ id:"invalid-d20", purpose:"Retaliation", sides:20, faces:[15] },
      attackModifierContributions:[{ source:"strength", value:5 }],
      baseDamage:{ sourceId:"unarmed", damageType:"bludgeoning", dice:[], flat:[{ source:"unarmed", value:6 }] },
    },
  });
  assert.equal(wrongSource.status,"rejected");
  assert.equal(wrongSource.state.combatants.hero.economy.reaction,true);
});

test("Intimidating Presence uses the Strength-based save DC, spends Bonus Action, applies Frightened for one minute, and repeat success ends it", () => {
  assert.equal(berserkerIntimidatingPresenceDc(4,3),15);
  const state = runtimeState();
  const result = resolveBerserkerIntimidatingPresence(TEST_PROFILE,state,{
    id:"berserker.intimidating",
    actorId:"hero",
    expectedRevision:0,
    barbarianLevel:14,
    subclassId:BARBARIAN_BERSERKER_SUBCLASS_ID,
    strengthModifier:4,
    proficiencyBonus:3,
    targets:[{
      id:"goblin",
      kind:"creature",
      relation:"enemy",
      distanceFeet:25,
      visible:false,
      cover:"none",
      wisdomSaveModifier:1,
      saveDice:{ id:"intimidating-save", purpose:"Wisdom save", sides:20, faces:[5] },
    }],
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.economy.bonusAction,false);
  const effect = result.state.effects.find((entry) => entry.sourceId === BERSERKER_INTIMIDATING_PRESENCE_FEATURE_ID && entry.tags.includes(BERSERKER_INTIMIDATING_PRESENCE_TAG));
  assert.ok(effect);
  assert.equal(effect?.conditionId,"frightened");
  assert.deepEqual(effect?.expiry,{ kind:"time", elapsedSeconds:60 });
  assert.equal(effect?.metadata?.saveDc,15);

  const repeated = resolveBerserkerIntimidatingPresenceRepeatSave(TEST_PROFILE,result.state,{
    id:"berserker.intimidating.repeat",
    targetId:"goblin",
    expectedRevision:result.state.revision,
    wisdomSaveModifier:1,
    saveDice:{ id:"intimidating-repeat-save", purpose:"Wisdom save", sides:20, faces:[18] },
  });
  assert.equal(repeated.status,"committed");
  if (repeated.status !== "committed") return;
  assert.equal(repeated.state.effects.some((entry) => entry.id === effect?.id),false);
});
