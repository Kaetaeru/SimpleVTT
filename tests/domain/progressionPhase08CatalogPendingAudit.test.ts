import assert from "node:assert/strict";
import test from "node:test";
import { SPELL_PRESENTATIONS } from "../../src/app/spellPresentation";
import { FEAT_RULE_CATALOG } from "../../src/domain/featRuleCatalog";
import type { ChoiceSelectionMap } from "../../src/domain/choiceDefinition";
import type { ProgressionCharacterState, ProgressionRequest } from "../../src/domain/progression";
import { PROGRESSION_CATALOG, proficiencyBonusForTotalLevel } from "../../src/domain/progressionCatalog";
import { buildProgressionPlanPhase08MonkOpenHand } from "../../src/domain/progressionPhase08MonkOpenHand";
import { buildProgressionPlanPhase08RogueThief } from "../../src/domain/progressionPhase08RogueThief";
import { classCantripListEntries } from "../../src/domain/spellListCatalog";
import { MONK_OPEN_HAND_SUBCLASS_ID, ROGUE_THIEF_SUBCLASS_ID, srdSubclassIdForClass } from "../../src/domain/srdSubclassCatalog";
import {
  MONK_FOCUS_RESOURCE_ID,
  MONK_OPEN_HAND_CLASS_ID,
  OPEN_HAND_FLEET_STEP_FEATURE_ID,
  OPEN_HAND_FLEET_STEP_JUMP_TAG,
  OPEN_HAND_QUIVERING_PALM_FEATURE_ID,
  OPEN_HAND_QUIVERING_PALM_TAG,
  OPEN_HAND_WHOLENESS_OF_BODY_FEATURE_ID,
  OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID,
  STEP_OF_THE_WIND_SOURCE_ID,
  monkOpenHandRuntimeResourceDefinitions,
  resolveOpenHandFleetStep,
  resolveOpenHandQuiveringPalmDetonation,
  resolveOpenHandQuiveringPalmSeed,
  resolveOpenHandWholenessOfBody,
} from "../../src/domain/monkOpenHand";
import {
  ROGUE_THIEF_CLASS_ID,
  THIEF_SUPREME_SNEAK_CUNNING_STRIKE,
  THIEF_SUPREME_SNEAK_FEATURE_ID,
  THIEF_THIEFS_REFLEXES_FEATURE_ID,
  THIEF_USE_MAGIC_DEVICE_FEATURE_ID,
  resolveThiefMagicItemChargeUse,
  resolveThiefSpellScrollUse,
  supremeSneakPreservesHideInvisible,
  thiefFirstRoundTurns,
  thiefMagicItemAttunementMaximum,
} from "../../src/domain/rogueThief";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

type AuditState = ProgressionCharacterState & {
  subclassIds?:Record<string,string>;
  subclassFeatureIds?:string[];
  subclassFeatureSources?:Record<string,string>;
  epicBoonFeatIds?:string[];
  epicBoonFeatSources?:Record<string,string>;
  bardMagicalDiscoverySpellIds?:string[];
  bardMagicalDiscoverySpellSources?:Record<string,string>;
};

const spellOptions = SPELL_PRESENTATIONS.map((spell) => ({
  id:spell.id,
  label:spell.name,
  description:spell.summary,
  level:spell.level,
  castingTime:spell.castingTime,
  school:spell.school,
}));
const featOptions = FEAT_RULE_CATALOG.feats.map((feat) => ({ id:feat.id, label:feat.name, description:feat.originalName }));
const originFeatOptions = FEAT_RULE_CATALOG.feats
  .filter((feat) => feat.tags.includes("origin"))
  .map((feat) => ({ id:feat.id, label:feat.name, description:feat.originalName }));
const fightingStyleOptions = FEAT_RULE_CATALOG.feats
  .filter((feat) => feat.tags.includes("fighting-style"))
  .map((feat) => ({ id:feat.id, label:feat.name, description:feat.originalName }));
const languageOptions = ["공용어","드워프어","엘프어","거인어","노움어","고블린어","하플링어","오크어"]
  .map((label,index) => ({ id:`language:audit-${index}`, label, description:"Phase 08 catalog-pending audit option" }));

