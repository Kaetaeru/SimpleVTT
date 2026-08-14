import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/classFeatureSpellRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import {
  DRUID_ID,
  DRUID_NATURE_MAGICIAN_RESOURCE_ID,
  DRUID_WILD_SHAPE_RESOURCE_ID,
} from "../../src/domain/coreClassResources";

async function baselineAdapter() {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  return { adapter, internal:adapter as unknown as { activeCharacter:typeof baseline } };
}

test("Druid 20 projects the Archdruid Nature Magician Long-Rest gate without refilling spent state", async () => {
  const { adapter, internal } = await baselineAdapter();
  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"드루이드",
    level:20,
    classLevels:[{ classId:DRUID_ID, className:"드루이드", level:20 }],
    resources:[],
  };

  let snapshot = await adapter.getSnapshot();
  let resource = snapshot.activeCharacter.resources.find((entry) => entry.id === DRUID_NATURE_MAGICIAN_RESOURCE_ID);
  assert.deepEqual({ current:resource?.current, max:resource?.max, recovery:resource?.recovery },{
    current:1,
    max:1,
    recovery:{ longRest:"all" },
  });
  assert.match(resource?.source ?? "",/드루이드 20레벨 · Archdruid · Nature Magician/);
  assert.equal(snapshot.activeCharacter.resources.find((entry) => entry.id === DRUID_WILD_SHAPE_RESOURCE_ID)?.max,4);

  const internalResource = internal.activeCharacter.resources.find((entry) => entry.id === DRUID_NATURE_MAGICIAN_RESOURCE_ID);
  assert.ok(internalResource);
  internalResource.current = 0;
  snapshot = await adapter.getSnapshot();
  resource = snapshot.activeCharacter.resources.find((entry) => entry.id === DRUID_NATURE_MAGICIAN_RESOURCE_ID);
  assert.equal(resource?.current,0,"snapshot normalization must not restore a spent Nature Magician use");
});

test("Druid 19 does not project Nature Magician before Archdruid", async () => {
  const { adapter, internal } = await baselineAdapter();
  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"드루이드",
    level:19,
    classLevels:[{ classId:DRUID_ID, className:"드루이드", level:19 }],
    resources:[],
  };
  const snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.some((entry) => entry.id === DRUID_NATURE_MAGICIAN_RESOURCE_ID),false);
});
