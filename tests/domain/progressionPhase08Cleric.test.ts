import assert from "node:assert/strict";
import test from "node:test";
import { buildProgressionPlan, resolveProgression, type ProgressionCharacterState } from "../../src/domain/progression";
import { classCantripListEntries, classSpellListAllEntries, classSpellListEntries, stableSpellId } from "../../src/domain/spellListCatalog";

const clericId = "dnd.srd521.class.cleric";
const spellChoice = (level: number) => `progression.${clericId}.${level}.column.준비 주문`;

function cleric(level: number, overrides: Partial<ProgressionCharacterState> = {}): ProgressionCharacterState {
  return {
    revision:0,
    id:"cleric",
    name:"Mira",
    totalLevel:level,
    abilities:{ str:10,dex:12,con:14,int:10,wis:18,cha:14 },
    hpCurrent:10 + Math.max(0, level - 1) * 7,
    hpMaximum:10 + Math.max(0, level - 1) * 7,
    proficiencyBonus:level >= 5 ? 3 : 2,
    classTracks:[{ classId:clericId, className:"클레릭", level, ...(level >= 3 ? { subclassName:"생명 권역" } : {}) }],
    hitDiceByDie:{ d8:level },
    features:["주문 시전","신성한 역할"],
    cantripIds:[stableSpellId("Guidance"),stableSpellId("Sacred Flame"),stableSpellId("Thaumaturgy")],
    preparedSpellIds:[stableSpellId("Bless"),stableSpellId("Cure Wounds"),stableSpellId("Healing Word"),stableSpellId("Shield of Faith")],
    ...overrides,
  };
}

test("canonical Cleric spell list contains 7 cantrips and 102 leveled SRD 5.2.1 spells", () => {
  assert.equal(classCantripListEntries(clericId).length, 7);
  assert.equal(classSpellListEntries(clericId).length, 102);
  assert.equal(classSpellListAllEntries(clericId).length, 109);
  assert.ok(classCantripListEntries(clericId).some((entry) => entry.id === stableSpellId("Sacred Flame")));
  assert.ok(classSpellListEntries(clericId).some((entry) => entry.id === stableSpellId("Spirit Guardians") && entry.level === 3));
  assert.ok(classSpellListEntries(clericId).some((entry) => entry.id === stableSpellId("True Resurrection") && entry.level === 9));
  assert.equal(stableSpellId("Heroes' Feast"), "dnd.srd521.spell.heroes-feast");
});

test("Cleric 1 -> 2 exposes one additional level-1 prepared spell and commits it atomically", () => {
  const state = cleric(1);
  const choiceId = spellChoice(2);
  const command = stableSpellId("Command");
  const plan = buildProgressionPlan(state, {
    expectedRevision:0,
    targetClassId:clericId,
    hpMethod:"fixed",
    selections:{ [choiceId]:{ kind:"options", optionIds:[command] } },
  });
  const choice = plan.choices.find((entry) => entry.id === choiceId);
  assert.equal(choice?.status, "ready");
  assert.equal(choice?.count, 1);
  assert.ok(choice?.options.some((option) => option.id === command));
  assert.equal(choice?.options.some((option) => option.id === stableSpellId("Aid")), false, "Cleric 2 has no level-2 spell slot yet");
  assert.equal(choice?.options.some((option) => option.id === stableSpellId("Guidance")), false, "cantrips never appear in prepared-spell choices");
  assert.equal(choice?.options.find((option) => option.id === stableSpellId("Bless"))?.disabledReason, "이미 준비했거나 항상 준비된 주문입니다.");
  assert.equal(plan.blocking.length, 0);

  const result = resolveProgression(state, {
    expectedRevision:0,
    targetClassId:clericId,
    hpMethod:"fixed",
    selections:{ [choiceId]:{ kind:"options", optionIds:[command] } },
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.totalLevel, 2);
  assert.ok(result.state.preparedSpellIds?.includes(command));
  assert.equal(result.state.preparedSpellSources?.[command], "클레릭 2레벨 표 · SRD 5.2.1");
  assert.equal(result.state.spellSlotMaximums?.[1], 3);
});

test("Cleric 2 -> 3 exposes level-2 spell membership while the SRD subclass choice remains explicit", () => {
  const state = cleric(2, {
    preparedSpellIds:[
      stableSpellId("Bless"), stableSpellId("Command"), stableSpellId("Cure Wounds"),
      stableSpellId("Healing Word"), stableSpellId("Shield of Faith"),
    ],
  });
  const choiceId = spellChoice(3);
  const plan = buildProgressionPlan(state, {
    expectedRevision:0,
    targetClassId:clericId,
    hpMethod:"fixed",
    selections:{
      [choiceId]:{ kind:"options", optionIds:[stableSpellId("Aid")] },
      [`progression.${clericId}.3.subclass`]:{ kind:"options", optionIds:["subclass:생명 권역"] },
    },
  });
  const choice = plan.choices.find((entry) => entry.id === choiceId);
  assert.equal(choice?.status, "ready");
  assert.ok(choice?.options.some((option) => option.id === stableSpellId("Aid")));
  assert.ok(plan.choices.some((entry) => entry.kind === "subclass"));
});

test("Cleric 3 -> 4 still exposes the cantrip increase explicitly until the canonical cantrip choice is wired", () => {
  const state = cleric(3, {
    preparedSpellIds:[
      stableSpellId("Bless"), stableSpellId("Command"), stableSpellId("Cure Wounds"), stableSpellId("Healing Word"),
      stableSpellId("Shield of Faith"), stableSpellId("Aid"),
    ],
  });
  const plan = buildProgressionPlan(state, {
    expectedRevision:0,
    targetClassId:clericId,
    hpMethod:"fixed",
    selections:{
      [spellChoice(4)]:{ kind:"options", optionIds:[stableSpellId("Lesser Restoration")] },
      [`progression.${clericId}.4.asi`]:{ kind:"asi", mode:"plus-two", primary:"wis" },
    },
  });
  assert.ok(plan.choices.some((entry) => entry.id.endsWith(".column.소마법") && entry.status === "catalog-pending"));
  assert.ok(plan.blocking.some((message) => /소마법/.test(message)));
});
