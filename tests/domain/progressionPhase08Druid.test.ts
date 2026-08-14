import assert from "node:assert/strict";
import test from "node:test";
import {
  DRUID_ELEMENTAL_FURY_ID,
  DRUID_MAGICIAN_CANTRIP_ID,
  DRUID_MAGICIAN_OPTION,
  DRUID_POTENT_SPELLCASTING_OPTION,
  DRUID_PRIMAL_ORDER_ID,
} from "../../src/domain/druidProgressionChoices";
import { buildProgressionPlan, resolveProgression, type ProgressionCharacterState } from "../../src/domain/progression";
import { classCantripListEntries, classSpellListAllEntries, classSpellListEntries, stableSpellId } from "../../src/domain/spellListCatalog";

const druidId = "dnd.srd521.class.druid";
const cantripChoice = (level: number) => `progression.${druidId}.${level}.column.소마법`;
const preparedChoice = (level: number) => `progression.${druidId}.${level}.column.준비 주문`;

function fighterFive(): ProgressionCharacterState {
  return {
    revision:0,
    id:"fighter-druid",
    name:"Aelar",
    totalLevel:5,
    abilities:{ str:16,dex:12,con:14,int:10,wis:16,cha:10 },
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

function druid(level: number, overrides: Partial<ProgressionCharacterState> = {}): ProgressionCharacterState {
  return {
    revision:0,
    id:"druid",
    name:"Rowan",
    totalLevel:level,
    abilities:{ str:10,dex:14,con:14,int:12,wis:18,cha:8 },
    hpCurrent:10 + Math.max(0, level - 1) * 7,
    hpMaximum:10 + Math.max(0, level - 1) * 7,
    proficiencyBonus:level >= 5 ? 3 : 2,
    classTracks:[{ classId:druidId, className:"드루이드", level, ...(level >= 3 ? { subclassName:"대지의 결사" } : {}) }],
    hitDiceByDie:{ d8:level },
    features:["주문 시전","드루이드어","마법사", ...(level >= 3 ? ["대지의 결사"] : [])],
    cantripIds:[stableSpellId("Druidcraft"),stableSpellId("Produce Flame"),stableSpellId("Guidance")],
    preparedSpellIds:[
      `always:${stableSpellId("Speak with Animals")}`,
      stableSpellId("Animal Friendship"),stableSpellId("Cure Wounds"),stableSpellId("Faerie Fire"),stableSpellId("Thunderwave"),
      ...(level >= 2 ? [stableSpellId("Goodberry")] : []),
      ...(level >= 3 ? [stableSpellId("Moonbeam")] : []),
    ],
    ...overrides,
  };
}

test("canonical Druid spell list contains 11 cantrips and 113 leveled SRD 5.2.1 spells", () => {
  assert.equal(classCantripListEntries(druidId).length, 11);
  assert.equal(classSpellListEntries(druidId).length, 113);
  assert.equal(classSpellListAllEntries(druidId).length, 124);
  assert.ok(classCantripListEntries(druidId).some((entry) => entry.id === stableSpellId("Starry Wisp")));
  assert.ok(classSpellListEntries(druidId).some((entry) => entry.id === stableSpellId("Moonbeam") && entry.level === 2));
  assert.ok(classSpellListEntries(druidId).some((entry) => entry.id === stableSpellId("Storm of Vengeance") && entry.level === 9));
  assert.equal(classSpellListEntries(druidId).some((entry) => entry.id === stableSpellId("Summon Fey")), false, "Summon Fey is not in the SRD 5.2.1 Druid Spell List");
});

test("multiclass Fighter 5 -> Druid 1 materializes Primal Order, Magician bonus cantrip, base spell choices, and Druidic always-prepared spell", () => {
  const state = fighterFive();
  const message = stableSpellId("Message");
  const request = {
    expectedRevision:0,
    targetClassId:druidId,
    hpMethod:"fixed" as const,
    selections:{
      [DRUID_PRIMAL_ORDER_ID]:{ kind:"options" as const, optionIds:[DRUID_MAGICIAN_OPTION] },
      [DRUID_MAGICIAN_CANTRIP_ID]:{ kind:"options" as const, optionIds:[message] },
      [cantripChoice(1)]:{ kind:"options" as const, optionIds:[stableSpellId("Druidcraft"),stableSpellId("Produce Flame")] },
      [preparedChoice(1)]:{ kind:"options" as const, optionIds:[
        stableSpellId("Animal Friendship"),stableSpellId("Cure Wounds"),stableSpellId("Faerie Fire"),stableSpellId("Thunderwave"),
      ] },
    },
  };
  const plan = buildProgressionPlan(state, request);
  const primalOrder = plan.choices.find((choice) => choice.id === DRUID_PRIMAL_ORDER_ID);
  const bonusCantrip = plan.choices.find((choice) => choice.id === DRUID_MAGICIAN_CANTRIP_ID);
  const prepared = plan.choices.find((choice) => choice.id === preparedChoice(1));
  assert.equal(plan.isMulticlass, true);
  assert.equal(primalOrder?.status, "ready");
  assert.deepEqual(primalOrder?.options.map((option) => option.label), ["마법사","수호자"]);
  assert.equal(bonusCantrip?.status, "ready");
  assert.equal(plan.choices.find((choice) => choice.id === cantripChoice(1))?.count, 2);
  assert.equal(prepared?.count, 4);
  assert.equal(prepared?.options.find((option) => option.id === stableSpellId("Speak with Animals"))?.disabledReason, "이미 준비했거나 항상 준비된 주문입니다.");
  assert.equal(plan.blocking.length, 0);

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.totalLevel, 6);
  assert.deepEqual(result.state.classTracks.map((track) => [track.className,track.level]), [["파이터",5],["드루이드",1]]);
  assert.ok(result.state.features.includes("마법사"));
  assert.deepEqual(result.state.cantripIds, [stableSpellId("Druidcraft"),stableSpellId("Produce Flame"),message]);
  assert.ok(result.state.preparedSpellIds?.includes(`always:${stableSpellId("Speak with Animals")}`));
  assert.equal(result.state.preparedSpellSources?.[stableSpellId("Speak with Animals")], "드루이드 1레벨 · 드루이드어 · SRD 5.2.1");
  assert.equal(result.state.spellSlotMaximums?.[1], 4, "Fighter 5 + Druid 1 has full-caster level 1 spell slots");
});

test("Druid entry rejects a Magician bonus cantrip duplicated in the base Druid cantrip allotment", () => {
  const state = fighterFive();
  const duplicate = stableSpellId("Druidcraft");
  const result = resolveProgression(state, {
    expectedRevision:0,
    targetClassId:druidId,
    hpMethod:"fixed",
    selections:{
      [DRUID_PRIMAL_ORDER_ID]:{ kind:"options", optionIds:[DRUID_MAGICIAN_OPTION] },
      [DRUID_MAGICIAN_CANTRIP_ID]:{ kind:"options", optionIds:[duplicate] },
      [cantripChoice(1)]:{ kind:"options", optionIds:[duplicate,stableSpellId("Produce Flame")] },
      [preparedChoice(1)]:{ kind:"options", optionIds:[
        stableSpellId("Animal Friendship"),stableSpellId("Cure Wounds"),stableSpellId("Faerie Fire"),stableSpellId("Thunderwave"),
      ] },
    },
  });
  assert.equal(result.status, "rejected");
  if (result.status !== "rejected") return;
  assert.match(result.error, /소마법 선택은 같은 progression 트랜잭션 안에서 중복/);
  assert.equal(result.state, state);
});

test("Druid 3 -> 4 commits cantrip + prepared spell + ASI through the generic full-caster boundary", () => {
  const state = druid(3);
  const resistance = stableSpellId("Resistance");
  const barkskin = stableSpellId("Barkskin");
  const request = {
    expectedRevision:0,
    targetClassId:druidId,
    hpMethod:"fixed" as const,
    selections:{
      [cantripChoice(4)]:{ kind:"options" as const, optionIds:[resistance] },
      [preparedChoice(4)]:{ kind:"options" as const, optionIds:[barkskin] },
      [`progression.${druidId}.4.asi`]:{ kind:"asi" as const, mode:"plus-two" as const, primary:"wis" as const },
    },
  };
  const plan = buildProgressionPlan(state, request);
  assert.equal(plan.choices.find((choice) => choice.id === cantripChoice(4))?.status, "ready");
  assert.equal(plan.choices.find((choice) => choice.id === preparedChoice(4))?.status, "ready");
  assert.equal(plan.blocking.length, 0);

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.totalLevel, 4);
  assert.equal(result.state.abilities.wis, 20);
  assert.ok(result.state.cantripIds?.includes(resistance));
  assert.ok(result.state.preparedSpellIds?.includes(barkskin));
  assert.equal(result.state.spellSlotMaximums?.[1], 4);
  assert.equal(result.state.spellSlotMaximums?.[2], 3);
});

