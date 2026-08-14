import assert from "node:assert/strict";
import test from "node:test";
import { buildProgressionPlan, resolveProgression, type ProgressionCharacterState } from "../../src/domain/progression";
import { classCantripListEntries, classSpellListAllEntries, classSpellListEntries, stableSpellId } from "../../src/domain/spellListCatalog";

const clericId = "dnd.srd521.class.cleric";
const spellChoice = (level: number) => `progression.${clericId}.${level}.column.준비 주문`;
const cantripChoice = (level: number) => `progression.${clericId}.${level}.column.소마법`;

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
  const request = {
    expectedRevision:0,
    targetClassId:clericId,
    hpMethod:"fixed" as const,
    selections:{ [choiceId]:{ kind:"options" as const, optionIds:[command] } },
  };
  const plan = buildProgressionPlan(state, request);
  const choice = plan.choices.find((entry) => entry.id === choiceId);
  assert.equal(choice?.status, "ready");
  assert.equal(choice?.count, 1);
  assert.ok(choice?.options.some((option) => option.id === command));
  assert.equal(choice?.options.some((option) => option.id === stableSpellId("Aid")), false, "Cleric 2 has no level-2 spell slot yet");
  assert.equal(choice?.options.some((option) => option.id === stableSpellId("Guidance")), false, "cantrips never appear in prepared-spell choices");
  assert.equal(choice?.options.find((option) => option.id === stableSpellId("Bless"))?.disabledReason, "이미 준비했거나 항상 준비된 주문입니다.");
  assert.equal(plan.blocking.length, 0);

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.totalLevel, 2);
  assert.ok(result.state.preparedSpellIds?.includes(command));
  assert.equal(result.state.preparedSpellSources?.[command], "클레릭 2레벨 표 · SRD 5.2.1");
  assert.equal(result.state.spellSlotMaximums?.[1], 3);
});

test("Cleric 2 -> 3 applies Life Domain spells as always prepared and keeps them out of the ordinary prepared choice", () => {
  const state = cleric(2, {
    preparedSpellIds:[
      stableSpellId("Bless"), stableSpellId("Command"), stableSpellId("Cure Wounds"),
      stableSpellId("Healing Word"), stableSpellId("Shield of Faith"),
    ],
  });
  const choiceId = spellChoice(3);
  const spiritualWeapon = stableSpellId("Spiritual Weapon");
  const request = {
    expectedRevision:0,
    targetClassId:clericId,
    hpMethod:"fixed" as const,
    selections:{
      [choiceId]:{ kind:"options" as const, optionIds:[spiritualWeapon] },
      [`progression.${clericId}.3.subclass`]:{ kind:"options" as const, optionIds:["subclass:생명 권역"] },
    },
  };
  const plan = buildProgressionPlan(state, request);
  const choice = plan.choices.find((entry) => entry.id === choiceId);
  assert.equal(choice?.status, "ready");
  assert.equal(choice?.options.find((option) => option.id === stableSpellId("Aid"))?.disabledReason, "이미 준비했거나 항상 준비된 주문입니다.");
  assert.equal(choice?.options.find((option) => option.id === stableSpellId("Lesser Restoration"))?.disabledReason, "이미 준비했거나 항상 준비된 주문입니다.");
  assert.ok(choice?.options.some((option) => option.id === spiritualWeapon && !option.disabledReason));
  assert.ok(plan.diffs.some((diff) => diff.label === "항상 준비 주문" && diff.after.includes("Aid") && diff.after.includes("Lesser Restoration")));
  assert.equal(plan.blocking.length, 0);

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.totalLevel, 3);
  assert.equal(result.state.classTracks[0].subclassName, "생명 권역");
  assert.ok(result.state.preparedSpellIds?.includes(`always:${stableSpellId("Aid")}`));
  assert.ok(result.state.preparedSpellIds?.includes(`always:${stableSpellId("Bless")}`));
  assert.ok(result.state.preparedSpellIds?.includes(`always:${stableSpellId("Cure Wounds")}`));
  assert.ok(result.state.preparedSpellIds?.includes(`always:${stableSpellId("Lesser Restoration")}`));
  assert.ok(result.state.preparedSpellIds?.includes(spiritualWeapon));
  assert.equal(result.state.preparedSpellSources?.[stableSpellId("Aid")], "클레릭 3레벨 · 생명 권역 주문 · SRD 5.2.1");
});

test("Cleric 3 -> 4 commits cantrip + prepared spell + ASI through one progression transaction", () => {
  const state = cleric(3, {
    preparedSpellIds:[
      `always:${stableSpellId("Bless")}`, `always:${stableSpellId("Cure Wounds")}`,
      `always:${stableSpellId("Aid")}`, `always:${stableSpellId("Lesser Restoration")}`,
      stableSpellId("Command"), stableSpellId("Healing Word"), stableSpellId("Shield of Faith"), stableSpellId("Spiritual Weapon"),
    ],
  });
  const light = stableSpellId("Light");
  const prayer = stableSpellId("Prayer of Healing");
  const request = {
    expectedRevision:0,
    targetClassId:clericId,
    hpMethod:"fixed" as const,
    selections:{
      [spellChoice(4)]:{ kind:"options" as const, optionIds:[prayer] },
      [cantripChoice(4)]:{ kind:"options" as const, optionIds:[light] },
      [`progression.${clericId}.4.asi`]:{ kind:"asi" as const, mode:"plus-two" as const, primary:"wis" as const },
    },
  };
  const plan = buildProgressionPlan(state, request);
  const cantrip = plan.choices.find((entry) => entry.id === cantripChoice(4));
  assert.equal(cantrip?.status, "ready");
  assert.equal(cantrip?.count, 1);
  assert.equal(cantrip?.options.find((option) => option.id === stableSpellId("Guidance"))?.disabledReason, "이미 알고 있는 소마법입니다.");
  assert.equal(cantrip?.options.find((option) => option.id === light)?.disabledReason, undefined);
  assert.ok(plan.diffs.some((diff) => diff.label === "소마법 추가" && diff.after.includes("Light")));
  assert.equal(plan.blocking.length, 0);

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.totalLevel, 4);
  assert.equal(result.state.abilities.wis, 20);
  assert.ok(result.state.cantripIds?.includes(light));
  assert.equal(result.state.cantripSources?.[light], "클레릭 4레벨 표 · SRD 5.2.1");
  assert.ok(result.state.preparedSpellIds?.includes(prayer));
  assert.equal(result.state.preparedSpellSources?.[prayer], "클레릭 4레벨 표 · SRD 5.2.1");
  assert.equal(result.state.spellSlotMaximums?.[1], 4);
  assert.equal(result.state.spellSlotMaximums?.[2], 3);
});
