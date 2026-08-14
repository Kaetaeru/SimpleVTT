import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionRuntimeAdapter";
import "../../src/app/progressionContracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import { projectOfficialSheet } from "../../src/app/characterSheetV10Projection";
import { SPELL_PRESENTATIONS } from "../../src/app/spellPresentation";
import { classSpellListEntries } from "../../src/domain/spellListCatalog";

const rangerId = "dnd.srd521.class.ranger";
const paladinId = "dnd.srd521.class.paladin";

test("canonical Ranger and Paladin spell lists resolve to the checked-in 339-spell presentation catalog at the same level", () => {
  const presentations = new Map(SPELL_PRESENTATIONS.map((spell) => [spell.id, spell]));
  for (const [classId, expectedCount] of [[rangerId,48],[paladinId,38]] as const) {
    const entries = classSpellListEntries(classId);
    assert.equal(entries.length, expectedCount);
    for (const entry of entries) {
      const presentation = presentations.get(entry.id);
      assert.ok(presentation, `${entry.id} missing from spell presentation catalog`);
      assert.equal(presentation?.level, entry.level, `${entry.id} spell level mismatch`);
      assert.equal(presentation?.nameEn, entry.nameEn, `${entry.id} English name mismatch`);
    }
  }
});

test("Ranger 1 -> 2 runtime exposes four Fighting Style feats plus Druidic Warrior and commits the conditional Druid cantrips", async () => {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as { activeCharacter: typeof baseline };
  internal.activeCharacter = {
    ...baseline,
    className:"레인저",
    subclassName:undefined,
    level:1,
    hp:12,
    maxHp:12,
    proficiencyBonus:2,
    abilities:{ str:10, dex:16, con:14, int:10, wis:16, cha:8 },
    skills:["지각","은신","생존"],
    features:["주문 시전","주적","무기 통달"],
    languages:["공용어","엘프어"],
    cantrips:[],
    classLevels:[{ classId:rangerId, className:"레인저", level:1 }],
    hitDiceByDie:{ d10:1 },
    progressionRevision:0,
    preparedSpells:[
      "dnd.srd521.spell.cure-wounds",
      "dnd.srd521.spell.goodberry",
      "always:dnd.srd521.spell.hunter-s-mark",
    ],
  };
  delete internal.activeCharacter.expertiseSkills;
  delete internal.activeCharacter.expertiseSources;
  delete internal.activeCharacter.cantripSources;
  delete internal.activeCharacter.preparedSpellSources;

  await adapter.startLevelUp(internal.activeCharacter.id);
  let snapshot = await adapter.getSnapshot();
  const styleId = `progression.${rangerId}.2.fighting-style`;
  const style = snapshot.progressionPlan?.choices.find((choice) => choice.id === styleId);
  assert.ok(style);
  assert.equal(style?.status, "ready");
  assert.equal(style?.options.length, 5);
  assert.deepEqual(style?.options.slice(0, 4).map((option) => option.label), ["궁술","방어","대형 무기 전투","쌍수 전투"]);
  assert.equal(style?.options.at(-1)?.label, "드루이드 전사");

  const phase08 = adapter as unknown as Phase07AdapterCommands;
  await phase08.setProgressionChoice(`progression.${rangerId}.2.seasoned-explorer.expertise`, { kind:"options", optionIds:["skill:은신"] });
  await phase08.setProgressionChoice(`progression.${rangerId}.2.seasoned-explorer.languages`, { kind:"options", optionIds:["language.dwarvish","language.giant"] });
  await phase08.setProgressionChoice(`progression.${rangerId}.2.column.준비 주문`, { kind:"options", optionIds:["dnd.srd521.spell.alarm"] });
  await phase08.setProgressionChoice(styleId, { kind:"options", optionIds:["feature:ranger.druidic-warrior"] });
  snapshot = await adapter.getSnapshot();

  const cantripChoice = snapshot.progressionPlan?.choices.find((choice) => choice.id === `${styleId}.druidic-warrior.cantrips`);
  assert.ok(cantripChoice);
  assert.equal(cantripChoice?.count, 2);
  assert.ok(cantripChoice?.options.some((option) => option.id === "dnd.srd521.spell.druidcraft"));
  assert.ok(cantripChoice?.options.some((option) => option.id === "dnd.srd521.spell.produce-flame"));
  await phase08.setProgressionChoice(cantripChoice!.id, {
    kind:"options",
    optionIds:["dnd.srd521.spell.druidcraft","dnd.srd521.spell.produce-flame"],
  });
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.blocking.length, 0);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level, 2);
  assert.ok(snapshot.activeCharacter.features.includes("드루이드 전사"));
  assert.ok(snapshot.activeCharacter.cantrips?.includes("dnd.srd521.spell.druidcraft"));
  assert.ok(snapshot.activeCharacter.cantrips?.includes("dnd.srd521.spell.produce-flame"));
  assert.equal(snapshot.activeCharacter.cantripSources?.["dnd.srd521.spell.druidcraft"], "레인저 2레벨 · SRD 5.2.1");
  assert.ok(snapshot.activeCharacter.preparedSpells?.includes("dnd.srd521.spell.alarm"));
  assert.deepEqual(snapshot.activeCharacter.expertiseSkills, ["은신"]);
  assert.ok(snapshot.activeCharacter.languages?.includes("드워프어"));
  assert.ok(snapshot.activeCharacter.languages?.includes("거인어"));
});

