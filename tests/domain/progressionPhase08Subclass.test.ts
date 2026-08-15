import assert from "node:assert/strict";
import test from "node:test";
import type { ProgressionRequest } from "../../src/domain/progression";
import {
  buildProgressionPlanPhase08Subclass,
  resolveProgressionPhase08Subclass,
} from "../../src/domain/progressionPhase08Subclass";
import {
  CLERIC_SUBCLASS_CLASS_ID,
  DRUID_SUBCLASS_CLASS_ID,
  FIGHTER_SUBCLASS_CLASS_ID,
  PALADIN_SUBCLASS_CLASS_ID,
  RANGER_SUBCLASS_CLASS_ID,
  srdSubclassRelationship,
  subclassFeatureChoiceId,
  type SrdSubclassProgressionState,
} from "../../src/domain/srdSubclassProgression";
import { CLERIC_LIFE_DOMAIN_SUBCLASS_ID } from "../../src/domain/clericLifeDomain";
import { DRUID_CIRCLE_LAND_SUBCLASS_ID } from "../../src/domain/druidCircleLand";
import { FIGHTER_CHAMPION_SUBCLASS_ID } from "../../src/domain/fighterChampion";
import { HUNTER_DEFENSIVE_TACTICS_FEATURE_ID } from "../../src/domain/rangerHunter";
import { PALADIN_DEVOTION_SUBCLASS_ID, RANGER_HUNTER_SUBCLASS_ID } from "../../src/domain/srdSubclassCatalog";
import { weaponMasteryChoiceId } from "../../src/domain/weaponMasteryProgression";

const ARCHERY = "dnd.srd521.feat.fighting-style.archery";
const DEFENSE = "dnd.srd521.feat.fighting-style.defense";
const GREAT_WEAPON = "dnd.srd521.feat.fighting-style.great-weapon-fighting";
const TWO_WEAPON = "dnd.srd521.feat.fighting-style.two-weapon-fighting";
const styleOptions = [
  { id:ARCHERY, label:"궁술" },
  { id:DEFENSE, label:"방어" },
  { id:GREAT_WEAPON, label:"대형 무기 전투" },
  { id:TWO_WEAPON, label:"쌍수 전투" },
];

function fighter(level:number):SrdSubclassProgressionState {
  return {
    revision:level,
    id:"fighter",
    name:"Fighter",
    totalLevel:level,
    abilities:{ str:18, dex:14, con:16, int:10, wis:10, cha:8 },
    hpCurrent:20 + level * 8,
    hpMaximum:20 + level * 8,
    proficiencyBonus:level >= 9 ? 4 : level >= 5 ? 3 : 2,
    classTracks:[{ classId:FIGHTER_SUBCLASS_CLASS_ID, className:"파이터", level, subclassName:level >= 3 ? "챔피언" : undefined }],
    hitDiceByDie:{ d10:level },
    features:[],
    proficientSkills:["운동","지각"],
    fightingStyleFeatIds:[ARCHERY],
    fightingStyleFeatSources:{ [ARCHERY]:"파이터 1레벨" },
    weaponMasteryIds:[
      "dnd.srd521.item.weapon.greatsword",
      "dnd.srd521.item.weapon.longsword",
      "dnd.srd521.item.weapon.longbow",
      ...(level >= 4 ? ["dnd.srd521.item.weapon.rapier"] : []),
    ],
    weaponMasterySources:{},
    subclassIds:level >= 3 ? { [FIGHTER_SUBCLASS_CLASS_ID]:FIGHTER_CHAMPION_SUBCLASS_ID } : {},
    subclassFeatureIds:[],
    subclassFeatureSources:{},
  };
}

function request(state:SrdSubclassProgressionState,selections:ProgressionRequest["selections"]):ProgressionRequest {
  return {
    expectedRevision:state.revision,
    targetClassId:FIGHTER_SUBCLASS_CLASS_ID,
    hpMethod:"fixed",
    selections,
    featOptions:[],
    originFeatOptions:[],
    fightingStyleOptions:styleOptions,
    languageOptions:[],
    spellOptions:[],
  };
}

test("SRD subclass progression catalog records only the mechanics-backed automatic/choice relationships", () => {
  assert.deepEqual(
    srdSubclassRelationship(CLERIC_SUBCLASS_CLASS_ID,CLERIC_LIFE_DOMAIN_SUBCLASS_ID,6)?.features.map((feature) => feature.label),
    ["축복받은 치유자"],
  );
  assert.deepEqual(
    srdSubclassRelationship(CLERIC_SUBCLASS_CLASS_ID,CLERIC_LIFE_DOMAIN_SUBCLASS_ID,17)?.features.map((feature) => feature.label),
    ["최고의 치유"],
  );
  assert.deepEqual(
    srdSubclassRelationship(DRUID_SUBCLASS_CLASS_ID,DRUID_CIRCLE_LAND_SUBCLASS_ID,10)?.features.map((feature) => feature.label),
    ["자연의 수호"],
  );
  assert.deepEqual(
    srdSubclassRelationship(DRUID_SUBCLASS_CLASS_ID,DRUID_CIRCLE_LAND_SUBCLASS_ID,14)?.features.map((feature) => feature.label),
    ["자연의 성역"],
  );
  assert.deepEqual(
    [7,15,20].map((level) => srdSubclassRelationship(PALADIN_SUBCLASS_CLASS_ID,PALADIN_DEVOTION_SUBCLASS_ID,level)?.features[0]?.label),
    ["헌신의 오라","보호의 강타","성스러운 후광"],
  );
  assert.deepEqual(
    [7,11,15].map((level) => srdSubclassRelationship(RANGER_SUBCLASS_CLASS_ID,RANGER_HUNTER_SUBCLASS_ID,level)?.features[0]?.label),
    ["방어 전술","우월한 사냥꾼의 먹잇감","우월한 사냥꾼의 방어"],
  );
  assert.equal(srdSubclassRelationship(RANGER_SUBCLASS_CLASS_ID,RANGER_HUNTER_SUBCLASS_ID,7)?.choice,"ranger-defensive-tactics");
  assert.equal(srdSubclassRelationship(RANGER_SUBCLASS_CLASS_ID,RANGER_HUNTER_SUBCLASS_ID,7)?.features[0]?.id,HUNTER_DEFENSIVE_TACTICS_FEATURE_ID);
  assert.equal(srdSubclassRelationship("dnd.srd521.class.paladin","external-subclass",7),undefined);
});

