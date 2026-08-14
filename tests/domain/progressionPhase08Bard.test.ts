import assert from "node:assert/strict";
import test from "node:test";
import { buildProgressionPlan, resolveProgression, type ProgressionCharacterState } from "../../src/domain/progression";
import {
  automaticPreparedSpellsForLevel,
  classCantripListEntries,
  classSpellListAllEntries,
  classSpellListEntries,
  stableSpellId,
} from "../../src/domain/spellListCatalog";

const bardId = "dnd.srd521.class.bard";
const cantripChoice = (level: number) => `progression.${bardId}.${level}.column.소마법`;
const preparedChoice = (level: number) => `progression.${bardId}.${level}.column.준비 주문`;

function bard(level: number, overrides: Partial<ProgressionCharacterState> = {}): ProgressionCharacterState {
  const prepared = [
    "Animal Friendship","Bane","Charm Person","Command","Cure Wounds","Dissonant Whispers",
    "Faerie Fire","Healing Word","Heroism","Thunderwave","Hold Person","Shatter",
    "Dispel Magic","Hypnotic Pattern",
  ].slice(0, level >= 9 ? 12 : 12).map(stableSpellId);
  return {
    revision:0,
    id:"bard",
    name:"Lyra",
    totalLevel:level,
    abilities:{ str:8,dex:14,con:14,int:12,wis:12,cha:18 },
    hpCurrent:10 + Math.max(0, level - 1) * 7,
    hpMaximum:10 + Math.max(0, level - 1) * 7,
    proficiencyBonus:level >= 9 ? 4 : 3,
    classTracks:[{ classId:bardId, className:"바드", level, ...(level >= 3 ? { subclassName:"지식의 학파" } : {}) }],
    hitDiceByDie:{ d8:level },
    features:["주문 시전","바드의 격려","만물박사",...(level >= 3 ? ["지식의 학파"] : [])],
    proficientSkills:["공연","설득","비전","통찰","역사","지각"],
    expertiseSkills:["공연","설득"],
    expertiseSources:{ 공연:"바드 2레벨 · SRD 5.2.1", 설득:"바드 2레벨 · SRD 5.2.1" },
    cantripIds:[stableSpellId("Vicious Mockery"),stableSpellId("Mage Hand"),stableSpellId("Minor Illusion")],
    preparedSpellIds:prepared,
    ...overrides,
  };
}

test("canonical Bard spell list contains 10 cantrips and 119 leveled SRD 5.2.1 spells", () => {
  assert.equal(classCantripListEntries(bardId).length, 10);
  assert.equal(classSpellListEntries(bardId).length, 119);
  assert.equal(classSpellListAllEntries(bardId).length, 129);
  assert.ok(classCantripListEntries(bardId).some((entry) => entry.id === stableSpellId("Vicious Mockery")));
  assert.ok(classSpellListEntries(bardId).some((entry) => entry.id === stableSpellId("Dissonant Whispers") && entry.level === 1));
  assert.ok(classSpellListEntries(bardId).some((entry) => entry.id === stableSpellId("Forcecage") && entry.level === 7));
  assert.ok(classSpellListEntries(bardId).some((entry) => entry.id === stableSpellId("Power Word Heal") && entry.level === 9));
});

