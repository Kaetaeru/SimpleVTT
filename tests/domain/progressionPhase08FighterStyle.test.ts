import assert from "node:assert/strict";
import test from "node:test";
import type { ProgressionRequest } from "../../src/domain/progression";
import {
  buildProgressionPlanPhase08FighterStyle,
  resolveProgressionPhase08FighterStyle,
} from "../../src/domain/progressionPhase08FighterStyle";
import {
  encodeFightingStyleReplacement,
  fighterFightingStyleChoiceId,
  fighterFightingStyleReplacementChoiceId,
  FIGHTER_FIGHTING_STYLE_CLASS_ID,
  type FighterFightingStyleState,
} from "../../src/domain/fighterFightingStyleProgression";
import { weaponMasteryChoiceId } from "../../src/domain/weaponMasteryProgression";

const ARCHERY = "dnd.srd521.feat.fighting-style.archery";
const DEFENSE = "dnd.srd521.feat.fighting-style.defense";
const GREAT_WEAPON = "dnd.srd521.feat.fighting-style.great-weapon-fighting";
const TWO_WEAPON = "dnd.srd521.feat.fighting-style.two-weapon-fighting";
const GREAT_SWORD = "dnd.srd521.item.weapon.greatsword";
const LONG_SWORD = "dnd.srd521.item.weapon.longsword";
const LONG_BOW = "dnd.srd521.item.weapon.longbow";

const styleOptions = [
  { id:ARCHERY, label:"궁술", description:"원거리 무기 명중 +2" },
  { id:DEFENSE, label:"방어", description:"방어구 착용 중 AC +1" },
  { id:GREAT_WEAPON, label:"대형 무기 전투", description:"대형 무기 피해 주사위 최솟값" },
  { id:TWO_WEAPON, label:"쌍수 전투", description:"경량 추가 공격 능력 수정치" },
];

function level0():FighterFightingStyleState {
  return {
    revision:0,
    id:"fighter",
    name:"Fighter",
    totalLevel:0,
    abilities:{ str:16, dex:14, con:14, int:10, wis:10, cha:8 },
    hpCurrent:1,
    hpMaximum:1,
    proficiencyBonus:0,
    classTracks:[],
    hitDiceByDie:{},
    features:[],
    fightingStyleFeatIds:[],
    fightingStyleFeatSources:{},
  };
}

function request(state:FighterFightingStyleState,selections:ProgressionRequest["selections"]):ProgressionRequest {
  return {
    expectedRevision:state.revision,
    targetClassId:FIGHTER_FIGHTING_STYLE_CLASS_ID,
    hpMethod:"fixed",
    selections,
    featOptions:[],
    originFeatOptions:[],
    fightingStyleOptions:styleOptions,
    languageOptions:[],
    spellOptions:[],
  };
}

test("Fighter 1 materializes Fighting Style and Weapon Mastery instead of leaving catalog-pending blockers", () => {
  const state = level0();
  const styleId = fighterFightingStyleChoiceId(1);
  const masteryId = weaponMasteryChoiceId(FIGHTER_FIGHTING_STYLE_CLASS_ID,1);
  const selections = {
    [styleId]:{ kind:"options" as const, optionIds:[ARCHERY] },
    [masteryId]:{ kind:"options" as const, optionIds:[GREAT_SWORD,LONG_SWORD,LONG_BOW] },
  };
  const plan = buildProgressionPlanPhase08FighterStyle(state,request(state,selections));
  const style = plan.choices.find((choice) => choice.id === styleId);
  assert.ok(style);
  assert.equal(style?.status,"ready");
  assert.deepEqual(style?.options.map((option) => option.label),["궁술","방어","대형 무기 전투","쌍수 전투"]);
  assert.deepEqual(plan.blocking,[]);
  assert.ok(!plan.blocking.some((message) => /catalog/.test(message)));
  assert.ok(plan.diffs.some((diff) => diff.label === "전투 방식" && diff.after === "궁술"));

  const result = resolveProgressionPhase08FighterStyle(state,request(state,selections));
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  const next = result.state as FighterFightingStyleState & { weaponMasteryIds?:string[] };
  assert.equal(next.totalLevel,1);
  assert.deepEqual(next.fightingStyleFeatIds,[ARCHERY]);
  assert.match(next.fightingStyleFeatSources?.[ARCHERY] ?? "",/파이터 1레벨 · 전투 방식/);
  assert.ok(next.features.includes(ARCHERY));
  assert.deepEqual(next.weaponMasteryIds,[GREAT_SWORD,LONG_SWORD,LONG_BOW]);
});

test("gaining another Fighter level can optionally replace one known Fighting Style feat", () => {
  const state: FighterFightingStyleState = {
    ...level0(),
    revision:5,
    totalLevel:1,
    proficiencyBonus:2,
    hpCurrent:12,
    hpMaximum:12,
    classTracks:[{ classId:FIGHTER_FIGHTING_STYLE_CLASS_ID, className:"파이터", level:1 }],
    hitDiceByDie:{ d10:1 },
    features:[ARCHERY,"재기의 바람","무기 통달"],
    fightingStyleFeatIds:[ARCHERY],
    fightingStyleFeatSources:{ [ARCHERY]:"파이터 1레벨" },
  };
  const replacementId = fighterFightingStyleReplacementChoiceId(2);
  const replacement = encodeFightingStyleReplacement(ARCHERY,DEFENSE);
  const selections = { [replacementId]:{ kind:"options" as const, optionIds:[replacement] } };
  const plan = buildProgressionPlanPhase08FighterStyle(state,request(state,selections));
  const choice = plan.choices.find((entry) => entry.id === replacementId);
  assert.ok(choice);
  assert.equal(choice?.required,false);
  assert.ok(choice?.options.some((option) => option.id === replacement && option.label === "궁술 → 방어"));
  assert.deepEqual(plan.blocking,[]);

  const result = resolveProgressionPhase08FighterStyle(state,request(state,selections));
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  const next = result.state as FighterFightingStyleState;
  assert.deepEqual(next.fightingStyleFeatIds,[DEFENSE]);
  assert.equal(next.features.includes(ARCHERY),false);
  assert.ok(next.features.includes(DEFENSE));
  assert.match(next.fightingStyleFeatSources?.[DEFENSE] ?? "",/파이터 2레벨 획득/);
});

test("Fighter Fighting Style choices reject unknown ids and do not accept an already-known style", () => {
  const state = level0();
  const styleId = fighterFightingStyleChoiceId(1);
  const masteryId = weaponMasteryChoiceId(FIGHTER_FIGHTING_STYLE_CLASS_ID,1);
  const baseMastery = { [masteryId]:{ kind:"options" as const, optionIds:[GREAT_SWORD,LONG_SWORD,LONG_BOW] } };
  const unknown = buildProgressionPlanPhase08FighterStyle(state,request(state,{
    ...baseMastery,
    [styleId]:{ kind:"options", optionIds:["feat:invented-style"] },
  }));
  assert.ok(unknown.blocking.some((message) => /알 수 없는 선택값/.test(message)));

  const knownState = { ...state, features:[ARCHERY], fightingStyleFeatIds:[ARCHERY] };
  const known = buildProgressionPlanPhase08FighterStyle(knownState,request(knownState,{
    ...baseMastery,
    [styleId]:{ kind:"options", optionIds:[ARCHERY] },
  }));
  assert.ok(known.blocking.some((message) => /이미 보유한 전투 방식/.test(message)));
});