test("Paladin 1 -> 2 runtime exposes Blessed Warrior, commits two Cleric cantrips, and makes Divine Smite always prepared", async () => {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as { activeCharacter: typeof baseline };
  internal.activeCharacter = {
    ...baseline,
    className:"팔라딘",
    subclassName:undefined,
    level:1,
    hp:12,
    maxHp:12,
    proficiencyBonus:2,
    abilities:{ str:16, dex:10, con:14, int:8, wis:12, cha:16 },
    skills:["운동","설득"],
    features:["안수","주문 시전","무기 통달"],
    cantrips:[],
    classLevels:[{ classId:paladinId, className:"팔라딘", level:1 }],
    hitDiceByDie:{ d10:1 },
    progressionRevision:0,
    preparedSpells:["dnd.srd521.spell.bless","dnd.srd521.spell.cure-wounds"],
  };
  delete internal.activeCharacter.cantripSources;
  delete internal.activeCharacter.preparedSpellSources;

  await adapter.startLevelUp(internal.activeCharacter.id);
  let snapshot = await adapter.getSnapshot();
  const styleId = `progression.${paladinId}.2.fighting-style`;
  const style = snapshot.progressionPlan?.choices.find((choice) => choice.id === styleId);
  assert.ok(style);
  assert.equal(style?.status, "ready");
  assert.equal(style?.options.length, 5);
  assert.equal(style?.options.at(-1)?.label, "축복받은 전사");
  const prepared = snapshot.progressionPlan?.choices.find((choice) => choice.id === `progression.${paladinId}.2.column.준비 주문`);
  assert.ok(prepared);
  assert.equal(prepared?.options.find((option) => option.id === "dnd.srd521.spell.divine-smite")?.disabledReason, "이미 준비했거나 항상 준비된 주문입니다.");

  const phase08 = adapter as unknown as Phase07AdapterCommands;
  await phase08.setProgressionChoice(prepared!.id, { kind:"options", optionIds:["dnd.srd521.spell.command"] });
  await phase08.setProgressionChoice(styleId, { kind:"options", optionIds:["feature:paladin.blessed-warrior"] });
  snapshot = await adapter.getSnapshot();
  const cantripChoice = snapshot.progressionPlan?.choices.find((choice) => choice.id === `${styleId}.blessed-warrior.cantrips`);
  assert.ok(cantripChoice);
  assert.equal(cantripChoice?.count, 2);
  assert.ok(cantripChoice?.options.some((option) => option.id === "dnd.srd521.spell.sacred-flame"));
  assert.ok(cantripChoice?.options.some((option) => option.id === "dnd.srd521.spell.thaumaturgy"));
  await phase08.setProgressionChoice(cantripChoice!.id, {
    kind:"options",
    optionIds:["dnd.srd521.spell.sacred-flame","dnd.srd521.spell.thaumaturgy"],
  });
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.blocking.length, 0);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level, 2);
  assert.ok(snapshot.activeCharacter.features.includes("축복받은 전사"));
  assert.ok(snapshot.activeCharacter.cantrips?.includes("dnd.srd521.spell.sacred-flame"));
  assert.ok(snapshot.activeCharacter.cantrips?.includes("dnd.srd521.spell.thaumaturgy"));
  assert.ok(snapshot.activeCharacter.preparedSpells?.includes("dnd.srd521.spell.command"));
  assert.ok(snapshot.activeCharacter.preparedSpells?.includes("always:dnd.srd521.spell.divine-smite"));
  assert.equal(snapshot.activeCharacter.preparedSpellSources?.["dnd.srd521.spell.divine-smite"], "팔라딘 2레벨 · 팔라딘의 강타 · SRD 5.2.1");
});

