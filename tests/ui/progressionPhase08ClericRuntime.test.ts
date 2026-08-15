import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionRuntimeAdapter";
import "../../src/app/progressionContracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import { projectOfficialSheet } from "../../src/app/characterSheetV10Projection";
import { stableSpellId } from "../../src/domain/spellListCatalog";

const clericId = "dnd.srd521.class.cleric";

test("Cleric 3 -> 4 runtime persists cantrip, prepared spell, ASI, and full-caster slots onto CharacterSheet", async () => {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as { activeCharacter: typeof baseline };
  const light = stableSpellId("Light");
  const prayer = stableSpellId("Prayer of Healing");

  internal.activeCharacter = {
    ...baseline,
    className:"클레릭",
    subclassName:"생명 권역",
    level:3,
    hp:24,
    maxHp:24,
    proficiencyBonus:2,
    abilities:{ str:10, dex:12, con:14, int:10, wis:18, cha:14 },
    skills:["통찰","의학"],
    features:["주문 시전","신성한 역할","생명 권역"],
    cantrips:[stableSpellId("Guidance"),stableSpellId("Sacred Flame"),stableSpellId("Thaumaturgy")],
    classLevels:[{ classId:clericId, className:"클레릭", level:3, subclassName:"생명 권역" }],
    hitDiceByDie:{ d8:3 },
    progressionRevision:0,
    preparedSpells:[
      `always:${stableSpellId("Bless")}`,
      `always:${stableSpellId("Cure Wounds")}`,
      `always:${stableSpellId("Aid")}`,
      `always:${stableSpellId("Lesser Restoration")}`,
      stableSpellId("Command"),
      stableSpellId("Healing Word"),
      stableSpellId("Shield of Faith"),
      stableSpellId("Spiritual Weapon"),
    ],
  };
  delete internal.activeCharacter.cantripSources;
  delete internal.activeCharacter.preparedSpellSources;

  await adapter.startLevelUp(internal.activeCharacter.id);
  let snapshot = await adapter.getSnapshot();
  const cantripId = `progression.${clericId}.4.column.소마법`;
  const preparedId = `progression.${clericId}.4.column.준비 주문`;
  const asiId = `progression.${clericId}.4.asi`;
  const cantrip = snapshot.progressionPlan?.choices.find((choice) => choice.id === cantripId);
  const prepared = snapshot.progressionPlan?.choices.find((choice) => choice.id === preparedId);
  assert.equal(cantrip?.status, "ready");
  assert.equal(cantrip?.options.find((option) => option.id === light)?.label, "빛");
  assert.equal(prepared?.status, "ready");
  assert.ok(prepared?.options.some((option) => option.id === prayer));

  const phase08 = adapter as unknown as Phase07AdapterCommands;
  await phase08.setProgressionChoice(cantripId, { kind:"options", optionIds:[light] });
  await phase08.setProgressionChoice(preparedId, { kind:"options", optionIds:[prayer] });
  await phase08.setProgressionChoice(asiId, { kind:"asi", mode:"plus-two", primary:"wis" });
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.blocking.length, 0);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level, 4);
  assert.equal(snapshot.activeCharacter.abilities.wis, 20);
  assert.ok(snapshot.activeCharacter.cantrips?.includes(light));
  assert.equal(snapshot.activeCharacter.cantripSources?.[light], "클레릭 4레벨 표 · SRD 5.2.1");
  assert.ok(snapshot.activeCharacter.preparedSpells?.includes(prayer));
  assert.equal(snapshot.activeCharacter.preparedSpellSources?.[prayer], "클레릭 4레벨 표 · SRD 5.2.1");
  assert.equal(snapshot.activeCharacter.spellSlotMaximums?.[1], 4);
  assert.equal(snapshot.activeCharacter.spellSlotMaximums?.[2], 3);

  const view = projectOfficialSheet(snapshot.activeCharacter);
  assert.equal(view.spells.find((spell) => spell.id === light)?.prepared, true);
  assert.equal(view.spells.find((spell) => spell.id === prayer)?.prepared, true);
  assert.equal(view.spellSlots.find((slot) => slot.level === 1)?.total, 4);
  assert.equal(view.spellSlots.find((slot) => slot.level === 2)?.total, 3);
});