test("Champion acquisition at Fighter 3 persists stable subclass and initial mechanics-backed feature ids without a fake subclass-feature choice", () => {
  const state = fighter(2);
  const selections = {
    [`progression.${FIGHTER_SUBCLASS_CLASS_ID}.3.subclass`]:{ kind:"options" as const, optionIds:["subclass:챔피언"] },
  };
  const plan = buildProgressionPlanPhase08Subclass(state,request(state,selections));
  assert.deepEqual(plan.blocking,[]);
  assert.equal(plan.choices.some((choice) => choice.id.endsWith(".subclass-feature")),false);
  assert.ok(plan.diffs.some((diff) => diff.label === "서브클래스 특성" && diff.after.includes("향상된 치명타") && diff.after.includes("비범한 운동선수")));

  const result = resolveProgressionPhase08Subclass(state,request(state,selections));
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  const next = result.state as SrdSubclassProgressionState;
  assert.equal(next.subclassIds?.[FIGHTER_SUBCLASS_CLASS_ID],FIGHTER_CHAMPION_SUBCLASS_ID);
  assert.ok(next.subclassFeatureIds?.includes("dnd.srd521.feature.fighter.champion.improved-critical"));
  assert.ok(next.subclassFeatureIds?.includes("dnd.srd521.feature.fighter.champion.remarkable-athlete"));
  assert.equal(next.classTracks[0].subclassName,"챔피언");
});

test("Champion 7 keeps its real Additional Fighting Style choice while removing the generic subclass catalog blocker", () => {
  const state = fighter(6);
  const choiceId = subclassFeatureChoiceId(FIGHTER_SUBCLASS_CLASS_ID,7);
  const selections = { [choiceId]:{ kind:"options" as const, optionIds:[DEFENSE] } };
  const plan = buildProgressionPlanPhase08Subclass(state,request(state,selections));
  const choice = plan.choices.find((entry) => entry.id === choiceId);
  assert.ok(choice);
  assert.equal(choice?.status,"ready");
  assert.equal(choice?.label,"추가 전투 방식");
  assert.equal(choice?.options.find((option) => option.id === ARCHERY)?.disabledReason,"이미 보유한 전투 방식 재주입니다.");
  assert.equal(choice?.options.find((option) => option.id === DEFENSE)?.disabledReason,undefined);
  assert.deepEqual(plan.blocking,[]);
  assert.ok(!plan.blocking.some((message) => /서브클래스별 고레벨 mechanics relationship/.test(message)));

  const result = resolveProgressionPhase08Subclass(state,request(state,selections));
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  const next = result.state as SrdSubclassProgressionState;
  assert.deepEqual(next.fightingStyleFeatIds,[ARCHERY,DEFENSE]);
  assert.ok(next.subclassFeatureIds?.includes("dnd.srd521.feature.fighter.champion.additional-fighting-style"));
  assert.match(next.fightingStyleFeatSources?.[DEFENSE] ?? "",/챔피언 7레벨/);
});

test("Champion automatic subclass feature at Fighter 10 no longer blocks level-up and persists Heroic Warrior", () => {
  const state = fighter(9);
  const masteryId = weaponMasteryChoiceId(FIGHTER_SUBCLASS_CLASS_ID,10);
  const selections = {
    [masteryId]:{ kind:"options" as const, optionIds:["dnd.srd521.item.weapon.shortbow"] },
  };
  const plan = buildProgressionPlanPhase08Subclass(state,request(state,selections));
  assert.deepEqual(plan.blocking,[]);
  assert.equal(plan.choices.some((choice) => choice.id === subclassFeatureChoiceId(FIGHTER_SUBCLASS_CLASS_ID,10)),false);
  assert.ok(plan.diffs.some((diff) => diff.label === "서브클래스 특성" && diff.after === "영웅적 전사"));

  const result = resolveProgressionPhase08Subclass(state,request(state,selections));
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  const next = result.state as SrdSubclassProgressionState;
  assert.ok(next.subclassFeatureIds?.includes("dnd.srd521.feature.fighter.champion.heroic-warrior"));
  assert.ok(next.features.includes("dnd.srd521.feature.fighter.champion.heroic-warrior"));
});
