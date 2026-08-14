import assert from "node:assert/strict";
import test from "node:test";
import { buildProgressionPlan, resolveProgression, type ProgressionCharacterState } from "../../src/domain/progression";
import { classCantripListEntries, classSpellListAllEntries, classSpellListEntries, stableSpellId } from "../../src/domain/spellListCatalog";
import { METAMAGIC_OPTIONS, SORCERER_ID, sorcererMetamagicChoiceId } from "../../src/domain/sorcererProgressionChoices";

const cantripChoice = (level: number) => `progression.${SORCERER_ID}.${level}.column.소마법`;
const preparedChoice = (level: number) => `progression.${SORCERER_ID}.${level}.column.준비 주문`;

function fighterFive(): ProgressionCharacterState {
  return {
    revision:0,
    id:"fighter-sorcerer",
    name:"Aelar",
    totalLevel:5,
    abilities:{ str:16,dex:12,con:14,int:10,wis:10,cha:16 },
    hpCurrent:38,
    hpMaximum:44,
    proficiencyBonus:3,
    classTracks:[{ classId:"dnd.srd521.class.fighter", className:"파이터", level:5, subclassName:"챔피언" }],
    hitDiceByDie:{ d10:5 },
    features:["추가 공격"],
    cantripIds:[],
    preparedSpellIds:[],
  };
}

function sorcererOne(): ProgressionCharacterState {
  return {
    revision:0,
    id:"sorcerer",
    name:"Mira",
    totalLevel:1,
    abilities:{ str:8,dex:14,con:14,int:10,wis:12,cha:18 },
    hpCurrent:8,
    hpMaximum:8,
    proficiencyBonus:2,
    classTracks:[{ classId:SORCERER_ID, className:"소서러", level:1 }],
    hitDiceByDie:{ d6:1 },
    features:["주문 시전","타고난 마법"],
    cantripIds:["Fire Bolt","Mage Hand","Prestidigitation","Sorcerous Burst"].map(stableSpellId),
    preparedSpellIds:["Burning Hands","Magic Missile"].map(stableSpellId),
    metamagicIds:[],
  };
}

test("canonical Sorcerer spell list contains 16 cantrips and 122 leveled SRD 5.2.1 spells", () => {
  assert.equal(classCantripListEntries(SORCERER_ID).length, 16);
  assert.equal(classSpellListEntries(SORCERER_ID).length, 122);
  assert.equal(classSpellListAllEntries(SORCERER_ID).length, 138);
  assert.ok(classCantripListEntries(SORCERER_ID).some((entry) => entry.id === stableSpellId("Sorcerous Burst")));
  assert.ok(classSpellListEntries(SORCERER_ID).some((entry) => entry.id === stableSpellId("Magic Missile") && entry.level === 1));
  assert.ok(classSpellListEntries(SORCERER_ID).some((entry) => entry.id === stableSpellId("Fireball") && entry.level === 3));
  assert.ok(classSpellListEntries(SORCERER_ID).some((entry) => entry.id === stableSpellId("Wish") && entry.level === 9));
});

test("multiclass Fighter 5 -> Sorcerer 1 materializes four cantrips and two prepared spells through the generic full-caster boundary", () => {
  const state = fighterFive();
  const cantrips = ["Fire Bolt","Mage Hand","Prestidigitation","Sorcerous Burst"].map(stableSpellId);
  const prepared = ["Burning Hands","Magic Missile"].map(stableSpellId);
  const request = {
    expectedRevision:0,
    targetClassId:SORCERER_ID,
    hpMethod:"fixed" as const,
    selections:{
      [cantripChoice(1)]:{ kind:"options" as const, optionIds:cantrips },
      [preparedChoice(1)]:{ kind:"options" as const, optionIds:prepared },
    },
  };
  const plan = buildProgressionPlan(state, request);
  assert.equal(plan.choices.find((choice) => choice.id === cantripChoice(1))?.count, 4);
  assert.equal(plan.choices.find((choice) => choice.id === preparedChoice(1))?.count, 2);
  assert.equal(plan.blocking.length, 0);

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.deepEqual(new Set(result.state.cantripIds), new Set(cantrips));
  assert.deepEqual(new Set(result.state.preparedSpellIds), new Set(prepared));
  assert.equal(result.state.spellSlotMaximums?.[1], 2, "Fighter 5 + Sorcerer 1 has caster level 1 slots");
});

