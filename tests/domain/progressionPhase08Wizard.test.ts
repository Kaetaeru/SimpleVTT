import assert from "node:assert/strict";
import test from "node:test";
import { buildProgressionPlan, resolveProgression, type ProgressionCharacterState } from "../../src/domain/progression";
import { classCantripListEntries, classSpellListAllEntries, classSpellListEntries, stableSpellId } from "../../src/domain/spellListCatalog";
import { WIZARD_ID, wizardSpellbookChoiceId } from "../../src/domain/wizardProgressionChoices";

const cantripChoice = (level: number) => `progression.${WIZARD_ID}.${level}.column.소마법`;
const preparedChoice = (level: number) => `progression.${WIZARD_ID}.${level}.column.준비 주문`;

function fighterFive(): ProgressionCharacterState {
  return {
    revision:0,
    id:"fighter-wizard",
    name:"Aelar",
    totalLevel:5,
    abilities:{ str:16,dex:12,con:14,int:16,wis:10,cha:8 },
    hpCurrent:38,
    hpMaximum:44,
    proficiencyBonus:3,
    classTracks:[{ classId:"dnd.srd521.class.fighter", className:"파이터", level:5, subclassName:"챔피언" }],
    hitDiceByDie:{ d10:5 },
    features:["추가 공격"],
    proficientSkills:["비전","역사","지각"],
    cantripIds:[],
    preparedSpellIds:[],
    spellbookSpellIds:[],
  };
}

function wizardOne(): ProgressionCharacterState {
  const book = ["Alarm","Burning Hands","Detect Magic","Find Familiar","Magic Missile","Shield"].map(stableSpellId);
  return {
    revision:0,
    id:"wizard",
    name:"Mira",
    totalLevel:1,
    abilities:{ str:8,dex:14,con:14,int:18,wis:12,cha:10 },
    hpCurrent:8,
    hpMaximum:8,
    proficiencyBonus:2,
    classTracks:[{ classId:WIZARD_ID, className:"위저드", level:1 }],
    hitDiceByDie:{ d6:1 },
    features:["주문 시전","비전 회복","의식 시전자"],
    proficientSkills:["비전","역사"],
    cantripIds:[stableSpellId("Fire Bolt"),stableSpellId("Mage Hand"),stableSpellId("Minor Illusion")],
    spellbookSpellIds:book,
    spellbookSpellSources:Object.fromEntries(book.map((id) => [id,"SRD 5.2.1 · Character Creation · 주문책"])),
    preparedSpellIds:[stableSpellId("Detect Magic"),stableSpellId("Find Familiar"),stableSpellId("Magic Missile"),stableSpellId("Shield")],
  };
}

test("canonical Wizard spell list contains 15 cantrips and 202 leveled SRD 5.2.1 spells", () => {
  assert.equal(classCantripListEntries(WIZARD_ID).length, 15);
  assert.equal(classSpellListEntries(WIZARD_ID).length, 202);
  assert.equal(classSpellListAllEntries(WIZARD_ID).length, 217);
  assert.ok(classCantripListEntries(WIZARD_ID).some((entry) => entry.id === stableSpellId("Fire Bolt")));
  assert.ok(classSpellListEntries(WIZARD_ID).some((entry) => entry.id === stableSpellId("Magic Missile") && entry.level === 1));
  assert.ok(classSpellListEntries(WIZARD_ID).some((entry) => entry.id === stableSpellId("Fireball") && entry.level === 3));
  assert.ok(classSpellListEntries(WIZARD_ID).some((entry) => entry.id === stableSpellId("Wish") && entry.level === 9));
});

