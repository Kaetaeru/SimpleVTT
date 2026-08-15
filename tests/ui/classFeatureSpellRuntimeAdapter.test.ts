import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/classFeatureSpellRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import {
  BARBARIAN_BERSERKER_SUBCLASS_ID,
  BARBARIAN_CLASS_ID,
  BARBARIAN_RAGE_RESOURCE_ID,
  BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID,
} from "../../src/domain/barbarianBerserker";
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
import {
  MONK_FOCUS_RESOURCE_ID,
  MONK_OPEN_HAND_CLASS_ID,
  OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID,
} from "../../src/domain/monkOpenHand";
import { MONK_OPEN_HAND_SUBCLASS_ID } from "../../src/domain/srdSubclassCatalog";

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

test("Berserker level 14 projects Rage plus one Long-Rest Intimidating Presence use without snapshot refills", async () => {
  const { adapter, internal } = await baselineAdapter();
  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"바바리안",
    subclassName:"광전사의 길",
    level:14,
    classLevels:[{ classId:BARBARIAN_CLASS_ID, className:"바바리안", level:14, subclassName:"광전사의 길" }],
    subclassIds:{ [BARBARIAN_CLASS_ID]:BARBARIAN_BERSERKER_SUBCLASS_ID },
    resources:[],
  };
  let snapshot = await adapter.getSnapshot();
  let rage = snapshot.activeCharacter.resources.find((resource) => resource.id === BARBARIAN_RAGE_RESOURCE_ID);
  let presence = snapshot.activeCharacter.resources.find((resource) => resource.id === BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID);
  assert.deepEqual({ current:rage?.current, max:rage?.max, recovery:rage?.recovery }, {
    current:5,
    max:5,
    recovery:{ shortRest:1, longRest:"all" },
  });
  assert.deepEqual({ current:presence?.current, max:presence?.max, recovery:presence?.recovery }, {
    current:1,
    max:1,
    recovery:{ longRest:"all" },
  });

  const internalRage = internal.activeCharacter.resources.find((resource) => resource.id === BARBARIAN_RAGE_RESOURCE_ID);
  const internalPresence = internal.activeCharacter.resources.find((resource) => resource.id === BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID);
  assert.ok(internalRage && internalPresence);
  internalRage!.current = 2;
  internalPresence!.current = 0;
  snapshot = await adapter.getSnapshot();
  rage = snapshot.activeCharacter.resources.find((resource) => resource.id === BARBARIAN_RAGE_RESOURCE_ID);
  presence = snapshot.activeCharacter.resources.find((resource) => resource.id === BERSERKER_INTIMIDATING_PRESENCE_RESOURCE_ID);
  assert.equal(rage?.current,2,"snapshot normalization must not refill spent Rage uses");
  assert.equal(presence?.current,0,"snapshot normalization must not refill spent Intimidating Presence");
});

test("Open Hand Monk projects the shared Focus pool plus Wisdom-based Wholeness of Body uses without snapshot refills", async () => {
  const { adapter, internal } = await baselineAdapter();
  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"수도승",
    subclassName:"열린 손의 전사",
    level:6,
    abilities:{ ...internal.activeCharacter.abilities, wis:18 },
    classLevels:[{ classId:MONK_OPEN_HAND_CLASS_ID, className:"수도승", level:6, subclassName:"열린 손의 전사" }],
    subclassIds:{ [MONK_OPEN_HAND_CLASS_ID]:MONK_OPEN_HAND_SUBCLASS_ID },
    resources:[],
  };
  let snapshot = await adapter.getSnapshot();
  let focus = snapshot.activeCharacter.resources.find((resource) => resource.id === MONK_FOCUS_RESOURCE_ID);
  let wholeness = snapshot.activeCharacter.resources.find((resource) => resource.id === OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID);
  assert.deepEqual({ current:focus?.current, max:focus?.max, recovery:focus?.recovery }, {
    current:6,
    max:6,
    recovery:{ shortRest:"all", longRest:"all" },
  });
  assert.deepEqual({ current:wholeness?.current, max:wholeness?.max, recovery:wholeness?.recovery }, {
    current:4,
    max:4,
    recovery:{ longRest:"all" },
  });

  const internalFocus = internal.activeCharacter.resources.find((resource) => resource.id === MONK_FOCUS_RESOURCE_ID);
  const internalWholeness = internal.activeCharacter.resources.find((resource) => resource.id === OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID);
  assert.ok(internalFocus && internalWholeness);
  internalFocus!.current = 2;
  internalWholeness!.current = 0;
  snapshot = await adapter.getSnapshot();
  focus = snapshot.activeCharacter.resources.find((resource) => resource.id === MONK_FOCUS_RESOURCE_ID);
  wholeness = snapshot.activeCharacter.resources.find((resource) => resource.id === OPEN_HAND_WHOLENESS_OF_BODY_RESOURCE_ID);
  assert.equal(focus?.current,2,"snapshot normalization must not refill spent Focus Points");
  assert.equal(wholeness?.current,0,"snapshot normalization must not refill spent Wholeness of Body uses");
});
