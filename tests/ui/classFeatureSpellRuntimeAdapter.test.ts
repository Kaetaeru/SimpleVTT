import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/classFeatureSpellRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import {
  DIVINE_SMITE_FREE_CAST_RESOURCE_ID,
  DIVINE_SMITE_ID,
  FIND_STEED_FREE_CAST_RESOURCE_ID,
  FIND_STEED_ID,
  HUNTERS_MARK_FREE_CAST_RESOURCE_ID,
  HUNTERS_MARK_ID,
  PALADIN_ID,
  RANGER_ID,
} from "../../src/domain/classFeatureSpellResources";

async function baselineAdapter() {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  return { adapter, internal:adapter as unknown as { activeCharacter:typeof baseline } };
}

test("Ranger CharacterSheet projects Favored Enemy free casts without snapshot refills", async () => {
  const { adapter, internal } = await baselineAdapter();
  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"레인저",
    level:4,
    classLevels:[{ classId:RANGER_ID, className:"레인저", level:4 }],
    resources:[],
  };
  let snapshot = await adapter.getSnapshot();
  let hunter = snapshot.activeCharacter.resources.find((resource) => resource.id === HUNTERS_MARK_FREE_CAST_RESOURCE_ID);
  assert.equal(hunter?.current, 2);
  assert.equal(hunter?.max, 2);
  assert.equal(hunter?.recovery?.longRest, "all");
  assert.equal(snapshot.activeCharacter.featureSpellResourceIds?.[HUNTERS_MARK_ID], HUNTERS_MARK_FREE_CAST_RESOURCE_ID);
  assert.match(snapshot.activeCharacter.featureSpellSources?.[HUNTERS_MARK_ID] ?? "", /레인저 4레벨 · 주적/);

  const internalHunter = internal.activeCharacter.resources.find((resource) => resource.id === HUNTERS_MARK_FREE_CAST_RESOURCE_ID);
  assert.ok(internalHunter);
  internalHunter!.current = 0;
  snapshot = await adapter.getSnapshot();
  hunter = snapshot.activeCharacter.resources.find((resource) => resource.id === HUNTERS_MARK_FREE_CAST_RESOURCE_ID);
  assert.equal(hunter?.current, 0, "snapshot normalization must not refill expended Favored Enemy uses");

  internal.activeCharacter.level = 5;
  internal.activeCharacter.classLevels = [{ classId:RANGER_ID, className:"레인저", level:5 }];
  snapshot = await adapter.getSnapshot();
  hunter = snapshot.activeCharacter.resources.find((resource) => resource.id === HUNTERS_MARK_FREE_CAST_RESOURCE_ID);
  assert.equal(hunter?.max, 3);
  assert.equal(hunter?.current, 0, "increasing the maximum must not grant an implicit free cast");
});

test("Paladin CharacterSheet projects independent Divine Smite and Find Steed free-cast resources", async () => {
  const { adapter, internal } = await baselineAdapter();
  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"팔라딘",
    level:5,
    classLevels:[{ classId:PALADIN_ID, className:"팔라딘", level:5 }],
    resources:[],
  };
  const snapshot = await adapter.getSnapshot();
  const smite = snapshot.activeCharacter.resources.find((resource) => resource.id === DIVINE_SMITE_FREE_CAST_RESOURCE_ID);
  const steed = snapshot.activeCharacter.resources.find((resource) => resource.id === FIND_STEED_FREE_CAST_RESOURCE_ID);
  assert.deepEqual({ current:smite?.current, max:smite?.max, recovery:smite?.recovery?.longRest }, { current:1, max:1, recovery:"all" });
  assert.deepEqual({ current:steed?.current, max:steed?.max, recovery:steed?.recovery?.longRest }, { current:1, max:1, recovery:"all" });
  assert.equal(snapshot.activeCharacter.featureSpellResourceIds?.[DIVINE_SMITE_ID], DIVINE_SMITE_FREE_CAST_RESOURCE_ID);
  assert.equal(snapshot.activeCharacter.featureSpellResourceIds?.[FIND_STEED_ID], FIND_STEED_FREE_CAST_RESOURCE_ID);
  assert.match(snapshot.activeCharacter.featureSpellSources?.[DIVINE_SMITE_ID] ?? "", /팔라딘 5레벨 · 팔라딘의 강타/);
  assert.match(snapshot.activeCharacter.featureSpellSources?.[FIND_STEED_ID] ?? "", /팔라딘 5레벨 · 충직한 군마/);
});