function classCantripOptions(classId:string) {
  const presentation = new Map(SPELL_PRESENTATIONS.map((spell) => [spell.id,spell]));
  return classCantripListEntries(classId).map((spell) => ({
    id:spell.id,
    label:presentation.get(spell.id)?.name ?? spell.nameEn,
    description:presentation.get(spell.id)?.summary ?? spell.nameEn,
  }));
}

function stateFor(classId:string,targetLevel:number):AuditState {
  const definition = PROGRESSION_CATALOG.classes.find((entry) => entry.id === classId)!;
  const currentLevel = targetLevel - 1;
  const subclassId = currentLevel >= 3 ? srdSubclassIdForClass(classId) : undefined;
  return {
    revision:1000 + targetLevel,
    id:`audit:${definition.slug}:${currentLevel}`,
    name:`Audit ${definition.nameEn}`,
    totalLevel:currentLevel,
    abilities:{ str:18,dex:18,con:18,int:18,wis:18,cha:18 },
    hpCurrent:20 + currentLevel * 6,
    hpMaximum:20 + currentLevel * 6,
    proficiencyBonus:proficiencyBonusForTotalLevel(currentLevel),
    classTracks:[{
      classId,
      className:definition.nameKo,
      level:currentLevel,
      ...(currentLevel >= 3 ? { subclassName:definition.srdSubclassName } : {}),
    }],
    hitDiceByDie:{ [`d${definition.hitDie}`]:currentLevel },
    features:["주문 시전",...(currentLevel >= 3 ? [definition.srdSubclassName] : [])],
    proficientSkills:["운동","곡예","비전","역사","통찰","지각","은신","설득"],
    expertiseSkills:[],
    expertiseSources:{},
    languages:["공용어"],
    languageSources:{},
    cantripIds:[],
    cantripSources:{},
    preparedSpellIds:[],
    preparedSpellSources:{},
    spellbookSpellIds:[],
    spellbookSpellSources:{},
    spellMasterySpellIds:{},
    spellMasterySources:{},
    signatureSpellIds:[],
    signatureSpellSources:{},
    metamagicIds:[],
    metamagicSources:{},
    eldritchInvocationIds:[],
    eldritchInvocationSources:{},
    mysticArcanumSpellIds:{},
    mysticArcanumSources:{},
    pactMagicSlotLevel:0,
    pactMagicSlotMaximum:0,
    spellSlotMaximums:{},
    weaponMasteryIds:[],
    weaponMasterySources:{},
    fightingStyleFeatIds:[],
    fightingStyleFeatSources:{},
    subclassIds:subclassId ? { [classId]:subclassId } : {},
    subclassFeatureIds:[],
    subclassFeatureSources:{},
    epicBoonFeatIds:[],
    epicBoonFeatSources:{},
    bardMagicalDiscoverySpellIds:[],
    bardMagicalDiscoverySpellSources:{},
  };
}

function requestFor(state:AuditState,classId:string,targetLevel:number):ProgressionRequest {
  const definition = PROGRESSION_CATALOG.classes.find((entry) => entry.id === classId)!;
  const selections:ChoiceSelectionMap = targetLevel === 3
    ? { [`progression.${classId}.3.subclass`]:{ kind:"options", optionIds:[`subclass:${definition.srdSubclassName}`] } }
    : {};
  return {
    expectedRevision:state.revision,
    targetClassId:classId,
    hpMethod:"fixed",
    selections,
    featOptions,
    originFeatOptions,
    fightingStyleOptions,
    druidCantripOptions:classCantripOptions("dnd.srd521.class.druid"),
    clericCantripOptions:classCantripOptions("dnd.srd521.class.cleric"),
    languageOptions,
    spellOptions,
  };
}

test("outermost Phase 08 progression plans have zero catalog-pending choices across all 12 classes and levels 2-20", () => {
  const pending:Array<{ classId:string; className:string; level:number; choiceId:string; label:string; reason:string }> = [];
  for (const definition of PROGRESSION_CATALOG.classes) {
    for (let targetLevel = 2; targetLevel <= 20; targetLevel += 1) {
      const state = stateFor(definition.id,targetLevel);
      const plan = buildProgressionPlanPhase08RogueThief(state,requestFor(state,definition.id,targetLevel));
      for (const choice of plan.choices.filter((entry) => entry.status === "catalog-pending")) {
        pending.push({
          classId:definition.id,
          className:definition.nameKo,
          level:targetLevel,
          choiceId:choice.id,
          label:choice.label,
          reason:choice.pendingReason ?? "missing pending reason",
        });
      }
    }
  }
  assert.deepEqual(pending,[],`unexpected Phase 08 catalog-pending choices:\n${JSON.stringify(pending,null,2)}`);
});

