import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionRuntimeAdapter";
import "../../src/app/progressionContracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import { stableSpellId } from "../../src/domain/spellListCatalog";
import { SORCERER_ID, sorcererMetamagicChoiceId } from "../../src/domain/sorcererProgressionChoices";
import { SORCERY_POINT_RESOURCE_ID } from "../../src/domain/sorcery";

test("Sorcerer 1 -> 2 runtime persists prepared spells, Metamagic IDs/provenance, full-caster slots, and Sorcery Points", async () => {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as { activeCharacter: typeof baseline };
  const charmPerson = stableSpellId("Charm Person");
  const shield = stableSpellId("Shield");

  internal.activeCharacter = {
    ...baseline,
    className:"소서러",
    subclassName:undefined,
    level:1,
    hp:8,
    maxHp:8,
    proficiencyBonus:2,
    abilities:{ str:8, dex:14, con:14, int:10, wis:12, cha:18 },
    features:["주문 시전","타고난 마법"],
    cantrips:["Fire Bolt","Mage Hand","Prestidigitation","Sorcerous Burst"].map(stableSpellId),
    preparedSpells:[stableSpellId("Burning Hands"),stableSpellId("Magic Missile")],
    classLevels:[{ classId:SORCERER_ID, className:"소서러", level:1 }],
    hitDiceByDie:{ d6:1 },
    progressionRevision:0,
    metamagicIds:[],
    metamagicSources:{},
    resources:baseline.resources.filter((resource) => resource.id !== SORCERY_POINT_RESOURCE_ID),
  };
  delete internal.activeCharacter.preparedSpellSources;

  await adapter.startLevelUp(internal.activeCharacter.id);
  let snapshot = await adapter.getSnapshot();
  const preparedId = `progression.${SORCERER_ID}.2.column.준비 주문`;
  const metamagicId = sorcererMetamagicChoiceId(2);
  assert.equal(snapshot.progressionPlan?.choices.find((choice) => choice.id === preparedId)?.count, 2);
  assert.equal(snapshot.progressionPlan?.choices.find((choice) => choice.id === metamagicId)?.count, 2);

  const phase08 = adapter as unknown as Phase07AdapterCommands;
  await phase08.setProgressionChoice(preparedId, { kind:"options", optionIds:[charmPerson,shield] });
  await phase08.setProgressionChoice(metamagicId, { kind:"options", optionIds:["metamagic:quickened-spell","metamagic:subtle-spell"] });
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.blocking.length, 0);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level, 2);
  assert.ok(snapshot.activeCharacter.preparedSpells?.includes(charmPerson));
  assert.ok(snapshot.activeCharacter.preparedSpells?.includes(shield));
  assert.equal(snapshot.activeCharacter.preparedSpellSources?.[shield], "소서러 2레벨 표 · SRD 5.2.1");
  assert.deepEqual(new Set(snapshot.activeCharacter.metamagicIds), new Set(["metamagic:quickened-spell","metamagic:subtle-spell"]));
  assert.equal(snapshot.activeCharacter.metamagicSources?.["metamagic:quickened-spell"], "소서러 2레벨 · 메타매직 · SRD 5.2.1");
  assert.equal(snapshot.activeCharacter.spellSlotMaximums?.[1], 3);
  const sorceryPoints = snapshot.activeCharacter.resources.find((resource) => resource.id === SORCERY_POINT_RESOURCE_ID);
  assert.equal(sorceryPoints?.current, 2);
  assert.equal(sorceryPoints?.max, 2);
  assert.equal(sorceryPoints?.recovery?.longRest, "all");

  const internalPoints = internal.activeCharacter.resources.find((resource) => resource.id === SORCERY_POINT_RESOURCE_ID);
  assert.ok(internalPoints);
  internalPoints!.current = 0;
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((resource) => resource.id === SORCERY_POINT_RESOURCE_ID)?.current, 0, "metadata normalization must not refill spent Sorcery Points");
});