test("multiclass Fighter 5 -> Wizard 1 records six spellbook spells before preparing four from that book", () => {
  const state = fighterFive();
  const book = ["Alarm","Burning Hands","Detect Magic","Find Familiar","Magic Missile","Shield"].map(stableSpellId);
  const prepared = ["Detect Magic","Find Familiar","Magic Missile","Shield"].map(stableSpellId);
  const request = {
    expectedRevision:0,
    targetClassId:WIZARD_ID,
    hpMethod:"fixed" as const,
    selections:{
      [cantripChoice(1)]:{ kind:"options" as const, optionIds:[stableSpellId("Fire Bolt"),stableSpellId("Mage Hand"),stableSpellId("Minor Illusion")] },
      [wizardSpellbookChoiceId(1)]:{ kind:"options" as const, optionIds:book },
      [preparedChoice(1)]:{ kind:"options" as const, optionIds:prepared },
    },
  };
  const plan = buildProgressionPlan(state, request);
  const spellbook = plan.choices.find((choice) => choice.id === wizardSpellbookChoiceId(1));
  const preparedDef = plan.choices.find((choice) => choice.id === preparedChoice(1));
  assert.equal(spellbook?.status, "ready");
  assert.equal(spellbook?.count, 6);
  assert.equal(preparedDef?.status, "ready");
  assert.equal(preparedDef?.count, 4);
  assert.deepEqual(new Set(preparedDef?.options.map((option) => option.id)), new Set(book));
  assert.equal(plan.blocking.length, 0);

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.totalLevel, 6);
  assert.deepEqual(new Set(result.state.spellbookSpellIds), new Set(book));
  assert.deepEqual(new Set(result.state.preparedSpellIds), new Set(prepared));
  assert.equal(result.state.spellbookSpellSources?.[stableSpellId("Magic Missile")], "위저드 1레벨 · 주문책 · SRD 5.2.1");
  assert.equal(result.state.spellSlotMaximums?.[1], 2, "Fighter 5 + Wizard 1 has caster level 1 slots");
});

test("Wizard prepared-spell selection rejects a canonical Wizard spell that is not in the selected spellbook", () => {
  const state = fighterFive();
  const book = ["Alarm","Burning Hands","Detect Magic","Find Familiar","Magic Missile","Shield"].map(stableSpellId);
  const result = resolveProgression(state, {
    expectedRevision:0,
    targetClassId:WIZARD_ID,
    hpMethod:"fixed",
    selections:{
      [cantripChoice(1)]:{ kind:"options", optionIds:[stableSpellId("Fire Bolt"),stableSpellId("Mage Hand"),stableSpellId("Minor Illusion")] },
      [wizardSpellbookChoiceId(1)]:{ kind:"options", optionIds:book },
      [preparedChoice(1)]:{ kind:"options", optionIds:[stableSpellId("Detect Magic"),stableSpellId("Magic Missile"),stableSpellId("Shield"),stableSpellId("Sleep")] },
    },
  });
  assert.equal(result.status, "rejected");
  if (result.status !== "rejected") return;
  assert.match(result.error, /알 수 없는 선택값/);
  assert.equal(result.state, state);
});

