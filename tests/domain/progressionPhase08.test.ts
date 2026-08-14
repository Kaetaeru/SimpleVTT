import assert from "node:assert/strict";
import test from "node:test";
import { buildProgressionPlan, resolveProgression, type ProgressionCharacterState } from "../../src/domain/progression";
import { classSpellListEntries } from "../../src/domain/spellListCatalog";

const rangerId = "dnd.srd521.class.ranger";
const spellChoice = (level: number) => `progression.${rangerId}.${level}.column.준비 주문`;
const rangerExpertise = `progression.${rangerId}.2.seasoned-explorer.expertise`;
const rangerLanguages = `progression.${rangerId}.2.seasoned-explorer.languages`;
const rangerFightingStyle = `progression.${rangerId}.2.fighting-style`;
const rangerDruidicCantrips = `${rangerFightingStyle}.druidic-warrior.cantrips`;

const languages = [
  { id:"language.common", label:"공용어" },
  { id:"language.elvish", label:"엘프어" },
  { id:"language.dwarvish", label:"드워프어" },
  { id:"language.giant", label:"거인어" },
];
const fightingStyles = [
  { id:"dnd.srd521.feat.fighting-style.archery", label:"궁술" },
  { id:"dnd.srd521.feat.fighting-style.defense", label:"방어" },
  { id:"dnd.srd521.feat.fighting-style.great-weapon-fighting", label:"대형 무기 전투" },
  { id:"dnd.srd521.feat.fighting-style.two-weapon-fighting", label:"쌍수 전투" },
];
const druidCantrips = [
  { id:"dnd.srd521.spell.druidcraft", label:"드루이드술" },
  { id:"dnd.srd521.spell.guidance", label:"인도" },
  { id:"dnd.srd521.spell.produce-flame", label:"불꽃 생성" },
];

function ranger(level: number, overrides: Partial<ProgressionCharacterState> = {}): ProgressionCharacterState {
  return {
    revision:0,
    id:"ranger",
    name:"Ilyra",
    totalLevel:level,
    abilities:{ str:10,dex:16,con:14,int:10,wis:16,cha:8 },
    hpCurrent:12 + Math.max(0, level - 1) * 8,
    hpMaximum:12 + Math.max(0, level - 1) * 8,
    proficiencyBonus:level >= 5 ? 3 : 2,
    classTracks:[{ classId:rangerId, className:"레인저", level, ...(level >= 3 ? { subclassName:"사냥꾼" } : {}) }],
    hitDiceByDie:{ d10:level },
    features:["주문 시전","주적","무기 통달"],
    proficientSkills:["지각","은신","생존"],
    languages:["공용어","엘프어"],
    ...overrides,
  };
}

function rangerLevel2Selections(styleId: string) {
  return {
    [rangerExpertise]:{ kind:"options" as const, optionIds:["skill:은신"] },
    [rangerLanguages]:{ kind:"options" as const, optionIds:["language.dwarvish","language.giant"] },
    [rangerFightingStyle]:{ kind:"options" as const, optionIds:[styleId] },
    [spellChoice(2)]:{ kind:"options" as const, optionIds:["dnd.srd521.spell.alarm"] },
  };
}

function rangerLevel2Request(state: ProgressionCharacterState, styleId: string) {
  return {
    expectedRevision:state.revision,
    targetClassId:rangerId,
    hpMethod:"fixed" as const,
    selections:rangerLevel2Selections(styleId),
    languageOptions:languages,
    fightingStyleOptions:fightingStyles,
    druidCantripOptions:druidCantrips,
  };
}

test("canonical Ranger spell list contains the complete SRD 5.2.1 level 1-5 membership", () => {
  const entries = classSpellListEntries(rangerId);
  assert.equal(entries.length, 48);
  assert.deepEqual([...new Set(entries.map((entry) => entry.level))], [1,2,3,4,5]);
  assert.ok(entries.some((entry) => entry.id === "dnd.srd521.spell.hunter-s-mark" && entry.level === 1));
  assert.ok(entries.some((entry) => entry.id === "dnd.srd521.spell.aid" && entry.level === 2));
  assert.ok(entries.some((entry) => entry.id === "dnd.srd521.spell.tree-stride" && entry.level === 5));
});

