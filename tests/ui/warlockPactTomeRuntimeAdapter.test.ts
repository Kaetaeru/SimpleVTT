import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/pactTomeRuntimeAdapter";
import { configurePactTomeBook } from "../../src/app/pactTomeRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import {
  allClassCantripIds,
  allClassLevelOneRitualSpellIds,
} from "../../src/domain/spellRuleCatalog";
import { WARLOCK_ID } from "../../src/domain/warlockProgressionChoices";
import { WARLOCK_PACT_TOME_INVOCATION_ID } from "../../src/domain/warlockPactTome";

async function baselineAdapter() {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  return { adapter, internal:adapter as unknown as { activeCharacter:typeof baseline } };
}

test("Pact of the Tome stores Book spells separately while snapshot spell views include them", async () => {
  const { adapter, internal } = await baselineAdapter();
  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"워락",
    level:3,
    classLevels:[{ classId:WARLOCK_ID, className:"워락", level:3 }],
    progressionRevision:5,
    cantrips:[],
    preparedSpells:[],
    cantripSources:{},
    preparedSpellSources:{},
    eldritchInvocationIds:[WARLOCK_PACT_TOME_INVOCATION_ID],
    eldritchInvocationSources:{ [WARLOCK_PACT_TOME_INVOCATION_ID]:"워락 기원술" },
    pactTomeCantripIds:[],
    pactTomeRitualSpellIds:[],
    pactTomeSpellSources:{},
  };
  const cantripIds = allClassCantripIds().slice(0,3);
  const ritualSpellIds = allClassLevelOneRitualSpellIds().slice(0,2);
  assert.equal(cantripIds.length,3);
  assert.equal(ritualSpellIds.length,2);

  const configured = configurePactTomeBook(internal.activeCharacter,{
    expectedRevision:5,
    rest:"long",
    cantripIds,
    ritualSpellIds,
  });
  assert.equal(configured.status,"committed");
  assert.deepEqual(internal.activeCharacter.cantrips,[],"base cantrip list stays untouched");
  assert.deepEqual(internal.activeCharacter.preparedSpells,[],"base prepared list stays untouched");
  assert.deepEqual(internal.activeCharacter.pactTomeCantripIds,cantripIds);
  assert.deepEqual(internal.activeCharacter.pactTomeRitualSpellIds,ritualSpellIds);

  const snapshot = await adapter.getSnapshot();
  cantripIds.forEach((spellId) => assert.ok(snapshot.activeCharacter.cantrips.includes(spellId)));
  ritualSpellIds.forEach((spellId) => assert.ok(snapshot.activeCharacter.preparedSpells.includes(spellId)));
  for (const spellId of cantripIds) assert.match(snapshot.activeCharacter.cantripSources?.[spellId] ?? "",/functions as a Warlock spell/);
  for (const spellId of ritualSpellIds) assert.match(snapshot.activeCharacter.preparedSpellSources?.[spellId] ?? "",/functions as a Warlock spell/);
});

test("stored Book spell data becomes inactive in the snapshot if Pact of the Tome is removed", async () => {
  const { adapter, internal } = await baselineAdapter();
  const cantripIds = allClassCantripIds().slice(0,3);
  const ritualSpellIds = allClassLevelOneRitualSpellIds().slice(0,2);
  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"워락",
    level:3,
    classLevels:[{ classId:WARLOCK_ID, className:"워락", level:3 }],
    progressionRevision:6,
    cantrips:[],
    preparedSpells:[],
    eldritchInvocationIds:[],
    pactTomeCantripIds:cantripIds,
    pactTomeRitualSpellIds:ritualSpellIds,
    pactTomeSpellSources:Object.fromEntries([...cantripIds,...ritualSpellIds].map((spellId) => [spellId,"stale tome"])),
  };
  const snapshot = await adapter.getSnapshot();
  assert.deepEqual(snapshot.activeCharacter.cantrips,[]);
  assert.deepEqual(snapshot.activeCharacter.preparedSpells,[]);
  assert.deepEqual(snapshot.activeCharacter.pactTomeCantripIds,cantripIds,"stale durable data may remain for history/migration but has no active mechanics");
});