test("Ranger 4 -> 5 prepared-spell progression uses localized spell presentation and persists into the official sheet", async () => {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as { activeCharacter: typeof baseline };
  internal.activeCharacter = {
    ...baseline,
    className:"레인저",
    subclassName:"사냥꾼",
    level:4,
    hp:36,
    maxHp:36,
    proficiencyBonus:2,
    abilities:{ str:10, dex:16, con:14, int:10, wis:16, cha:8 },
    skills:["지각","은신","생존"],
    features:["주문 시전","주적","무기 통달"],
    languages:["공용어","엘프어"],
    classLevels:[{ classId:rangerId, className:"레인저", level:4, subclassName:"사냥꾼" }],
    hitDiceByDie:{ d10:4 },
    progressionRevision:0,
    preparedSpells:[
      "dnd.srd521.spell.alarm",
      "dnd.srd521.spell.cure-wounds",
      "dnd.srd521.spell.goodberry",
      "dnd.srd521.spell.fog-cloud",
      "dnd.srd521.spell.speak-with-animals",
      "always:dnd.srd521.spell.hunter-s-mark",
    ],
  };
  delete internal.activeCharacter.preparedSpellSources;

  await adapter.startLevelUp(internal.activeCharacter.id);
  let snapshot = await adapter.getSnapshot();
  const choice = snapshot.progressionPlan?.choices.find((entry) => entry.id === `progression.${rangerId}.5.column.준비 주문`);
  assert.ok(choice);
  assert.equal(choice?.status, "ready");
  assert.equal(choice?.options.find((option) => option.id === "dnd.srd521.spell.aid")?.label, "지원");
  assert.equal(choice?.options.find((option) => option.id === "dnd.srd521.spell.cure-wounds")?.disabledReason, "이미 준비했거나 항상 준비된 주문입니다.");

  const phase08 = adapter as unknown as Phase07AdapterCommands;
  await phase08.setProgressionChoice(choice!.id, { kind:"options", optionIds:["dnd.srd521.spell.aid"] });
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.blocking.length, 0);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level, 5);
  assert.ok(snapshot.activeCharacter.preparedSpells?.includes("dnd.srd521.spell.aid"));
  assert.equal(snapshot.activeCharacter.preparedSpellSources?.["dnd.srd521.spell.aid"], "레인저 5레벨 표 · SRD 5.2.1");

  const view = projectOfficialSheet(snapshot.activeCharacter);
  const aid = view.spells.find((spell) => spell.id === "dnd.srd521.spell.aid");
  assert.equal(aid?.name, "지원");
  assert.equal(aid?.prepared, true);
  assert.equal(view.spellSlots.find((slot) => slot.level === 1)?.total, 4);
  assert.equal(view.spellSlots.find((slot) => slot.level === 2)?.total, 2);
});

test("official sheet projection consumes progression Expertise instead of only level-1 creation selections", async () => {
  const adapter = new MockAdapter();
  const character = (await adapter.getSnapshot()).activeCharacter;
  character.className = "로그";
  character.level = 6;
  character.proficiencyBonus = 3;
  character.abilities.dex = 18;
  character.skills = ["은신"];
  character.expertiseSkills = ["은신"];
  character.creationSelections = {};
  const view = projectOfficialSheet(character);
  assert.equal(view.skillExpertise("은신"), true);
  assert.equal(view.skillBonus("은신", "dex"), 10, "DEX +4 plus doubled proficiency +6");
});