test("Open Hand 6/11/17 progression replaces generic subclass blockers with stable mechanics-backed feature ids", () => {
  const expected = [
    [6,OPEN_HAND_WHOLENESS_OF_BODY_FEATURE_ID,"신체 완성"],
    [11,OPEN_HAND_FLEET_STEP_FEATURE_ID,"날랜 발걸음"],
    [17,OPEN_HAND_QUIVERING_PALM_FEATURE_ID,"진동장"],
  ] as const;
  for (const [level,featureId,label] of expected) {
    const state = stateFor(MONK_OPEN_HAND_CLASS_ID,level);
    const plan = buildProgressionPlanPhase08MonkOpenHand(state,requestFor(state,MONK_OPEN_HAND_CLASS_ID,level));
    assert.equal(plan.choices.some((choice) => choice.status === "catalog-pending"),false);
    assert.ok(plan.diffs.some((diff) => diff.label === "서브클래스 특성" && diff.after === label));
    assert.ok(featureId.startsWith("dnd.srd521.feature.monk.open-hand."));
  }
});

test("Monk Focus and Wholeness of Body resources use the shared class pool model and Wisdom-based Long-Rest uses", () => {
  const definitions = monkOpenHandRuntimeResourceDefinitions(
    [{ classId:MONK_OPEN_HAND_CLASS_ID, className:"수도승", level:17, subclassName:"열린 손의 전사" }],
    { [MONK_OPEN_HAND_CLASS_ID]:MONK_OPEN_HAND_SUBCLASS_ID },
    18,
  );
  assert.deepEqual(definitions.map((entry) => [entry.resourceId,entry.maximum]),[
    [MONK_FOCUS_RESOURCE_ID,17],
    [OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID,4],
  ]);
  assert.equal(definitions[0]?.recovery.shortRest,"all");
  assert.equal(definitions[0]?.recovery.longRest,"all");
  assert.equal(definitions[1]?.recovery.longRest,"all");
});

