import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionRuntimeAdapter";
import "../../src/app/progressionContracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import { projectOfficialSheet } from "../../src/app/characterSheetV10Projection";
import { stableSpellId } from "../../src/domain/spellListCatalog";

const druidId = "dnd.srd521.class.druid";

test("Druid 3 -> 4 runtime persists cantrip, prepared spell, ASI, and full-caster slots onto CharacterSheet", async () => {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as { activeCharacter: typeof baseline };
  const resistance = stableSpellId("Resistance");
  const barkskin = stableSpellId("Barkskin");

  internal.activeCharacter = {
    ...baseline,
    className:"드루이드",
    subclassName:"대지의 결사",
    level:3,
    hp:24,
    maxHp:24,
    proficiencyBonus:2,
    abilities:{ str:10, dex:14, con:14, int:12, wis:18, cha:8 },
    skills:["자연","생존"],
    features:["주문 시전","드루이드어","마법사","대지의 결사"],
    cantrips:[stableSpellId("Druidcraft"),stableSpellId("Produce Flame"),stableSpellId("Guidance")],
    classLevels:[{ classId:druidId, className:"드루이드", level:3, subclassName:"대지의 결사" }],
    hitDiceByDie:{ d8:3 },
    progressionRevision:0,
    preparedSpells:[
      `always:${stableSpellId("Speak with Animals")}`,
      stableSpellId("Animal Friendship"),
      stableSpellId("Cure Wounds"),
      stableSpellId("Faerie Fire"),
      stableSpellId("Thunderwave"),
      stableSpellId("Goodberry"),
      stableSpellId("Moonbeam"),
    ],
  };
  delete internal.activeCharacter.cantripSources;
  delete internal.activeCharacter.preparedSpellSources;

  await adapter.startLevelUp(internal.activeCharacter.id);
  let snapshot = await adapter.getSnapshot();
  const cantripId = `progression.${druidId}.4.column.소마법`;
  const preparedId = `progression.${druidId}.4.column.준비 주문`;
  const asiId = `progression.${druidId}.4.asi`;
  const cantrip = snapshot.progressionPlan?.choices.find((choice) => choice.id === cantripId);
  const prepared = snapshot.progressionPlan?.choices.find((choice) => choice.id === preparedId);
  assert.equal(cantrip?.status, "ready");
  assert.ok(cantrip?.options.some((option) => option.id === resistance));
  assert.equal(prepared?.status, "ready");
  assert.ok(prepared?.options.some((option) => option.id === barkskin));
  assert.equal(
    prepared?.options.find((option) => option.id === stableSpellId("Speak with Animals"))?.disabledReason,
    "이미 준비했거나 항상 준비된 주문입니다.",
  );

  const phase08 = adapter as unknown as Phase07AdapterCommands;
  await phase08.setProgressionChoice(cantripId, { kind:"options", optionIds:[resistance] });
  await phase08.setProgressionChoice(preparedId, { kind:"options", optionIds:[barkskin] });
  await phase08.setProgressionChoice(asiId, { kind:"asi", mode:"plus-two", primary:"wis" });
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.blocking.length, 0);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level, 4);
  assert.equal(snapshot.activeCharacter.abilities.wis, 20);
  assert.ok(snapshot.activeCharacter.cantrips?.includes(resistance));
  assert.equal(snapshot.activeCharacter.cantripSources?.[resistance], "드루이드 4레벨 표 · SRD 5.2.1");
  assert.ok(snapshot.activeCharacter.preparedSpells?.includes(barkskin));
  assert.equal(snapshot.activeCharacter.preparedSpellSources?.[barkskin], "드루이드 4레벨 표 · SRD 5.2.1");
  assert.ok(snapshot.activeCharacter.preparedSpells?.includes(`always:${stableSpellId("Speak with Animals")}`));
  assert.equal(snapshot.activeCharacter.spellSlotMaximums?.[1], 4);
  assert.equal(snapshot.activeCharacter.spellSlotMaximums?.[2], 3);

  const view = projectOfficialSheet(snapshot.activeCharacter);
  assert.equal(view.spells.find((spell) => spell.id === resistance)?.prepared, true);
  assert.equal(view.spells.find((spell) => spell.id === barkskin)?.prepared, true);
  assert.equal(view.spells.find((spell) => spell.id === stableSpellId("Speak with Animals"))?.alwaysPrepared, true);
  assert.equal(view.spellSlots.find((slot) => slot.level === 1)?.total, 4);
  assert.equal(view.spellSlots.find((slot) => slot.level === 2)?.total, 3);
});
