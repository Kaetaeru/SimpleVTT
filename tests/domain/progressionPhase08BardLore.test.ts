import assert from "node:assert/strict";
import test from "node:test";
import type { ProgressionRequest } from "../../src/domain/progression";
import { classById } from "../../src/domain/progressionCatalog";
import {
  buildProgressionPlanPhase08BardLore,
  resolveProgressionPhase08BardLore,
} from "../../src/domain/progressionPhase08BardLore";
import {
  BARD_LORE_CLASS_ID,
  BARD_LORE_BONUS_PROFICIENCIES_FEATURE_ID,
  BARD_LORE_CUTTING_WORDS_FEATURE_ID,
  BARD_LORE_MAGICAL_DISCOVERIES_FEATURE_ID,
  BARD_LORE_PEERLESS_SKILL_FEATURE_ID,
  encodeLoreMagicalDiscoveryReplacement,
  loreBonusProficienciesChoiceId,
  loreMagicalDiscoveriesChoiceId,
  loreMagicalDiscoveriesReplacementChoiceId,
  type BardLoreProgressionState,
} from "../../src/domain/bardLoreProgression";
import { BARD_COLLEGE_LORE_SUBCLASS_ID } from "../../src/domain/bardCollegeLore";
import { classSpellListEntries, stableSpellId } from "../../src/domain/spellListCatalog";

const subclassName = classById(BARD_LORE_CLASS_ID)!.srdSubclassName;
const preparedChoiceId = (level:number) => `progression.${BARD_LORE_CLASS_ID}.${level}.column.준비 주문`;

function basePrepared() {
  return ["Animal Friendship","Bane","Charm Person","Command","Cure Wounds"].map(stableSpellId);
}

function bard(level:number,overrides:Partial<BardLoreProgressionState> = {}):BardLoreProgressionState {
  return {
    revision:level,
    id:"bard",
    name:"Lyra",
    totalLevel:level,
    abilities:{ str:8,dex:14,con:14,int:12,wis:12,cha:18 },
    hpCurrent:10 + Math.max(0,level - 1) * 7,
    hpMaximum:10 + Math.max(0,level - 1) * 7,
    proficiencyBonus:level >= 9 ? 4 : level >= 5 ? 3 : 2,
    classTracks:[{ classId:BARD_LORE_CLASS_ID, className:"바드", level, ...(level >= 3 ? { subclassName } : {}) }],
    hitDiceByDie:{ d8:level },
    features:["주문 시전","바드의 영감",...(level >= 3 ? [subclassName] : [])],
    proficientSkills:["공연","설득","비전"],
    cantripIds:[stableSpellId("Vicious Mockery"),stableSpellId("Mage Hand")],
    preparedSpellIds:basePrepared(),
    preparedSpellSources:{},
    subclassIds:level >= 3 ? { [BARD_LORE_CLASS_ID]:BARD_COLLEGE_LORE_SUBCLASS_ID } : {},
    subclassFeatureIds:[],
    subclassFeatureSources:{},
    bardMagicalDiscoverySpellIds:[],
    bardMagicalDiscoverySpellSources:{},
    ...overrides,
  };
}

function nextNativeBardSpell(state:BardLoreProgressionState,targetLevel:number) {
  const known = new Set((state.preparedSpellIds ?? []).map((value) => value.replace(/^always:/,"")));
  return classSpellListEntries(BARD_LORE_CLASS_ID,targetLevel >= 5 ? 4 : 2).find((entry) => !known.has(entry.id))!.id;
}

function request(state:BardLoreProgressionState,selections:ProgressionRequest["selections"]):ProgressionRequest {
  return {
    expectedRevision:state.revision,
    targetClassId:BARD_LORE_CLASS_ID,
    hpMethod:"fixed",
    selections,
    featOptions:[],
    originFeatOptions:[],
    fightingStyleOptions:[],
    languageOptions:[],
    spellOptions:[],
  };
}