test("Wholeness of Body spends Bonus Action plus one use and heals one Martial Arts die plus Wisdom", () => {
  const state = runtimeState();
  state.combatants.hero.life.hp.current = 7;
  state.combatants.hero.resources.push({
    id:OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID,
    label:"신체 완성",
    current:4,
    maximum:4,
    recovery:{ longRest:"all" },
  });
  const result = resolveOpenHandWholenessOfBody(TEST_PROFILE,state,{
    id:"open-hand.wholeness",
    actorId:"hero",
    expectedRevision:state.revision,
    monkLevel:6,
    subclassId:MONK_OPEN_HAND_SUBCLASS_ID,
    wisdomModifier:4,
    martialArtsDieFace:8,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.life.hp.current,19);
  assert.equal(result.state.combatants.hero.economy.bonusAction,false);
  assert.equal(result.state.combatants.hero.resources.find((entry) => entry.id === OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID)?.current,3);
});

test("Fleet Step requires the immediately preceding non-Step Bonus Action and reuses Step of the Wind without spending another Bonus Action", () => {
  const state = runtimeState();
  state.clock.activeActorId = "hero";
  state.combatants.hero.resources.push({
    id:MONK_FOCUS_RESOURCE_ID,
    label:"기 점수",
    current:11,
    maximum:11,
    recovery:{ shortRest:"all", longRest:"all" },
  });
  const trigger = resolvePendingResolution(TEST_PROFILE,state,{
    id:"open-hand.trigger-bonus",
    actorId:"hero",
    sourceId:"test:non-step-bonus-action",
    expectedRevision:state.revision,
    operations:[{
      id:"open-hand.trigger-bonus:economy",
      kind:"use-economy",
      actorId:"hero",
      slot:"bonus-action",
      bonusActionGranted:true,
      actionKind:"other",
    }],
  });
  assert.equal(trigger.status,"committed");
  if (trigger.status !== "committed") return;
  const result = resolveOpenHandFleetStep(TEST_PROFILE,trigger.state,{
    id:"open-hand.fleet-step",
    actorId:"hero",
    expectedRevision:trigger.state.revision,
    monkLevel:11,
    subclassId:MONK_OPEN_HAND_SUBCLASS_ID,
    triggeringResolutionId:"open-hand.trigger-bonus",
    triggeringBonusActionSourceId:"test:non-step-bonus-action",
    spendFocus:true,
    distanceFeet:30,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.economy.bonusAction,false,"Fleet Step must not spend a second Bonus Action");
  assert.equal(result.state.combatants.hero.resources.find((entry) => entry.id === MONK_FOCUS_RESOURCE_ID)?.current,10);
  assert.ok(result.state.effects.some((effect) => effect.tags.includes(OPEN_HAND_FLEET_STEP_JUMP_TAG) && effect.metadata?.jumpDistanceMultiplier === 2));

  const invalid = resolveOpenHandFleetStep(TEST_PROFILE,trigger.state,{
    id:"open-hand.fleet-step.invalid",
    actorId:"hero",
    expectedRevision:trigger.state.revision,
    monkLevel:11,
    subclassId:MONK_OPEN_HAND_SUBCLASS_ID,
    triggeringResolutionId:"open-hand.trigger-bonus",
    triggeringBonusActionSourceId:STEP_OF_THE_WIND_SOURCE_ID,
    spendFocus:false,
    distanceFeet:30,
  });
  assert.equal(invalid.status,"rejected");
});

test("Quivering Palm spends 4 Focus, keeps only one seeded target, and Action detonation deals 10d12 force or half on a successful Constitution save", () => {
  const state = runtimeState();
  state.clock.activeActorId = "hero";
  state.combatants.hero.resources.push({
    id:MONK_FOCUS_RESOURCE_ID,
    label:"기 점수",
    current:12,
    maximum:17,
    recovery:{ shortRest:"all", longRest:"all" },
  });
  state.combatants.goblin.life.hp = { current:100, maximum:100, temporary:0 };
  state.combatants.orc = structuredClone(state.combatants.goblin);
  state.combatants.orc.id = "orc";

  const first = resolveOpenHandQuiveringPalmSeed(TEST_PROFILE,state,{
    id:"open-hand.quivering.first",
    actorId:"hero",
    targetId:"goblin",
    expectedRevision:state.revision,
    monkLevel:17,
    subclassId:MONK_OPEN_HAND_SUBCLASS_ID,
    unarmedStrikeHit:true,
  });
  assert.equal(first.status,"committed");
  if (first.status !== "committed") return;
  assert.equal(first.state.combatants.hero.resources.find((entry) => entry.id === MONK_FOCUS_RESOURCE_ID)?.current,8);

  const second = resolveOpenHandQuiveringPalmSeed(TEST_PROFILE,first.state,{
    id:"open-hand.quivering.second",
    actorId:"hero",
    targetId:"orc",
    expectedRevision:first.state.revision,
    monkLevel:17,
    subclassId:MONK_OPEN_HAND_SUBCLASS_ID,
    unarmedStrikeHit:true,
  });
  assert.equal(second.status,"committed");
  if (second.status !== "committed") return;
  const seeded = second.state.effects.filter((effect) => effect.tags.includes(OPEN_HAND_QUIVERING_PALM_TAG));
  assert.equal(seeded.length,1);
  assert.equal(seeded[0]?.targetId,"orc");
  assert.equal(second.state.combatants.hero.resources.find((entry) => entry.id === MONK_FOCUS_RESOURCE_ID)?.current,4);

  const unsupported = resolveOpenHandQuiveringPalmDetonation(TEST_PROFILE,second.state,{
    id:"open-hand.quivering.replace-attack",
    actorId:"hero",
    targetId:"orc",
    expectedRevision:second.state.revision,
    monkLevel:17,
    subclassId:MONK_OPEN_HAND_SUBCLASS_ID,
    activation:"replace-attack",
    samePlane:true,
    proficiencyBonus:6,
    wisdomModifier:4,
    targetConSaveModifier:0,
    saveDice:{ id:"open-hand.save.unsupported", purpose:"Quivering Palm Constitution save", sides:20, faces:[1] },
    forceDamageFaces:[8,8,8,8,8,8,8,8,8,8],
    creatureKind:"monster",
  });
  assert.equal(unsupported.status,"rejected");
  assert.match(unsupported.status === "rejected" ? unsupported.error : "",/Attack-sequence replacement support/);

  const failedSave = resolveOpenHandQuiveringPalmDetonation(TEST_PROFILE,second.state,{
    id:"open-hand.quivering.detonate",
    actorId:"hero",
    targetId:"orc",
    expectedRevision:second.state.revision,
    monkLevel:17,
    subclassId:MONK_OPEN_HAND_SUBCLASS_ID,
    activation:"action",
    samePlane:true,
    proficiencyBonus:6,
    wisdomModifier:4,
    targetConSaveModifier:0,
    saveDice:{ id:"open-hand.save.fail", purpose:"Quivering Palm Constitution save", sides:20, faces:[1] },
    forceDamageFaces:[8,8,8,8,8,8,8,8,8,8],
    creatureKind:"monster",
  });
  assert.equal(failedSave.status,"committed");
  if (failedSave.status !== "committed") return;
  assert.equal(failedSave.state.combatants.orc.life.hp.current,20);
  assert.equal(failedSave.state.combatants.hero.economy.action,false);
  assert.equal(failedSave.state.effects.some((effect) => effect.tags.includes(OPEN_HAND_QUIVERING_PALM_TAG)),false);

  const halfState = runtimeState();
  halfState.clock.activeActorId = "hero";
  halfState.combatants.hero.resources.push({
    id:MONK_FOCUS_RESOURCE_ID,
    label:"기 점수",
    current:4,
    maximum:17,
    recovery:{ shortRest:"all", longRest:"all" },
  });
  halfState.combatants.goblin.life.hp = { current:100, maximum:100, temporary:0 };
  const halfSeed = resolveOpenHandQuiveringPalmSeed(TEST_PROFILE,halfState,{
    id:"open-hand.quivering.half.seed",
    actorId:"hero",
    targetId:"goblin",
    expectedRevision:halfState.revision,
    monkLevel:17,
    subclassId:MONK_OPEN_HAND_SUBCLASS_ID,
    unarmedStrikeHit:true,
  });
  assert.equal(halfSeed.status,"committed");
  if (halfSeed.status !== "committed") return;
  const successfulSave = resolveOpenHandQuiveringPalmDetonation(TEST_PROFILE,halfSeed.state,{
    id:"open-hand.quivering.half.detonate",
    actorId:"hero",
    targetId:"goblin",
    expectedRevision:halfSeed.state.revision,
    monkLevel:17,
    subclassId:MONK_OPEN_HAND_SUBCLASS_ID,
    activation:"action",
    samePlane:true,
    proficiencyBonus:6,
    wisdomModifier:4,
    targetConSaveModifier:0,
    saveDice:{ id:"open-hand.save.success", purpose:"Quivering Palm Constitution save", sides:20, faces:[20] },
    forceDamageFaces:[8,8,8,8,8,8,8,8,8,8],
    creatureKind:"monster",
  });
  assert.equal(successfulSave.status,"committed");
  if (successfulSave.status !== "committed") return;
  assert.equal(successfulSave.state.combatants.goblin.life.hp.current,60,"80 force damage is halved to 40 on a successful save");
});

test("Thief 9/13/17 progression replaces the final generic subclass blockers with stable mechanics-backed feature ids", () => {
  const expected = [
    [9,THIEF_SUPREME_SNEAK_FEATURE_ID,"최고의 은신"],
    [13,THIEF_USE_MAGIC_DEVICE_FEATURE_ID,"마법 장치 사용"],
    [17,THIEF_THIEFS_REFLEXES_FEATURE_ID,"도둑의 반사 신경"],
  ] as const;
  for (const [level,featureId,label] of expected) {
    const state = stateFor(ROGUE_THIEF_CLASS_ID,level);
    const plan = buildProgressionPlanPhase08RogueThief(state,requestFor(state,ROGUE_THIEF_CLASS_ID,level));
    assert.equal(plan.choices.some((choice) => choice.status === "catalog-pending"),false);
    assert.ok(plan.diffs.some((diff) => diff.label === "서브클래스 특성" && diff.after === label));
    assert.ok(featureId.startsWith("dnd.srd521.feature.rogue.thief."));
  }
});

test("Supreme Sneak exposes the exact one-die Cunning Strike cost and preserves Hide invisibility only behind Three-Quarters or Total Cover", () => {
  assert.equal(THIEF_SUPREME_SNEAK_CUNNING_STRIKE.sneakAttackDiceCost,1);
  const base = {
    rogueLevel:9,
    subclassId:ROGUE_THIEF_SUBCLASS_ID,
    usedStealthAttackOption:true,
    invisibleFromHideAction:true,
  } as const;
  assert.equal(supremeSneakPreservesHideInvisible({ ...base, endTurnCover:"three-quarters" }),true);
  assert.equal(supremeSneakPreservesHideInvisible({ ...base, endTurnCover:"total" }),true);
  assert.equal(supremeSneakPreservesHideInvisible({ ...base, endTurnCover:"half" }),false);
  assert.equal(supremeSneakPreservesHideInvisible({ ...base, usedStealthAttackOption:false, endTurnCover:"total" }),false);
  assert.equal(supremeSneakPreservesHideInvisible({ ...base, invisibleFromHideAction:false, endTurnCover:"total" }),false);
});

test("Use Magic Device raises attunement to four, preserves charges only on d6=6, and uses Intelligence Arcana for level 2+ spell scrolls", () => {
  assert.equal(thiefMagicItemAttunementMaximum(3,13,ROGUE_THIEF_SUBCLASS_ID),4);
  assert.equal(thiefMagicItemAttunementMaximum(5,13,ROGUE_THIEF_SUBCLASS_ID),5,"a higher independent attunement cap is never reduced");

  assert.deepEqual(resolveThiefMagicItemChargeUse(13,ROGUE_THIEF_SUBCLASS_ID,3,6),{
    dieFace:6,
    requestedCharges:3,
    spentCharges:0,
    preserved:true,
  });
  assert.deepEqual(resolveThiefMagicItemChargeUse(13,ROGUE_THIEF_SUBCLASS_ID,3,5),{
    dieFace:5,
    requestedCharges:3,
    spentCharges:3,
    preserved:false,
  });

  const low = resolveThiefSpellScrollUse(TEST_PROFILE,{
    rogueLevel:13,
    subclassId:ROGUE_THIEF_SUBCLASS_ID,
    spellLevel:1,
  });
  assert.equal(low.spellcastingAbility,"intelligence");
  assert.equal(low.checkRequired,false);
  assert.equal(low.outcome,"cast");

  const success = resolveThiefSpellScrollUse(TEST_PROFILE,{
    rogueLevel:13,
    subclassId:ROGUE_THIEF_SUBCLASS_ID,
    spellLevel:5,
    dice:{ id:"thief.scroll.success", purpose:"Intelligence (Arcana) spell scroll check", sides:20, faces:[12] },
    intelligenceArcanaModifiers:[{ source:"thief:intelligence-arcana", value:3 }],
  });
  assert.equal(success.dc,15);
  assert.equal(success.check?.total,15);
  assert.equal(success.outcome,"cast");

  const failure = resolveThiefSpellScrollUse(TEST_PROFILE,{
    rogueLevel:13,
    subclassId:ROGUE_THIEF_SUBCLASS_ID,
    spellLevel:5,
    dice:{ id:"thief.scroll.failure", purpose:"Intelligence (Arcana) spell scroll check", sides:20, faces:[1] },
    intelligenceArcanaModifiers:[{ source:"thief:intelligence-arcana", value:3 }],
  });
  assert.equal(failure.outcome,"destroyed");
});

test("Thief's Reflexes emits exactly two first-round turn slots at normal initiative and initiative minus 10", () => {
  const turns = thiefFirstRoundTurns({ id:"rogue", controller:"player", total:18 },17,ROGUE_THIEF_SUBCLASS_ID);
  assert.deepEqual(turns.map((turn) => ({ actorId:turn.actorId, initiativeTotal:turn.initiativeTotal, ordinal:turn.ordinal })),[
    { actorId:"rogue", initiativeTotal:18, ordinal:1 },
    { actorId:"rogue", initiativeTotal:8, ordinal:2 },
  ]);
  assert.equal(turns[1]?.sourceId,THIEF_THIEFS_REFLEXES_FEATURE_ID);
});
