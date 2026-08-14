import assert from "node:assert/strict";
import test from "node:test";
import { buildProgressionPlan, resolveProgression, type ProgressionCharacterState } from "../../src/domain/progression";
import { classSpellListEntries } from "../../src/domain/spellListCatalog";

const rangerId = "dnd.srd521.class.ranger";
const spellChoice = (level: number) => `progression.${rangerId}.${level}.column.준비 주문`;

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

test("canonical Ranger spell list contains the complete SRD 5.2.1 level 1-5 membership", () => {
  const entries = classSpellListEntries(rangerId);
  assert.equal(entries.length, 48);
  assert.deepEqual([...new Set(entries.map((entry) => entry.level))], [1,2,3,4,5]);
  assert.ok(entries.some((entry) => entry.id === "dnd.srd521.spell.hunter-s-mark" && entry.level === 1));
  assert.ok(entries.some((entry) => entry.id === "dnd.srd521.spell.aid" && entry.level === 2));
  assert.ok(entries.some((entry) => entry.id === "dnd.srd521.spell.tree-stride" && entry.level === 5));
});

test("Ranger 1 -> 2 exposes only level-1 prepared-spell additions, disables existing/always-prepared spells, and keeps Fighting Style pending", () => {
  const state = ranger(1, {
    expertiseSkills:["지각"],
    preparedSpellIds:[
      "dnd.srd521.spell.cure-wounds",
      "dnd.srd521.spell.goodberry",
      "always:dnd.srd521.spell.hunter-s-mark",
    ],
  });
  const expertiseId = `progression.${rangerId}.2.seasoned-explorer.expertise`;
  const languagesId = `progression.${rangerId}.2.seasoned-explorer.languages`;
  const spellsId = spellChoice(2);
  const plan = buildProgressionPlan(state, {
    expectedRevision:0,
    targetClassId:rangerId,
    hpMethod:"fixed",
    selections:{
      [expertiseId]:{ kind:"options", optionIds:["skill:은신"] },
      [languagesId]:{ kind:"options", optionIds:["language.dwarvish","language.giant"] },
      [spellsId]:{ kind:"options", optionIds:["dnd.srd521.spell.alarm"] },
    },
    languageOptions:[
      { id:"language.common", label:"공용어" },
      { id:"language.elvish", label:"엘프어" },
      { id:"language.dwarvish", label:"드워프어" },
      { id:"language.giant", label:"거인어" },
    ],
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