test("College of Lore acquisition at Bard 3 adds three any-skill proficiencies and Cutting Words", () => {
  const state = bard(2,{ subclassIds:{} });
  const prepared = nextNativeBardSpell(state,3);
  const selections = {
    [`progression.${BARD_LORE_CLASS_ID}.3.subclass`]:{ kind:"options" as const, optionIds:[`subclass:${subclassName}`] },
    [preparedChoiceId(3)]:{ kind:"options" as const, optionIds:[prepared] },
    [loreBonusProficienciesChoiceId()]:{ kind:"options" as const, optionIds:["skill:history","skill:perception","skill:stealth"] },
  };
  const plan = buildProgressionPlanPhase08BardLore(state,request(state,selections));
  const skills = plan.choices.find((choice) => choice.id === loreBonusProficienciesChoiceId());
  assert.ok(skills);
  assert.equal(skills?.count,3);
  assert.equal(skills?.options.length,18);
  assert.equal(skills?.options.find((option) => option.label === "공연")?.disabledReason,"이미 숙련된 기술입니다.");
  assert.deepEqual(plan.blocking,[]);
  assert.ok(plan.diffs.some((diff) => diff.label === "전승 학파 · 추가 숙련" && diff.after.includes("역사") && diff.after.includes("지각") && diff.after.includes("은신")));
  assert.ok(plan.diffs.some((diff) => diff.label === "서브클래스 특성" && diff.after === "날카로운 말"));

  const result = resolveProgressionPhase08BardLore(state,request(state,selections));
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  const next = result.state as BardLoreProgressionState;
  assert.equal(next.subclassIds?.[BARD_LORE_CLASS_ID],BARD_COLLEGE_LORE_SUBCLASS_ID);
  assert.ok(next.proficientSkills?.includes("역사"));
  assert.ok(next.proficientSkills?.includes("지각"));
  assert.ok(next.proficientSkills?.includes("은신"));
  assert.ok(next.subclassFeatureIds?.includes(BARD_LORE_BONUS_PROFICIENCIES_FEATURE_ID));
  assert.ok(next.subclassFeatureIds?.includes(BARD_LORE_CUTTING_WORDS_FEATURE_ID));
});

test("College of Lore 6 replaces generic subclass pending with two canonical Magical Discoveries that are always prepared", () => {
  const state = bard(5,{ subclassFeatureIds:[BARD_LORE_BONUS_PROFICIENCIES_FEATURE_ID,BARD_LORE_CUTTING_WORDS_FEATURE_ID] });
  const prepared = nextNativeBardSpell(state,6);
  const guidance = stableSpellId("Guidance");
  const fireball = stableSpellId("Fireball");
  const selections = {
    [preparedChoiceId(6)]:{ kind:"options" as const, optionIds:[prepared] },
    [loreMagicalDiscoveriesChoiceId()]:{ kind:"options" as const, optionIds:[guidance,fireball] },
  };
  const plan = buildProgressionPlanPhase08BardLore(state,request(state,selections));
  const discoveries = plan.choices.find((choice) => choice.id === loreMagicalDiscoveriesChoiceId());
  assert.ok(discoveries);
  assert.equal(discoveries?.status,"ready");
  assert.equal(discoveries?.count,2);
  assert.ok(discoveries?.options.some((option) => option.id === guidance));
  assert.ok(discoveries?.options.some((option) => option.id === fireball));
  assert.equal(plan.choices.some((choice) => choice.id === `progression.${BARD_LORE_CLASS_ID}.6.subclass-feature` && choice.status === "catalog-pending"),false);
  assert.deepEqual(plan.blocking,[]);

  const result = resolveProgressionPhase08BardLore(state,request(state,selections));
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  const next = result.state as BardLoreProgressionState;
  assert.deepEqual(next.bardMagicalDiscoverySpellIds,[guidance,fireball]);
  assert.ok(next.preparedSpellIds?.includes(`always:${guidance}`));
  assert.ok(next.preparedSpellIds?.includes(`always:${fireball}`));
  assert.match(next.bardMagicalDiscoverySpellSources?.[fireball] ?? "",/전승 학파 6레벨 · 마법 발견/);
  assert.ok(next.subclassFeatureIds?.includes(BARD_LORE_MAGICAL_DISCOVERIES_FEATURE_ID));
});

