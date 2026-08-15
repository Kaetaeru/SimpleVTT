import assert from "node:assert/strict";
import test from "node:test";
import {
  DIVINE_SMITE_FREE_CAST_RESOURCE_ID,
  DIVINE_SMITE_ID,
  FIND_STEED_FREE_CAST_RESOURCE_ID,
  FIND_STEED_ID,
  HUNTERS_MARK_FREE_CAST_RESOURCE_ID,
  HUNTERS_MARK_ID,
  PALADIN_ID,
  RANGER_ID,
  classFeatureSpellResourceDefinitions,
  classFeatureSpellResourceIds,
  classFeatureSpellSources,
  rangerFavoredEnemyUses,
} from "../../src/domain/classFeatureSpellResources";

test("Favored Enemy free Hunter's Mark uses follow the exact Ranger table breakpoints", () => {
  const expected: Array<[number,number]> = [
    [0,0],[1,2],[4,2],[5,3],[8,3],[9,4],[12,4],[13,5],[16,5],[17,6],[20,6],
  ];
  for (const [level, uses] of expected) assert.equal(rangerFavoredEnemyUses(level), uses, `Ranger ${level}`);
});

test("Ranger and Paladin class tracks materialize independent Long-Rest free-cast resources", () => {
  const tracks = [
    { classId:RANGER_ID, className:"레인저", level:9 },
    { classId:PALADIN_ID, className:"팔라딘", level:5 },
  ];
  const definitions = classFeatureSpellResourceDefinitions(tracks);
  const hunter = definitions.find((entry) => entry.spellId === HUNTERS_MARK_ID);
  const smite = definitions.find((entry) => entry.spellId === DIVINE_SMITE_ID);
  const steed = definitions.find((entry) => entry.spellId === FIND_STEED_ID);
  assert.deepEqual({ id:hunter?.resourceId, maximum:hunter?.maximum, recovery:hunter?.recovery.longRest }, {
    id:HUNTERS_MARK_FREE_CAST_RESOURCE_ID, maximum:4, recovery:"all",
  });
  assert.deepEqual({ id:smite?.resourceId, maximum:smite?.maximum, recovery:smite?.recovery.longRest }, {
    id:DIVINE_SMITE_FREE_CAST_RESOURCE_ID, maximum:1, recovery:"all",
  });
  assert.deepEqual({ id:steed?.resourceId, maximum:steed?.maximum, recovery:steed?.recovery.longRest }, {
    id:FIND_STEED_FREE_CAST_RESOURCE_ID, maximum:1, recovery:"all",
  });

  const resourceIds = classFeatureSpellResourceIds(tracks);
  assert.equal(resourceIds[HUNTERS_MARK_ID], HUNTERS_MARK_FREE_CAST_RESOURCE_ID);
  assert.equal(resourceIds[DIVINE_SMITE_ID], DIVINE_SMITE_FREE_CAST_RESOURCE_ID);
  assert.equal(resourceIds[FIND_STEED_ID], FIND_STEED_FREE_CAST_RESOURCE_ID);
  const sources = classFeatureSpellSources(tracks);
  assert.match(sources[HUNTERS_MARK_ID], /레인저 9레벨 · 주적/);
  assert.match(sources[DIVINE_SMITE_ID], /팔라딘 5레벨 · 팔라딘의 강타/);
  assert.match(sources[FIND_STEED_ID], /팔라딘 5레벨 · 충직한 군마/);
});

test("Paladin free-cast resources unlock at their exact class levels", () => {
  const one = classFeatureSpellResourceDefinitions([{ classId:PALADIN_ID, className:"팔라딘", level:1 }]);
  const two = classFeatureSpellResourceDefinitions([{ classId:PALADIN_ID, className:"팔라딘", level:2 }]);
  const five = classFeatureSpellResourceDefinitions([{ classId:PALADIN_ID, className:"팔라딘", level:5 }]);
  assert.equal(one.length, 0);
  assert.deepEqual(two.map((entry) => entry.spellId), [DIVINE_SMITE_ID]);
  assert.deepEqual(new Set(five.map((entry) => entry.spellId)), new Set([DIVINE_SMITE_ID,FIND_STEED_ID]));
});