test("Sorcerer 1 -> 2 commits two new prepared spells and two Metamagic options atomically with stable IDs and provenance", () => {
  const state = sorcererOne();
  const charmPerson = stableSpellId("Charm Person");
  const shield = stableSpellId("Shield");
  const metamagicId = sorcererMetamagicChoiceId(2);
  const request = {
    expectedRevision:0,
    targetClassId:SORCERER_ID,
    hpMethod:"fixed" as const,
    selections:{
      [preparedChoice(2)]:{ kind:"options" as const, optionIds:[charmPerson,shield] },
      [metamagicId]:{ kind:"options" as const, optionIds:["metamagic:quickened-spell","metamagic:subtle-spell"] },
    },
  };
  const plan = buildProgressionPlan(state, request);
  const metamagic = plan.choices.find((choice) => choice.id === metamagicId);
  assert.equal(plan.choices.find((choice) => choice.id === preparedChoice(2))?.count, 2);
  assert.equal(metamagic?.status, "ready");
  assert.equal(metamagic?.count, 2);
  assert.equal(metamagic?.options.length, 10);
  assert.equal(METAMAGIC_OPTIONS.length, 10);
  assert.equal(plan.blocking.length, 0);

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.ok(result.state.preparedSpellIds?.includes(charmPerson));
  assert.ok(result.state.preparedSpellIds?.includes(shield));
  assert.deepEqual(new Set(result.state.metamagicIds), new Set(["metamagic:quickened-spell","metamagic:subtle-spell"]));
  assert.equal(result.state.metamagicSources?.["metamagic:quickened-spell"], "소서러 2레벨 · 메타매직 · SRD 5.2.1");
  assert.equal(result.state.spellSlotMaximums?.[1], 3);
});

test("Sorcerer 10 Metamagic disables already-known options and rejects a client that submits one anyway", () => {
  const state = sorcererOne();
  state.totalLevel = 9;
  state.classTracks[0].level = 9;
  state.hitDiceByDie.d6 = 9;
  state.hpCurrent = 50;
  state.hpMaximum = 50;
  state.proficiencyBonus = 4;
  state.cantripIds = ["Fire Bolt","Mage Hand","Prestidigitation","Sorcerous Burst","Ray of Frost"].map(stableSpellId);
  state.preparedSpellIds = [
    "Burning Hands","Magic Missile","Charm Person","Shield","Misty Step","Web","Fireball",
    "Haste","Banishment","Polymorph","Cone of Cold","Telekinesis","Counterspell","Fly",
  ].map(stableSpellId);
  state.metamagicIds = ["metamagic:quickened-spell","metamagic:subtle-spell"];

  const metamagicId = sorcererMetamagicChoiceId(10);
  const initial = buildProgressionPlan(state, {
    expectedRevision:0,
    targetClassId:SORCERER_ID,
    hpMethod:"fixed",
    selections:{},
  });
  const metamagic = initial.choices.find((choice) => choice.id === metamagicId);
  assert.equal(metamagic?.count, 2);
  assert.equal(metamagic?.options.find((option) => option.id === "metamagic:quickened-spell")?.disabledReason, "이미 알고 있는 메타매직입니다.");

  const cantrip = initial.choices.find((choice) => choice.id === cantripChoice(10));
  const prepared = initial.choices.find((choice) => choice.id === preparedChoice(10));
  assert.ok(cantrip?.options.find((option) => !option.disabledReason));
  assert.ok(prepared?.options.find((option) => !option.disabledReason));
  const result = resolveProgression(state, {
    expectedRevision:0,
    targetClassId:SORCERER_ID,
    hpMethod:"fixed",
    selections:{
      [cantripChoice(10)]:{ kind:"options", optionIds:[cantrip!.options.find((option) => !option.disabledReason)!.id] },
      [preparedChoice(10)]:{ kind:"options", optionIds:[prepared!.options.find((option) => !option.disabledReason)!.id] },
      [metamagicId]:{ kind:"options", optionIds:["metamagic:quickened-spell","metamagic:distant-spell"] },
    },
  });
  assert.equal(result.status, "rejected");
  if (result.status !== "rejected") return;
  assert.match(result.error, /이미 알고 있는 메타매직/);
  assert.equal(result.state, state);
});