test("a later Bard level can optionally replace exactly one Magical Discovery with a newly eligible spell", () => {
  const guidance = stableSpellId("Guidance");
  const fireball = stableSpellId("Fireball");
  const state = bard(6,{
    preparedSpellIds:[...basePrepared(),`always:${guidance}`,`always:${fireball}`],
    preparedSpellSources:{ [guidance]:"전승 학파 6레벨 · 마법 발견", [fireball]:"전승 학파 6레벨 · 마법 발견" },
    bardMagicalDiscoverySpellIds:[guidance,fireball],
    bardMagicalDiscoverySpellSources:{ [guidance]:"전승 학파 6레벨 · 마법 발견", [fireball]:"전승 학파 6레벨 · 마법 발견" },
    subclassFeatureIds:[BARD_LORE_BONUS_PROFICIENCIES_FEATURE_ID,BARD_LORE_CUTTING_WORDS_FEATURE_ID,BARD_LORE_MAGICAL_DISCOVERIES_FEATURE_ID],
  });
  const prepared = nextNativeBardSpell(state,7);
  const iceStorm = stableSpellId("Ice Storm");
  const replacementId = loreMagicalDiscoveriesReplacementChoiceId(7);
  const replacement = encodeLoreMagicalDiscoveryReplacement(guidance,iceStorm);
  const selections = {
    [preparedChoiceId(7)]:{ kind:"options" as const, optionIds:[prepared] },
    [replacementId]:{ kind:"options" as const, optionIds:[replacement] },
  };
  const plan = buildProgressionPlanPhase08BardLore(state,request(state,selections));
  const choice = plan.choices.find((entry) => entry.id === replacementId);
  assert.ok(choice);
  assert.equal(choice?.required,false);
  assert.ok(choice?.options.some((option) => option.id === replacement));
  assert.deepEqual(plan.blocking,[]);

  const result = resolveProgressionPhase08BardLore(state,request(state,selections));
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  const next = result.state as BardLoreProgressionState;
  assert.deepEqual(new Set(next.bardMagicalDiscoverySpellIds),new Set([fireball,iceStorm]));
  assert.equal(next.preparedSpellIds?.includes(`always:${guidance}`),false);
  assert.ok(next.preparedSpellIds?.includes(`always:${iceStorm}`));
});

test("College of Lore 14 automatically materializes Peerless Skill without a fake subclass choice", () => {
  const state = bard(13,{
    bardMagicalDiscoverySpellIds:[stableSpellId("Guidance"),stableSpellId("Fireball")],
    subclassFeatureIds:[BARD_LORE_BONUS_PROFICIENCIES_FEATURE_ID,BARD_LORE_CUTTING_WORDS_FEATURE_ID,BARD_LORE_MAGICAL_DISCOVERIES_FEATURE_ID],
  });
  const plan = buildProgressionPlanPhase08BardLore(state,request(state,{}));
  assert.equal(plan.choices.some((choice) => choice.id === `progression.${BARD_LORE_CLASS_ID}.14.subclass-feature`),false);
  assert.ok(plan.diffs.some((diff) => diff.label === "서브클래스 특성" && diff.after === "비할 데 없는 기량"));
  assert.deepEqual(plan.blocking,[]);
  const result = resolveProgressionPhase08BardLore(state,request(state,{}));
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.ok((result.state as BardLoreProgressionState).subclassFeatureIds?.includes(BARD_LORE_PEERLESS_SKILL_FEATURE_ID));
});
