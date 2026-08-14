import assert from "node:assert/strict";
import test from "node:test";
import {
  CLERIC_BLESSED_STRIKES_ID,
  CLERIC_DIVINE_ORDER_ID,
  CLERIC_POTENT_SPELLCASTING_OPTION,
  CLERIC_THAUMATURGE_CANTRIP_ID,
  CLERIC_THAUMATURGE_OPTION,
} from "../../src/domain/clericProgressionChoices";
import { buildProgressionPlan, resolveProgression, type ProgressionCharacterState } from "../../src/domain/progression";
import { stableSpellId } from "../../src/domain/spellListCatalog";

const clericId = "dnd.srd521.class.cleric";
const clericCantrips = `progression.${clericId}.1.column.소마법`;
const clericPrepared = (level: number) => `progression.${clericId}.${level}.column.준비 주문`;

function fighterFive(): ProgressionCharacterState {
  return {
    revision:0,
    id:"fighter-cleric",
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

function clericSix(): ProgressionCharacterState {
  return {
    revision:0,
    id:"life-cleric",
    name:"Mira",
    totalLevel:6,
    abilities:{ str:10,dex:12,con:14,int:10,wis:20,cha:14 },
    hpCurrent:42,
    hpMaximum:45,
    proficiencyBonus:3,
    classTracks:[{ classId:clericId, className:"클레릭", level:6, subclassName:"생명 권역" }],
    hitDiceByDie:{ d8:6 },
    features:["주문 시전","신성한 역할","기적술사","생명 권역"],
    cantripIds:[stableSpellId("Guidance"),stableSpellId("Light"),stableSpellId("Sacred Flame"),stableSpellId("Thaumaturgy")],
    preparedSpellIds:[
      `always:${stableSpellId("Bless")}`,
      `always:${stableSpellId("Cure Wounds")}`,
      `always:${stableSpellId("Aid")}`,
      `always:${stableSpellId("Lesser Restoration")}`,
      `always:${stableSpellId("Mass Healing Word")}`,
      `always:${stableSpellId("Revivify")}`,
      stableSpellId("Command"), stableSpellId("Healing Word"), stableSpellId("Shield of Faith"),
      stableSpellId("Spiritual Weapon"), stableSpellId("Spirit Guardians"), stableSpellId("Dispel Magic"),
    ],
  };
}

function thaumaturgeEntryRequest(baseCantrips = [stableSpellId("Guidance"),stableSpellId("Sacred Flame"),stableSpellId("Thaumaturgy")]) {
  return {
    expectedRevision:0,
    targetClassId:clericId,
    hpMethod:"fixed" as const,
    selections:{
      [CLERIC_DIVINE_ORDER_ID]:{ kind:"options" as const, optionIds:[CLERIC_THAUMATURGE_OPTION] },
      [CLERIC_THAUMATURGE_CANTRIP_ID]:{ kind:"options" as const, optionIds:[stableSpellId("Light")] },
      [clericCantrips]:{ kind:"options" as const, optionIds:baseCantrips },
      [clericPrepared(1)]:{ kind:"options" as const, optionIds:[stableSpellId("Bane"),stableSpellId("Bless"),stableSpellId("Command"),stableSpellId("Cure Wounds")] },
    },
  };
}

test("multiclass Fighter 5 -> Cleric 1 materializes Divine Order and Thaumaturge bonus cantrip without approximating the class choice", () => {
  const state = fighterFive();
  const request = thaumaturgeEntryRequest();
  const plan = buildProgressionPlan(state, request);
  const divineOrder = plan.choices.find((choice) => choice.id === CLERIC_DIVINE_ORDER_ID);
  const bonusCantrip = plan.choices.find((choice) => choice.id === CLERIC_THAUMATURGE_CANTRIP_ID);
  assert.equal(plan.isMulticlass, true);
  assert.equal(divineOrder?.status, "ready");
  assert.deepEqual(divineOrder?.options.map((option) => option.label), ["수호자","기적술사"]);
  assert.equal(bonusCantrip?.status, "ready");
  assert.equal(bonusCantrip?.count, 1);
  assert.equal(plan.blocking.length, 0);

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.totalLevel, 6);
  assert.deepEqual(result.state.classTracks.map((track) => [track.className,track.level]), [["파이터",5],["클레릭",1]]);
  assert.ok(result.state.features.includes("기적술사"));
  assert.deepEqual(result.state.cantripIds, [
    stableSpellId("Guidance"), stableSpellId("Sacred Flame"), stableSpellId("Thaumaturgy"), stableSpellId("Light"),
  ]);
  assert.equal(result.state.cantripSources?.[stableSpellId("Light")], "클레릭 1레벨 · SRD 5.2.1");
  assert.equal(result.state.preparedSpellIds?.length, 4);
  assert.equal(result.state.spellSlotMaximums?.[1], 2);
});

test("Cleric entry rejects the same cantrip selected by the base class allotment and Thaumaturge bonus", () => {
  const state = fighterFive();
  const request = thaumaturgeEntryRequest([stableSpellId("Light"),stableSpellId("Sacred Flame"),stableSpellId("Thaumaturgy")]);
  const result = resolveProgression(state, request);
  assert.equal(result.status, "rejected");
  if (result.status !== "rejected") return;
  assert.match(result.error, /소마법 선택은 같은 progression 트랜잭션 안에서 중복/);
  assert.equal(result.state, state);
});

test("Cleric 6 -> 7 requires Blessed Strikes choice instead of silently granting the umbrella feature", () => {
  const state = clericSix();
  const freedom = stableSpellId("Freedom of Movement");
  const request = {
    expectedRevision:0,
    targetClassId:clericId,
    hpMethod:"fixed" as const,
    selections:{
      [CLERIC_BLESSED_STRIKES_ID]:{ kind:"options" as const, optionIds:[CLERIC_POTENT_SPELLCASTING_OPTION] },
      [clericPrepared(7)]:{ kind:"options" as const, optionIds:[freedom] },
    },
  };
  const plan = buildProgressionPlan(state, request);
  const blessed = plan.choices.find((choice) => choice.id === CLERIC_BLESSED_STRIKES_ID);
  const prepared = plan.choices.find((choice) => choice.id === clericPrepared(7));
  assert.equal(blessed?.status, "ready");
  assert.deepEqual(blessed?.options.map((option) => option.label), ["신성한 일격","강력한 주문 시전"]);
  assert.ok(!plan.automaticGrants.includes("축복받은 일격"));
  assert.equal(prepared?.options.find((option) => option.id === stableSpellId("Aura of Life"))?.disabledReason, "이미 준비했거나 항상 준비된 주문입니다.");
  assert.equal(prepared?.options.find((option) => option.id === stableSpellId("Death Ward"))?.disabledReason, "이미 준비했거나 항상 준비된 주문입니다.");
  assert.equal(plan.blocking.length, 0);

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.ok(result.state.features.includes("강력한 주문 시전"));
  assert.ok(!result.state.features.includes("축복받은 일격"));
  assert.ok(result.state.preparedSpellIds?.includes(`always:${stableSpellId("Aura of Life")}`));
  assert.ok(result.state.preparedSpellIds?.includes(`always:${stableSpellId("Death Ward")}`));
  assert.ok(result.state.preparedSpellIds?.includes(freedom));
});