test("Bard 8 -> 9 materializes Expertise 2 and two additional prepared spells from the canonical Bard list", () => {
  const state = bard(8, { proficiencyBonus:3 });
  const expertiseId = `progression.${bardId}.9.expertise`;
  const holdMonster = stableSpellId("Hold Monster");
  const greaterRestoration = stableSpellId("Greater Restoration");
  const request = {
    expectedRevision:0,
    targetClassId:bardId,
    hpMethod:"fixed" as const,
    selections:{
      [expertiseId]:{ kind:"options" as const, optionIds:["skill:비전","skill:통찰"] },
      [preparedChoice(9)]:{ kind:"options" as const, optionIds:[holdMonster,greaterRestoration] },
    },
  };
  const plan = buildProgressionPlan(state, request);
  const expertise = plan.choices.find((choice) => choice.id === expertiseId);
  const prepared = plan.choices.find((choice) => choice.id === preparedChoice(9));
  assert.equal(expertise?.status, "ready");
  assert.equal(expertise?.count, 2);
  assert.equal(expertise?.options.find((option) => option.id === "skill:공연")?.disabledReason, "이미 전문화를 보유하고 있습니다.");
  assert.equal(prepared?.status, "ready");
  assert.equal(prepared?.count, 2);
  assert.ok(prepared?.options.some((option) => option.id === holdMonster && !option.disabledReason));
  assert.ok(prepared?.options.some((option) => option.id === greaterRestoration && !option.disabledReason));
  assert.equal(prepared?.options.some((option) => option.level > 5), false, "Bard 9 cannot prepare above 5th level");
  assert.equal(plan.blocking.length, 0);

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.totalLevel, 9);
  assert.ok(result.state.expertiseSkills?.includes("비전"));
  assert.ok(result.state.expertiseSkills?.includes("통찰"));
  assert.equal(result.state.expertiseSources?.["비전"], "바드 9레벨 · SRD 5.2.1");
  assert.ok(result.state.preparedSpellIds?.includes(holdMonster));
  assert.ok(result.state.preparedSpellIds?.includes(greaterRestoration));
  assert.equal(result.state.preparedSpellSources?.[holdMonster], "바드 9레벨 표 · SRD 5.2.1");
  assert.equal(result.state.spellSlotMaximums?.[5], 1);
});

test("Bard 9 -> 10 keeps Magical Secrets prepared-spell increase pending until the Wizard canonical list exists", () => {
  const state = bard(9, {
    proficiencyBonus:4,
    preparedSpellIds:[
      ...bard(9).preparedSpellIds ?? [],
      stableSpellId("Hold Monster"), stableSpellId("Greater Restoration"),
    ],
  });
  const cantrip = stableSpellId("Starry Wisp");
  const plan = buildProgressionPlan(state, {
    expectedRevision:0,
    targetClassId:bardId,
    hpMethod:"fixed",
    selections:{
      [cantripChoice(10)]:{ kind:"options", optionIds:[cantrip] },
    },
  });
  const cantripDef = plan.choices.find((choice) => choice.id === cantripChoice(10));
  const prepared = plan.choices.find((choice) => choice.id === preparedChoice(10));
  assert.equal(cantripDef?.status, "ready");
  assert.equal(cantripDef?.count, 1);
  assert.equal(prepared?.status, "catalog-pending");
  assert.match(prepared?.pendingReason ?? "", /바드\/클레릭\/드루이드\/위저드/);
  assert.match(prepared?.pendingReason ?? "", /위저드 canonical/);
  assert.equal(plan.choices.some((choice) => choice.id.includes("마법의 비밀")), false, "Magical Secrets modifies the spell candidate pool instead of creating a fake extra choice");
  assert.ok(plan.blocking.some((message) => /준비 주문|마법의 비밀|위저드/.test(message)));

  const result = resolveProgression(state, {
    expectedRevision:0,
    targetClassId:bardId,
    hpMethod:"fixed",
    selections:{ [cantripChoice(10)]:{ kind:"options", optionIds:[cantrip] } },
  });
  assert.equal(result.status, "rejected");
  if (result.status !== "rejected") return;
  assert.equal(result.state, state);
});

test("Bard 20 Words of Creation catalog relationship keeps Power Word Heal and Power Word Kill always prepared", () => {
  const automatic = automaticPreparedSpellsForLevel(bardId, 20);
  assert.deepEqual(
    new Set(automatic.map((entry) => entry.spellId)),
    new Set([stableSpellId("Power Word Heal"),stableSpellId("Power Word Kill")]),
  );
  assert.ok(automatic.every((entry) => entry.sourceFeature === "창조의 말씀"));
});
