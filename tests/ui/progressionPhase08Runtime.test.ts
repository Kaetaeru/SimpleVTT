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

test("every canonical Ranger spell-list entry resolves to the checked-in 339-spell presentation catalog at the same level", () => {
  const presentations = new Map(SPELL_PRESENTATIONS.map((spell) => [spell.id, spell]));
  const entries = classSpellListEntries(rangerId);
  assert.equal(entries.length, 48);
  for (const entry of entries) {
    const presentation = presentations.get(entry.id);
    assert.ok(presentation, `${entry.id} missing from spell presentation catalog`);
    assert.equal(presentation?.level, entry.level, `${entry.id} spell level mismatch`);
    assert.equal(presentation?.nameEn, entry.nameEn, `${entry.id} English name mismatch`);
  }
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
      "always:dnd.srd521.spell.hunters-mark",
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
