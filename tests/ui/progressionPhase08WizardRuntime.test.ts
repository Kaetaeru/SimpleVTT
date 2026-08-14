import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionRuntimeAdapter";
import "../../src/app/progressionContracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import { projectOfficialSheet } from "../../src/app/characterSheetV10Projection";
import { stableSpellId } from "../../src/domain/spellListCatalog";
import { WIZARD_ID, wizardSpellbookChoiceId } from "../../src/domain/wizardProgressionChoices";

test("Wizard 1 -> 2 runtime persists researched spellbook spells, prepared subset, Scholar Expertise, and slots", async () => {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as { activeCharacter: typeof baseline };
  const initialBook = ["Alarm","Burning Hands","Detect Magic","Find Familiar","Magic Missile","Shield"].map(stableSpellId);
  const featherFall = stableSpellId("Feather Fall");
  const mageArmor = stableSpellId("Mage Armor");

  internal.activeCharacter = {
    ...baseline,
    className:"위저드",
    subclassName:undefined,
    level:1,
    hp:8,
    maxHp:8,
    proficiencyBonus:2,
    abilities:{ str:8, dex:14, con:14, int:18, wis:12, cha:10 },
    skills:["비전","역사"],
    features:["주문 시전","비전 회복","의식 시전자"],
    cantrips:[stableSpellId("Fire Bolt"),stableSpellId("Mage Hand"),stableSpellId("Minor Illusion")],
    classLevels:[{ classId:WIZARD_ID, className:"위저드", level:1 }],
    hitDiceByDie:{ d6:1 },
    progressionRevision:0,
    spellbookSpells:initialBook,
    preparedSpells:[stableSpellId("Detect Magic"),stableSpellId("Find Familiar"),stableSpellId("Magic Missile"),stableSpellId("Shield")],
  };
  delete internal.activeCharacter.expertiseSkills;
  delete internal.activeCharacter.expertiseSources;
  delete internal.activeCharacter.spellbookSpellSources;
  delete internal.activeCharacter.preparedSpellSources;

  await adapter.startLevelUp(internal.activeCharacter.id);
  let snapshot = await adapter.getSnapshot();
  const bookId = wizardSpellbookChoiceId(2);
  const preparedId = `progression.${WIZARD_ID}.2.column.준비 주문`;
  const scholarId = `progression.${WIZARD_ID}.2.scholar`;
  const book = snapshot.progressionPlan?.choices.find((choice) => choice.id === bookId);
  const scholar = snapshot.progressionPlan?.choices.find((choice) => choice.id === scholarId);
  assert.equal(book?.status, "ready");
  assert.equal(book?.count, 2);
  assert.equal(scholar?.status, "ready");
  assert.deepEqual(scholar?.options.map((option) => option.label), ["비전","역사"]);

  const phase08 = adapter as unknown as Phase07AdapterCommands;
  await phase08.setProgressionChoice(bookId, { kind:"options", optionIds:[featherFall,mageArmor] });
  snapshot = await adapter.getSnapshot();
  const prepared = snapshot.progressionPlan?.choices.find((choice) => choice.id === preparedId);
  assert.equal(prepared?.status, "ready");
  assert.equal(prepared?.count, 1);
  assert.ok(prepared?.options.some((option) => option.id === mageArmor), "newly researched spell is immediately eligible for preparation");
  assert.equal(prepared?.options.some((option) => option.id === stableSpellId("Sleep")), false, "Wizard preparation is restricted to the spellbook");

  await phase08.setProgressionChoice(preparedId, { kind:"options", optionIds:[mageArmor] });
  await phase08.setProgressionChoice(scholarId, { kind:"options", optionIds:["skill:비전"] });
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.blocking.length, 0);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level, 2);
  assert.equal(snapshot.activeCharacter.spellbookSpells?.length, 8);
  assert.ok(snapshot.activeCharacter.spellbookSpells?.includes(featherFall));
  assert.ok(snapshot.activeCharacter.spellbookSpells?.includes(mageArmor));
  assert.equal(snapshot.activeCharacter.spellbookSpellSources?.[mageArmor], "위저드 2레벨 · 주문책 · SRD 5.2.1");
  assert.ok(snapshot.activeCharacter.preparedSpells?.includes(mageArmor));
  assert.equal(snapshot.activeCharacter.preparedSpellSources?.[mageArmor], "위저드 2레벨 표 · SRD 5.2.1");
  assert.ok(snapshot.activeCharacter.expertiseSkills?.includes("비전"));
  assert.equal(snapshot.activeCharacter.expertiseSources?.["비전"], "위저드 2레벨 · 학자 · SRD 5.2.1");
  assert.equal(snapshot.activeCharacter.spellSlotMaximums?.[1], 3);

  const view = projectOfficialSheet(snapshot.activeCharacter);
  assert.equal(view.spells.find((spell) => spell.id === mageArmor)?.prepared, true);
  assert.equal(view.spellSlots.find((slot) => slot.level === 1)?.total, 3);
});
