import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/classFeatureSpellRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import {
  CLERIC_CHANNEL_DIVINITY_RESOURCE_ID,
  CLERIC_ID,
  DRUID_ID,
  DRUID_WILD_RESURGENCE_LONG_REST_RESOURCE_ID,
  DRUID_WILD_RESURGENCE_TURN_RESOURCE_ID,
  DRUID_WILD_SHAPE_RESOURCE_ID,
  PALADIN_CHANNEL_DIVINITY_RESOURCE_ID,
  PALADIN_ID,
  PALADIN_LAY_ON_HANDS_RESOURCE_ID,
} from "../../src/domain/coreClassResources";

async function baselineAdapter() {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  return { adapter, internal:adapter as unknown as { activeCharacter:typeof baseline } };
}

test("Cleric Channel Divinity projection preserves spent uses and only raises capacity at the level-6 breakpoint", async () => {
  const { adapter, internal } = await baselineAdapter();
  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"클레릭",
    level:5,
    classLevels:[{ classId:CLERIC_ID, className:"클레릭", level:5 }],
    resources:[],
  };
  let snapshot = await adapter.getSnapshot();
  let resource = snapshot.activeCharacter.resources.find((entry) => entry.id === CLERIC_CHANNEL_DIVINITY_RESOURCE_ID);
  assert.deepEqual({ current:resource?.current, max:resource?.max, recovery:resource?.recovery }, {
    current:2,
    max:2,
    recovery:{ shortRest:1, longRest:"all" },
  });

  const internalResource = internal.activeCharacter.resources.find((entry) => entry.id === CLERIC_CHANNEL_DIVINITY_RESOURCE_ID);
  assert.ok(internalResource);
  internalResource!.current = 0;
  snapshot = await adapter.getSnapshot();
  resource = snapshot.activeCharacter.resources.find((entry) => entry.id === CLERIC_CHANNEL_DIVINITY_RESOURCE_ID);
  assert.equal(resource?.current, 0, "snapshot normalization must not restore spent Channel Divinity uses");

  internal.activeCharacter.level = 6;
  internal.activeCharacter.classLevels = [{ classId:CLERIC_ID, className:"클레릭", level:6 }];
  snapshot = await adapter.getSnapshot();
  resource = snapshot.activeCharacter.resources.find((entry) => entry.id === CLERIC_CHANNEL_DIVINITY_RESOURCE_ID);
  assert.equal(resource?.max, 3);
  assert.equal(resource?.current, 0, "capacity growth must not grant an implicit Channel Divinity use");
});

test("Paladin level 11 projects Channel Divinity and Lay On Hands with independent recovery and no snapshot refill", async () => {
  const { adapter, internal } = await baselineAdapter();
  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"팔라딘",
    level:11,
    classLevels:[{ classId:PALADIN_ID, className:"팔라딘", level:11 }],
    resources:[],
  };
  let snapshot = await adapter.getSnapshot();
  const channel = snapshot.activeCharacter.resources.find((entry) => entry.id === PALADIN_CHANNEL_DIVINITY_RESOURCE_ID);
  let layOnHands = snapshot.activeCharacter.resources.find((entry) => entry.id === PALADIN_LAY_ON_HANDS_RESOURCE_ID);
  assert.deepEqual({ current:channel?.current, max:channel?.max, recovery:channel?.recovery }, {
    current:3,
    max:3,
    recovery:{ shortRest:1, longRest:"all" },
  });
  assert.deepEqual({ current:layOnHands?.current, max:layOnHands?.max, recovery:layOnHands?.recovery }, {
    current:55,
    max:55,
    recovery:{ longRest:"all" },
  });
  assert.match(channel?.source ?? "", /팔라딘 11레벨 · Channel Divinity/);
  assert.match(layOnHands?.source ?? "", /팔라딘 11레벨 · Lay On Hands/);

  const internalLay = internal.activeCharacter.resources.find((entry) => entry.id === PALADIN_LAY_ON_HANDS_RESOURCE_ID);
  assert.ok(internalLay);
  internalLay!.current = 7;
  internal.activeCharacter.level = 12;
  internal.activeCharacter.classLevels = [{ classId:PALADIN_ID, className:"팔라딘", level:12 }];
  snapshot = await adapter.getSnapshot();
  layOnHands = snapshot.activeCharacter.resources.find((entry) => entry.id === PALADIN_LAY_ON_HANDS_RESOURCE_ID);
  assert.equal(layOnHands?.max, 60);
  assert.equal(layOnHands?.current, 7, "level-up capacity growth must not refill Lay On Hands");
});