test("Wizard 1 -> 2 adds two level-1 spellbook spells, prepares one more from the expanded book, and materializes Scholar Expertise", () => {
  const state = wizardOne();
  const featherFall = stableSpellId("Feather Fall");
  const mageArmor = stableSpellId("Mage Armor");
  const request = {
    expectedRevision:0,
    targetClassId:WIZARD_ID,
    hpMethod:"fixed" as const,
    selections:{
      [wizardSpellbookChoiceId(2)]:{ kind:"options" as const, optionIds:[featherFall,mageArmor] },
      [preparedChoice(2)]:{ kind:"options" as const, optionIds:[mageArmor] },
      [`progression.${WIZARD_ID}.2.scholar`]:{ kind:"options" as const, optionIds:["skill:비전"] },
    },
  };
  const plan = buildProgressionPlan(state, request);
  const spellbook = plan.choices.find((choice) => choice.id === wizardSpellbookChoiceId(2));
  const scholar = plan.choices.find((choice) => choice.id.endsWith(".2.scholar"));
  const prepared = plan.choices.find((choice) => choice.id === preparedChoice(2));
  assert.equal(spellbook?.count, 2);
  assert.equal(spellbook?.options.some((option) => option.id === stableSpellId("Misty Step")), false, "Wizard 2 cannot research level-2 spells yet");
  assert.equal(scholar?.status, "ready");
  assert.deepEqual(scholar?.options.map((option) => option.label), ["비전","역사"]);
  assert.ok(prepared?.options.some((option) => option.id === mageArmor));
  assert.equal(plan.blocking.length, 0);

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.spellbookSpellIds?.length, 8);
  assert.ok(result.state.spellbookSpellIds?.includes(featherFall));
  assert.ok(result.state.spellbookSpellIds?.includes(mageArmor));
  assert.ok(result.state.preparedSpellIds?.includes(mageArmor));
  assert.ok(result.state.expertiseSkills?.includes("비전"));
  assert.equal(result.state.expertiseSources?.["비전"], "위저드 2레벨 · 학자 · SRD 5.2.1");
  assert.equal(result.state.spellSlotMaximums?.[1], 3);
});

test("Wizard 2 -> 3 unlocks level-2 research and can prepare a newly recorded level-2 spell in the same atomic transaction", () => {
  const levelTwo = wizardOne();
  levelTwo.totalLevel = 2;
  levelTwo.classTracks[0].level = 2;
  levelTwo.hitDiceByDie.d6 = 2;
  levelTwo.hpCurrent = 14;
  levelTwo.hpMaximum = 14;
  levelTwo.expertiseSkills = ["비전"];
  levelTwo.expertiseSources = { 비전:"위저드 2레벨 · 학자 · SRD 5.2.1" };
  levelTwo.spellbookSpellIds = [...(levelTwo.spellbookSpellIds ?? []),stableSpellId("Feather Fall"),stableSpellId("Mage Armor")];
  levelTwo.preparedSpellIds = [...(levelTwo.preparedSpellIds ?? []),stableSpellId("Mage Armor")];

  const mistyStep = stableSpellId("Misty Step");
  const web = stableSpellId("Web");
  const initial = buildProgressionPlan(levelTwo, {
    expectedRevision:0,targetClassId:WIZARD_ID,hpMethod:"fixed",selections:{
      [wizardSpellbookChoiceId(3)]:{ kind:"options", optionIds:[mistyStep,web] },
      [preparedChoice(3)]:{ kind:"options", optionIds:[mistyStep] },
    },
  });
  const subclass = initial.choices.find((choice) => choice.kind === "subclass");
  assert.ok(subclass?.options[0]);
  const subclassId = subclass!.options[0].id;
  const request = {
    expectedRevision:0,targetClassId:WIZARD_ID,hpMethod:"fixed" as const,selections:{
      [wizardSpellbookChoiceId(3)]:{ kind:"options" as const, optionIds:[mistyStep,web] },
      [preparedChoice(3)]:{ kind:"options" as const, optionIds:[mistyStep] },
      [subclass!.id]:{ kind:"options" as const, optionIds:[subclassId] },
    },
  };
  const plan = buildProgressionPlan(levelTwo, request);
  assert.ok(plan.choices.find((choice) => choice.id === wizardSpellbookChoiceId(3))?.options.some((option) => option.id === mistyStep));
  assert.ok(plan.choices.find((choice) => choice.id === preparedChoice(3))?.options.some((option) => option.id === mistyStep));
  assert.equal(plan.blocking.length, 0);

  const result = resolveProgression(levelTwo, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.ok(result.state.spellbookSpellIds?.includes(mistyStep));
  assert.ok(result.state.spellbookSpellIds?.includes(web));
  assert.ok(result.state.preparedSpellIds?.includes(mistyStep));
  assert.equal(result.state.spellSlotMaximums?.[2], 2);
});
