import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionRuntimeAdapter";
import "../../src/app/progressionContracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import { stableSpellId } from "../../src/domain/spellListCatalog";
import { WARLOCK_ID } from "../../src/domain/warlockProgressionChoices";

test("Warlock 1 -> 2 runtime persists invocation IDs/provenance and Pact Magic separately from ordinary slots", async () => {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as { activeCharacter: typeof baseline };
  const charmPerson = stableSpellId("Charm Person");

  internal.activeCharacter = {
    ...baseline,
    className:"워락",
    subclassName:undefined,
    level:1,
    hp:10,
    maxHp:10,
    proficiencyBonus:2,
    abilities:{ str:8, dex:14, con:14, int:10, wis:12, cha:18 },
    features:["계약 마법"],
    cantrips:[stableSpellId("Eldritch Blast"),stableSpellId("Prestidigitation")],
    preparedSpells:[stableSpellId("Hex"),stableSpellId("Hellish Rebuke")],
    classLevels:[{ classId:WARLOCK_ID, className:"워락", level:1 }],
    hitDiceByDie:{ d8:1 },
    progressionRevision:0,
    eldritchInvocationIds:["invocation:pact-of-the-blade"],
    eldritchInvocationSources:{ "invocation:pact-of-the-blade":"워락 1레벨 · 섬뜩한 기원술 · SRD 5.2.1" },
    pactMagicSlotLevel:1,
    pactMagicSlotMaximum:1,
    spellSlotMaximums:{},
  };
  delete internal.activeCharacter.preparedSpellSources;

  await adapter.startLevelUp(internal.activeCharacter.id);
  let snapshot = await adapter.getSnapshot();
  const preparedId = `progression.${WARLOCK_ID}.2.column.준비 주문`;
  const invocationOne = `progression.${WARLOCK_ID}.2.invocation-slot.1`;
  const invocationTwo = `progression.${WARLOCK_ID}.2.invocation-slot.2`;
  assert.equal(snapshot.progressionPlan?.choices.find((choice) => choice.id === preparedId)?.count, 1);
  assert.equal(snapshot.progressionPlan?.choices.find((choice) => choice.id === invocationOne)?.status, "ready");
  assert.equal(snapshot.progressionPlan?.pactMagicAfter.slotMaximum, 2);

  const phase08 = adapter as unknown as Phase07AdapterCommands;
  await phase08.setProgressionChoice(preparedId, { kind:"options", optionIds:[charmPerson] });
  await phase08.setProgressionChoice(invocationOne, { kind:"options", optionIds:["invocation:devils-sight"] });
  await phase08.setProgressionChoice(invocationTwo, { kind:"options", optionIds:["invocation:fiendish-vigor"] });
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.blocking.length, 0);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level, 2);
  assert.ok(snapshot.activeCharacter.preparedSpells?.includes(charmPerson));
  assert.deepEqual(new Set(snapshot.activeCharacter.eldritchInvocationIds), new Set(["invocation:pact-of-the-blade","invocation:devils-sight","invocation:fiendish-vigor"]));
  assert.equal(snapshot.activeCharacter.eldritchInvocationSources?.["invocation:devils-sight"], "워락 2레벨 · 섬뜩한 기원술 · SRD 5.2.1");
  assert.equal(snapshot.activeCharacter.pactMagicSlotLevel, 1);
  assert.equal(snapshot.activeCharacter.pactMagicSlotMaximum, 2);
  assert.equal(Object.values(snapshot.activeCharacter.spellSlotMaximums ?? {}).some((count) => count > 0), false);
});
