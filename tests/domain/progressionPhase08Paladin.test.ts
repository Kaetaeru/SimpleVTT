import assert from "node:assert/strict";
import test from "node:test";
import { buildProgressionPlan, resolveProgression, type ProgressionCharacterState } from "../../src/domain/progression";
import { classSpellListEntries } from "../../src/domain/spellListCatalog";

const paladinId = "dnd.srd521.class.paladin";
const spellChoice = (level: number) => `progression.${paladinId}.${level}.column.준비 주문`;
const fightingStyle = `progression.${paladinId}.2.fighting-style`;
const blessedWarriorCantrips = `${fightingStyle}.blessed-warrior.cantrips`;

const fightingStyles = [
  { id:"dnd.srd521.feat.fighting-style.archery", label:"궁술" },
  { id:"dnd.srd521.feat.fighting-style.defense", label:"방어" },
  { id:"dnd.srd521.feat.fighting-style.great-weapon-fighting", label:"대형 무기 전투" },
  { id:"dnd.srd521.feat.fighting-style.two-weapon-fighting", label:"쌍수 전투" },
];
const clericCantrips = [
  { id:"dnd.srd521.spell.guidance", label:"인도" },
  { id:"dnd.srd521.spell.sacred-flame", label:"신성한 불꽃" },
  { id:"dnd.srd521.spell.thaumaturgy", label:"기적술" },
];

function paladin(level: number, overrides: Partial<ProgressionCharacterState> = {}): ProgressionCharacterState {
  return {
    revision:0,
    id:"paladin",
    name:"Ser Caldor",
    totalLevel:level,
    abilities:{ str:16,dex:10,con:14,int:8,wis:12,cha:16 },
    hpCurrent:12 + Math.max(0, level - 1) * 8,
    hpMaximum:12 + Math.max(0, level - 1) * 8,
    proficiencyBonus:level >= 5 ? 3 : 2,
    classTracks:[{ classId:paladinId, className:"팔라딘", level, ...(level >= 3 ? { subclassName:"헌신의 맹세" } : {}) }],
    hitDiceByDie:{ d10:level },
    features:["안수","주문 시전","무기 통달"],
    proficientSkills:["운동","설득"],
    ...overrides,
  };
}

test("canonical Paladin spell list contains the complete SRD 5.2.1 level 1-5 membership", () => {
  const entries = classSpellListEntries(paladinId);
  assert.equal(entries.length, 38);
  assert.deepEqual([...new Set(entries.map((entry) => entry.level))], [1,2,3,4,5]);
  assert.ok(entries.some((entry) => entry.id === "dnd.srd521.spell.divine-smite" && entry.level === 1));
  assert.ok(entries.some((entry) => entry.id === "dnd.srd521.spell.find-steed" && entry.level === 2));
  assert.ok(entries.some((entry) => entry.id === "dnd.srd521.spell.raise-dead" && entry.level === 5));
});

test("Paladin 1 -> 2 standard Fighting Style path is executable and Divine Smite is granted as always prepared", () => {
  const state = paladin(1, {
    preparedSpellIds:["dnd.srd521.spell.bless","dnd.srd521.spell.cure-wounds"],
  });
  const request = {
    expectedRevision:0,
    targetClassId:paladinId,
    hpMethod:"fixed" as const,
    selections:{
      [fightingStyle]:{ kind:"options" as const, optionIds:["dnd.srd521.feat.fighting-style.defense"] },
      [spellChoice(2)]:{ kind:"options" as const, optionIds:["dnd.srd521.spell.command"] },
    },
    fightingStyleOptions:fightingStyles,
    clericCantripOptions:clericCantrips,
  };
  const plan = buildProgressionPlan(state, request);
  const style = plan.choices.find((choice) => choice.id === fightingStyle);
  const spells = plan.choices.find((choice) => choice.id === spellChoice(2));
  assert.equal(style?.options.length, 5, "four Fighting Style feats plus Blessed Warrior");
  assert.equal(style?.options.at(-1)?.label, "축복받은 전사");
  assert.equal(spells?.options.find((option) => option.id === "dnd.srd521.spell.divine-smite")?.disabledReason, "이미 준비했거나 항상 준비된 주문입니다.");
  assert.equal(plan.blocking.length, 0);
  assert.ok(plan.diffs.some((diff) => diff.label === "항상 준비 주문" && diff.after.includes("Divine Smite")));

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.totalLevel, 2);
  assert.ok(result.state.features.includes("dnd.srd521.feat.fighting-style.defense"));
  assert.ok(result.state.preparedSpellIds?.includes("dnd.srd521.spell.command"));
  assert.ok(result.state.preparedSpellIds?.includes("always:dnd.srd521.spell.divine-smite"));
  assert.equal(result.state.preparedSpellSources?.["dnd.srd521.spell.divine-smite"], "팔라딘 2레벨 · 팔라딘의 강타 · SRD 5.2.1");
});

