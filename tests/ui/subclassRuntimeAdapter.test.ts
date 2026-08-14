import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/subclassRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { CLERIC_LIFE_DOMAIN_SUBCLASS_ID } from "../../src/domain/clericLifeDomain";
import { DRUID_CIRCLE_LAND_SUBCLASS_ID } from "../../src/domain/druidCircleLand";
import {
  DRUID_NATURAL_RECOVERY_CAST_RESOURCE_ID,
  DRUID_NATURAL_RECOVERY_SLOTS_RESOURCE_ID,
} from "../../src/domain/druidCircleLandRecovery";
import { FIGHTER_CHAMPION_SUBCLASS_ID } from "../../src/domain/fighterChampion";
import { classById } from "../../src/domain/progressionCatalog";

const CLERIC_ID = "dnd.srd521.class.cleric";
const DRUID_ID = "dnd.srd521.class.druid";
const FIGHTER_ID = "dnd.srd521.class.fighter";

async function baselineAdapter() {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  return { adapter, internal:adapter as unknown as { activeCharacter:typeof baseline } };
}

function srdSubclassName(classId:string) {
  const name = classById(classId)?.srdSubclassName;
  assert.ok(name,`missing SRD subclass name for ${classId}`);
  return name;
}

test("known SRD subclasses migrate from presentation names to stable IDs", async () => {
  const cases = [
    { classId:CLERIC_ID, className:"클레릭", subclassId:CLERIC_LIFE_DOMAIN_SUBCLASS_ID },
    { classId:DRUID_ID, className:"드루이드", subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID },
    { classId:FIGHTER_ID, className:"파이터", subclassId:FIGHTER_CHAMPION_SUBCLASS_ID },
  ];

  for (const entry of cases) {
    const { adapter, internal } = await baselineAdapter();
    internal.activeCharacter = {
      ...internal.activeCharacter,
      className:entry.className,
      subclassName:srdSubclassName(entry.classId),
      level:3,
      classLevels:[{
        classId:entry.classId,
        className:entry.className,
        level:3,
        subclassName:srdSubclassName(entry.classId),
      }],
      subclassIds:{},
      subclassSources:{},
    };
    const snapshot = await adapter.getSnapshot();
    assert.equal(snapshot.activeCharacter.subclassIds?.[entry.classId],entry.subclassId);
    assert.match(snapshot.activeCharacter.subclassSources?.[entry.classId] ?? "",/SRD 5\.2\.1/);
  }
});

test("unrecognized subclass presentation names are never coerced into an SRD stable ID", async () => {
  const { adapter, internal } = await baselineAdapter();
  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"드루이드",
    subclassName:"외부 모듈 서브클래스",
    level:6,
    classLevels:[{
      classId:DRUID_ID,
      className:"드루이드",
      level:6,
      subclassName:"외부 모듈 서브클래스",
    }],
    subclassIds:{},
    subclassSources:{},
    resources:[],
  };
  const snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.subclassIds?.[DRUID_ID],undefined);
  assert.equal(snapshot.activeCharacter.resources.some((entry) => entry.id === DRUID_NATURAL_RECOVERY_CAST_RESOURCE_ID),false);
  assert.equal(snapshot.activeCharacter.resources.some((entry) => entry.id === DRUID_NATURAL_RECOVERY_SLOTS_RESOURCE_ID),false);
});

test("Circle of the Land level 6 projects independent Natural Recovery Long-Rest resources without snapshot refill", async () => {
  const { adapter, internal } = await baselineAdapter();
  internal.activeCharacter = {
    ...internal.activeCharacter,
    className:"드루이드",
    subclassName:srdSubclassName(DRUID_ID),
    level:6,
    classLevels:[{
      classId:DRUID_ID,
      className:"드루이드",
      level:6,
      subclassName:srdSubclassName(DRUID_ID),
    }],
    subclassIds:{},
    subclassSources:{},
    resources:[],
  };

  let snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.subclassIds?.[DRUID_ID],DRUID_CIRCLE_LAND_SUBCLASS_ID);
  const cast = snapshot.activeCharacter.resources.find((entry) => entry.id === DRUID_NATURAL_RECOVERY_CAST_RESOURCE_ID);
  const slots = snapshot.activeCharacter.resources.find((entry) => entry.id === DRUID_NATURAL_RECOVERY_SLOTS_RESOURCE_ID);
  assert.deepEqual({ current:cast?.current, max:cast?.max, recovery:cast?.recovery },{
    current:1,
    max:1,
    recovery:{ longRest:"all" },
  });
  assert.deepEqual({ current:slots?.current, max:slots?.max, recovery:slots?.recovery },{
    current:1,
    max:1,
    recovery:{ longRest:"all" },
  });

  const internalCast = internal.activeCharacter.resources.find((entry) => entry.id === DRUID_NATURAL_RECOVERY_CAST_RESOURCE_ID);
  const internalSlots = internal.activeCharacter.resources.find((entry) => entry.id === DRUID_NATURAL_RECOVERY_SLOTS_RESOURCE_ID);
  assert.ok(internalCast && internalSlots);
  internalCast.current = 0;
  internalSlots.current = 0;

  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry) => entry.id === DRUID_NATURAL_RECOVERY_CAST_RESOURCE_ID)?.current,0);
  assert.equal(snapshot.activeCharacter.resources.find((entry) => entry.id === DRUID_NATURAL_RECOVERY_SLOTS_RESOURCE_ID)?.current,0);
});
