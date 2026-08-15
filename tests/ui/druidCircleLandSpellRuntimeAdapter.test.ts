import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/druidCircleLandSpellRuntimeAdapter";
import { configureCircleLandSpells } from "../../src/app/druidCircleLandSpellRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { DRUID_CIRCLE_LAND_SUBCLASS_ID } from "../../src/domain/druidCircleLand";
import { DRUID_ID } from "../../src/domain/druidProgressionChoices";
import { stableSpellId } from "../../src/domain/spellListCatalog";

const id = stableSpellId;

async function baselineAdapter() {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  return { adapter, internal:adapter as unknown as { activeCharacter:typeof baseline } };
}

test("Circle of the Land stores the current land package separately and projects it into spell views", async () => {
  const { adapter, internal } = await baselineAdapter();
  const guidance = id("Guidance");
  const cureWounds = id("Cure Wounds");
  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"드루이드",
    subclassName:"대지의 회합",
    level:9,
    classLevels:[{ classId:DRUID_ID, className:"드루이드", level:9, subclassName:"대지의 회합" }],
    subclassIds:{ [DRUID_ID]:DRUID_CIRCLE_LAND_SUBCLASS_ID },
    progressionRevision:11,
    cantrips:[guidance],
    preparedSpells:[cureWounds],
    cantripSources:{ [guidance]:"드루이드 기본 소마법" },
    preparedSpellSources:{ [cureWounds]:"드루이드 기본 준비 주문" },
    circleLandCantripIds:[],
    circleLandPreparedSpellIds:[],
    circleLandSpellSources:{},
  };

  const configured = configureCircleLandSpells(internal.activeCharacter,"arid");
  assert.equal(configured.status,"committed");
  assert.equal(internal.activeCharacter.progressionRevision,12);
  assert.deepEqual(internal.activeCharacter.cantrips,[guidance],"base cantrips stay durable and separate");
  assert.deepEqual(internal.activeCharacter.preparedSpells,[cureWounds],"base prepared spells stay durable and separate");
  assert.deepEqual(internal.activeCharacter.circleLandCantripIds,[id("Fire Bolt")]);
  assert.deepEqual(internal.activeCharacter.circleLandPreparedSpellIds,[
    id("Blur"),id("Burning Hands"),id("Fireball"),id("Blight"),id("Wall of Stone"),
  ]);

  const snapshot = await adapter.getSnapshot();
  assert.deepEqual(snapshot.activeCharacter.cantrips,[guidance,id("Fire Bolt")]);
  assert.deepEqual(snapshot.activeCharacter.preparedSpells,[
    cureWounds,id("Blur"),id("Burning Hands"),id("Fireball"),id("Blight"),id("Wall of Stone"),
  ]);
  assert.match(snapshot.activeCharacter.cantripSources?.[id("Fire Bolt")] ?? "",/circle-of-the-land\.circle-spells:arid/);
  assert.match(snapshot.activeCharacter.preparedSpellSources?.[id("Fireball")] ?? "",/circle-of-the-land\.circle-spells:arid/);
});

test("changing land replaces only the Circle package while the character's base spell state survives", async () => {
  const { adapter, internal } = await baselineAdapter();
  const guidance = id("Guidance");
  const cureWounds = id("Cure Wounds");
  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"드루이드",
    subclassName:"대지의 회합",
    level:5,
    classLevels:[{ classId:DRUID_ID, className:"드루이드", level:5, subclassName:"대지의 회합" }],
    subclassIds:{ [DRUID_ID]:DRUID_CIRCLE_LAND_SUBCLASS_ID },
    progressionRevision:3,
    cantrips:[guidance],
    preparedSpells:[cureWounds],
    cantripSources:{ [guidance]:"base cantrip" },
    preparedSpellSources:{ [cureWounds]:"base prepared" },
  };

  assert.equal(configureCircleLandSpells(internal.activeCharacter,"arid").status,"committed");
  assert.equal(configureCircleLandSpells(internal.activeCharacter,"polar").status,"committed");
  assert.equal(internal.activeCharacter.progressionRevision,5);
  assert.deepEqual(internal.activeCharacter.circleLandCantripIds,[id("Ray of Frost")]);
  assert.deepEqual(internal.activeCharacter.circleLandPreparedSpellIds,[id("Fog Cloud"),id("Hold Person"),id("Sleet Storm")]);

  const snapshot = await adapter.getSnapshot();
  assert.deepEqual(snapshot.activeCharacter.cantrips,[guidance,id("Ray of Frost")]);
  assert.ok(!snapshot.activeCharacter.cantrips.includes(id("Fire Bolt")));
  assert.ok(snapshot.activeCharacter.preparedSpells.includes(cureWounds));
  assert.ok(!snapshot.activeCharacter.preparedSpells.includes(id("Fireball")));
  assert.deepEqual(snapshot.activeCharacter.circleLandPreparedSpellIds,[id("Fog Cloud"),id("Hold Person"),id("Sleet Storm")]);
});

test("stored Circle package becomes inactive if the stable subclass id is no longer Circle of the Land", async () => {
  const { adapter, internal } = await baselineAdapter();
  const guidance = id("Guidance");
  const fireBolt = id("Fire Bolt");
  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"드루이드",
    level:3,
    classLevels:[{ classId:DRUID_ID, className:"드루이드", level:3 }],
    subclassIds:{ [DRUID_ID]:"dnd.srd521.subclass.druid.other" },
    cantrips:[guidance],
    preparedSpells:[],
    circleLandType:"arid",
    circleLandCantripIds:[fireBolt],
    circleLandPreparedSpellIds:[id("Blur"),id("Burning Hands")],
    circleLandSpellSources:{ [fireBolt]:"stale land package" },
  };
  const snapshot = await adapter.getSnapshot();
  assert.deepEqual(snapshot.activeCharacter.cantrips,[guidance]);
  assert.deepEqual(snapshot.activeCharacter.preparedSpells,[]);
  assert.deepEqual(snapshot.activeCharacter.circleLandCantripIds,[fireBolt],"durable history may remain but has no active mechanics");
});