test("Ranger 1 -> 2 exposes only level-1 prepared-spell additions, disables existing/always-prepared spells, and keeps Fighting Style pending without catalog options", () => {
  const state = ranger(1, {
    expertiseSkills:["지각"],
    preparedSpellIds:[
      "dnd.srd521.spell.cure-wounds",
      "dnd.srd521.spell.goodberry",
      "always:dnd.srd521.spell.hunter-s-mark",
    ],
  });
  const spellsId = spellChoice(2);
  const plan = buildProgressionPlan(state, {
    expectedRevision:0,
    targetClassId:rangerId,
    hpMethod:"fixed",
    selections:{
      [rangerExpertise]:{ kind:"options", optionIds:["skill:은신"] },
      [rangerLanguages]:{ kind:"options", optionIds:["language.dwarvish","language.giant"] },
      [spellsId]:{ kind:"options", optionIds:["dnd.srd521.spell.alarm"] },
    },
    languageOptions:languages,
  });
  const spells = plan.choices.find((choice) => choice.id === spellsId);
  assert.equal(spells?.status, "ready");
  assert.equal(spells?.count, 1);
  assert.equal(spells?.options.find((option) => option.id === "dnd.srd521.spell.cure-wounds")?.disabledReason, "이미 준비했거나 항상 준비된 주문입니다.");
  assert.equal(spells?.options.find((option) => option.id === "dnd.srd521.spell.hunter-s-mark")?.disabledReason, "이미 준비했거나 항상 준비된 주문입니다.");
  assert.equal(spells?.options.some((option) => option.id === "dnd.srd521.spell.aid"), false, "Ranger 2 has no level-2 spell slot yet");
  assert.ok(plan.choices.some((choice) => choice.label === "전투 방식" && choice.status === "catalog-pending"));
  assert.ok(plan.blocking.some((message) => /전투 방식/.test(message)));
  assert.ok(!plan.blocking.some((message) => /준비 주문/.test(message)));
});

test("Ranger 1 -> 2 standard Fighting Style path is fully executable and stores the selected feat", () => {
  const state = ranger(1, {
    preparedSpellIds:[
      "dnd.srd521.spell.cure-wounds",
      "dnd.srd521.spell.goodberry",
      "always:dnd.srd521.spell.hunter-s-mark",
    ],
  });
  const request = rangerLevel2Request(state, "dnd.srd521.feat.fighting-style.archery");
  const plan = buildProgressionPlan(state, request);
  const style = plan.choices.find((choice) => choice.id === rangerFightingStyle);
  assert.equal(style?.status, "ready");
  assert.equal(style?.options.length, 5, "four SRD fighting styles plus Druidic Warrior");
  assert.equal(plan.choices.some((choice) => choice.id === rangerDruidicCantrips), false);
  assert.equal(plan.blocking.length, 0);

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.totalLevel, 2);
  assert.ok(result.state.features.includes("dnd.srd521.feat.fighting-style.archery"));
  assert.deepEqual(result.state.expertiseSkills, ["은신"]);
  assert.deepEqual(result.state.languages, ["공용어","엘프어","드워프어","거인어"]);
  assert.ok(result.state.preparedSpellIds?.includes("dnd.srd521.spell.alarm"));
});