test("Druid Wild Shape projection preserves spent uses while the level-17 capacity increases to four", async () => {
  const { adapter, internal } = await baselineAdapter();
  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"드루이드",
    level:16,
    classLevels:[{ classId:DRUID_ID, className:"드루이드", level:16 }],
    resources:[],
  };
  let snapshot = await adapter.getSnapshot();
  let resource = snapshot.activeCharacter.resources.find((entry) => entry.id === DRUID_WILD_SHAPE_RESOURCE_ID);
  assert.equal(resource?.current, 3);
  assert.equal(resource?.max, 3);
  assert.deepEqual(resource?.recovery, { shortRest:1, longRest:"all" });

  const internalResource = internal.activeCharacter.resources.find((entry) => entry.id === DRUID_WILD_SHAPE_RESOURCE_ID);
  assert.ok(internalResource);
  internalResource!.current = 1;
  internal.activeCharacter.level = 17;
  internal.activeCharacter.classLevels = [{ classId:DRUID_ID, className:"드루이드", level:17 }];
  snapshot = await adapter.getSnapshot();
  resource = snapshot.activeCharacter.resources.find((entry) => entry.id === DRUID_WILD_SHAPE_RESOURCE_ID);
  assert.equal(resource?.max, 4);
  assert.equal(resource?.current, 1, "level-17 capacity growth must not refill Wild Shape");
});

test("Druid level 5 projects independent turn and Long-Rest Wild Resurgence gates without snapshot refills", async () => {
  const { adapter, internal } = await baselineAdapter();
  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"드루이드",
    level:5,
    classLevels:[{ classId:DRUID_ID, className:"드루이드", level:5 }],
    resources:[],
  };
  let snapshot = await adapter.getSnapshot();
  const turnGate = snapshot.activeCharacter.resources.find((entry) => entry.id === DRUID_WILD_RESURGENCE_TURN_RESOURCE_ID);
  const longRestGate = snapshot.activeCharacter.resources.find((entry) => entry.id === DRUID_WILD_RESURGENCE_LONG_REST_RESOURCE_ID);
  assert.deepEqual({ current:turnGate?.current, max:turnGate?.max, recovery:turnGate?.recovery }, {
    current:1,
    max:1,
    recovery:{ turnStart:"all" },
  });
  assert.deepEqual({ current:longRestGate?.current, max:longRestGate?.max, recovery:longRestGate?.recovery }, {
    current:1,
    max:1,
    recovery:{ longRest:"all" },
  });

  const internalTurn = internal.activeCharacter.resources.find((entry) => entry.id === DRUID_WILD_RESURGENCE_TURN_RESOURCE_ID);
  const internalLong = internal.activeCharacter.resources.find((entry) => entry.id === DRUID_WILD_RESURGENCE_LONG_REST_RESOURCE_ID);
  assert.ok(internalTurn && internalLong);
  internalTurn!.current = 0;
  internalLong!.current = 0;
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry) => entry.id === DRUID_WILD_RESURGENCE_TURN_RESOURCE_ID)?.current, 0);
  assert.equal(snapshot.activeCharacter.resources.find((entry) => entry.id === DRUID_WILD_RESURGENCE_LONG_REST_RESOURCE_ID)?.current, 0);
});
