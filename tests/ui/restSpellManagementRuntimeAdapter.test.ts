import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/restSpellManagementRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { DRUID_CIRCLE_LAND_SUBCLASS_ID } from "../../src/domain/druidCircleLand";
import { DRUID_ID } from "../../src/domain/druidProgressionChoices";
import { classSpellListEntries, stableSpellId } from "../../src/domain/spellListCatalog";
import { allClassCantripIds, allClassLevelOneRitualSpellIds } from "../../src/domain/spellRuleCatalog";
import { WARLOCK_ID } from "../../src/domain/warlockProgressionChoices";
import { WARLOCK_PACT_TOME_INVOCATION_ID } from "../../src/domain/warlockPactTome";
import { WIZARD_ID } from "../../src/domain/wizardProgressionChoices";
import { wizardNormalPreparedSpellCount } from "../../src/domain/wizardLongRestPreparation";

const id = stableSpellId;

async function baselineAdapter() {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  return { adapter, internal:adapter as unknown as { activeCharacter:typeof baseline } };
}

test("Wizard Long-Rest command commits ordinary preparation and one Spell Mastery replacement", async () => {
  const { adapter, internal } = await baselineAdapter();
  const wizardEntries = classSpellListEntries(WIZARD_ID,9);
  const masteryOld = id("Magic Missile");
  const masteryNew = id("Burning Hands");
  const masteryTwo = id("Scorching Ray");
  const spellbook = [...new Set([...wizardEntries.slice(0,70).map((entry) => entry.id),masteryOld,masteryNew,masteryTwo])];
  const excluded = new Set([masteryOld,masteryNew,masteryTwo]);
  const ordinary = spellbook.filter((spellId) => !excluded.has(spellId)).slice(0,wizardNormalPreparedSpellCount(18));
  assert.equal(ordinary.length,23);

  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"위저드",
    level:18,
    classLevels:[{ classId:WIZARD_ID, className:"위저드", level:18 }],
    progressionRevision:10,
    spellbookSpells:spellbook,
    spellbookSpellSources:Object.fromEntries(spellbook.map((spellId) => [spellId,"spellbook"])),
    preparedSpells:[...ordinary,`always:${masteryOld}`,`always:${masteryTwo}`],
    preparedSpellSources:Object.fromEntries([...ordinary.map((spellId) => [spellId,"prepared"]),[masteryOld,"mastery"],[masteryTwo,"mastery"]]),
    spellMasterySpellIds:{ 1:masteryOld, 2:masteryTwo },
    spellMasterySources:{ 1:"mastery", 2:"mastery" },
    signatureSpellIds:[],
    signatureSpellSources:{},
  };

  const snapshot = await adapter.configureWizardLongRest({
    normalPreparedSpellIds:ordinary,
    spellMasteryReplacement:{ spellLevel:1, spellId:masteryNew },
  });
  assert.equal(snapshot.restSpellManagement?.status,"committed");
  assert.equal(snapshot.restSpellManagement?.kind,"wizard-long-rest");
  assert.equal(snapshot.activeCharacter.progressionRevision,11);
  assert.equal(snapshot.activeCharacter.spellMasterySpellIds?.[1],masteryNew);
  assert.ok(snapshot.activeCharacter.preparedSpells.includes(`always:${masteryNew}`));
  assert.equal(snapshot.activeCharacter.preparedSpells.includes(`always:${masteryOld}`),false);

  const beforeRevision = snapshot.activeCharacter.progressionRevision;
  const rejected = await adapter.configureWizardLongRest({ normalPreparedSpellIds:ordinary.slice(0,5) });
  assert.equal(rejected.restSpellManagement?.status,"rejected");
  assert.equal(rejected.activeCharacter.progressionRevision,beforeRevision,"rejected rest command must not advance character revision");
});

test("Pact of the Tome rest command commits Book choices and returns the projected active spell view", async () => {
  const { adapter, internal } = await baselineAdapter();
  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"워락",
    level:3,
    classLevels:[{ classId:WARLOCK_ID, className:"워락", level:3 }],
    progressionRevision:4,
    cantrips:[],
    preparedSpells:[],
    eldritchInvocationIds:[WARLOCK_PACT_TOME_INVOCATION_ID],
    eldritchInvocationSources:{ [WARLOCK_PACT_TOME_INVOCATION_ID]:"invocation" },
    pactTomeCantripIds:[],
    pactTomeRitualSpellIds:[],
    pactTomeSpellSources:{},
  };
  const cantripIds = allClassCantripIds().slice(0,3);
  const ritualSpellIds = allClassLevelOneRitualSpellIds().slice(0,2);
  const snapshot = await adapter.configurePactTomeRest({ rest:"short", cantripIds, ritualSpellIds });
  assert.equal(snapshot.restSpellManagement?.status,"committed");
  assert.equal(snapshot.restSpellManagement?.kind,"pact-tome");
  assert.equal(snapshot.activeCharacter.progressionRevision,5);
  cantripIds.forEach((spellId) => assert.ok(snapshot.activeCharacter.cantrips.includes(spellId)));
  ritualSpellIds.forEach((spellId) => assert.ok(snapshot.activeCharacter.preparedSpells.includes(spellId)));
});

test("Circle of the Land rest command changes the current land package without touching base Druid spells", async () => {
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
    progressionRevision:20,
    cantrips:[guidance],
    preparedSpells:[cureWounds],
    cantripSources:{ [guidance]:"base" },
    preparedSpellSources:{ [cureWounds]:"base" },
  };

  const arid = await adapter.configureCircleLandRest("arid");
  assert.equal(arid.restSpellManagement?.status,"committed");
  assert.equal(arid.activeCharacter.progressionRevision,21);
  assert.ok(arid.activeCharacter.cantrips.includes(id("Fire Bolt")));
  assert.ok(arid.activeCharacter.preparedSpells.includes(id("Fireball")));

  const polar = await adapter.configureCircleLandRest("polar");
  assert.equal(polar.restSpellManagement?.status,"committed");
  assert.equal(polar.activeCharacter.progressionRevision,22);
  assert.ok(polar.activeCharacter.cantrips.includes(guidance));
  assert.ok(polar.activeCharacter.preparedSpells.includes(cureWounds));
  assert.ok(polar.activeCharacter.cantrips.includes(id("Ray of Frost")));
  assert.equal(polar.activeCharacter.cantrips.includes(id("Fire Bolt")),false);
  assert.equal(polar.activeCharacter.preparedSpells.includes(id("Fireball")),false);
});
