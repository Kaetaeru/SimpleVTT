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

test("Circle of the Land keeps the current land package in session configuration and projects it into spell views", async () => {
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
  };

  const configured = configureCircleLandSpells(adapter,"arid");
  assert.equal(configured.status,"committed");
  assert.equal(internal.activeCharacter.progressionRevision,11,"rest configuration must not advance durable character progression revision");
  assert.deepEqual(internal.activeCharacter.cantrips,[guidance],"base cantrips stay durable and separate");
  assert.deepEqual(internal.activeCharacter.preparedSpells,[cureWounds],"base prepared spells stay durable and separate");
  assert.equal(Object.prototype.hasOwnProperty.call(internal.activeCharacter,"circleLandType"),false);
  assert.equal(Object.prototype.hasOwnProperty.call(internal.activeCharacter,"circleLandCantripIds"),false);
  assert.equal(Object.prototype.hasOwnProperty.call(internal.activeCharacter,"circleLandPreparedSpellIds"),false);

  const snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.circleLandRestConfiguration?.revision,1);
  assert.equal(snapshot.circleLandRestConfiguration?.landType,"arid");
  assert.deepEqual(snapshot.circleLandRestConfiguration?.cantripIds,[id("Fire Bolt")]);
  assert.deepEqual(snapshot.circleLandRestConfiguration?.preparedSpellIds,[
    id("Blur"),id("Burning Hands"),id("Fireball"),id("Blight"),id("Wall of Stone"),
  ]);
  assert.deepEqual(snapshot.activeCharacter.cantrips,[guidance,id("Fire Bolt")]);
  assert.deepEqual(snapshot.activeCharacter.preparedSpells,[
    cureWounds,id("Blur"),id("Burning Hands"),id("Fireball"),id("Blight"),id("Wall of Stone"),
  ]);
  assert.match(snapshot.activeCharacter.cantripSources?.[id("Fire Bolt")] ?? "",/circle-of-the-land\.circle-spells:arid/);
  assert.match(snapshot.activeCharacter.preparedSpellSources?.[id("Fireball")] ?? "",/circle-of-the-land\.circle-spells:arid/);
});

test("changing land replaces only the session package while the character's durable spell state survives", async () => {
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

  assert.equal(configureCircleLandSpells(adapter,"arid").status,"committed");
  assert.equal(configureCircleLandSpells(adapter,"polar").status,"committed");
  assert.equal(internal.activeCharacter.progressionRevision,3);

  const snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.circleLandRestConfiguration?.revision,2);
  assert.equal(snapshot.circleLandRestConfiguration?.landType,"polar");
  assert.deepEqual(snapshot.circleLandRestConfiguration?.cantripIds,[id("Ray of Frost")]);
  assert.deepEqual(snapshot.circleLandRestConfiguration?.preparedSpellIds,[id("Fog Cloud"),id("Hold Person"),id("Sleet Storm")]);
  assert.deepEqual(snapshot.activeCharacter.cantrips,[guidance,id("Ray of Frost")]);
  assert.ok(!snapshot.activeCharacter.cantrips.includes(id("Fire Bolt")));
  assert.ok(snapshot.activeCharacter.preparedSpells.includes(cureWounds));
  assert.ok(!snapshot.activeCharacter.preparedSpells.includes(id("Fireball")));
});

test("session Circle package becomes mechanically inactive if the stable subclass id is no longer Circle of the Land", async () => {
  const { adapter, internal } = await baselineAdapter();
  const guidance = id("Guidance");
  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"드루이드",
    subclassName:"대지의 회합",
    level:3,
    classLevels:[{ classId:DRUID_ID, className:"드루이드", level:3, subclassName:"대지의 회합" }],
    subclassIds:{ [DRUID_ID]:DRUID_CIRCLE_LAND_SUBCLASS_ID },
    progressionRevision:8,
    cantrips:[guidance],
    preparedSpells:[],
  };
  assert.equal(configureCircleLandSpells(adapter,"arid").status,"committed");

  internal.activeCharacter.subclassIds = { [DRUID_ID]:"dnd.srd521.subclass.druid.other" };
  const snapshot = await adapter.getSnapshot();
  assert.deepEqual(snapshot.activeCharacter.cantrips,[guidance]);
  assert.deepEqual(snapshot.activeCharacter.preparedSpells,[]);
  assert.equal(snapshot.circleLandRestConfiguration?.landType,"arid","session configuration may remain as inactive state");
  assert.ok(snapshot.circleLandRestConfiguration?.cantripIds.includes(id("Fire Bolt")));
});