test("Paladin 1 -> 2 Blessed Warrior opens two Cleric cantrips and commits them atomically", () => {
  const state = paladin(1, {
    cantripIds:["dnd.srd521.spell.guidance"],
    preparedSpellIds:["dnd.srd521.spell.bless","dnd.srd521.spell.cure-wounds"],
  });
  const request = {
    expectedRevision:0,
    targetClassId:paladinId,
    hpMethod:"fixed" as const,
    selections:{
      [fightingStyle]:{ kind:"options" as const, optionIds:["feature:paladin.blessed-warrior"] },
      [blessedWarriorCantrips]:{ kind:"options" as const, optionIds:["dnd.srd521.spell.sacred-flame","dnd.srd521.spell.thaumaturgy"] },
      [spellChoice(2)]:{ kind:"options" as const, optionIds:["dnd.srd521.spell.command"] },
    },
    fightingStyleOptions:fightingStyles,
    clericCantripOptions:clericCantrips,
  };
  const plan = buildProgressionPlan(state, request);
  const cantrips = plan.choices.find((choice) => choice.id === blessedWarriorCantrips);
  assert.equal(cantrips?.count, 2);
  assert.equal(cantrips?.options.find((option) => option.id === "dnd.srd521.spell.guidance")?.disabledReason, "이미 알고 있는 소마법입니다.");
  assert.equal(plan.blocking.length, 0);

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.ok(result.state.features.includes("축복받은 전사"));
  assert.deepEqual(result.state.cantripIds, ["dnd.srd521.spell.guidance","dnd.srd521.spell.sacred-flame","dnd.srd521.spell.thaumaturgy"]);
  assert.equal(result.state.cantripSources?.["dnd.srd521.spell.sacred-flame"], "팔라딘 2레벨 · SRD 5.2.1");
  assert.ok(result.state.preparedSpellIds?.includes("always:dnd.srd521.spell.divine-smite"));
});

test("Paladin 4 -> 5 unlocks level-2 prepared spells while Find Steed is granted separately as always prepared", () => {
  const state = paladin(4, {
    preparedSpellIds:[
      "dnd.srd521.spell.bless",
      "dnd.srd521.spell.command",
      "dnd.srd521.spell.cure-wounds",
      "dnd.srd521.spell.shield-of-faith",
      "dnd.srd521.spell.heroism",
      "always:dnd.srd521.spell.divine-smite",
    ],
  });
  const choiceId = spellChoice(5);
  const request = {
    expectedRevision:0,
    targetClassId:paladinId,
    hpMethod:"fixed" as const,
    selections:{ [choiceId]:{ kind:"options" as const, optionIds:["dnd.srd521.spell.aid"] } },
  };
  const plan = buildProgressionPlan(state, request);
  const choice = plan.choices.find((entry) => entry.id === choiceId);
  assert.equal(choice?.status, "ready");
  assert.ok(choice?.options.some((option) => option.id === "dnd.srd521.spell.aid"));
  assert.equal(choice?.options.find((option) => option.id === "dnd.srd521.spell.find-steed")?.disabledReason, "이미 준비했거나 항상 준비된 주문입니다.");
  assert.equal(plan.blocking.length, 0);
  assert.ok(plan.diffs.some((diff) => diff.label === "항상 준비 주문" && diff.after.includes("Find Steed")));

  const result = resolveProgression(state, request);
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.totalLevel, 5);
  assert.ok(result.state.preparedSpellIds?.includes("dnd.srd521.spell.aid"));
  assert.ok(result.state.preparedSpellIds?.includes("always:dnd.srd521.spell.find-steed"));
  assert.equal(result.state.preparedSpellSources?.["dnd.srd521.spell.find-steed"], "팔라딘 5레벨 · 충직한 군마 · SRD 5.2.1");
  assert.equal(result.state.spellSlotMaximums?.[1], 4);
  assert.equal(result.state.spellSlotMaximums?.[2], 2);
});