test("Druid 6 -> 7 materializes Elemental Fury rather than granting the umbrella feature automatically", () => {
  const state = druid(6, {
    proficiencyBonus:3,
    cantripIds:[stableSpellId("Druidcraft"),stableSpellId("Produce Flame"),stableSpellId("Guidance")],
    preparedSpellIds:[
      `always:${stableSpellId("Speak with Animals")}`,
      stableSpellId("Animal Friendship"),stableSpellId("Cure Wounds"),stableSpellId("Faerie Fire"),stableSpellId("Thunderwave"),
      stableSpellId("Goodberry"),stableSpellId("Moonbeam"),stableSpellId("Call Lightning"),stableSpellId("Dispel Magic"),
      stableSpellId("Revivify"),stableSpellId("Sleet Storm"),
    ],
  });
  const freedom = stableSpellId("Freedom of Movement");
  const request = {
    expectedRevision:0,
    targetClassId:druidId,
    hpMethod:"fixed" as const,
    selections:{
      [DRUID_ELEMENTAL_FURY_ID]:{ kind:"options" as const, optionIds:[DRUID_POTENT_SPELLCASTING_OPTION] },
      [preparedChoice(7)]:{ kind:"options" as const, optionIds:[freedom] },
    },
  };
  const plan = buildProgressionPlan(state, request);
  const fury = plan.choices.find((choice) => choice.id === DRUID_ELEMENTAL_FURY_ID);
  assert.ok(fury, `Druid 7 choices: ${JSON.stringify(plan.choices.map((choice) => [choice.id,choice.label,choice.status]))}`);
  assert.equal(fury?.status, "ready");
  assert.deepEqual(fury?.options.map((option) => option.label), ["강력한 주문 시전","원초적 일격"]);
  assert.ok(!plan.automaticGrants.some((feature) => /원소|Elemental Fury/.test(feature)));
  assert.equal(plan.blocking.length, 0);

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.ok(result.state.features.includes("강력한 주문 시전"));
  assert.ok(result.state.preparedSpellIds?.includes(freedom));
});