test("Ranger 1 -> 2 Druidic Warrior requires two new Druid cantrips and commits them with provenance", () => {
  const state = ranger(1, {
    cantripIds:["dnd.srd521.spell.guidance"],
    preparedSpellIds:[
      "dnd.srd521.spell.cure-wounds",
      "dnd.srd521.spell.goodberry",
      "always:dnd.srd521.spell.hunter-s-mark",
    ],
  });
  const request = rangerLevel2Request(state, "feature:ranger.druidic-warrior");
  request.selections[rangerDruidicCantrips] = {
    kind:"options",
    optionIds:["dnd.srd521.spell.druidcraft","dnd.srd521.spell.produce-flame"],
  };
  const plan = buildProgressionPlan(state, request);
  const cantrips = plan.choices.find((choice) => choice.id === rangerDruidicCantrips);
  assert.equal(cantrips?.status, "ready");
  assert.equal(cantrips?.count, 2);
  assert.equal(cantrips?.options.find((option) => option.id === "dnd.srd521.spell.guidance")?.disabledReason, "이미 알고 있는 소마법입니다.");
  assert.equal(plan.blocking.length, 0);

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.ok(result.state.features.includes("드루이드 전사"));
  assert.deepEqual(result.state.cantripIds, ["dnd.srd521.spell.guidance","dnd.srd521.spell.druidcraft","dnd.srd521.spell.produce-flame"]);
  assert.equal(result.state.cantripSources?.["dnd.srd521.spell.druidcraft"], "레인저 2레벨 · SRD 5.2.1");
  assert.equal(result.state.cantripSources?.["dnd.srd521.spell.produce-flame"], "레인저 2레벨 · SRD 5.2.1");
});

test("Ranger 4 -> 5 unlocks level-2 spell options and commits a newly prepared spell with provenance", () => {
  const state = ranger(4, {
    preparedSpellIds:[
      "dnd.srd521.spell.alarm",
      "dnd.srd521.spell.cure-wounds",
      "dnd.srd521.spell.goodberry",
      "dnd.srd521.spell.fog-cloud",
      "dnd.srd521.spell.speak-with-animals",
      "always:dnd.srd521.spell.hunter-s-mark",
    ],
    preparedSpellSources:{
      "dnd.srd521.spell.alarm":"Character Creation",
      "dnd.srd521.spell.cure-wounds":"Character Creation",
      "dnd.srd521.spell.goodberry":"Character Creation",
      "dnd.srd521.spell.fog-cloud":"Character Creation",
      "dnd.srd521.spell.speak-with-animals":"Character Creation",
      "dnd.srd521.spell.hunter-s-mark":"Always prepared",
    },
  });
  const choiceId = spellChoice(5);
  const request = {
    expectedRevision:0,
    targetClassId:rangerId,
    hpMethod:"fixed" as const,
    selections:{ [choiceId]:{ kind:"options" as const, optionIds:["dnd.srd521.spell.aid"] } },
  };
  const plan = buildProgressionPlan(state, request);
  const choice = plan.choices.find((entry) => entry.id === choiceId);
  assert.equal(choice?.status, "ready");
  assert.equal(choice?.count, 1);
  assert.ok(choice?.options.some((option) => option.id === "dnd.srd521.spell.aid"));
  assert.equal(plan.blocking.length, 0);
  assert.deepEqual(plan.automaticGrants, ["추가 공격"]);

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.totalLevel, 5);
  assert.ok(result.state.preparedSpellIds?.includes("dnd.srd521.spell.aid"));
  assert.equal(result.state.preparedSpellSources?.["dnd.srd521.spell.aid"], "레인저 5레벨 표 · SRD 5.2.1");
  assert.equal(result.state.spellSlotMaximums?.[1], 4);
  assert.equal(result.state.spellSlotMaximums?.[2], 2);
});

test("Ranger prepared-spell progression rejects a duplicate always-prepared Hunter's Mark even if submitted by a client", () => {
  const state = ranger(4, {
    preparedSpellIds:[
      "dnd.srd521.spell.alarm",
      "dnd.srd521.spell.cure-wounds",
      "dnd.srd521.spell.goodberry",
      "dnd.srd521.spell.fog-cloud",
      "dnd.srd521.spell.speak-with-animals",
      "always:dnd.srd521.spell.hunter-s-mark",
    ],
  });
  const choiceId = spellChoice(5);
  const result = resolveProgression(state, {
    expectedRevision:0,
    targetClassId:rangerId,
    hpMethod:"fixed",
    selections:{ [choiceId]:{ kind:"options", optionIds:["dnd.srd521.spell.hunter-s-mark"] } },
  });
  assert.equal(result.status, "rejected");
  if (result.status !== "rejected") return;
  assert.match(result.error, /이미 준비했거나 항상 준비된 주문/);
  assert.equal(result.state, state);
});
