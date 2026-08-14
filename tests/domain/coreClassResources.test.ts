import assert from "node:assert/strict";
import test from "node:test";
import {
  CLERIC_CHANNEL_DIVINITY_RESOURCE_ID,
  CLERIC_ID,
  DRUID_ID,
  DRUID_WILD_SHAPE_RESOURCE_ID,
  PALADIN_CHANNEL_DIVINITY_RESOURCE_ID,
  PALADIN_ID,
  PALADIN_LAY_ON_HANDS_RESOURCE_ID,
  clericChannelDivinityMaximum,
  coreClassResourceDefinitions,
  druidWildShapeMaximum,
  paladinChannelDivinityMaximum,
  paladinLayOnHandsMaximum,
} from "../../src/domain/coreClassResources";
import { recoverResources } from "../../src/domain/resources";

test("Channel Divinity, Wild Shape, and Lay On Hands maxima follow their exact class tables", () => {
  for (const [level, expected] of [[0,0],[1,0],[2,2],[5,2],[6,3],[17,3],[18,4],[20,4]] as const) {
    assert.equal(clericChannelDivinityMaximum(level), expected, `Cleric ${level}`);
  }
  for (const [level, expected] of [[0,0],[1,5],[3,15],[14,70],[20,100]] as const) {
    assert.equal(paladinLayOnHandsMaximum(level), expected, `Paladin Lay On Hands ${level}`);
  }
  for (const [level, expected] of [[0,0],[2,0],[3,2],[10,2],[11,3],[20,3]] as const) {
    assert.equal(paladinChannelDivinityMaximum(level), expected, `Paladin ${level}`);
  }
  for (const [level, expected] of [[0,0],[1,0],[2,2],[5,2],[6,3],[16,3],[17,4],[20,4]] as const) {
    assert.equal(druidWildShapeMaximum(level), expected, `Druid ${level}`);
  }
});

test("multiclass tracks materialize independent core class resource pools with their own recovery rules", () => {
  const definitions = coreClassResourceDefinitions([
    { classId:CLERIC_ID, className:"클레릭", level:6 },
    { classId:PALADIN_ID, className:"팔라딘", level:11 },
    { classId:DRUID_ID, className:"드루이드", level:17 },
  ]);
  const cleric = definitions.find((entry) => entry.resourceId === CLERIC_CHANNEL_DIVINITY_RESOURCE_ID);
  const layOnHands = definitions.find((entry) => entry.resourceId === PALADIN_LAY_ON_HANDS_RESOURCE_ID);
  const paladin = definitions.find((entry) => entry.resourceId === PALADIN_CHANNEL_DIVINITY_RESOURCE_ID);
  const druid = definitions.find((entry) => entry.resourceId === DRUID_WILD_SHAPE_RESOURCE_ID);
  assert.deepEqual({ maximum:cleric?.maximum, recovery:cleric?.recovery }, { maximum:3, recovery:{ shortRest:1, longRest:"all" } });
  assert.deepEqual({ maximum:layOnHands?.maximum, recovery:layOnHands?.recovery }, { maximum:55, recovery:{ longRest:"all" } });
  assert.deepEqual({ maximum:paladin?.maximum, recovery:paladin?.recovery }, { maximum:3, recovery:{ shortRest:1, longRest:"all" } });
  assert.deepEqual({ maximum:druid?.maximum, recovery:druid?.recovery }, { maximum:4, recovery:{ shortRest:1, longRest:"all" } });
  assert.match(cleric?.source ?? "", /클레릭 6레벨 · Channel Divinity/);
  assert.match(layOnHands?.source ?? "", /팔라딘 11레벨 · Lay On Hands/);
  assert.match(paladin?.source ?? "", /팔라딘 11레벨 · Channel Divinity/);
  assert.match(druid?.source ?? "", /드루이드 17레벨 · Wild Shape/);
});

test("generic ResourcePool recovery restores one Channel Divinity or Wild Shape use on Short Rest and all pools on Long Rest", () => {
  const definitions = coreClassResourceDefinitions([
    { classId:CLERIC_ID, className:"클레릭", level:6 },
    { classId:PALADIN_ID, className:"팔라딘", level:3 },
    { classId:DRUID_ID, className:"드루이드", level:6 },
  ]);
  const pools = definitions.map((definition) => ({
    id:definition.resourceId,
    label:definition.label,
    current:0,
    maximum:definition.maximum,
    recovery:definition.recovery,
  }));
  const shortRest = recoverResources(pools, "shortRest").next;
  assert.equal(shortRest.find((pool) => pool.id === CLERIC_CHANNEL_DIVINITY_RESOURCE_ID)?.current, 1);
  assert.equal(shortRest.find((pool) => pool.id === PALADIN_CHANNEL_DIVINITY_RESOURCE_ID)?.current, 1);
  assert.equal(shortRest.find((pool) => pool.id === DRUID_WILD_SHAPE_RESOURCE_ID)?.current, 1);
  assert.equal(shortRest.find((pool) => pool.id === PALADIN_LAY_ON_HANDS_RESOURCE_ID)?.current, 0, "Lay On Hands does not recover on Short Rest");
  const longRest = recoverResources(shortRest, "longRest").next;
  assert.equal(longRest.find((pool) => pool.id === CLERIC_CHANNEL_DIVINITY_RESOURCE_ID)?.current, 3);
  assert.equal(longRest.find((pool) => pool.id === PALADIN_CHANNEL_DIVINITY_RESOURCE_ID)?.current, 2);
  assert.equal(longRest.find((pool) => pool.id === PALADIN_LAY_ON_HANDS_RESOURCE_ID)?.current, 15);
  assert.equal(longRest.find((pool) => pool.id === DRUID_WILD_SHAPE_RESOURCE_ID)?.current, 3);
});
