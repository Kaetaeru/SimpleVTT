import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/bardicInspirationRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { BARD_ID, BARDIC_INSPIRATION_RESOURCE_ID } from "../../src/domain/bardicInspiration";

async function adapterWithBard(level:number,charisma:number) {
  const adapter = new MockAdapter();
  const baseline = (await adapter.getSnapshot()).activeCharacter;
  const internal = adapter as unknown as { activeCharacter:typeof baseline };
  internal.activeCharacter = {
    ...baseline,
    className:"바드",
    level,
    abilities:{ ...baseline.abilities, cha:charisma },
    classLevels:[{ classId:BARD_ID, className:"바드", level }],
    resources:baseline.resources.filter((resource) => resource.id !== BARDIC_INSPIRATION_RESOURCE_ID),
  };
  return { adapter, internal };
}

test("Bardic Inspiration resource projects Charisma-modifier maximum and level-based rest recovery", async () => {
  const { adapter } = await adapterWithBard(4,18);
  const snapshot = await adapter.getSnapshot();
  const resource = snapshot.activeCharacter.resources.find((entry) => entry.id === BARDIC_INSPIRATION_RESOURCE_ID);
  assert.ok(resource);
  assert.equal(resource?.current,4);
  assert.equal(resource?.max,4);
  assert.deepEqual(resource?.recovery,{ longRest:"all" });
  assert.match(resource?.source ?? "",/바드 4레벨 · 바드의 영감/);
});

test("Font of Inspiration and Charisma growth update recovery/maximum without snapshot refill", async () => {
  const { adapter, internal } = await adapterWithBard(4,18);
  await adapter.getSnapshot();
  const stored = internal.activeCharacter.resources.find((entry) => entry.id === BARDIC_INSPIRATION_RESOURCE_ID)!;
  stored.current = 1;
  internal.activeCharacter.level = 5;
  internal.activeCharacter.classLevels = [{ classId:BARD_ID, className:"바드", level:5 }];
  internal.activeCharacter.abilities.cha = 20;

  const snapshot = await adapter.getSnapshot();
  const resource = snapshot.activeCharacter.resources.find((entry) => entry.id === BARDIC_INSPIRATION_RESOURCE_ID);
  assert.equal(resource?.current,1,"projection must not restore spent uses");
  assert.equal(resource?.max,5);
  assert.deepEqual(resource?.recovery,{ shortRest:"all", longRest:"all" });
});

test("negative Charisma still produces the SRD minimum one Bardic Inspiration use", async () => {
  const { adapter } = await adapterWithBard(1,6);
  const snapshot = await adapter.getSnapshot();
  const resource = snapshot.activeCharacter.resources.find((entry) => entry.id === BARDIC_INSPIRATION_RESOURCE_ID);
  assert.equal(resource?.current,1);
  assert.equal(resource?.max,1);
});
